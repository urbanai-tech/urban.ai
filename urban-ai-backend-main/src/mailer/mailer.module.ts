import { MailerController } from './mailer.controller';
import { MailerService } from './mailer.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from 'src/auth/roles.guard';
import { User } from 'src/entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User])],
    controllers: [
        MailerController,],
    providers: [
        MailerService,
        RolesGuard,],
    exports: [MailerService]
})
export class MailerModule { }
