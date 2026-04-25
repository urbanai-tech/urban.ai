import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../entities/addresses.entity';
import { List } from '../entities/list.entity';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import { UrbanAIPricingEngine } from './pricing-engine';
import { PropertyClassifier } from './knn-classifier';
import { TravelTimeEngine } from './isochrone';
import { DisplacementCostMatrix } from './cost-matrix';
import { PricingBootstrapService } from './pricing-bootstrap.service';
import { FeatureEngineeringService } from './feature-engineering.service';
import { DatasetCollectorService } from './dataset-collector.service';
import { PricingStrategyFactory } from './pricing-strategy.factory';
import { RuleBasedPricingStrategy } from './strategies/rule-based-pricing.strategy';
import { XGBoostPricingStrategy } from './strategies/xgboost-pricing.strategy';
import { AdaptivePricingStrategy } from './strategies/adaptive-pricing.strategy';

/**
 * Módulo central do motor de pricing.
 *
 * Provê:
 *  - Engine atual (regras + multiplicadores) via UrbanAIPricingEngine
 *  - Strategy pattern plugável (rules / xgboost / shadow / adaptive)
 *  - Bootstrap + retreino periódico
 *  - Feature engineering (geocoding, metro distance, amenities)
 *  - **Dataset collector** — captura passiva diária para construir base própria
 *  - **AdaptivePricingStrategy** — auto-tier que muda de algoritmo conforme
 *    dataset cresce, sem precisar redeployar (caminho do moat)
 *
 * Ver `docs/adr/0008-pricing-algoritmo-evolucao.md` (KNN→XGBoost) e
 * `docs/adr/0009-modelo-neural-hibrido-moat.md` (Tier 4 aspiracional).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Address, List, PriceSnapshot])],
  providers: [
    // Componentes nativos
    TravelTimeEngine,
    PropertyClassifier,
    DisplacementCostMatrix,
    UrbanAIPricingEngine,
    // Bootstrap + retreino + feature engineering + dataset collection
    PricingBootstrapService,
    FeatureEngineeringService,
    DatasetCollectorService,
    // Strategies plugáveis
    RuleBasedPricingStrategy,
    XGBoostPricingStrategy,
    AdaptivePricingStrategy,
    PricingStrategyFactory,
  ],
  exports: [
    UrbanAIPricingEngine,
    TravelTimeEngine,
    PropertyClassifier,
    DisplacementCostMatrix,
    PricingStrategyFactory,
    RuleBasedPricingStrategy,
    AdaptivePricingStrategy,
    DatasetCollectorService,
  ],
})
export class KnnEngineModule {}
