import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalisePreco } from '../entities/AnalisePreco';
import { Address } from '../entities/addresses.entity';
import { Payment } from '../entities/payment.entity';
import { Plan } from '../entities/plan.entity';
import { User } from '../entities/user.entity';
import { RoiService } from './roi.service';

@Module({
  imports: [TypeOrmModule.forFeature([AnalisePreco, Payment, Plan, User, Address])],
  providers: [RoiService],
  exports: [RoiService],
})
export class RoiModule {}
