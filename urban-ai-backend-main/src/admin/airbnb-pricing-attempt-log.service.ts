import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import {
  AirbnbPricingAttemptLog,
  AirbnbPricingAttemptStatus,
} from '../entities/airbnb-pricing-attempt-log.entity';

const SUCCESS_STATUSES = ['success', 'ok'];
const FAILURE_STATUSES = [
  'failed',
  'failure',
  'error',
  'timeout',
  'blocked',
  'unavailable',
  'not_available',
  'no_price',
];
const PENDING_STATUSES = ['pending', 'running', 'queued'];

export interface RecordAirbnbPricingAttemptInput {
  listingId: string;
  userId?: string | null;
  listId?: string | null;
  addressId?: string | null;
  checkIn: string;
  checkOut: string;
  source?: string | null;
  status?: AirbnbPricingAttemptStatus | null;
  reason?: string | null;
  durationMs?: number | null;
  priceTotal?: number | string | null;
  dailyPrice?: number | string | null;
  currency?: string | null;
  finalUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
}

@Injectable()
export class AirbnbPricingAttemptLogService {
  constructor(
    @InjectRepository(AirbnbPricingAttemptLog)
    private readonly attemptRepo: Repository<AirbnbPricingAttemptLog>,
  ) {}

  async recordAttempt(input: RecordAirbnbPricingAttemptInput) {
    const attempt = this.attemptRepo.create({
      listingId: input.listingId,
      userId: input.userId ?? null,
      listId: input.listId ?? null,
      addressId: input.addressId ?? null,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      source: this.truncate(input.source || 'airbnb_headless', 64) || 'airbnb_headless',
      status: input.status || 'pending',
      reason: this.truncate(input.reason, 255),
      durationMs: this.nonNegativeIntOrNull(input.durationMs),
      priceTotal: this.moneyOrNull(input.priceTotal),
      dailyPrice: this.moneyOrNull(input.dailyPrice),
      currency: this.truncate((input.currency || 'BRL').toUpperCase(), 3) || 'BRL',
      finalUrl: input.finalUrl ?? null,
      metadata: input.metadata ?? null,
      startedAt: this.dateOrUndefined(input.startedAt),
      finishedAt: this.dateOrNull(input.finishedAt),
    });

    return this.attemptRepo.save(attempt);
  }

  async health(windowHours = 24) {
    const now = new Date();
    const safeWindowHours = Math.max(1, Math.min(24 * 30, Number(windowHours) || 24));
    const windowStart = new Date(now.getTime() - safeWindowHours * 60 * 60 * 1000);
    const staleBefore = new Date(now.getTime() - 30 * 60 * 1000);

    try {
      const [summaryRow, failuresByReasonRows, sourceRows, openPending, stalePending, recent] =
        await Promise.all([
          this.summaryRow(windowStart),
          this.failuresByReason(windowStart),
          this.sourcesSummary(windowStart),
          this.attemptRepo.count({ where: { status: In(PENDING_STATUSES) } as any }),
          this.attemptRepo.count({
            where: { status: In(PENDING_STATUSES), startedAt: LessThan(staleBefore) } as any,
          }),
          this.attemptRepo.find({
            order: { startedAt: 'DESC' },
            take: 10,
          }),
        ]);

      const summary = {
        total: this.number(summaryRow?.total),
        successes: this.number(summaryRow?.successes),
        failures: this.number(summaryRow?.failures),
        pending: this.number(summaryRow?.pending),
        openPending,
        stalePending,
        avgDurationMs: this.roundOrNull(summaryRow?.avgDurationMs),
        latestAttemptAt: this.toIsoOrNull(summaryRow?.latestAttemptAt),
      };

      return {
        generatedAt: now.toISOString(),
        windowHours: safeWindowHours,
        health: this.healthStatus(summary),
        schema: { available: true, error: null },
        summary,
        failuresByReason: failuresByReasonRows.map((row: any) => ({
          reason: String(row.reason || 'unknown'),
          count: this.number(row.count),
          avgDurationMs: this.roundOrNull(row.avgDurationMs),
          lastSeenAt: this.toIsoOrNull(row.lastSeenAt),
        })),
        sources: sourceRows.map((row: any) => ({
          source: String(row.source || 'unknown'),
          total: this.number(row.total),
          successes: this.number(row.successes),
          failures: this.number(row.failures),
          pending: this.number(row.pending),
          avgDurationMs: this.roundOrNull(row.avgDurationMs),
          latestAttemptAt: this.toIsoOrNull(row.latestAttemptAt),
        })),
        recent: recent.map((attempt) => this.toAdminRow(attempt)),
      };
    } catch (error) {
      return {
        generatedAt: now.toISOString(),
        windowHours: safeWindowHours,
        health: 'red' as const,
        schema: { available: false, error: this.errorMessage(error) },
        summary: {
          total: 0,
          successes: 0,
          failures: 0,
          pending: 0,
          openPending: 0,
          stalePending: 0,
          avgDurationMs: null,
          latestAttemptAt: null,
        },
        failuresByReason: [],
        sources: [],
        recent: [],
      };
    }
  }

