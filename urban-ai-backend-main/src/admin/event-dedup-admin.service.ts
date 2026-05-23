import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
  EventDedupCandidate,
  EventDedupCandidateStatus,
  EventDedupConfidenceBand,
} from '../entities/event-dedup-candidate.entity';
import { EventSource } from '../entities/event-source.entity';
import { Event as EventEntity } from '../entities/events.entity';
import {
  EventIdentityInput,
  EventIdentityScore,
  EventIdentityService,
} from '../evento/event-identity.service';

export type EventDedupScanOptions = {
  limit?: number;
  from?: string | Date;
  to?: string | Date;
  lookbackDays?: number;
  lookaheadDays?: number;
  minScore?: number;
  highScore?: number;
  includeInactive?: boolean;
  source?: string;
};

export type EventDedupCandidateFilters = {
  page?: number;
  limit?: number;
  status?: EventDedupCandidateStatus | 'all';
  confidenceBand?: EventDedupConfidenceBand | 'all';
  source?: string;
  search?: string;
};

type EventDedupRepositories = {
  eventRepo: Repository<EventEntity>;
  candidateRepo: Repository<EventDedupCandidate>;
  eventSourceRepo: Repository<EventSource>;
};

@Injectable()
export class EventDedupAdminService {
  private readonly DEFAULT_MIN_SCORE = 0.74;
  private readonly DEFAULT_HIGH_SCORE = 0.86;

  constructor(
    @InjectRepository(EventEntity) private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(EventDedupCandidate)
    private readonly candidateRepo: Repository<EventDedupCandidate>,
    @InjectRepository(EventSource) private readonly eventSourceRepo: Repository<EventSource>,
    private readonly identity: EventIdentityService,
  ) {}

  private repositories(): EventDedupRepositories {
    return {
      eventRepo: this.eventRepo,
      candidateRepo: this.candidateRepo,
      eventSourceRepo: this.eventSourceRepo,
    };
  }

  private async withEventDedupTransaction<T>(
    work: (repos: EventDedupRepositories) => Promise<T>,
  ): Promise<T> {
    const manager = this.candidateRepo.manager ?? this.eventRepo.manager;
    if (manager?.transaction) {
      return manager.transaction(async (transactionalManager) =>
        work({
          eventRepo: transactionalManager.getRepository(EventEntity),
          candidateRepo: transactionalManager.getRepository(EventDedupCandidate),
          eventSourceRepo: transactionalManager.getRepository(EventSource),
        }),
      );
    }
    return work(this.repositories());
  }

  async scanEventDedupCandidates(options: EventDedupScanOptions = {}) {
    const startedAt = new Date();
    const limit = this.clampInt(options.limit, 50, 5000, 1000);
    const lookbackDays = this.clampInt(options.lookbackDays, 0, 3650, 30);
    const lookaheadDays = this.clampInt(options.lookaheadDays, 1, 3650, 365);
    const minScore = this.clampScore(options.minScore, this.DEFAULT_MIN_SCORE);
    const highScore = this.clampScore(options.highScore, this.DEFAULT_HIGH_SCORE);
    const from = options.from
      ? this.parseDate(options.from, 'from')
      : new Date(startedAt.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    const to = options.to
      ? this.parseDate(options.to, 'to')
      : new Date(startedAt.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);
    from.setUTCHours(0, 0, 0, 0);
    to.setUTCHours(23, 59, 59, 999);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('from must be before or equal to to');
    }

    const [events, reviewPending] = await Promise.all([
      this.readCanonicalEventsForScan({
        from,
        to,
        limit,
        includeInactive: Boolean(options.includeInactive),
        source: options.source,
      }),
      this.readReviewPendingEvents({ from, to, limit, source: options.source }),
    ]);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const touched = new Map<string, EventDedupCandidate>();

    for (const duplicate of reviewPending) {
      const canonical = duplicate.duplicateOfEventId
        ? await this.eventRepo.findOne({ where: { id: duplicate.duplicateOfEventId } })
        : null;
      if (!canonical) {
        skipped++;
        continue;
      }
      const score = this.withStoredIdentityScore(
        this.identity.scoreCandidate(this.toIdentityInput(duplicate), canonical),
        duplicate.identityConfidence,
      );
      if (score.score < minScore) {
        skipped++;
        continue;
      }
      const result = await this.upsertCandidate(canonical, duplicate, score, highScore, 'review_pending_event');
      if (result.action === 'created') created++;
      else if (result.action === 'updated') updated++;
      else skipped++;
      touched.set(result.candidate.id, result.candidate);
    }

    const buckets = this.bucketByDateAndRegion(events);
    for (const bucket of buckets.values()) {
      for (let i = 0; i < bucket.length; i += 1) {
        for (let j = i + 1; j < bucket.length; j += 1) {
          const [canonical, duplicate] = this.chooseCanonicalPair(bucket[i], bucket[j]);
          const score = this.identity.scoreCandidate(this.toIdentityInput(duplicate), canonical);
          if (score.score < minScore) continue;
          const result = await this.upsertCandidate(canonical, duplicate, score, highScore, 'admin_scan');
          if (result.action === 'created') created++;
          else if (result.action === 'updated') updated++;
          else skipped++;
          touched.set(result.candidate.id, result.candidate);
        }
      }
    }

    const pendingTotal = await this.candidateRepo.count({ where: { status: 'pending' } });
    const items = Array.from(touched.values())
      .sort((a, b) => Number(b.score) - Number(a.score))
      .slice(0, 25)
      .map((candidate) => this.toCandidateDto(candidate));

    return {
      generatedAt: new Date().toISOString(),
      window: { from: from.toISOString(), to: to.toISOString() },
      scannedEvents: events.length,
      reviewPendingEvents: reviewPending.length,
      created,
      updated,
      skipped,
      pendingTotal,
      items,
    };
  }

