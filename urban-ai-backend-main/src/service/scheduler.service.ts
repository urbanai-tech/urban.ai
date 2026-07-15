// src/maps/scheduler.service.ts

import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MapsService } from '../maps/maps.service';
import { User } from '../entities/user.entity';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';


@Injectable()
export class SchedulerService  {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly mapsService: MapsService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

 

  @Cron('0 0 10 * * 1'
, {
    name: 'mapsBatchJob',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async handleBatchForAllUsers() {
    return runScheduledJob(this.scheduledJobRunner, 'mapsBatchJob', async () => {
      this.logger.log('🔄 Iniciando batch automático (a cada minuto)');

      const users = await this.userRepo.find();
      for (const user of users) {
        const maxKm = user.distanceKm ?? 0;
        this.logger.log(` km do usuário ${user.distanceKm}`);
        this.logger.log(`→ Usuário ${user.id}: maxKm=${maxKm}`);
        try {

          this.logger.log(`   ✓ Batch concluído para ${user.id}`);
        } catch (err) {
          this.logger.error(`   ❌ Erro no batch do usuário ${user.id}:`, err);
        }
      }
    });
  }
}
