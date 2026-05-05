import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Plan } from '../entities/plan.entity';

/**
 * StripeSyncCheckService — valida que os Stripe Price IDs configurados
 * (matriz F6.5: 2 planos × 4 ciclos = 8 IDs) existem na conta Stripe
 * e batem com o ciclo esperado.
 *
 * Sem essa validação, o time descobre que `quarterly` ou `semestral` não
 * funciona só quando o primeiro cliente tenta pagar. Esse service vira o
 * KPI "Stripe está OK?" do `/admin/pricing-config`.
 *
 * Uso: `GET /admin/stripe/sync-check` (admin only).
 */
type Cycle = 'monthly' | 'quarterly' | 'semestral' | 'annual';

export interface PriceStatusEntry {
  planName: string;
  cycle: Cycle;
  priceId: string | null;
  source: 'plan-entity' | 'env-fallback' | 'missing';
  status: 'ok' | 'missing' | 'not-found' | 'cycle-mismatch' | 'inactive' | 'currency-mismatch' | 'check-error';
  details?: string;
  // Dados do Stripe quando encontrado
  stripeAmountCents?: number;
  stripeCurrency?: string;
  stripeInterval?: string;
  stripeIntervalCount?: number;
  stripeActive?: boolean;
}

@Injectable()
export class StripeSyncCheckService {
  private readonly logger = new Logger(StripeSyncCheckService.name);
  private stripe: Stripe;

  // Intervalo Stripe esperado por ciclo F6.5 (interval × intervalCount)
  // Stripe não tem "semester" ou "quarter" nativos — usa month×3 e month×6.
  private readonly expectedInterval: Record<Cycle, { interval: string; count: number }> = {
    monthly: { interval: 'month', count: 1 },
    quarterly: { interval: 'month', count: 3 },
    semestral: { interval: 'month', count: 6 },
    annual: { interval: 'year', count: 1 },
  };

  constructor(@InjectRepository(Plan) private readonly planRepo: Repository<Plan>) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2025-08-27.basil',
    });
  }

  /**
   * Roda o check completo. Retorna lista de entries (8 esperados se 2 planos
   * ativos × 4 ciclos), agregando contadores no topo.
   *
   * Não falha se algum priceId der erro — cada entry tem seu status. O
   * caller decide como apresentar.
   */
  async check(): Promise<{
    summary: {
      total: number;
      ok: number;
      missing: number;
      problems: number;
      stripeKeyConfigured: boolean;
    };
    entries: PriceStatusEntry[];
  }> {
    const entries: PriceStatusEntry[] = [];
    const plans = await this.planRepo.find({ where: { isActive: true } });

    const stripeKeyConfigured = !!process.env.STRIPE_SECRET_KEY;
    if (!stripeKeyConfigured) {
      this.logger.warn('STRIPE_SECRET_KEY ausente — não é possível validar Price IDs');
    }

    const cycles: Cycle[] = ['monthly', 'quarterly', 'semestral', 'annual'];

    for (const plan of plans) {
      // Plano custom (ex: Escala "fale com consultor") não passa por checkout
      // padrão, então não esperamos Price IDs nele.
      if ((plan as any).isCustomPrice) continue;

      for (const cycle of cycles) {
        const { priceId, source } = this.resolveExpectedPriceId(plan, cycle);

        if (!priceId) {
          entries.push({
            planName: plan.name,
            cycle,
            priceId: null,
            source: 'missing',
            status: 'missing',
            details: 'Price ID não configurado em Plan.* nem em env vars',
          });
          continue;
        }

        if (!stripeKeyConfigured) {
          entries.push({
            planName: plan.name,
            cycle,
            priceId,
            source,
            status: 'check-error',
            details: 'STRIPE_SECRET_KEY ausente — pulando validação remota',
          });
          continue;
        }

        try {
          const price = await this.stripe.prices.retrieve(priceId);
          entries.push(this.evaluatePrice(plan.name, cycle, priceId, source, price));
        } catch (err: any) {
          const code = err?.code ?? err?.raw?.code;
          if (code === 'resource_missing') {
            entries.push({
              planName: plan.name,
              cycle,
              priceId,
              source,
              status: 'not-found',
              details: `Stripe não encontrou price ${priceId}`,
            });
          } else {
            entries.push({
              planName: plan.name,
              cycle,
              priceId,
              source,
              status: 'check-error',
              details: err?.message ?? 'Erro desconhecido ao consultar Stripe',
            });
          }
        }
      }
    }

    const ok = entries.filter((e) => e.status === 'ok').length;
    const missing = entries.filter((e) => e.status === 'missing').length;
    const problems = entries.filter((e) => !['ok', 'missing'].includes(e.status)).length;

    return {
      summary: {
        total: entries.length,
        ok,
        missing,
        problems,
        stripeKeyConfigured,
      },
      entries,
    };
  }

  /**
   * Mesma lógica do `PaymentsService.resolveStripePriceId` — duplicada de
   * propósito para evitar dependência circular. Mantenha as duas em sincro
   * (ou refatore para um helper compartilhado em iteração futura).
   */
  private resolveExpectedPriceId(
    plan: Plan,
    cycle: Cycle,
  ): { priceId: string | null; source: 'plan-entity' | 'env-fallback' | 'missing' } {
    const fromEntity = (() => {
      switch (cycle) {
        case 'monthly':
          return plan.stripePriceIdMonthly || plan.stripePriceId;
        case 'quarterly':
          return plan.stripePriceIdQuarterly;
        case 'semestral':
          return plan.stripePriceIdSemestral;
        case 'annual':
          return plan.stripePriceIdAnnualNew || plan.stripePriceIdAnnual;
      }
    })();

    if (fromEntity) return { priceId: fromEntity, source: 'plan-entity' };

    // Fallback env (legados)
    if (cycle === 'monthly' && process.env.MENSAL_PLAN) {
      return { priceId: process.env.MENSAL_PLAN, source: 'env-fallback' };
    }
    if (cycle === 'annual' && process.env.ANUAL_PLAN) {
      return { priceId: process.env.ANUAL_PLAN, source: 'env-fallback' };
    }

    return { priceId: null, source: 'missing' };
  }

  private evaluatePrice(
    planName: string,
    cycle: Cycle,
    priceId: string,
    source: PriceStatusEntry['source'],
    price: Stripe.Price,
  ): PriceStatusEntry {
    const expected = this.expectedInterval[cycle];
    const interval = price.recurring?.interval;
    const count = price.recurring?.interval_count ?? 1;

    const base: PriceStatusEntry = {
      planName,
      cycle,
      priceId,
      source,
      status: 'ok',
      stripeAmountCents: price.unit_amount ?? undefined,
      stripeCurrency: price.currency,
      stripeInterval: interval,
      stripeIntervalCount: count,
      stripeActive: price.active,
    };

    if (!price.active) {
      return { ...base, status: 'inactive', details: 'Price está marcado como inactive no Stripe' };
    }

    if (price.currency?.toLowerCase() !== 'brl') {
      return {
        ...base,
        status: 'currency-mismatch',
        details: `Currency Stripe=${price.currency}, esperado BRL`,
      };
    }

    if (!interval) {
      return {
        ...base,
        status: 'cycle-mismatch',
        details: 'Price não é recurring (deveria ser para assinatura)',
      };
    }

    if (interval !== expected.interval || count !== expected.count) {
      return {
        ...base,
        status: 'cycle-mismatch',
        details: `Stripe diz ${interval}×${count}, esperado ${expected.interval}×${expected.count} para ciclo ${cycle}`,
      };
    }

    return base;
  }
}
