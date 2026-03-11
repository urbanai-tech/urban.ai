import { MailerController } from './mailer.controller';
import { MailerService } from './mailer.service';
import { Module } from '@nestjs/common';

@Module({
    imports: [],
    controllers: [
        MailerController,],
    providers: [
        MailerService,],
        exports: [MailerService]
})
export class MailerModule { }
