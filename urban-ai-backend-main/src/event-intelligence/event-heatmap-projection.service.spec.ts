import { EventHeatmapProjectionService } from './event-heatmap-projection.service';

describe('EventHeatmapProjectionService', () => {
  it('groups nearby events and preserves snapshot and derived scoring semantics', () => {
    const eventDemandScore = jest.fn().mockReturnValue({
      eventDemandScore: 60,
      confidence: 'medium',
    });
    const service = new EventHeatmapProjectionService({ eventDemandScore } as any);
    const events = [
      {
        id: 'event-snapshot',
        latitude: 10.002,
        longitude: 20.002,
        relevancia: 90,
        categoria: 'show',
      },
      {
        id: 'event-derived',
        latitude: 10.004,
        longitude: 20.004,
        relevancia: 70,
        categoria: 'show',
        dataInicio: new Date('2026-08-01T20:00:00.000Z'),
      },
      { id: 'event-without-coordinates', latitude: null, longitude: null, relevancia: 99 },
    ] as any[];
    const snapshots = new Map([
      [
        'event-snapshot',
        {
          eventDemandScore: 80,
          eventRevenuePotentialCents: 120000,
          confidence: 'high',
        } as any,
      ],
    ]);

    expect(
      service.buildCells(events, snapshots, new Map([['event-snapshot', 2], ['event-derived', 3]]), {
        from: '2026-08-01',
        to: '2026-08-31',
      }),
    ).toEqual([
      {
        cellId: '10.00:20.00',
        bbox: [19.99, 9.99, 20.01, 10.01],
        centerLat: 10,
        centerLng: 20,
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        eventDemandScore: 70,
        revenuePotentialCents: 120000,
        eventsCount: 2,
        topEventIds: ['event-snapshot', 'event-derived'],
        affectedPropertiesCount: 5,
        averageConfidence: 'medium',
        dominantCategory: 'show',
        supplyCompressionScore: null,
      },
    ]);
    expect(eventDemandScore).toHaveBeenCalledTimes(1);
  });

  it('returns no cells and does not score events without coordinates', () => {
    const eventDemandScore = jest.fn();
    const service = new EventHeatmapProjectionService({ eventDemandScore } as any);

    expect(
      service.buildCells(
        [{ id: 'event-1', latitude: null, longitude: null } as any],
        new Map(),
        new Map(),
        { from: '2026-08-01', to: '2026-08-31' },
      ),
    ).toEqual([]);
    expect(eventDemandScore).not.toHaveBeenCalled();
  });
});
