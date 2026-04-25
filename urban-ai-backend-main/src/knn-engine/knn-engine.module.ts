import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../entities/addresses.entity';
import { UrbanAIPricingEngine } from './pricing-engine';
import { PropertyClassifier } from './knn-classifier';
import { TravelTimeEngine } from './isochrone';
import { DisplacementCostMatrix } from './cost-matrix';
import { PricingBootstrapService } from './pricing-bootstrap.service';
import { FeatureEngineeringService } from './feature-engineering.service';
import { PricingStrategyFactory } from './pricing-strategy.factory';
import { RuleBasedPricingStrategy } from './strategies/rule-based-pricing.strategy';
import { XGBoostPricingStrategy } from './strategies/xgboost-pricing.strategy';

/**
 * Módulo central do motor de pricing.
 *
 * Provê o engine atual (regras + multiplicadores) **e** os pontos de extensão
 * para evoluir até XGBoost / ensemble (ver ADR 0008).
 *
 * Quem precisa de uma `PricingStrategy` injeta o `PricingStrategyFactory` e
 * chama `.build()` no boot.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Address])],
  providers: [
    // Componentes nativos
    TravelTimeEngine,
    PropertyClassifier,
    DisplacementCostMatrix,
    UrbanAIPricingEngine,
    // Bootstrap + retreino + feature engineering
    PricingBootstrapService,
    FeatureEngineeringService,
    // Strategies plugáveis
    RuleBasedPricingStrategy,
    XGBoostPricingStrategy,
    PricingStrategyFactory,
  ],
  exports: [
    UrbanAIPricingEngine,
    TravelTimeEngine,
    PropertyClassifier,
    DisplacementCostMatrix,
    PricingStrategyFactory,
    RuleBasedPricingStrategy,
  ],
})
export class KnnEngineModule {}
