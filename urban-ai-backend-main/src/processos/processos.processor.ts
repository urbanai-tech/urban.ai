import { OnQueueFailed, OnQueueStalled, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Job } from 'bull';
import { MapsService } from 'src/maps/maps.service';
import { recordQueuePermanentFailure, recordQueueRetry, recordQueueStalled } from './queue-failure-stats';

export const PROCESSOS_QUEUE = 'processos';

@Processor(PROCESSOS_QUEUE)
export class ProcessosConsumer {
  private readonly logger = new Logger(ProcessosConsumer.name);

  constructor(
    private readonly mapsService: MapsService,
  ) { }

  @Process()
  async handle(job: Job<{ userId: string, propertyAdressId: string }>) {
    const { userId, propertyAdressId } = job.data;

    this.logger.log(`Iniciando processamento para usuário ${userId}`);
    await this.analiseEnderecoPropriedadeByProperty(
      'processar-propriedades-eventos-by-user-andpropertyId',
      userId,
      propertyAdressId,
    );
  }

  private async analiseEnderecoPropriedadeByProperty(nome: string, userId: string, propertyAdressId: string) {
    this.logger.log(`Chamando rotina: ${nome}`);

    try {
      const analise = await this.mapsService.processarAnalisesByProperty(userId, propertyAdressId);
      this.logger.log(`Finalizada rotina ${nome}: ${JSON.stringify(analise)}`);
    } catch (erro) {
      this.logger.error(`Erro na rotina ${nome}`, erro instanceof Error ? erro.stack : String(erro));
      throw erro;
    }
  }

  @Process('processar-pricing')
  async handleEvento(job: Job<{ userId: string; propertyAdressId: string }>) {
    const { userId, propertyAdressId } = job.data;
    this.logger.log(`Iniciando processamento de pricing para property ${propertyAdressId}`);
    await this.analiseEnderecoPropriedadeByProperty(
      'processar-propriedades-eventos-by-user-andpropertyId',
      userId,
      propertyAdressId,
    );
    this.logger.log(`Finalizado processamento de pricing para property ${propertyAdressId}`);
  }

  /**
   * Chamado a cada tentativa que falha. Se ainda restam tentativas o Bull reagenda
   * com backoff (retry); na última tentativa a falha é PERMANENTE: loga com contexto,
   * conta (/health checks.queues) e captura no Sentry.
   */
  @OnQueueFailed()
  onFailed(job: Job<{ userId?: string; propertyAdressId?: string }>, error: Error) {
    const maxAttempts = job.opts?.attempts ?? 1;
    const attemptsMade = job.attemptsMade ?? 1;
    const context = {
      queue: PROCESSOS_QUEUE,
      jobId: String(job.id),
      jobName: job.name,
      attemptsMade,
      maxAttempts,
      userId: job.data?.userId,
      propertyAdressId: job.data?.propertyAdressId,
      failedReason: error?.message ?? job.failedReason,
    };

    if (attemptsMade < maxAttempts) {
      recordQueueRetry(PROCESSOS_QUEUE);
      this.logger.warn(`Job falhou, será reprocessado com backoff: ${JSON.stringify(context)}`);
      return;
    }

    recordQueuePermanentFailure(PROCESSOS_QUEUE, String(job.id), context.failedReason ?? 'unknown');
    this.logger.error(`Job falhou DEFINITIVAMENTE (sem mais tentativas): ${JSON.stringify(context)}`, error?.stack);
    Sentry.captureException(error, {
      level: 'error',
      tags: { component: 'bull-queue', queue: PROCESSOS_QUEUE, jobName: String(job.name) },
      extra: context,
    });
  }

  @OnQueueStalled()
  onStalled(job: Job) {
    recordQueueStalled(PROCESSOS_QUEUE);
    this.logger.warn(`Job travado (stalled) e será reenfileirado: queue=${PROCESSOS_QUEUE} jobId=${job.id} attemptsMade=${job.attemptsMade}`);
  }
}
