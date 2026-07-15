import { PortfolioActionTargetResolverService } from './portfolio-action-target-resolver.service';

describe('PortfolioActionTargetResolverService', () => {
  const service = new PortfolioActionTargetResolverService();
  const addresses = [
    { id: 'address-1', list: { id: 'listing-1' } },
    { id: 'address-2', list: { id: 'listing-2' } },
  ] as any[];

  it('resolves explicit address and listing aliases without expanding a property-date matrix', () => {
    const result = service.resolve(
      {
        propertyIds: ['address-1', 'address-2'],
        action: 'set-date-price',
        payload: {
          targets: [
            { propertyId: 'address-1', date: '2026-08-03' },
            { listingId: 'listing-2', targetDate: '2026-08-02' },
            { listId: 'listing-2', day: '2026-08-02' },
            { propertyId: 'not-owned', date: '2026-08-01' },
          ],
        },
      },
      addresses,
    );

    expect(result.explicit).toBe(true);
    expect(result.dates).toEqual(['2026-08-02', '2026-08-03']);
    expect(Object.fromEntries(result.byAddress)).toEqual({
      'address-1': ['2026-08-03'],
      'address-2': ['2026-08-02'],
    });
    expect(Array.from(result.keys).sort()).toEqual([
      'address-1:2026-08-03',
      'address-2:2026-08-02',
    ]);
  });

  it('deduplicates fallback dates and expands them only across owned addresses', () => {
    const result = service.resolve(
      {
        propertyIds: ['address-1', 'address-2'],
        action: 'apply-strategy',
        dates: ['2026-08-03'],
        payload: { dates: '2026-08-02, 2026-08-03' },
      },
      addresses,
    );

    expect(result.explicit).toBe(false);
    expect(result.dates).toEqual(['2026-08-02', '2026-08-03']);
    expect(Object.fromEntries(result.byAddress)).toEqual({
      'address-1': ['2026-08-02', '2026-08-03'],
      'address-2': ['2026-08-02', '2026-08-03'],
    });
    expect(result.keys.size).toBe(4);
  });

  it('preserves the inclusive range and 360-day cap', () => {
    const result = service.resolve(
      {
        propertyIds: ['address-1'],
        action: 'apply-strategy',
        from: '2026-01-01',
        to: '2027-12-31',
      },
      addresses.slice(0, 1),
    );

    expect(result.dates).toHaveLength(360);
    expect(result.dates[0]).toBe('2026-01-01');
    expect(result.dates[result.dates.length - 1]).toBe('2026-12-26');
  });
});
