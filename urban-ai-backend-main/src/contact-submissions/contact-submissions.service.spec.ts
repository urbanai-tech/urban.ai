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
    listQb.getManyAndCount.mockResolvedValue([
      [{ id: 'c1', status: 'new', email: 'lead@urban.ai' }],
      3,
    ]);
    statusQb.getRawMany.mockResolvedValue([
      { status: 'new', count: '2' },
      { status: 'in_progress', count: '1' },
    ]);

    const repo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(listQb)
        .mockReturnValueOnce(statusQb),
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
      items: [{ id: 'c1', status: 'new', email: 'lead@urban.ai' }],
    });
  });
});
