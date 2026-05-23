import { EventDedupAdminService } from './event-dedup-admin.service';
import { EventIdentityService } from '../evento/event-identity.service';

function event(overrides: any = {}) {
  return {
    id: 'event-1',
    nome: 'Festival X',
    dataInicio: new Date('2026-06-10T20:00:00Z'),
    dataFim: new Date('2026-06-10T23:00:00Z'),
    enderecoCompleto: 'Allianz Parque',
    cidade: 'Sao Paulo',
    estado: 'SP',
    latitude: -23.5,
    longitude: -46.6,
    source: 'sympla',
    sourceId: 'src-1',
    dedupStatus: 'canonical',
    duplicateOfEventId: null,
    sourceCount: 1,
    identityConfidence: 1,
    ativo: true,
    pendingGeocode: false,
    outOfScope: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeService(overrides: any = {}) {
  const eventRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
    ...overrides.eventRepo,
  };
  const candidateRepo = {
    findOne: jest.fn(),
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => ({ id: 'candidate-1', ...row })),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(1),
    createQueryBuilder: jest.fn(),
    ...overrides.candidateRepo,
  };
  const eventSourceRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(1),
    ...overrides.eventSourceRepo,
  };
  return {
    service: new EventDedupAdminService(
      eventRepo as any,
      candidateRepo as any,
      eventSourceRepo as any,
      new EventIdentityService(),
    ),
    eventRepo,
    candidateRepo,
    eventSourceRepo,
  };
}

