jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => unknown) => fn(),
}));
jest.mock('../maps/maps.service', () => ({ MapsService: class MapsService {} }));
jest.mock('./coverage.service', () => ({ CoverageService: class CoverageService {} }));

import { EventsGeocoderService } from './events-geocoder.service';

describe('EventsGeocoderService', () => {
  const createService = () => {
    const repo = {
      find: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    const maps = {
      updateLatLngByEventId: jest.fn(),
      getGeocodingReadiness: jest.fn().mockReturnValue({
        configured: true,
        status: 'configured',
        message: 'configured',
        nextAction: 'run geocoder',
      }),
    };
    const coverage = {
      isWithinCoverage: jest.fn().mockResolvedValue(true),
    };

    const service = new EventsGeocoderService(repo as any, maps as any, coverage as any);
    return { service, repo, maps, coverage };
  };

  it('exposes queue count, readiness and empty last run in status', async () => {
    const { service, repo, maps } = createService();
    repo.count.mockResolvedValue(7);
    maps.getGeocodingReadiness.mockReturnValue({
      configured: false,
      status: 'missing_api_key',
      message: 'GOOGLE_MAPS_API_KEY nao configurada no backend.',
      nextAction: 'Configure GOOGLE_MAPS_API_KEY.',
    });

    await expect(service.status()).resolves.toEqual({
      pendingGeocode: 7,
      readiness: {
        configured: false,
        status: 'missing_api_key',
        message: 'GOOGLE_MAPS_API_KEY nao configurada no backend.',
        nextAction: 'Configure GOOGLE_MAPS_API_KEY.',
      },
      running: false,
      lastRun: null,
    });
  });

  it('stores the last run failure reason for admin diagnostics', async () => {
    const { service, repo, maps } = createService();
    repo.find.mockResolvedValue([{ id: 'evt-1' }]);
    maps.updateLatLngByEventId.mockResolvedValue({
      ok: false,
      message: 'Google Geocoding API request failed - HTTP 403 / REQUEST_DENIED',
    });

    const result = await service.runOnce(10);
    const status = await service.status();

    expect(result).toEqual({
      attempted: 1,
      succeeded: 0,
      failed: 1,
      failures: [
        {
          id: 'evt-1',
          reason: 'Google Geocoding API request failed - HTTP 403 / REQUEST_DENIED',
        },
      ],
    });
    expect(status.lastRun).toEqual(
      expect.objectContaining({
        attempted: 1,
        succeeded: 0,
        failed: 1,
        status: 'failed',
      }),
    );
    expect(status.lastRun?.failures[0].reason).toContain('REQUEST_DENIED');
  });

  it('stops early on Google Maps configuration errors to avoid log storms', async () => {
    const { service, repo, maps } = createService();
    repo.find.mockResolvedValue([{ id: 'evt-1' }, { id: 'evt-2' }, { id: 'evt-3' }]);
    maps.updateLatLngByEventId.mockResolvedValue({
      ok: false,
      message:
        'Google Geocoding API request failed (HTTP 403, REQUEST_DENIED) - check GOOGLE_MAPS_API_KEY server restrictions, Geocoding API enablement and Google Cloud billing',
    });

    const result = await service.runOnce(10);

    expect(result).toEqual({
      attempted: 1,
      succeeded: 0,
      failed: 1,
      failures: [
        {
          id: 'evt-1',
          reason:
            'Google Geocoding API request failed (HTTP 403, REQUEST_DENIED) - check GOOGLE_MAPS_API_KEY server restrictions, Geocoding API enablement and Google Cloud billing',
        },
      ],
    });
    expect(maps.updateLatLngByEventId).toHaveBeenCalledTimes(1);
  });

  it('marks successful geocoded events according to coverage', async () => {
    const { service, repo, maps, coverage } = createService();
    repo.find.mockResolvedValue([{ id: 'evt-1' }]);
    maps.updateLatLngByEventId.mockResolvedValue({ ok: true, lat: -23.5, lng: -46.6 });
    coverage.isWithinCoverage.mockResolvedValue(false);

    await expect(service.runOnce()).resolves.toEqual({
      attempted: 1,
      succeeded: 1,
      failed: 0,
      failures: [],
    });
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'evt-1' },
      {
        pendingGeocode: false,
        outOfScope: true,
        ativo: false,
      },
    );
  });
});
