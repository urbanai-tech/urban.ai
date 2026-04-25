import { Injectable, Logger } from '@nestjs/common';
import {
  PricingInput,
  PricingStrategy,
  PriceSuggestion,
} from '../pricing-strategy.interface';

/**
 * Strategy "shadow mode": roda DUAS estratégias em paralelo. A `primary`
 * é a que de fato responde ao usuário; a `shadow` é executada também,
 * mas seu resultado é apenas logado para comparação posterior.
 *
 * É a forma segura de introduzir um novo algoritmo (XGBoost) sem afetar
 * a experiência do anfitrião. Quando MAPE da shadow ficar consistentemente
 * abaixo do alvo (≤15%, F6.1 Tier 3), promove para primary via env var
 * `PRICING_STRATEGY=xgboost`.
 *
 * Uso:
 *   new ShadowPricingStrategy({
 *     primary: ruleBased,
 *     shadow: xgboost,
 *     onShadowResult: (primary, shadow, input) => {
 *       // gravar em tabela `pricing_shadow_log` para análise
 *     }
 *   });
 */

interface ShadowOptions {
  primary: PricingStrategy;
  shadow: PricingStrategy;
  onShadowResult?: (
    primary: PriceSuggestion,
    shadow: PriceSuggestion,
    input: PricingInput,
  ) => void | Promise<void>;
}

@Injectable()
export class ShadowPricingStrategy implements PricingStrategy {
  public readonly name = 'shadow';
  private readonly logger = new Logger(ShadowPricingStrategy.name);

  constructor(private readonly options: ShadowOptions) {}

  isReady(): boolean {
    return this.options.primary.isReady();
  }

  async suggestPrice(input: PricingInput): Promise<PriceSuggestion> {
    const primaryPromise = this.options.primary.suggestPrice(input);

    let shadowPromise: Promise<PriceSuggestion> | null = null;
    if (this.options.shadow.isReady()) {
      // Shadow só roda se estiver pronta — evita exceção quando XGBoost
      // ainda não tem modelo carregado.
      shadowPromise = this.options.shadow.suggestPrice(input);
    }

    const primary = await primaryPromise;

    if (shadowPromise) {
      shadowPromise
        .then(async (shadow) => {
          const diffPct =
            primary.basePrice > 0
              ? ((shadow.suggestedPrice - primary.suggestedPrice) /
                  primary.suggestedPrice) *
                100
              : 0;

          this.logger.log(
            `[shadow] property=${input.property.id} primary=${this.options.primary.name}=${primary.suggestedPrice.toFixed(2)} ` +
              `shadow=${this.options.shadow.name}=${shadow.suggestedPrice.toFixed(2)} ` +
              `diff=${diffPct.toFixed(1)}%`,
          );

          if (this.options.onShadowResult) {
            try {
              await this.options.onShadowResult(primary, shadow, input);
            } catch (err) {
              this.logger.warn(
                `Erro no onShadowResult callback: ${(err as Error).message}`,
              );
            }
          }
        })
        .catch((err) => {
          this.logger.warn(
            `Shadow strategy '${this.options.shadow.name}' falhou: ${(err as Error).message}`,
          );
        });
    }

    return primary;
  }
}
