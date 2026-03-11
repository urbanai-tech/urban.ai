import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationsService } from './notifications.service';
/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { Notification } from 'src/entities/notification.entity';
import { User } from 'src/entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([
        Notification,
        User,
    ]),],
    controllers: [NotificationController],
    providers: [
        NotificationsService,],
         exports:[NotificationsService]
})
export class NotificationsModule { }
