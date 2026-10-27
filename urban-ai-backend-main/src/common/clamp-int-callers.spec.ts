jest.mock('../knn-engine/strategies/adaptive-pricing.strategy', () => ({
  AdaptivePricingStrategy: class AdaptivePricingStrategy {},
}));
jest.mock('../knn-engine/dataset-collector.service', () => ({
  DatasetCollectorService: class DatasetCollectorService {},
}));
jest.mock('../maps/maps.service', () => ({
  MapsService: class MapsService {},
}));

import { AdminEventsService } from '../admin/admin-events.service';
import { ContactSubmissionsService } from '../contact-submissions/contact-submissions.service';

// Regressão: os controllers admin fazem `parseInt(query, 10)`; `?page=abc`
// virava NaN e `Math.max(1, NaN)` continuava NaN (OFFSET NaN no SQL).
describe('paginação com query inválida (NaN)', () => {
  afterEach(() => jest.useRealTimers());

  it('eventsTimeline(NaN) usa a janela padrão de 30 dias', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-11T12:00:00Z'));
    const qb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const result = await new AdminEventsService(repo as any).eventsTimeline(parseInt('abc', 10));

    expect(result.buckets).toHaveLength(30);
  });

  it('ContactSubmissionsService.list com page/limit NaN usa página 1 e 30 itens', async () => {
    const qb: any = {
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    await new ContactSubmissionsService(repo as any).list({ page: NaN, limit: NaN });

    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(30);
  });
});
