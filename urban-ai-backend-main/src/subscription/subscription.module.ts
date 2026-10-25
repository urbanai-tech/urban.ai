import { BullModule } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../entities/addresses.entity';
import { Notification } from '../entities/notification.entity';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import { MailerModule } from '../mailer/mailer.module';
import { EntitlementService } from './entitlement.service';
import { SubscriptionGuard } from './subscription.guard';
import { SubscriptionQuotaService } from './subscription-quota.service';

/**
 * Global de propósito: crons e serviços de vários módulos consultam o
 * EntitlementService sem precisar importar este módulo (e sem ciclos com Payments).
 * O guard é registrado como APP_GUARD aqui — a política de cada rota fica em
 * `subscription-policy.ts`.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Payment, Address, Notification]),
    MailerModule,
    BullModule.registerQueue({ name: 'processos' }),
  ],
  providers: [
    EntitlementService,
    SubscriptionQuotaService,
    { provide: APP_GUARD, useClass: SubscriptionGuard },
  ],
  exports: [EntitlementService, SubscriptionQuotaService],
})
export class SubscriptionModule {}
