import { ProcessModule } from 'src/process/process.module';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { OnboardingDripService } from './onboarding-drip.service';
import { WeeklyEventReportService } from './weekly-event-report.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { Address } from 'src/entities/addresses.entity';
import { Event } from 'src/entities/events.entity';
import { Payment } from 'src/entities/payment.entity';
import { User } from 'src/entities/user.entity';
import { AdminJobRun } from 'src/entities/admin-job-run.entity';
import { EmailConfirmation } from 'src/entities/EmailConfirmation';
import { PasswordResetToken } from 'src/entities/password-reset-token.entity';
import { PricingRecommendationDigest } from 'src/entities/pricing-recommendation-digest.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { MailerModule } from 'src/mailer/mailer.module';
import { AuthModule } from 'src/auth/auth.module';
import { PushModule } from 'src/push/push.module';
import { PricingRecommendationDigestService } from './pricing-recommendation-digest.service';
import { CommunicationPreferencesModule } from 'src/communication-preferences/communication-preferences.module';

@Module({
    imports: [ProcessModule,
        AuthModule,
        MailerModule,
        NotificationsModule,
        PushModule,
        CommunicationPreferencesModule,
        TypeOrmModule.forFeature([
            Event,
            User,
            Address,
            AnalisePreco,
            AnaliseEnderecoEvento,
            EmailConfirmation,
            PasswordResetToken,
            PricingRecommendationDigest,
            Payment,
            AdminJobRun,
        ]),
    ],
    controllers: [
        EmailController,
    ],
    providers: [
        EmailService,
        PricingRecommendationDigestService,
        OnboardingDripService,
        WeeklyEventReportService,
    ],
    exports: [EmailService, OnboardingDripService, WeeklyEventReportService],
})
export class EmailModule { }