  private summaryRow(windowStart: Date) {
    return this.attemptRepo
      .createQueryBuilder('attempt')
      .select('COUNT(*)', 'total')
      .addSelect(
        'SUM(CASE WHEN attempt.status IN (:...successStatuses) THEN 1 ELSE 0 END)',
        'successes',
      )
      .addSelect(
        'SUM(CASE WHEN attempt.status IN (:...failureStatuses) THEN 1 ELSE 0 END)',
        'failures',
      )
      .addSelect(
        'SUM(CASE WHEN attempt.status IN (:...pendingStatuses) THEN 1 ELSE 0 END)',
        'pending',
      )
      .addSelect('AVG(attempt.durationMs)', 'avgDurationMs')
      .addSelect('MAX(attempt.startedAt)', 'latestAttemptAt')
      .where('attempt.startedAt >= :windowStart', { windowStart })
      .setParameters({
        successStatuses: SUCCESS_STATUSES,
        failureStatuses: FAILURE_STATUSES,
        pendingStatuses: PENDING_STATUSES,
      })
      .getRawOne();
  }

  private failuresByReason(windowStart: Date) {
    const reasonExpression = "COALESCE(NULLIF(attempt.reason, ''), attempt.status, 'unknown')";
    return this.attemptRepo
      .createQueryBuilder('attempt')
      .select(reasonExpression, 'reason')
      .addSelect('COUNT(*)', 'count')
      .addSelect('AVG(attempt.durationMs)', 'avgDurationMs')
      .addSelect('MAX(attempt.startedAt)', 'lastSeenAt')
      .where('attempt.startedAt >= :windowStart', { windowStart })
      .andWhere('attempt.status IN (:...failureStatuses)', {
        failureStatuses: FAILURE_STATUSES,
      })
      .groupBy(reasonExpression)
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany();
  }

  private sourcesSummary(windowStart: Date) {
    return this.attemptRepo
      .createQueryBuilder('attempt')
      .select('attempt.source', 'source')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        'SUM(CASE WHEN attempt.status IN (:...successStatuses) THEN 1 ELSE 0 END)',
        'successes',
      )
      .addSelect(
        'SUM(CASE WHEN attempt.status IN (:...failureStatuses) THEN 1 ELSE 0 END)',
        'failures',
      )
      .addSelect(
        'SUM(CASE WHEN attempt.status IN (:...pendingStatuses) THEN 1 ELSE 0 END)',
        'pending',
      )
      .addSelect('AVG(attempt.durationMs)', 'avgDurationMs')
      .addSelect('MAX(attempt.startedAt)', 'latestAttemptAt')
      .where('attempt.startedAt >= :windowStart', { windowStart })
      .setParameters({
        successStatuses: SUCCESS_STATUSES,
        failureStatuses: FAILURE_STATUSES,
        pendingStatuses: PENDING_STATUSES,
      })
      .groupBy('attempt.source')
      .orderBy('total', 'DESC')
      .getRawMany();
  }

  private toAdminRow(attempt: AirbnbPricingAttemptLog) {
    return {
      id: attempt.id,
      listingId: attempt.listingId,
      userId: attempt.userId,
      listId: attempt.listId,
      addressId: attempt.addressId,
      checkIn: attempt.checkIn,
      checkOut: attempt.checkOut,
      source: attempt.source,
      status: attempt.status,
      reason: attempt.reason,
      durationMs: attempt.durationMs,
      priceTotal: attempt.priceTotal == null ? null : Number(attempt.priceTotal),
      dailyPrice: attempt.dailyPrice == null ? null : Number(attempt.dailyPrice),
      currency: attempt.currency,
      finalUrl: attempt.finalUrl,
      metadata: attempt.metadata,
      startedAt: this.toIsoOrNull(attempt.startedAt),
      finishedAt: this.toIsoOrNull(attempt.finishedAt),
    };
  }

  private healthStatus(summary: {
    total: number;
    successes: number;
    failures: number;
    openPending: number;
    stalePending: number;
  }): 'green' | 'amber' | 'red' {
    if (summary.stalePending > 0) return 'red';
    if (summary.failures > 0 && summary.successes === 0) return 'red';
    if (summary.failures > 0 || summary.openPending > 0) return 'amber';
    return 'green';
  }

  private number(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private roundOrNull(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  private moneyOrNull(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private nonNegativeIntOrNull(value: number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  private dateOrUndefined(value: Date | string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private dateOrNull(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private truncate(value: string | null | undefined, max: number): string | null {
    if (!value) return null;
    return String(value).slice(0, max);
  }

  private toIsoOrNull(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
