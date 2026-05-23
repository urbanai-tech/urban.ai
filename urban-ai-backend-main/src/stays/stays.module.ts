import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaysAccount } from '../entities/stays-account.entity';
import { StaysListing } from '../entities/stays-listing.entity';
import { PriceUpdate } from '../entities/price-update.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { User } from '../entities/user.entity';
import { AdminJobRun } from '../entities/admin-job-run.entity';
import { PricingDecisionSnapshot } from '../entities/pricing-decision-snapshot.entity';
import { PricingCalculateService } from '../propriedades/pricing-calculate.service';
import { StaysConnector } from './stays-connector';
import { StaysService } from './stays.service';
import { StaysController } from './stays.controller';
import { StaysAutoApplyService } from './stays-auto-apply.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaysAccount,
      StaysListing,
      PriceUpdate,
      AnalisePreco,
      User,
      PricingDecisionSnapshot,
      AdminJobRun,
    ]),
  ],
  controllers: [StaysController],
  providers: [StaysConnector, StaysService, StaysAutoApplyService, PricingCalculateService],
  exports: [StaysService],
})
export class StaysModule {}
