import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../entities/addresses.entity';
import { List } from '../entities/list.entity';
import { EventProximityFeature } from '../entities/event-proximity-feature.entity';
import { OccupancyHistory } from '../entities/occupancy-history.entity';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import { PricingDecisionSnapshot } from '../entities/pricing-decision-snapshot.entity';
import { Event } from '../entities/events.entity';
import { AdminJobRun } from '../entities/admin-job-run.entity';
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
import { EventPricingIntelligenceService } from './event-pricing-intelligence.service';
import { PricingOutcomeLearningService } from './pricing-outcome-learning.service';
import { PricingFeedbackService } from './pricing-feedback.service';
import { VenueCapacityService } from './venue-capacity.service';
import { EventHistoricalService } from './event-historical.service';
import { EventHistoricalMultiplier } from '../entities/event-historical-multiplier.entity';
import { EventIdentityService } from '../evento/event-identity.service';
import { AnalisePreco } from '../entities/AnalisePreco';

/**
 * Módulo central do motor de pricing.
 *
 * Provê:
 *  - Engine atual (regras + multiplicadores) via UrbanAIPricingEngine
 *  - Strategy pattern plugável (rules / xgboost / shadow / adaptive)
 *  - Bootstrap + retreinamento periódico
 *  - Feature engineering (geocoding, metro distance, amenities)
 *  - **Dataset collector** — captura passiva diária para construir base própria
 *  - **AdaptivePricingStrategy** — auto-tier que muda de algoritmo conforme
 *    dataset cresce, sem precisar redeployar (caminho do moat)
 *
 * Ver `docs/adr/0008-pricing-algoritmo-evolucao.md` (KNN→XGBoost) e
 * `docs/adr/0009-modelo-neural-hibrido-moat.md` (Tier 4 aspiracional).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Address,
      List,
      PriceSnapshot,
      OccupancyHistory,
      EventProximityFeature,
      Event,
      PricingDecisionSnapshot,
      AdminJobRun,
      AnalisePreco,
      EventHistoricalMultiplier,
    ]),
  ],
  providers: [
    // Componentes nativos
    TravelTimeEngine,
    PropertyClassifier,
    DisplacementCostMatrix,
    UrbanAIPricingEngine,
    EventPricingIntelligenceService,
    // Bootstrap + retreinamento + feature engineering + dataset collection
    PricingBootstrapService,
    FeatureEngineeringService,
    DatasetCollectorService,
    PricingOutcomeLearningService,
    PricingFeedbackService,
    // Enriquecimento de venue (teto de capacidade p/ público)
    EventIdentityService,
    VenueCapacityService,
    EventHistoricalService,
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
    EventPricingIntelligenceService,
    PricingOutcomeLearningService,
    VenueCapacityService,
    EventHistoricalService,
  ],
})
export class KnnEngineModule {}
