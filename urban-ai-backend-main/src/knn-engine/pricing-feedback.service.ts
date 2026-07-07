import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import * as Sentry from '@sentry/nestjs';
import { AnalisePreco } from '../entities/AnalisePreco';
import { calculateBacktest, meetsQualityGate } from './backtesting';

const WINDOW_DAYS = 90;
const MAPE_GATE = 15;
const MIN_SAMPLE_FOR_ALERT = 20;

/**
 * IA-2 (feedback loop) — recalcula o MAPE periodicamente e alerta.
 *
 * Fecha o loop de ground-truth: `recordAppliedPrice` grava `precoAplicado` no
 * `analise_preco`; este cron compara previsão (`precoSugerido`) vs realidade
 * (`precoAplicado`) numa janela de 90d e, se houver amostra suficiente e o MAPE
 * passar do gate (15%), captura um alerta no Sentry.
 *
 * Roda segunda 05:00 BRT. Em base sem dados aplicados, apenas loga "sem amostra".
 */
@Injectable()
export class PricingFeedbackService {
  private readonly logger = new Logger(PricingFeedbackService.name);

  constructor(
    @InjectRepository(AnalisePreco)
    private readonly analiseRepo: Repository<AnalisePreco>,
  ) {}

  @Cron('0 5 * * 1', { timeZone: 'America/Sao_Paulo' })
  async run(): Promise<{ sampleSize: number; mape: number | null; passes: boolean }> {
    const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.analiseRepo
      .createQueryBuilder('a')
      .select('a.precoSugerido', 'predicted')
      .addSelect('a.precoAplicado', 'actual')
      .where('a.precoAplicado IS NOT NULL')
      .andWhere('a.criadoEm >= :cutoff', { cutoff })
      .getRawMany();

    const pairs = rows
      .map((r) => ({ predicted: Number(r.predicted), actual: Number(r.actual) }))
      .filter((p) => Number.isFinite(p.predicted) && Number.isFinite(p.actual) && p.actual > 0);

    const gate = meetsQualityGate(pairs, MAPE_GATE);
    const mape = Number.isFinite(gate.mape) ? Math.round(gate.mape * 100) / 100 : null;

    if (gate.sampleSize < MIN_SAMPLE_FOR_ALERT) {
      this.logger.log(
        `Feedback de pricing: amostra insuficiente (${gate.sampleSize}/${MIN_SAMPLE_FOR_ALERT}). MAPE não confiável ainda.`,
      );
      return { sampleSize: gate.sampleSize, mape, passes: gate.passes };
    }

    const backtest = calculateBacktest(pairs);
    this.logger.log(
      `Feedback de pricing: MAPE=${mape}% RMSE=${backtest.rmse?.toFixed?.(2)} amostra=${gate.sampleSize} (gate ${MAPE_GATE}%)`,
    );

    if (!gate.passes) {
      Sentry.captureMessage('Pricing MAPE acima do gate de qualidade', {
        level: 'warning',
        tags: { component: 'pricing-feedback' },
        extra: { mape, gate: MAPE_GATE, sampleSize: gate.sampleSize, windowDays: WINDOW_DAYS },
      });
    }

    return { sampleSize: gate.sampleSize, mape, passes: gate.passes };
  }
}
