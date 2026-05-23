import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationEvent } from '../entities/communication-event.entity';
import { CommunicationLogService } from './communication-log.service';
import { CommunicationsController } from './communications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CommunicationEvent])],
  controllers: [CommunicationsController],
  providers: [CommunicationLogService],
  exports: [CommunicationLogService],
})
export class CommunicationsModule {}
