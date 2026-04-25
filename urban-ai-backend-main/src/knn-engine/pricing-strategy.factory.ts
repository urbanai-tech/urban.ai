import { Injectable, Logger } from '@nestjs/common';
import { PricingStrategy } from './pricing-strategy.interface';
import { RuleBasedPricingStrategy } from './strategies/rule-based-pricing.strategy';
import { XGBoostPricingStrategy } from './strategies/xgboost-pricing.strategy';
import { ShadowPricingStrategy } from './strategies/shadow-pricing.strategy';
import { AdaptivePricingStrategy } from './strategies/adaptive-pricing.strategy';

/**
 * Selector de PricingStrategy via env var `PRICING_STRATEGY`.
 *
 * Valores:
 *  - `adaptive` (default) — auto-tier: escolhe entre rules/xgboost/hybrid
 *    conforme o volume de dataset proprietário cresce. **É o caminho do
 *    moat**: o produto migra de algoritmo automaticamente sem deploy.
 *  - `rules` — força regras + multiplicadores (fallback eterno)
 *  - `xgboost` — força XGBoost (precisa ter modelo carregado)
 *  - `shadow` — primária = regras, sombra = XGBoost (loga, não usa)
 *  - `auto` — alias semântico de adaptive (compat)
 *
 * Default mudou de 'rules' para 'adaptive' nesta versão — o adaptive cai
 * em 'rules' enquanto dataset é insuficiente, então comportamento atual
 * em produção é idêntico. A diferença: assim que o dataset cresce, o
 * switch acontece sem precisar trocar env var ou redeployar.
 *
 * Para forçar fallback (ex.: incidente), trocar para 'rules' e redeployar.
 */
@Injectable()
export class PricingStrategyFactory {
  private readonly logger = new Logger(PricingStrategyFactory.name);

  constructor(
    private readonly rules: RuleBasedPricingStrategy,
    private readonly xgboost: XGBoostPricingStrategy,
    private readonly adaptive: AdaptivePricingStrategy,
  ) {}

  build(): PricingStrategy {
    const choice = (process.env.PRICING_STRATEGY || 'adaptive').toLowerCase();

    switch (choice) {
      case 'xgboost':
        if (!this.xgboost.isReady()) {
          this.logger.warn(
            "PRICING_STRATEGY=xgboost mas modelo não está carregado — caindo para 'rules'.",
          );
          return this.rules;
        }
        this.logger.log("PricingStrategy ativa: 'xgboost'");
        return this.xgboost;

      case 'shadow':
        this.logger.log(
          "PricingStrategy ativa: 'shadow' (primary=rules, shadow=xgboost)",
        );
        return new ShadowPricingStrategy({
          primary: this.rules,
          shadow: this.xgboost,
        });

      case 'rules':
        this.logger.log("PricingStrategy ativa: 'rules'");
        return this.rules;

      case 'adaptive':
      case 'auto':
      default:
        this.logger.log("PricingStrategy ativa: 'adaptive' (auto-tier)");
        return this.adaptive;
    }
  }
}
