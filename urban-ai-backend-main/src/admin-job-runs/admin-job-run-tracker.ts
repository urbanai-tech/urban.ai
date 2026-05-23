import { Repository } from 'typeorm';
import { AdminJobRun } from '../entities/admin-job-run.entity';

export type AdminJobRunStatus = 'running' | 'success' | 'error';

export type AdminJobRunResponse = {
  id: string;
  name: string;
  status: AdminJobRunStatus;
  triggeredByUserId: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  result: unknown | null;
  errorMessage: string | null;
};

export async function runAdminJobWithTracking<T>(
  jobRunRepo: Repository<AdminJobRun>,
  name: string,
  triggeredByUserId: string | null,
  handler: () => Promise<T>,
): Promise<AdminJobRunResponse> {
  const startedAt = new Date();
  const run = await jobRunRepo.save(
    jobRunRepo.create({
      name,
      status: 'running',
      triggeredByUserId,
      startedAt,
      finishedAt: null,
      durationMs: null,
      result: null,
      errorMessage: null,
    }),
  );

  try {
    const result = await handler();
    const finishedAt = new Date();
    const outcome = evaluateAdminJobOutcome(result);
    const saved = await jobRunRepo.save({
      ...run,
      status: outcome.status,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      result,
      errorMessage: outcome.errorMessage,
    });
    return toAdminJobRunResponse(saved);
  } catch (error: any) {
    const finishedAt = new Date();
    await jobRunRepo.save({
      ...run,
      status: 'error',
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      result: safeAdminJobErrorPayload(error),
      errorMessage: error?.message || 'Job failed',
    });
    throw error;
  }
}

export function evaluateAdminJobOutcome(result: any): {
  status: 'success' | 'error';
  errorMessage: string | null;
} {
  if (!result || typeof result !== 'object') {
    return { status: 'success', errorMessage: null };
  }

  if (result.ok === false) {
    return { status: 'error', errorMessage: result.errorMessage || result.message || 'Job reported ok=false' };
  }

  if (
    typeof result.attempted === 'number' &&
    result.attempted > 0 &&
    typeof result.failed === 'number' &&
    result.failed >= result.attempted &&
    Number(result.succeeded ?? 0) === 0
  ) {
    return {
      status: 'error',
      errorMessage: `Job failed all attempted items (${result.failed}/${result.attempted})`,
    };
  }

  if (typeof result.status === 'string') {
    const status = result.status.toLowerCase();
    if (status === 'failed' || status === 'error' || status.startsWith('blocked')) {
      return { status: 'error', errorMessage: result.errorMessage || result.message || result.status };
    }
  }

  return { status: 'success', errorMessage: null };
}

export function toAdminJobRunResponse(run: AdminJobRun): AdminJobRunResponse {
  return {
    id: run.id,
    name: run.name,
    status: run.status,
    triggeredByUserId: run.triggeredByUserId,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    durationMs: run.durationMs,
    result: run.result,
    errorMessage: run.errorMessage,
  };
}

export function safeAdminJobErrorPayload(error: any) {
  return {
    message: error?.message || 'Job failed',
    status: error?.status ?? error?.response?.statusCode ?? null,
    code: error?.code ?? error?.response?.code ?? null,
  };
}
