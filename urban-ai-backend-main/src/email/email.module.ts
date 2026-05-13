import { ProcessModule } from 'src/process/process.module';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
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
            AnaliseEnderecoEvento,
            EmailConfirmation,
            PasswordResetToken
        ]),
    ],
    controllers: [
        EmailController,],
    providers: [
        EmailService,],
        exports: [EmailService]
})
export class EmailModule { }
