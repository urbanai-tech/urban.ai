import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from 'src/entities/payment.entity';
import { User } from 'src/entities/user.entity';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports:[
    TypeOrmModule.forFeature([
          Payment,
          User,
      ]),
    PlansModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService], // se quiser usar em outros módulos
})
export class PaymentsModule {}
