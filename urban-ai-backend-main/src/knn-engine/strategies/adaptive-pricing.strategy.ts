import { Injectable, Logger } from '@nestjs/common';
import { DatasetCollectorService } from '../dataset-collector.service';
import {
  PricingInput,
  PricingStrategy,
  PriceSuggestion,
} from '../pricing-strategy.interface';
import { RuleBasedPricingStrategy } from './rule-based-pricing.strategy';
import { XGBoostPricingStrategy } from './xgboost-pricing.strategy';

/**
 * F6.1 — Adaptive (auto-tier) Pricing Strategy.
 *
 * Switch automático que escolhe o **melhor modelo disponível conforme o
 * volume de dataset proprietário cresce**. A ideia é simples e poderosa:
 * o produto começa com regras (Tier 0), passa por XGBoost (Tier 2–3) e
 * eventualmente migra para modelo neural híbrido (Tier 4 = moat) sem
 * mexer em produto, em UI ou em rotas.
 *
 * Decisão da estratégia ativa é refeita periodicamente (cada N minutos
 * de cache) consultando o `DatasetCollectorService.datasetSize()`. Quando
 * o dataset bate um threshold, a próxima predição já vai com o modelo
 * superior, sem deploy.
 *
 * Thresholds (alinhados com `docs/roadmap-pos-sprint.md` F6.1 Tiers):
 *
 *  - **Tier 0**: dataset proprietário < 500 imóveis × 30 dias OU XGBoost
 *    sem modelo carregado → usa **regras** (RuleBasedPricingStrategy).
 *  - **Tier 1–2**: dataset entre 500 listings × 30 dias e 5000 × 90 dias
 *    AND XGBoost.isReady() → usa **XGBoost** primário.
 *  - **Tier 3**: dataset > 5000 listings × 90 dias → continua XGBoost
 *    (Tier 3 é validação por MAPE, não troca de algoritmo).
 *  - **Tier 4 (moat)**: dataset > 10k listings × 12 meses E modelo
 *    híbrido carregado → usa **HybridNeuralPricingStrategy** (a criar
 *    quando chegar a hora — interface igual, plug-in trivial).
 *
 * Por que não simples env var? Porque o produto cresce assíncrono — o
 * cron de coleta enche o dataset mesmo quando ninguém deploya. Auto-tier
 * elimina a necessidade de "lembrar de virar o flag". E permite voltar
 * automaticamente para fallback se um modelo cair (degradação resiliente).
 *
 * Eventos de transição são logados para auditoria + alerta Sentry.
 */

interface AdaptiveDecision {
  strategy: PricingStrategy;
  tier: 'tier-0' | 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4';
  reason: string;
}

@Injectable()
export class AdaptivePricingStrategy implements PricingStrategy {
  public readonly name = 'adaptive';
  private readonly logger = new Logger(AdaptivePricingStrategy.name);

  /** Cache da última decisão para não bater em DB a cada predição. */
  private cached: AdaptiveDecision | null = null;
  private cachedAt = 0;
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 min

  /** Tier atual logado — só loga ao mudar (evita spam). */
  private lastLoggedTier: string | null = null;

  constructor(
    private readonly rules: RuleBasedPricingStrategy,
    private readonly xgboost: XGBoostPricingStrategy,
    private readonly collector: DatasetCollectorService,
    /**
     * Slot opcional para futura HybridNeuralPricingStrategy.
     * Quando o Tier 4 for implementado, basta injetar aqui — a lógica
     * `decide()` já considera.
     */
    private readonly hybrid: PricingStrategy | null = null,
  ) {}

  isReady(): boolean {
    // Adaptive sempre está pronta — pelo menos cai em RuleBased.
    return true;
  }

  async suggestPrice(input: PricingInput): Promise<PriceSuggestion> {
    const decision = await this.getDecision();
    const result = await decision.strategy.suggestPrice(input);
    return {
      ...result,
      details: {
        ...result.details,
        strategy: `${this.name}/${decision.tier}/${decision.strategy.name}`,
      },
    };
  }

  /**
   * Resolve qual estratégia usar agora. Cache de 5 min evita re-consulta
   * de DB a cada predição.
   */
  private async getDecision(): Promise<AdaptiveDecision> {
    if (this.cached && Date.now() - this.cachedAt < this.cacheTtlMs) {
      return this.cached;
    }

    const decision = await this.decide();
    this.cached = decision;
    this.cachedAt = Date.now();

    if (this.lastLoggedTier !== decision.tier) {
      this.logger.log(
        `Adaptive switch: tier=${decision.tier} strategy=${decision.strategy.name} reason="${decision.reason}"`,
      );
      this.lastLoggedTier = decision.tier;
    }

    return decision;
  }

  /**
   * Política de seleção. Ordem: top-down (modelo mais sofisticado primeiro);
   * cai para o próximo se o anterior não está pronto ou o dataset não atende
   * o threshold.
   */
  private async decide(): Promise<AdaptiveDecision> {
    const ds = await this.collector.datasetSize().catch(() => null);

    // Sem dataset coletor disponível ainda — sempre rules.
    if (!ds) {
      return {
        strategy: this.rules,
        tier: 'tier-0',
        reason: 'dataset metrics indisponíveis — fallback para regras',
      };
    }

    // ---- Tier 4 — modelo neural híbrido ----
    const tier4Ready =
      this.hybrid?.isReady() &&
      ds.distinctListings >= 10_000 &&
      ds.distinctDays >= 365;
    if (tier4Ready && this.hybrid) {
      return {
        strategy: this.hybrid,
        tier: 'tier-4',
        reason: `dataset=${ds.distinctListings}×${ds.distinctDays}d → moat tier`,
      };
    }

    // ---- Tier 2 / 3 — XGBoost ----
    const xgbReady =
      this.xgboost.isReady() &&
      ds.distinctListings >= 500 &&
      ds.distinctDays >= 30;
    if (xgbReady) {
      const isTier3 = ds.distinctListings >= 5000 && ds.distinctDays >= 90;
      return {
        strategy: this.xgboost,
        tier: isTier3 ? 'tier-3' : 'tier-2',
        reason: `dataset=${ds.distinctListings}×${ds.distinctDays}d → XGBoost`,
      };
    }

    // ---- Tier 1 — bootstrapping ----
    if (ds.distinctListings >= 100 && ds.distinctDays >= 7) {
      return {
        strategy: this.rules,
        tier: 'tier-1',
        reason: `dataset=${ds.distinctListings}×${ds.distinctDays}d, KNN treinado mas XGBoost ainda não pronto`,
      };
    }

    // ---- Tier 0 — fallback ----
    return {
      strategy: this.rules,
      tier: 'tier-0',
      reason: `dataset=${ds.distinctListings}×${ds.distinctDays}d (insuficiente) — regras`,
    };
  }

  /** Para testes / endpoint admin de diagnóstico. */
  async describeCurrentTier(): Promise<AdaptiveDecision & { datasetSize: any }> {
    const decision = await this.decide();
    const datasetSize = await this.collector.datasetSize();
    return { ...decision, datasetSize };
  }

  /** Limpa o cache — útil para forçar re-decisão em testes ou após import grande. */
  invalidateCache() {
    this.cached = null;
    this.cachedAt = 0;
  }
}
