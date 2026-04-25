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
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { KnnEngineModule } from '../knn-engine/knn-engine.module';

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
    ]),
    AuthModule,        // RolesGuard precisa do TypeOrm de User; AuthModule já provê
    KnnEngineModule,   // AdaptivePricingStrategy + DatasetCollectorService
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
