import { MailerController } from './mailer.controller';
import { MailerService } from './mailer.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from 'src/auth/roles.guard';
import { CommunicationsModule } from 'src/communications/communications.module';
import { User } from 'src/entities/user.entity';

@Module({
    imports: [CommunicationsModule, TypeOrmModule.forFeature([User])],
    controllers: [
        MailerController,],
    providers: [
        MailerService,
        RolesGuard,],
    exports: [MailerService]
})
export class MailerModule { }
