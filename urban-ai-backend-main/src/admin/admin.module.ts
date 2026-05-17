import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Address } from '../entities/addresses.entity';
import { List } from '../entities/list.entity';
import { Event } from '../entities/events.entity';
import { Payment } from '../entities/payment.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import { OccupancyHistory } from '../entities/occupancy-history.entity';
import { PriceUpdate } from '../entities/price-update.entity';
import { StaysAccount } from '../entities/stays-account.entity';
import { StaysListing } from '../entities/stays-listing.entity';
import { Plan } from '../entities/plan.entity';
import { PlatformCost } from '../entities/platform-cost.entity';
import { Waitlist } from '../entities/waitlist.entity';
import { CoverageRegion } from '../entities/coverage-region.entity';
import { AdminJobRun } from '../entities/admin-job-run.entity';
import { ContactSubmission } from '../entities/contact-submission.entity';
import { AdminService } from './admin.service';
import { AdminFinanceService } from './finance.service';
import { StripeSyncCheckService } from './stripe-sync.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { KnnEngineModule } from '../knn-engine/knn-engine.module';
import { EventoModule } from '../evento/evento.module';
import { MapsModule } from '../maps/maps.module';
import { RoiModule } from '../roi/roi.module';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Address,
      List,
      Event,
      Payment,
      AnalisePreco,
      PriceSnapshot,
      OccupancyHistory,
      PriceUpdate,
      StaysAccount,
      StaysListing,
      Plan,
      PlatformCost,
      Waitlist,
      CoverageRegion,
      AdminJobRun,
      ContactSubmission,
    ]),
    AuthModule,
    KnnEngineModule,
    EventoModule,
    MapsModule,
    RoiModule,
    AdminAuditModule,
    EmailModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminFinanceService, StripeSyncCheckService],
  exports: [AdminService, AdminFinanceService, StripeSyncCheckService],
})
export class AdminModule {}
