import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommunicationPreferencesModule } from '../communication-preferences/communication-preferences.module';
import { Address } from '../entities/addresses.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { OccupancyHistory } from '../entities/occupancy-history.entity';
import { OwnerReportLink } from '../entities/owner-report-link.entity';
import { OwnerReport } from '../entities/owner-report.entity';
import { PropertyOwnerProperty } from '../entities/property-owner-property.entity';
import { PropertyOwner } from '../entities/property-owner.entity';
import { User } from '../entities/user.entity';
import { MailerModule } from '../mailer/mailer.module';
import { OwnerReportDeliveryService } from './owner-report-delivery.service';
import { OwnerReportPublicController } from './owner-report-public.controller';
import { OwnerReportsService } from './owner-reports.service';
import { PropertyOwnersController } from './property-owners.controller';
import { PropertyOwnersService } from './property-owners.service';

/**
 * Relatório mensal para o proprietário (ADR 0027): cadastro de proprietários, relatório com
 * link seguro, envio mensal por e-mail, lembrete de fim de mês e retenção. AdminJobRuns e
 * Subscription são módulos globais (runner de jobs e EntitlementService).
 */
@Module({
  imports: [
    AuthModule,
    MailerModule,
    CommunicationPreferencesModule,
    TypeOrmModule.forFeature([
      Address,
      AnalisePreco,
      OccupancyHistory,
      OwnerReport,
      OwnerReportLink,
      PropertyOwner,
      PropertyOwnerProperty,
      User,
    ]),
  ],
  controllers: [PropertyOwnersController, OwnerReportPublicController],
  providers: [PropertyOwnersService, OwnerReportsService, OwnerReportDeliveryService],
  exports: [OwnerReportsService],
})
export class OwnerReportModule {}
