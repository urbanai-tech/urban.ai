import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from 'src/entities/payment.entity';
import { User } from 'src/entities/user.entity';

@Module({
  imports:[TypeOrmModule.forFeature([
          Payment,
          User,
      ]),],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService], // se quiser usar em outros módulos
})
export class PaymentsModule {}
