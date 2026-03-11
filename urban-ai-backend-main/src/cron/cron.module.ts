import { TypeOrmModule } from '@nestjs/typeorm';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';

import { Module } from '@nestjs/common';
import { Address } from 'src/entities/addresses.entity';
import { List } from 'src/entities/list.entity';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { User } from 'src/entities/user.entity';
import { AirbnbService } from 'src/airbnb/airbnb.service';
import { AirbnbModule } from 'src/airbnb/airbnb.module';
import { MailerModule } from 'src/mailer/mailer.module';
import { EmailService } from 'src/email/email.service';
import { EmailModule } from 'src/email/email.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
    imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([
            Address,
            Event,
            List,
            AnalisePreco,
            User,
            MailerModule
        ]), AirbnbModule, MailerModule, EmailModule],
    controllers: [
        CronController,],
    providers: [
        CronService,],
})
export class CronModule { }
