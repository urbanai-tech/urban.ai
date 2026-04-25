import { Injectable, Logger } from '@nestjs/common';
import { PricingStrategy } from './pricing-strategy.interface';
import { RuleBasedPricingStrategy } from './strategies/rule-based-pricing.strategy';
import { XGBoostPricingStrategy } from './strategies/xgboost-pricing.strategy';
import { ShadowPricingStrategy } from './strategies/shadow-pricing.strategy';

/**
 * Selector de PricingStrategy via env var `PRICING_STRATEGY`.
 *
 * Valores:
 *  - `rules` (default) — sempre usa regras + multiplicadores
 *  - `xgboost` — só XGBoost (precisa ter o modelo carregado)
 *  - `shadow` — primária = regras, sombra = XGBoost (loga, não usa)
 *  - `auto` — usa XGBoost se isReady(), senão regras
 *
 * Selector é executado uma vez no boot. Se quiser trocar em runtime, basta
 * redeployar com a env var nova — não precisa mexer em código.
 */
@Injectable()
export class PricingStrategyFactory {
  private readonly logger = new Logger(PricingStrategyFactory.name);

  constructor(
    private readonly rules: RuleBasedPricingStrategy,
    private readonly xgboost: XGBoostPricingStrategy,
  ) {}

  build(): PricingStrategy {
    const choice = (process.env.PRICING_STRATEGY || 'rules').toLowerCase();

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
          // TODO: persistir em tabela `pricing_shadow_log` quando F6.1 Tier 1 fechar.
          // Hoje só loga via logger do ShadowPricingStrategy.
        });

      case 'auto':
        if (this.xgboost.isReady()) {
          this.logger.log("PricingStrategy ativa: 'auto' → 'xgboost'");
          return this.xgboost;
        }
        this.logger.log("PricingStrategy ativa: 'auto' → 'rules' (xgboost not ready)");
        return this.rules;

      case 'rules':
      default:
        this.logger.log("PricingStrategy ativa: 'rules'");
        return this.rules;
    }
  }
}
