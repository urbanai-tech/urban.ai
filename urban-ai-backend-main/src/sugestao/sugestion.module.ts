import { SugestionService } from './sugestion.service';
import { SugestionController } from './sugestion.controller';

import { Module } from '@nestjs/common';
import { User } from 'src/entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from 'src/entities/events.entity';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { Address } from 'src/entities/addresses.entity';
import { KnnEngineModule } from 'src/knn-engine/knn-engine.module';
import { PriceUpdate } from 'src/entities/price-update.entity';
import { AirbnbModule } from 'src/airbnb/airbnb.module';
import { PricingDecisionSnapshot } from 'src/entities/pricing-decision-snapshot.entity';
import { PricingCalculateService } from 'src/propriedades/pricing-calculate.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Event,
      AnalisePreco,
      Address,
      PriceUpdate,
      PricingDecisionSnapshot,
    ]),
    KnnEngineModule,
    AirbnbModule,
  ],
    controllers: [
        SugestionController,],
    providers: [
        SugestionService,
        PricingCalculateService,],
})
export class SugestionModule { }
