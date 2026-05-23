import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { CommunicationsModule } from 'src/communications/communications.module';
import { PushDelivery } from 'src/entities/push-delivery.entity';
import { PushSubscription } from 'src/entities/push-subscription.entity';
import { User } from 'src/entities/user.entity';
import { PushController } from './push.controller';
import { PushNotificationService } from './push-notification.service';

@Module({
  imports: [
    AuthModule,
    CommunicationsModule,
    TypeOrmModule.forFeature([PushSubscription, PushDelivery, User]),
  ],
  controllers: [PushController],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class PushModule { }
