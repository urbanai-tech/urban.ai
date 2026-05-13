import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationsService } from './notifications.service';
/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { Notification } from 'src/entities/notification.entity';
import { User } from 'src/entities/user.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [AuthModule, TypeOrmModule.forFeature([
        Notification,
        User,
    ]),],
    controllers: [NotificationController],
    providers: [
        NotificationsService,],
         exports:[NotificationsService]
})
export class NotificationsModule { }
