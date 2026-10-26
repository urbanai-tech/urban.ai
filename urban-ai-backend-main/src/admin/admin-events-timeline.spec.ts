jest.mock('../knn-engine/strategies/adaptive-pricing.strategy', () => ({
  AdaptivePricingStrategy: class AdaptivePricingStrategy {},
}));
jest.mock('../knn-engine/dataset-collector.service', () => ({
  DatasetCollectorService: class DatasetCollectorService {},
}));
jest.mock('../maps/maps.service', () => ({
  MapsService: class MapsService {},
}));

import { AdminEventsService } from './admin-events.service';

function makeTimelineRepo(rows: any[]) {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
  return { createQueryBuilder: jest.fn().mockReturnValue(qb), qb };
}

function makeService(eventRepo: any) {
  return new AdminEventsService(eventRepo as any);
}

describe('AdminEventsService.eventsTimeline (dia de calendário de São Paulo)', () => {
  afterEach(() => jest.useRealTimers());

  it('agrupa por dia de SP via CONVERT_TZ (não DATE() cru) e filtra desde 00:00 BRT do primeiro dia', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-11T00:30:00Z')); // 10/05 21:30 BRT
    const repo = makeTimelineRepo([]);
    await makeService(repo).eventsTimeline(3);

    expect(repo.qb.select).toHaveBeenCalledWith(
      "DATE_FORMAT(CONVERT_TZ(e.dataCrawl, @@session.time_zone, '-03:00'), '%Y-%m-%d')",
      'day',
    );
    // janela de 3 dias: 08, 09 e 10/05 -> começa em 00:00 BRT de 08/05 = 03:00Z
    expect(repo.qb.where).toHaveBeenCalledWith('e.dataCrawl >= :since', {
      since: new Date('2026-05-08T03:00:00.000Z'),
    });
  });

  it('buckets usam as mesmas chaves de dia de SP do SQL (21:30 BRT conta em "hoje", não em "amanhã")', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-11T00:30:00Z')); // hoje em SP = 10/05
    const repo = makeTimelineRepo([
      { day: '2026-05-09', inScope: '2', outOfScope: '1' },
      { day: '2026-05-10', inScope: '5', outOfScope: '0' },
    ]);
    const result = await makeService(repo).eventsTimeline(3);

    expect(result.buckets).toEqual([
      { day: '2026-05-08', inScope: 0, outOfScope: 0 },
      { day: '2026-05-09', inScope: 2, outOfScope: 1 },
      { day: '2026-05-10', inScope: 5, outOfScope: 0 },
    ]);
    expect(result.totalInScope).toBe(7);
    expect(result.peakDay).toEqual({ day: '2026-05-10', total: 5 });
  });
});
