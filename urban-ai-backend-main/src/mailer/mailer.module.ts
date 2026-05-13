import { MailerController } from './mailer.controller';
import { MailerService } from './mailer.service';
import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [
        MailerController,],
    providers: [
        MailerService,],
        exports: [MailerService]
})
export class MailerModule { }
