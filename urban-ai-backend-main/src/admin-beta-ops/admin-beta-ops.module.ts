import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { AuthModule } from '../auth/auth.module';
import { Address } from '../entities/addresses.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import { MailerModule } from '../mailer/mailer.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminBetaOpsController } from './admin-beta-ops.controller';
import { AdminBillingHostsService } from './admin-billing-hosts.service';
import { AdminOutcomesService } from './admin-outcomes.service';

/** Cobrança assistida e comparação v1 x v2 do beta pago. Só admin. */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Payment, Address, AnalisePreco]),
    AuthModule,
    AdminAuditModule,
    MailerModule,
    PaymentsModule,
  ],
  controllers: [AdminBetaOpsController],
  providers: [AdminBillingHostsService, AdminOutcomesService],
})
export class AdminBetaOpsModule {}
