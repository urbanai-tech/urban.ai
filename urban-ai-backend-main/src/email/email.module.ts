import { ProcessModule } from 'src/process/process.module';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnaliseEnderecoEvento } from 'src/entities/AnaliseEnderecoEvento.entity';
import { User } from 'src/entities/user.entity';
import { EmailConfirmation } from 'src/entities/EmailConfirmation';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { MailerModule } from 'src/mailer/mailer.module';

@Module({
    imports: [ProcessModule,
        MailerModule,
        NotificationsModule,
        TypeOrmModule.forFeature([
            Event,
            User,
            AnaliseEnderecoEvento,
            EmailConfirmation
        ]),
    ],
    controllers: [
        EmailController,],
    providers: [
        EmailService,],
        exports: [EmailService]
})
export class EmailModule { }
