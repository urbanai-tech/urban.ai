import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { CommunicationsModule } from 'src/communications/communications.module';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { EventAlertDispatch } from 'src/entities/event-alert-dispatch.entity';
import { PushDelivery } from 'src/entities/push-delivery.entity';
import { PushSubscription } from 'src/entities/push-subscription.entity';
import { User } from 'src/entities/user.entity';
import { UserCommunicationPreferences } from 'src/entities/user-communication-preferences.entity';
import { EventAlertPushService } from './event-alert-push.service';
import { PushController } from './push.controller';
import { PushDeferredDrainService } from './push-deferred-drain.service';
import { PushNotificationService } from './push-notification.service';

@Module({
  imports: [
    AuthModule,
    CommunicationsModule,
    TypeOrmModule.forFeature([
      PushSubscription,
      PushDelivery,
      User,
      UserCommunicationPreferences,
      AnalisePreco,
      EventAlertDispatch,
    ]),
  ],
  controllers: [PushController],
  providers: [PushNotificationService, PushDeferredDrainService, EventAlertPushService],
  exports: [PushNotificationService],
})
export class PushModule { }
