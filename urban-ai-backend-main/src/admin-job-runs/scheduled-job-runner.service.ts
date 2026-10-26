import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AdminJobRun } from '../entities/admin-job-run.entity';
import { runAdminJobWithTracking } from './admin-job-run-tracker';
import { LockOptions, RedisLockService } from '../common/redis-lock';

@Injectable()
export class ScheduledJobRunnerService {
  private readonly logger = new Logger(ScheduledJobRunnerService.name);
  private readonly activeWindowClaims = new Set<string>();

  constructor(
    @InjectRepository(AdminJobRun)
    private readonly jobRunRepo: Repository<AdminJobRun>,
    @Optional()
    private readonly redisLock?: RedisLockService,
  ) {}

  /**
   * Roda o job com lock distribuído em Redis (uma réplica por tick). Se o lock
   * está com outra réplica, ou o Redis falha (fail-closed), o job é PULADO e o
   * retorno é `undefined` — nenhuma linha em admin_job_runs é criada.
   * Sem RedisLockService (testes isolados) roda direto.
   */
  async run<T>(name: string, handler: () => Promise<T>, lockOptions?: LockOptions): Promise<T> {
    const tracked = async () => {
      const run = await runAdminJobWithTracking(this.jobRunRepo, name, null, handler);
      return run.result as T;
    };
    if (!this.redisLock) return tracked();
    const outcome = await this.redisLock.withLock(`job:${name}`, tracked, lockOptions);
    if (outcome.status === 'skipped') {
      this.logger.log(`[${name}] não executado neste tick (${outcome.reason}).`);
      return undefined as T;
    }
    return outcome.value;
  }

  async runOncePerWindow<T>(
    name: string,
    windowStart: Date,
    handler: () => Promise<T>,
    duplicateResult: () => T | Promise<T>,
  ): Promise<T> {
    const dataSource = this.jobRunRepo.manager?.connection;
    const databaseType = dataSource?.options?.type;
    if (databaseType !== 'mysql' && databaseType !== 'mariadb') {
      return this.runWithLocalWindowClaim(this.jobRunRepo, name, windowStart, handler, duplicateResult);
    }

    const queryRunner = dataSource.createQueryRunner();
    const claimKey = this.windowClaimKey(name, windowStart);
    await queryRunner.connect();
    try {
      const rows = await queryRunner.query('SELECT GET_LOCK(?, 0) AS acquired', [claimKey]);
      if (Number(rows?.[0]?.acquired) !== 1) return duplicateResult();

      try {
        const repository = queryRunner.manager.getRepository(AdminJobRun);
        return await this.runIfWindowIsPending(repository, name, windowStart, handler, duplicateResult);
      } finally {
        await queryRunner.query('SELECT RELEASE_LOCK(?) AS released', [claimKey]);
      }
    } finally {
      await queryRunner.release();
    }
  }

  private async runWithLocalWindowClaim<T>(
    repository: Repository<AdminJobRun>,
    name: string,
    windowStart: Date,
    handler: () => Promise<T>,
    duplicateResult: () => T | Promise<T>,
  ): Promise<T> {
    const claimKey = this.windowClaimKey(name, windowStart);
    if (this.activeWindowClaims.has(claimKey)) return duplicateResult();

    this.activeWindowClaims.add(claimKey);
    try {
      return await this.runIfWindowIsPending(repository, name, windowStart, handler, duplicateResult);
    } finally {
      this.activeWindowClaims.delete(claimKey);
    }
  }

  private async runIfWindowIsPending<T>(
    repository: Repository<AdminJobRun>,
    name: string,
    windowStart: Date,
    handler: () => Promise<T>,
    duplicateResult: () => T | Promise<T>,
  ): Promise<T> {
    const completed = await repository.findOne({
      where: {
        name,
        status: 'success',
        startedAt: MoreThanOrEqual(windowStart),
      },
      order: { startedAt: 'DESC' },
    });
    if (completed) return duplicateResult();

    const run = await runAdminJobWithTracking(repository, name, null, handler);
    return run.result as T;
  }

  private windowClaimKey(name: string, windowStart: Date): string {
    const digest = createHash('sha256')
      .update(`${name}:${windowStart.toISOString()}`)
      .digest('hex')
      .slice(0, 48);
    return `urban-cron:${digest}`;
  }
}

export function runScheduledJob<T>(
  runner: ScheduledJobRunnerService | undefined,
  name: string,
  handler: () => Promise<T>,
): Promise<T> {
  return runner ? runner.run(name, handler) : handler();
}

export function runScheduledJobOncePerWindow<T>(
  runner: ScheduledJobRunnerService | undefined,
  name: string,
  windowStart: Date,
  handler: () => Promise<T>,
  duplicateResult: () => T | Promise<T>,
): Promise<T> {
  return runner
    ? runner.runOncePerWindow(name, windowStart, handler, duplicateResult)
    : handler();
}
