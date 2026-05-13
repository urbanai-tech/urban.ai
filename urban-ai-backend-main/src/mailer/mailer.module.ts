import { MailerController } from './mailer.controller';
import { MailerService } from './mailer.service';
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [forwardRef(() => AuthModule)],
    controllers: [
        MailerController,],
    providers: [
        MailerService,],
        exports: [MailerService]
})
export class MailerModule { }
