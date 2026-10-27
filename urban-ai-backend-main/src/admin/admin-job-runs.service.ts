import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminJobRun } from '../entities/admin-job-run.entity';
import { runAdminJobWithTracking } from '../admin-job-runs/admin-job-run-tracker';

/**
 * AdminJobRunsService — histórico e tracking dos jobs manuais disparados pelo
 * painel admin (`admin_job_runs`). Compartilhado pelos controllers admin.
 */
@Injectable()
export class AdminJobRunsService {
  constructor(
    @InjectRepository(AdminJobRun)
    private readonly jobRunRepo: Repository<AdminJobRun>,
  ) {}

  async listJobRuns(limit = 10, name?: string) {
    const take = Math.max(1, Math.min(50, Number(limit) || 10));
    return this.jobRunRepo.find({
      where: name ? { name } : {},
      order: { startedAt: 'DESC' },
      take,
    });
  }

  async runTrackedJob<T>(name: string, triggeredByUserId: string | null, handler: () => Promise<T>) {
    return runAdminJobWithTracking(this.jobRunRepo, name, triggeredByUserId, handler);
  }
}
