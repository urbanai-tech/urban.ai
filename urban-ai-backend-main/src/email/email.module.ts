import { ProcessModule } from 'src/process/process.module';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { OnboardingDripService } from './onboarding-drip.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { Address } from 'src/entities/addresses.entity';
import { Payment } from 'src/entities/payment.entity';
import { User } from 'src/entities/user.entity';
import { EmailConfirmation } from 'src/entities/EmailConfirmation';
import { PasswordResetToken } from 'src/entities/password-reset-token.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { MailerModule } from 'src/mailer/mailer.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [ProcessModule,
        AuthModule,
        MailerModule,
        NotificationsModule,
        TypeOrmModule.forFeature([
            Event,
            User,
            Address,
            AnalisePreco,
            AnaliseEnderecoEvento,
            EmailConfirmation,
            PasswordResetToken,
            Payment,
        ]),
    ],
    controllers: [
        EmailController,
    ],
    providers: [
        EmailService,
        OnboardingDripService,
    ],
    exports: [EmailService, OnboardingDripService],
})
export class EmailModule { }
