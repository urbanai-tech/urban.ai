import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../entities/addresses.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { EventIntelligenceSnapshot } from '../entities/event-intelligence-snapshot.entity';
import { EventPropertyImpact } from '../entities/event-property-impact.entity';
import { Event } from '../entities/events.entity';
import { PricingDecisionSnapshot } from '../entities/pricing-decision-snapshot.entity';
import { EventPricingIntelligenceService } from '../knn-engine/event-pricing-intelligence.service';
import { PricingCalculateService } from '../propriedades/pricing-calculate.service';
import { EventIntelligenceService } from './event-intelligence.service';
import { EventHeatmapProjectionService } from './event-heatmap-projection.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Address,
      AnalisePreco,
      Event,
      EventIntelligenceSnapshot,
      EventPropertyImpact,
      PricingDecisionSnapshot,
    ]),
  ],
  providers: [
    EventPricingIntelligenceService,
    PricingCalculateService,
    EventHeatmapProjectionService,
    EventIntelligenceService,
  ],
  exports: [EventIntelligenceService],
})
export class EventIntelligenceModule {}
