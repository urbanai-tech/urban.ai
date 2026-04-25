import { Injectable } from '@nestjs/common';
import { UrbanAIPricingEngine } from '../pricing-engine';
import {
  PricingInput,
  PricingStrategy,
  PriceSuggestion,
} from '../pricing-strategy.interface';

/**
 * Strategy que envolve o motor de regras + multiplicadores existente
 * (`UrbanAIPricingEngine`). É o caminho atual e o **fallback eterno**: mesmo
 * quando XGBoost ou modelos mais avançados estiverem em produção, este
 * continua sendo a rede de segurança quando o ML não está pronto, dataset
 * é insuficiente ou a inferência falha.
 *
 * Está sempre pronta — não exige dataset.
 */
@Injectable()
export class RuleBasedPricingStrategy implements PricingStrategy {
  public readonly name = 'rules';

  constructor(private readonly engine: UrbanAIPricingEngine) {}

  isReady(): boolean {
    return true;
  }

  async suggestPrice(input: PricingInput): Promise<PriceSuggestion> {
    const result = await this.engine.suggestPrice(
      input.property,
      input.event,
      input.basePrice,
    );

    return {
      ...result,
      details: {
        ...result.details,
        strategy: this.name,
      },
    };
  }
}
