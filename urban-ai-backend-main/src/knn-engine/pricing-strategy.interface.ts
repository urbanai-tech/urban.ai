/**
 * Contrato comum para qualquer motor de pricing.
 *
 * Hoje temos `RuleBasedPricingStrategy` (multiplicadores fixos) implementado
 * via `UrbanAIPricingEngine`. O caminho de evolução (ADR 0008) prevê:
 *  - Tier 1: XGBoost shadow mode (`ShadowPricingStrategy` envolve dois)
 *  - Tier 2: XGBoost primário
 *  - Tier 3+: ensemble com features geo/temporal enriquecidas
 *
 * Toda estratégia precisa implementar esta interface para poder ser
 * trocada via env var `PRICING_STRATEGY`.
 */

import type { PricingContextV2, PricingDriver } from './pricing-engine-v2';

export interface PricingInput {
  property: {
    id: string;
    lat: number;
    lng: number;
    metroDistance?: number;
    amenitiesCount?: number;
    category?: number; // 0=Econômico, 1=Standard, 2=Premium
    [key: string]: unknown;
  };
  event: {
    id?: string;
    name?: string;
    nome?: string;
    lat: number;
    lng: number;
    relevancia?: number;
    dataInicio?: Date | string;
    [key: string]: unknown;
  };
  basePrice: number;
  /** Contexto da noite (data, regras, ocupação, guardrail) — usado pelo motor v2. */
  context?: PricingContextV2;
}

export interface PriceSuggestion {
  propertyId: string;
  eventName: string;
  basePrice: number;
  suggestedPrice: number;
  increasePercentage: number;
  details: {
    classification?: string;
    attractivity?: string;
    travelTimeMinutes?: number;
    eventAIRelevance?: number | null;
    reasoning: string;
    /** Tag da estratégia que produziu este resultado — útil para A/B logging */
    strategy?: string;
    /** Versão do motor que gerou o número ('pricing-engine-v1' | 'pricing-engine-v2.x'). */
    engineVersion?: string;
    /** Multiplicador final aplicado sobre basePrice. */
    multiplier?: number;
    /** O que aplicou, quanto e por quê — compatível com PricingDecisionSnapshot.drivers. */
    drivers?: PricingDriver[];
    guardrail?: Record<string, unknown>;
    /** Resultado do v2 calculado em sombra quando PRICING_ENGINE_V2=shadow. */
    shadowV2?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface PricingStrategy {
  /** Nome curto e único, p/ logs e flag de seleção. Ex: 'rules', 'xgboost'. */
  readonly name: string;

  /**
   * Está pronta para servir predições? Ex: XGBoost só fica `true` quando
   * o modelo foi carregado; regras estão sempre `true`.
   */
  isReady(): boolean;

  /**
   * Sugere preço para um par (imóvel, evento) com preço base.
   */
  suggestPrice(input: PricingInput): Promise<PriceSuggestion>;
}
