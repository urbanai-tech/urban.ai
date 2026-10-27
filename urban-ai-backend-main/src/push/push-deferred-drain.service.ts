import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';
import { DeferredDrainResult, PushNotificationService } from './push-notification.service';

/**
 * Envia os pushes que o horário de silêncio (22h-8h, São Paulo) adiou.
 *
 * Roda de hora em hora entre 08:00 e 12:00 BRT: o primeiro tick (08:00) entrega tudo; os demais
 * só recolhem o que falhou ou ficou para trás (réplica fora do ar às 08:00). Seguro para repetir:
 * cada entrega é reivindicada por UPDATE condicional e o runner usa o lock Redis, então duas
 * réplicas nunca enviam o mesmo push.
 */
@Injectable()
export class PushDeferredDrainService {
  private readonly logger = new Logger(PushDeferredDrainService.name);

  constructor(
    private readonly pushService: PushNotificationService,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

  @Cron('0 8-12 * * *', {
    name: 'push-deferred-drain',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async drain(): Promise<DeferredDrainResult | undefined> {
    return runScheduledJob(this.scheduledJobRunner, 'push-deferred-drain', async () => {
      const result = await this.pushService.drainDeferred(new Date());
      if (result.due > 0) this.logger.log(`[push-deferred-drain] ${JSON.stringify(result)}`);
      return result;
    });
  }
}
