// src/maps/maps.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MapsService } from './maps.service';
import { SchedulerService } from '../service/scheduler.service'; // 👈 Importe o Scheduler
import { MapsController } from './maps.controller';

import { Event } from '../entities/events.entity';
import { Address } from '../entities/addresses.entity';
import { AnaliseEnderecoEvento } from '../entities/AnaliseEnderecoEvento.entity';
import { User } from '../entities/user.entity';
import { ProcessStatus } from 'src/entities/processStatus.entity';
import { ProcessService } from 'src/process/process.service';
import { ProcessModule } from 'src/process/process.module';
import { EmailModule } from 'src/email/email.module';
import { PropriedadeModule } from 'src/propriedades/propriedade.module';

@Module({
  imports: [
    ProcessModule,
    ScheduleModule,
    PropriedadeModule,
    EmailModule,
    TypeOrmModule.forFeature([
      Event,
      Address,
      AnaliseEnderecoEvento,
      User,
    ]),
  ],
  providers: [
    MapsService,
    SchedulerService, // 👈 Adicione como provider
  ],
  controllers: [MapsController],
  exports: [MapsService],
})
export class MapsModule {}