  async listEventDedupCandidates(filters: EventDedupCandidateFilters = {}) {
    const page = this.clampInt(filters.page, 1, 10_000, 1);
    const limit = this.clampInt(filters.limit, 1, 100, 50);
    const qb = this.candidateRepo
      .createQueryBuilder('candidate')
      .leftJoinAndSelect('candidate.canonicalEvent', 'canonical')
      .leftJoinAndSelect('candidate.duplicateEvent', 'duplicate')
      .orderBy(
        "CASE candidate.confidenceBand WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END",
        'ASC',
      )
      .addOrderBy('candidate.score', 'DESC')
      .addOrderBy('candidate.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status && filters.status !== 'all') {
      qb.andWhere('candidate.status = :status', { status: filters.status });
    } else if (!filters.status) {
      qb.andWhere('candidate.status = :status', { status: 'pending' });
    }

    if (filters.confidenceBand && filters.confidenceBand !== 'all') {
      qb.andWhere('candidate.confidenceBand = :confidenceBand', {
        confidenceBand: filters.confidenceBand,
      });
    }
    if (filters.source) {
      qb.andWhere('candidate.source = :source', { source: filters.source });
    }
    if (filters.search) {
      const like = `%${filters.search.toLowerCase()}%`;
      qb.andWhere(
        `(
          LOWER(COALESCE(canonical.nome, '')) LIKE :like
          OR LOWER(COALESCE(duplicate.nome, '')) LIKE :like
          OR LOWER(COALESCE(canonical.cidade, '')) LIKE :like
          OR LOWER(COALESCE(duplicate.cidade, '')) LIKE :like
        )`,
        { like },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      page,
      limit,
      total,
      status: filters.status ?? 'pending',
      confidenceBand: filters.confidenceBand ?? 'all',
      items: items.map((candidate) => this.toCandidateDto(candidate)),
    };
  }

  async approveEventDedupCandidate(id: string, reviewedByUserId?: string | null) {
    return this.withEventDedupTransaction(async (repos) => {
      const candidate = await this.findCandidateOrThrow(id, repos.candidateRepo);
      if (candidate.status === 'approved') return this.toCandidateDto(candidate);
      if (candidate.status !== 'pending') {
        throw new BadRequestException(`Candidate is ${candidate.status}, not pending`);
      }

      const now = new Date();
      await this.moveSourceEvidence(candidate.canonicalEventId, candidate.duplicateEventId, now, repos);
      await repos.eventRepo.update(
        { id: candidate.duplicateEventId },
        {
          duplicateOfEventId: candidate.canonicalEventId,
          dedupStatus: 'duplicate',
          ativo: false,
          identityConfidence: Number(candidate.score),
          lastSeenAt: now,
        },
      );
      await repos.candidateRepo.update(
        { id: candidate.id },
        {
          status: 'approved',
          reviewedByUserId: reviewedByUserId ?? null,
          reviewedAt: now,
          reviewReason: null,
        },
      );
      await repos.candidateRepo.update(
        { duplicateEventId: candidate.duplicateEventId, status: 'pending' },
        {
          status: 'obsolete',
          reviewReason: `Obsoleted by approved candidate ${candidate.id}`,
        },
      );
      await repos.candidateRepo.update(
        { canonicalEventId: candidate.duplicateEventId, status: 'pending' },
        {
          status: 'obsolete',
          reviewReason: `Obsoleted by approved candidate ${candidate.id}`,
        },
      );

      return this.toCandidateDto(await this.findCandidateOrThrow(id, repos.candidateRepo));
    });
  }

  async rejectEventDedupCandidate(id: string, reviewedByUserId?: string | null, reason?: string | null) {
    return this.withEventDedupTransaction(async (repos) => {
      const candidate = await this.findCandidateOrThrow(id, repos.candidateRepo);
      if (candidate.status === 'rejected') return this.toCandidateDto(candidate);
      if (candidate.status !== 'pending') {
        throw new BadRequestException(`Candidate is ${candidate.status}, not pending`);
      }

      const duplicate = candidate.duplicateEvent;
      if (
        duplicate?.dedupStatus === 'review_pending' &&
        duplicate.duplicateOfEventId === candidate.canonicalEventId
      ) {
        await repos.eventRepo.update(
          { id: duplicate.id },
          {
            duplicateOfEventId: null,
            dedupStatus: 'canonical',
            ativo: !duplicate.pendingGeocode && !duplicate.outOfScope,
          },
        );
      }

      await repos.candidateRepo.update(
        { id: candidate.id },
        {
          status: 'rejected',
          reviewedByUserId: reviewedByUserId ?? null,
          reviewedAt: new Date(),
          reviewReason: reason?.slice(0, 255) ?? null,
        },
      );
      return this.toCandidateDto(await this.findCandidateOrThrow(id, repos.candidateRepo));
    });
  }

  async recordReviewCandidate(
    canonicalEvent: EventEntity,
    duplicateEvent: EventEntity,
    score: EventIdentityScore,
    source = 'ingest_review',
  ): Promise<EventDedupCandidate> {
    return (await this.upsertCandidate(
      canonicalEvent,
      duplicateEvent,
      score,
      this.DEFAULT_HIGH_SCORE,
      source,
    )).candidate;
  }

  private async moveSourceEvidence(
    canonicalEventId: string,
    duplicateEventId: string,
    now: Date,
    repos: EventDedupRepositories = this.repositories(),
  ) {
    const duplicateSources = await repos.eventSourceRepo.find({ where: { eventId: duplicateEventId } });
    for (const source of duplicateSources) {
      const canonicalSource = await this.findEquivalentCanonicalSource(canonicalEventId, source, repos);
      if (canonicalSource) {
        await repos.eventSourceRepo.update(
          { id: canonicalSource.id },
          {
            lastSeenAt: this.latestDate(canonicalSource.lastSeenAt, source.lastSeenAt, now),
            seenCount: Number(canonicalSource.seenCount ?? 0) + Number(source.seenCount ?? 1),
            confidenceScore: Math.max(
              Number(canonicalSource.confidenceScore ?? 0),
              Number(source.confidenceScore ?? 0),
            ),
            matchReason: canonicalSource.matchReason ?? source.matchReason,
            rawPayload: canonicalSource.rawPayload ?? source.rawPayload,
          } as Partial<EventSource>,
        );
        await repos.eventSourceRepo.delete({ id: source.id });
        continue;
      }

      await repos.eventSourceRepo.update(
        { id: source.id },
        {
          eventId: canonicalEventId,
          lastSeenAt: this.latestDate(source.lastSeenAt, now),
        } as Partial<EventSource>,
      );
    }

    const sourceCount = await repos.eventSourceRepo.count({ where: { eventId: canonicalEventId } });
    await repos.eventRepo.update({ id: canonicalEventId }, { sourceCount, lastSeenAt: now });
  }

  private async findEquivalentCanonicalSource(
    canonicalEventId: string,
    source: EventSource,
    repos: EventDedupRepositories = this.repositories(),
  ) {
    if (source.sourceId) {
      const bySourceId = await repos.eventSourceRepo.findOne({
        where: { eventId: canonicalEventId, source: source.source, sourceId: source.sourceId },
      });
      if (bySourceId) return bySourceId;
    }

    if (source.canonicalUrl) {
      return repos.eventSourceRepo.findOne({
        where: { eventId: canonicalEventId, source: source.source, canonicalUrl: source.canonicalUrl },
      });
    }

    return null;
  }

  private async readCanonicalEventsForScan(input: {
    from: Date;
    to: Date;
    limit: number;
    includeInactive: boolean;
    source?: string;
  }) {
    const qb = this.eventRepo
      .createQueryBuilder('event')
      .where('event.dataInicio BETWEEN :from AND :to', { from: input.from, to: input.to })
      .andWhere('event.duplicateOfEventId IS NULL')
      .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
      .andWhere(
        new Brackets((where) => {
          where.where('event.nome IS NOT NULL').andWhere("TRIM(event.nome) <> ''");
        }),
      )
      .orderBy('event.dataInicio', 'ASC')
      .addOrderBy('event.nome', 'ASC')
      .take(input.limit);

    if (!input.includeInactive) qb.andWhere('event.ativo = :active', { active: true });
    if (input.source) qb.andWhere('event.source = :source', { source: input.source });
    return qb.getMany();
  }

  private async readReviewPendingEvents(input: { from: Date; to: Date; limit: number; source?: string }) {
    const qb = this.eventRepo
      .createQueryBuilder('event')
      .where('event.dataInicio BETWEEN :from AND :to', { from: input.from, to: input.to })
      .andWhere('event.dedupStatus = :status', { status: 'review_pending' })
      .andWhere('event.duplicateOfEventId IS NOT NULL')
      .orderBy('event.createdAt', 'DESC')
      .take(input.limit);

    if (input.source) qb.andWhere('event.source = :source', { source: input.source });
    return qb.getMany();
  }

  private async upsertCandidate(
    canonical: EventEntity,
    duplicate: EventEntity,
    score: EventIdentityScore,
    highScore: number,
    source: string,
  ): Promise<{ action: 'created' | 'updated' | 'skipped'; candidate: EventDedupCandidate }> {
    if (canonical.id === duplicate.id) throw new BadRequestException('Cannot dedup an event into itself');

    const existing = await this.candidateRepo.findOne({
      where: [
        { canonicalEventId: canonical.id, duplicateEventId: duplicate.id },
        { canonicalEventId: duplicate.id, duplicateEventId: canonical.id },
      ],
      relations: ['canonicalEvent', 'duplicateEvent'],
    });

    const confidenceBand = this.confidenceBand(score.score, highScore);
    const patch = {
      canonicalEventId: canonical.id,
      duplicateEventId: duplicate.id,
      confidenceBand,
      score: score.score,
      reason: score.reason,
      signals: score.signals,
      source,
      sourceId: duplicate.sourceId ?? null,
    };

    if (existing) {
      if (existing.status !== 'pending') {
        return { action: 'skipped', candidate: existing };
      }
      await this.candidateRepo.update({ id: existing.id }, patch);
      return {
        action: 'updated',
        candidate: {
          ...existing,
          ...patch,
          canonicalEvent: canonical,
          duplicateEvent: duplicate,
        },
      };
    }

    const candidate = await this.candidateRepo.save(
      this.candidateRepo.create({
        ...patch,
        status: 'pending',
        canonicalEvent: canonical,
        duplicateEvent: duplicate,
      }),
    );
    return {
      action: 'created',
      candidate: { ...candidate, canonicalEvent: canonical, duplicateEvent: duplicate },
    };
  }

  private async findCandidateOrThrow(id: string, candidateRepo = this.candidateRepo) {
    const candidate = await candidateRepo.findOne({
      where: { id },
      relations: ['canonicalEvent', 'duplicateEvent'],
    });
    if (!candidate) throw new NotFoundException('Dedup candidate not found');
    return candidate;
  }

  private bucketByDateAndRegion(events: EventEntity[]): Map<string, EventEntity[]> {
    const buckets = new Map<string, EventEntity[]>();
    for (const event of events) {
      const key = [
        this.identity.eventDateKey(event.dataInicio) ?? 'no-date',
        this.normalizeKey(event.estado),
        this.normalizeKey(event.cidade),
      ].join('|');
      buckets.set(key, [...(buckets.get(key) ?? []), event]);
    }
    return buckets;
  }

  private chooseCanonicalPair(left: EventEntity, right: EventEntity): [EventEntity, EventEntity] {
    const leftScore = this.canonicalPreference(left);
    const rightScore = this.canonicalPreference(right);
    return leftScore >= rightScore ? [left, right] : [right, left];
  }

  private canonicalPreference(event: EventEntity): number {
    const sourceWeight = Number(event.sourceCount ?? 0) * 4;
    const activeWeight = event.ativo ? 2 : 0;
    const confidenceWeight = Number(event.identityConfidence ?? 0);
    const createdAt = event.createdAt ? new Date(event.createdAt).getTime() : Date.now();
    const ageWeight = Number.isFinite(createdAt) ? Math.max(0, 1 - createdAt / Date.now()) : 0;
    return sourceWeight + activeWeight + confidenceWeight + ageWeight;
  }

  private confidenceBand(score: number, highScore: number): EventDedupConfidenceBand {
    if (score >= highScore) return 'high';
    if (score >= this.DEFAULT_MIN_SCORE) return 'medium';
    return 'low';
  }

  private withStoredIdentityScore(score: EventIdentityScore, stored: unknown): EventIdentityScore {
    const storedScore = Number(stored);
    if (!Number.isFinite(storedScore) || storedScore <= score.score) return score;
    return {
      ...score,
      score: Math.max(0, Math.min(1, storedScore)),
      reason: `existing_review_pending:${score.reason}`.slice(0, 255),
    };
  }

  private toIdentityInput(event: EventEntity): EventIdentityInput {
    return {
      nome: event.nome,
      dataInicio: event.dataInicio,
      latitude: event.latitude,
      longitude: event.longitude,
      enderecoCompleto: event.enderecoCompleto,
      linkSiteOficial: event.linkSiteOficial,
      crawledUrl: event.crawledUrl,
      source: event.source,
      sourceId: event.sourceId,
    };
  }

  private toCandidateDto(candidate: EventDedupCandidate) {
    return {
      id: candidate.id,
      status: candidate.status,
      confidenceBand: candidate.confidenceBand,
      score: Number(candidate.score),
      reason: candidate.reason,
      signals: candidate.signals,
      source: candidate.source,
      sourceId: candidate.sourceId,
      reviewedByUserId: candidate.reviewedByUserId,
      reviewedAt: candidate.reviewedAt,
      reviewReason: candidate.reviewReason,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      canonicalEvent: this.toEventSummary(candidate.canonicalEvent),
      duplicateEvent: this.toEventSummary(candidate.duplicateEvent),
    };
  }

  private toEventSummary(event?: EventEntity | null) {
    if (!event) return null;
    return {
      id: event.id,
      nome: event.nome,
      canonicalName: event.canonicalName,
      cidade: event.cidade,
      estado: event.estado,
      dataInicio: event.dataInicio,
      dataFim: event.dataFim,
      enderecoCompleto: event.enderecoCompleto,
      latitude: event.latitude,
      longitude: event.longitude,
      source: event.source,
      sourceId: event.sourceId,
      dedupStatus: event.dedupStatus,
      duplicateOfEventId: event.duplicateOfEventId,
      sourceCount: event.sourceCount,
      identityConfidence: event.identityConfidence,
      ativo: event.ativo,
    };
  }

  private normalizeKey(value?: string | null): string {
    return this.identity.normalizeText(value ?? '') || 'unknown';
  }

  private latestDate(...values: Array<Date | string | null | undefined>): Date {
    const times = values
      .map((value) => (value ? new Date(value).getTime() : Number.NaN))
      .filter((time) => Number.isFinite(time));
    return times.length ? new Date(Math.max(...times)) : new Date();
  }

  private clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(parsed)));
  }

  private clampScore(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(1, parsed));
  }

  private parseDate(value: string | Date, label: string): Date {
    const parsed = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${label} is invalid`);
    }
    return parsed;
  }
}