describe('EventDedupAdminService', () => {
  it('records ingest review candidates without duplicating rejected or approved pairs', async () => {
    const { service, candidateRepo } = makeService();
    candidateRepo.findOne.mockResolvedValue(null);

    await service.recordReviewCandidate(
      event({ id: 'canonical-1' }),
      event({ id: 'duplicate-1', sourceId: 'src-2' }),
      {
        score: 0.8,
        reason: 'same_date+similar_name+same_venue',
        signals: { date: 1, name: 0.8, venue: 1, geo: 0, url: 0 },
        kind: 'review',
      },
    );

    expect(candidateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalEventId: 'canonical-1',
        duplicateEventId: 'duplicate-1',
        status: 'pending',
        confidenceBand: 'medium',
        source: 'ingest_review',
      }),
    );
  });

  it('approves a candidate by disabling duplicate while preserving source evidence', async () => {
    const canonical = event({ id: 'canonical-1' });
    const duplicate = event({ id: 'duplicate-1' });
    const pending = {
      id: 'candidate-1',
      canonicalEventId: canonical.id,
      duplicateEventId: duplicate.id,
      canonicalEvent: canonical,
      duplicateEvent: duplicate,
      status: 'pending',
      confidenceBand: 'high',
      score: 0.91,
      reason: 'likely_duplicate',
      signals: {},
    };
    const approved = { ...pending, status: 'approved' };
    const { service, candidateRepo, eventRepo, eventSourceRepo } = makeService();
    candidateRepo.findOne.mockResolvedValueOnce(pending).mockResolvedValueOnce(approved);
    eventSourceRepo.find.mockResolvedValue([
      {
        id: 'source-1',
        eventId: duplicate.id,
        source: 'sympla',
        sourceId: 'abc',
        canonicalUrl: null,
        lastSeenAt: new Date('2026-06-01T00:00:00Z'),
        seenCount: 1,
      },
    ]);
    eventSourceRepo.findOne.mockResolvedValue(null);

    const result = await service.approveEventDedupCandidate('candidate-1', 'admin-1');

    expect(eventSourceRepo.update).toHaveBeenCalledWith(
      { id: 'source-1' },
      expect.objectContaining({ eventId: 'canonical-1' }),
    );
    expect(eventSourceRepo.count).toHaveBeenCalledWith({ where: { eventId: 'canonical-1' } });
    expect(eventRepo.update).toHaveBeenCalledWith(
      { id: 'duplicate-1' },
      expect.objectContaining({
        duplicateOfEventId: 'canonical-1',
        dedupStatus: 'duplicate',
        ativo: false,
      }),
    );
    expect(candidateRepo.update).toHaveBeenCalledWith(
      { id: 'candidate-1' },
      expect.objectContaining({ status: 'approved', reviewedByUserId: 'admin-1' }),
    );
    expect(result.status).toBe('approved');
  });

  it('merges equivalent source evidence into the canonical source on approval', async () => {
    const canonical = event({ id: 'canonical-1' });
    const duplicate = event({ id: 'duplicate-1' });
    const pending = {
      id: 'candidate-1',
      canonicalEventId: canonical.id,
      duplicateEventId: duplicate.id,
      canonicalEvent: canonical,
      duplicateEvent: duplicate,
      status: 'pending',
      confidenceBand: 'high',
      score: 0.91,
      reason: 'likely_duplicate',
      signals: {},
    };
    const approved = { ...pending, status: 'approved' };
    const duplicateSource = {
      id: 'source-duplicate',
      eventId: duplicate.id,
      source: 'eventbrite',
      sourceId: null,
      canonicalUrl: 'https://eventbrite.com/e/festival-x',
      lastSeenAt: new Date('2026-06-02T00:00:00Z'),
      seenCount: 1,
      confidenceScore: 0.78,
      matchReason: 'review',
      rawPayload: { source: 'duplicate' },
    };
    const canonicalSource = {
      id: 'source-canonical',
      eventId: canonical.id,
      source: 'eventbrite',
      sourceId: null,
      canonicalUrl: duplicateSource.canonicalUrl,
      lastSeenAt: new Date('2026-06-01T00:00:00Z'),
      seenCount: 2,
      confidenceScore: 0.9,
      matchReason: 'canonical',
      rawPayload: { source: 'canonical' },
    };
    const { service, candidateRepo, eventSourceRepo } = makeService();
    candidateRepo.findOne.mockResolvedValueOnce(pending).mockResolvedValueOnce(approved);
    eventSourceRepo.find.mockResolvedValue([duplicateSource]);
    eventSourceRepo.findOne.mockResolvedValue(canonicalSource);

    await service.approveEventDedupCandidate('candidate-1', 'admin-1');

    expect(eventSourceRepo.update).toHaveBeenCalledWith(
      { id: 'source-canonical' },
      expect.objectContaining({
        seenCount: 3,
        confidenceScore: 0.9,
        matchReason: 'canonical',
        rawPayload: { source: 'canonical' },
      }),
    );
    expect(eventSourceRepo.delete).toHaveBeenCalledWith({ id: 'source-duplicate' });
  });

  it('scans canonical events by date and creates pending candidates', async () => {
    const canonical = event({
      id: 'canonical-1',
      nome: 'Festival X',
      sourceCount: 2,
      sourceId: 'official-1',
    });
    const duplicate = event({
      id: 'duplicate-1',
      nome: 'Festival X Oficial',
      source: 'eventbrite',
      sourceId: 'eventbrite-1',
    });
    const canonicalQb = queryBuilder([canonical, duplicate]);
    const reviewQb = queryBuilder([]);
    const { service, eventRepo, candidateRepo } = makeService({
      eventRepo: {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(canonicalQb)
          .mockReturnValueOnce(reviewQb),
      },
    });
    candidateRepo.findOne.mockResolvedValue(null);

    const result = await service.scanEventDedupCandidates({
      from: '2026-06-01',
      to: '2026-06-30',
      minScore: 0.74,
    });

    expect(result.scannedEvents).toBe(2);
    expect(result.created).toBe(1);
    expect(candidateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalEventId: 'canonical-1',
        duplicateEventId: 'duplicate-1',
        status: 'pending',
        confidenceBand: 'high',
        source: 'admin_scan',
        sourceId: 'eventbrite-1',
      }),
    );
    expect(eventRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
  });

  it('lists candidates with filters and admin-safe event summaries', async () => {
    const candidate = {
      id: 'candidate-1',
      status: 'pending',
      confidenceBand: 'high',
      score: '0.9100',
      reason: 'likely_duplicate',
      signals: { date: 1 },
      source: 'admin_scan',
      sourceId: 'eventbrite-1',
      reviewedByUserId: null,
      reviewedAt: null,
      reviewReason: null,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      updatedAt: new Date('2026-06-01T00:00:00Z'),
      canonicalEvent: event({ id: 'canonical-1' }),
      duplicateEvent: event({ id: 'duplicate-1' }),
    };
    const qb = listQueryBuilder([[candidate], 1]);
    const { service } = makeService({
      candidateRepo: {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      },
    });

    const result = await service.listEventDedupCandidates({
      status: 'pending',
      confidenceBand: 'high',
      source: 'admin_scan',
      search: 'festival',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('candidate.status = :status', { status: 'pending' });
    expect(qb.andWhere).toHaveBeenCalledWith('candidate.source = :source', { source: 'admin_scan' });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'candidate-1',
      score: 0.91,
      canonicalEvent: { id: 'canonical-1', nome: 'Festival X' },
      duplicateEvent: { id: 'duplicate-1', nome: 'Festival X' },
    });
  });

  it('rejects review_pending duplicates by restoring them as canonical events', async () => {
    const canonical = event({ id: 'canonical-1' });
    const duplicate = event({
      id: 'duplicate-1',
      dedupStatus: 'review_pending',
      duplicateOfEventId: canonical.id,
      ativo: false,
    });
    const pending = {
      id: 'candidate-1',
      canonicalEventId: canonical.id,
      duplicateEventId: duplicate.id,
      canonicalEvent: canonical,
      duplicateEvent: duplicate,
      status: 'pending',
      confidenceBand: 'medium',
      score: 0.78,
      reason: 'review',
      signals: {},
    };
    const rejected = { ...pending, status: 'rejected', reviewReason: 'not same event' };
    const { service, candidateRepo, eventRepo } = makeService();
    candidateRepo.findOne.mockResolvedValueOnce(pending).mockResolvedValueOnce(rejected);

    const result = await service.rejectEventDedupCandidate('candidate-1', 'admin-1', 'not same event');

    expect(eventRepo.update).toHaveBeenCalledWith(
      { id: 'duplicate-1' },
      expect.objectContaining({
        duplicateOfEventId: null,
        dedupStatus: 'canonical',
        ativo: true,
      }),
    );
    expect(candidateRepo.update).toHaveBeenCalledWith(
      { id: 'candidate-1' },
      expect.objectContaining({ status: 'rejected', reviewReason: 'not same event' }),
    );
    expect(result.status).toBe('rejected');
  });
});

function queryBuilder(rows: any[]) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  };
}

function listQueryBuilder(result: [any[], number]) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  };
}
