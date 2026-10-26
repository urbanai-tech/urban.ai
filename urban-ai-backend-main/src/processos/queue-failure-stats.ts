/**
 * Contador em memória (por réplica) das falhas de fila Bull, exposto em
 * `/health` (checks.queues) para um monitor externo alertar. Não é fonte de
 * verdade: zera no restart; o log estruturado + Sentry são o registro durável.
 */
export type QueueFailureSnapshot = {
  retried: number;
  permanentlyFailed: number;
  stalled: number;
  lastPermanentFailureAt: string | null;
  lastPermanentFailure: { queue: string; jobId: string; reason: string } | null;
};

const stats: Record<string, QueueFailureSnapshot> = {};

function entry(queue: string): QueueFailureSnapshot {
  return (stats[queue] ??= {
    retried: 0,
    permanentlyFailed: 0,
    stalled: 0,
    lastPermanentFailureAt: null,
    lastPermanentFailure: null,
  });
}

export function recordQueueRetry(queue: string): void {
  entry(queue).retried += 1;
}

export function recordQueueStalled(queue: string): void {
  entry(queue).stalled += 1;
}

export function recordQueuePermanentFailure(queue: string, jobId: string, reason: string, now = new Date()): void {
  const e = entry(queue);
  e.permanentlyFailed += 1;
  e.lastPermanentFailureAt = now.toISOString();
  e.lastPermanentFailure = { queue, jobId, reason: reason.slice(0, 300) };
}

export function getQueueFailureSnapshot(): Record<string, QueueFailureSnapshot> {
  return JSON.parse(JSON.stringify(stats));
}

export function resetQueueFailureStats(): void {
  for (const key of Object.keys(stats)) delete stats[key];
}
