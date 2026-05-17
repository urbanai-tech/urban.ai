import { ContactSubmissionsService } from './contact-submissions.service';

function makeQueryBuilder() {
  return {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getRawMany: jest.fn(),
  };
}

describe('ContactSubmissionsService', () => {
  it('returns paginated items plus global status counts for the same search', async () => {
    const listQb = makeQueryBuilder();
    const statusQb = makeQueryBuilder();
    const categoryQb = makeQueryBuilder();
    const severityQb = makeQueryBuilder();
    listQb.getManyAndCount.mockResolvedValue([
      [{ id: 'c1', status: 'new', email: 'lead@urban.ai' }],
      3,
    ]);
    statusQb.getRawMany.mockResolvedValue([
      { status: 'new', count: '2' },
      { status: 'in_progress', count: '1' },
    ]);
    categoryQb.getRawMany.mockResolvedValue([{ category: 'sales', count: '2' }]);
    severityQb.getRawMany.mockResolvedValue([{ severity: 'P3', count: '2' }]);

    const repo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(listQb)
        .mockReturnValueOnce(statusQb)
        .mockReturnValueOnce(categoryQb)
        .mockReturnValueOnce(severityQb),
    };
    const service = new ContactSubmissionsService(repo as any);

    const result = await service.list({
      page: 2,
      limit: 25,
      status: 'new',
      search: 'Lead',
    });

    expect(listQb.skip).toHaveBeenCalledWith(25);
    expect(listQb.take).toHaveBeenCalledWith(25);
    expect(listQb.andWhere).toHaveBeenCalledWith('c.status = :status', {
      status: 'new',
    });
    expect(listQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('LOWER(c.email)'), {
      like: '%lead%',
    });
    expect(statusQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('LOWER(c.email)'), {
      like: '%lead%',
    });
    expect(statusQb.andWhere).not.toHaveBeenCalledWith('c.status = :status', expect.anything());
    expect(result).toEqual({
      page: 2,
      limit: 25,
      total: 3,
      byStatus: [
        { status: 'new', count: 2 },
        { status: 'in_progress', count: 1 },
      ],
      byCategory: [{ category: 'sales', count: 2 }],
      bySeverity: [{ severity: 'P3', count: 2 }],
      items: [{ id: 'c1', status: 'new', email: 'lead@urban.ai' }],
    });
  });

  it('classifies LGPD requests with a 15-day due date', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-17T12:00:00.000Z'));
    const repo = {
      create: jest.fn((input) => input),
      save: jest.fn((input) => Promise.resolve({ id: 'c-lgpd', ...input })),
    };
    const service = new ContactSubmissionsService(repo as any);

    const result = await service.create(
      {
        name: 'Titular',
        email: 'titular@example.com',
        subject: 'Pedido LGPD',
        message: 'Quero excluir meus dados pessoais e revogar consentimento.',
        source: 'privacy',
      },
      { ipAddress: '127.0.0.1', userAgent: 'jest' },
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'privacy_lgpd',
        severity: 'P1',
        dueAt: new Date('2026-06-01T12:00:00.000Z'),
      }),
    );
    expect(result.category).toBe('privacy_lgpd');
    jest.useRealTimers();
  });
});
