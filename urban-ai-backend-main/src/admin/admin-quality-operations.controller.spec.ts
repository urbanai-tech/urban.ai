import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminQualityOperationsController } from './admin-quality-operations.controller';

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => async (work: () => unknown) => work(),
}));
jest.mock('./admin.service', () => ({ AdminService: class AdminService {} }));
jest.mock('./airbnb-pricing-attempt-log.service', () => ({
  AirbnbPricingAttemptLogService: class AirbnbPricingAttemptLogService {},
}));
jest.mock('../evento/events-geocoder.service', () => ({
  EventsGeocoderService: class EventsGeocoderService {},
}));
jest.mock('../evento/events-enrichment.service', () => ({
  EventsEnrichmentService: class EventsEnrichmentService {},
}));
jest.mock('../knn-engine/dataset-collector.service', () => ({
  DatasetCollectorService: class DatasetCollectorService {},
}));
jest.mock('../knn-engine/venue-capacity.service', () => ({
  VenueCapacityService: class VenueCapacityService {},
}));
jest.mock('../knn-engine/event-historical.service', () => ({
  EventHistoricalService: class EventHistoricalService {},
}));

type ControllerMethod = keyof AdminQualityOperationsController;

function handler(method: ControllerMethod): (...args: unknown[]) => unknown {
  return AdminQualityOperationsController.prototype[method] as (...args: unknown[]) => unknown;
}

function routeMetadata(method: ControllerMethod) {
  return {
    path: Reflect.getMetadata(PATH_METADATA, handler(method)),
    requestMethod: Reflect.getMetadata(METHOD_METADATA, handler(method)),
  };
}

function throttleMetadata(method: ControllerMethod) {
  return {
    ttl: Reflect.getMetadata(`${THROTTLER_TTL}default`, handler(method)),
    limit: Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler(method)),
  };
}

describe('AdminQualityOperationsController', () => {
  const admin = {
    pricingStatus: jest.fn(),
    alphaDashboard: jest.fn(),
    alphaRecommendations: jest.fn(),
    runAlphaReprocess: jest.fn(),
    datasetMetrics: jest.fn(),
    priceIntelligenceHealth: jest.fn(),
    listJobRuns: jest.fn(),
    runTrackedJob: jest.fn(async (_name: string, _actor: string | null, work: () => unknown) => work()),
  };
  const datasetCollector = {
    datasetDiagnostics: jest.fn(),
    recordOwnedListingsSnapshot: jest.fn(),
    recordEventProximityFeatures: jest.fn(),
  };
  const geocoder = { runOnce: jest.fn() };
  const enrichment = { resetStaleZeroRelevance: jest.fn() };
  const airbnbPricingAttempts = { health: jest.fn() };
  const venueCapacity = { backfillAll: jest.fn() };
  const eventHistorical = {
    seedCuratedAnchors: jest.fn(),
    importFromWikidata: jest.fn(),
    refreshFromFirecrawl: jest.fn(),
    recomputeFeedbackAnchors: jest.fn(),
    applyAnchorsAll: jest.fn(),
  };
  let controller: AdminQualityOperationsController;

  beforeEach(() => {
    jest.clearAllMocks();
    admin.runTrackedJob.mockImplementation(
      async (_name: string, _actor: string | null, work: () => unknown) => work(),
    );
    controller = new AdminQualityOperationsController(
      admin as any,
      datasetCollector as any,
      geocoder as any,
      enrichment as any,
      airbnbPricingAttempts as any,
      venueCapacity as any,
      eventHistorical as any,
    );
  });

  it('preserves all quality and operations routes under guarded /admin', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminQualityOperationsController)).toBe('admin');
    expect(Reflect.getMetadata(ROLES_KEY, AdminQualityOperationsController)).toEqual(['admin']);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminQualityOperationsController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);

    const routes: Array<[ControllerMethod, string, RequestMethod]> = [
      ['pricingStatus', 'pricing/status', RequestMethod.GET],
      ['alphaDashboard', 'alpha/dashboard', RequestMethod.GET],
      ['alphaRecommendations', 'alpha/recommendations', RequestMethod.GET],
      ['alphaReprocess', 'alpha/reprocess', RequestMethod.POST],
      ['datasetMetrics', 'dataset/metrics', RequestMethod.GET],
      ['datasetDiagnostics', 'dataset/diagnostics', RequestMethod.GET],
      ['priceIntelligenceHealth', 'price-intelligence/health', RequestMethod.GET],
      ['airbnbPricingAttemptHealth', 'airbnb/pricing-attempts/health', RequestMethod.GET],
      ['runDatasetSnapshot', 'dataset/snapshot/run', RequestMethod.POST],
      ['runEventProximitySnapshot', 'dataset/event-proximity/run', RequestMethod.POST],
      ['jobRuns', 'jobs/runs', RequestMethod.GET],
      ['runGeocoderJob', 'jobs/geocoder/run', RequestMethod.POST],
      ['runResetStaleEnrichment', 'jobs/reset-stale-enrichment/run', RequestMethod.POST],
      ['runVenueCapacityBackfill', 'jobs/venue-capacity/run', RequestMethod.POST],
      ['runEventHistorical', 'jobs/event-historical/run', RequestMethod.POST],
    ];

    for (const [method, path, requestMethod] of routes) {
      expect(routeMetadata(method)).toEqual({ path, requestMethod });
    }
  });

  it('preserves the stricter throttles on manual commands', () => {
    expect(throttleMetadata('alphaReprocess')).toEqual({ ttl: 60_000, limit: 3 });
    expect(throttleMetadata('runDatasetSnapshot')).toEqual({ ttl: 60_000, limit: 5 });
    expect(throttleMetadata('runEventProximitySnapshot')).toEqual({ ttl: 60_000, limit: 5 });
    expect(throttleMetadata('runGeocoderJob')).toEqual({ ttl: 60_000, limit: 5 });
    expect(throttleMetadata('runResetStaleEnrichment')).toEqual({ ttl: 60_000, limit: 3 });
    expect(throttleMetadata('runVenueCapacityBackfill')).toEqual({ ttl: 60_000, limit: 2 });
    expect(throttleMetadata('runEventHistorical')).toEqual({ ttl: 60_000, limit: 2 });
  });

  it('keeps read delegation and numeric query parsing stable', async () => {
    admin.pricingStatus.mockResolvedValue({ status: 'ready' });
    admin.alphaDashboard.mockResolvedValue({ email: 'host@test' });
    admin.alphaRecommendations.mockResolvedValue([{ id: 'rec-1' }]);
    admin.datasetMetrics.mockResolvedValue({ rows: 10 });
    datasetCollector.datasetDiagnostics.mockResolvedValue({ health: 'green' });
    admin.priceIntelligenceHealth.mockResolvedValue({ status: 'green' });
    airbnbPricingAttempts.health.mockResolvedValue({ status: 'green' });
    admin.listJobRuns.mockResolvedValue([{ name: 'geocoder' }]);

    await controller.pricingStatus();
    await controller.alphaDashboard('host@test');
    await controller.alphaRecommendations('host@test', '125');
    await controller.datasetMetrics();
    await controller.datasetDiagnostics();
    await controller.priceIntelligenceHealth('14');
    await controller.airbnbPricingAttemptHealth('12');
    await controller.jobRuns('25', 'geocoder');

    expect(admin.alphaRecommendations).toHaveBeenCalledWith('host@test', 125);
    expect(admin.priceIntelligenceHealth).toHaveBeenCalledWith(14);
    expect(airbnbPricingAttempts.health).toHaveBeenCalledWith(12);
    expect(admin.listJobRuns).toHaveBeenCalledWith(25, 'geocoder');
  });

  it('tracks alpha and dataset commands with the authenticated actor', async () => {
    admin.runAlphaReprocess.mockResolvedValue({ processed: 2 });
    datasetCollector.recordOwnedListingsSnapshot.mockResolvedValue({ saved: 3 });
    datasetCollector.recordEventProximityFeatures.mockResolvedValue({ saved: 4 });
    const req = { user: { userId: 'admin-1' } };

    await controller.alphaReprocess('host@test', req);
    await controller.runDatasetSnapshot(req);
    await controller.runEventProximitySnapshot(req);

    expect(admin.runTrackedJob.mock.calls.map(([name, actor]) => [name, actor])).toEqual([
      ['alpha-pricing-reprocess', 'admin-1'],
      ['dataset-snapshot', 'admin-1'],
      ['event-proximity-snapshot', 'admin-1'],
    ]);
    expect(admin.runAlphaReprocess).toHaveBeenCalledWith('host@test');
    expect(datasetCollector.recordOwnedListingsSnapshot).toHaveBeenCalled();
    expect(datasetCollector.recordEventProximityFeatures).toHaveBeenCalled();
  });

  it('tracks geocoder, enrichment and venue jobs with unchanged inputs', async () => {
    const req = { user: { userId: 'admin-1' } };
    geocoder.runOnce.mockResolvedValue({ processed: 50 });
    enrichment.resetStaleZeroRelevance.mockResolvedValue({ reset: 2 });
    venueCapacity.backfillAll.mockResolvedValue({ processed: 8 });

    await controller.runGeocoderJob('75', req);
    await controller.runResetStaleEnrichment(req);
    await controller.runVenueCapacityBackfill(req);

    expect(geocoder.runOnce).toHaveBeenCalledWith(75);
    expect(enrichment.resetStaleZeroRelevance).toHaveBeenCalled();
    expect(venueCapacity.backfillAll).toHaveBeenCalled();
    expect(admin.runTrackedJob.mock.calls.map(([name, actor]) => [name, actor])).toEqual([
      ['geocoder', 'admin-1'],
      ['reset-stale-enrichment', 'admin-1'],
      ['venue-capacity-backfill', 'admin-1'],
    ]);
  });

  it('keeps the historical enrichment pipeline ordered and tracked', async () => {
    eventHistorical.seedCuratedAnchors.mockResolvedValue('seeded');
    eventHistorical.importFromWikidata.mockResolvedValue('imported');
    eventHistorical.refreshFromFirecrawl.mockResolvedValue('refreshed');
    eventHistorical.recomputeFeedbackAnchors.mockResolvedValue('feedback');
    eventHistorical.applyAnchorsAll.mockResolvedValue('applied');

    await expect(
      controller.runEventHistorical({ user: { userId: 'admin-1' } }),
    ).resolves.toEqual({ seeded: 'seeded', imported: 'imported', refreshed: 'refreshed', feedback: 'feedback', applied: 'applied' });

    expect(admin.runTrackedJob).toHaveBeenCalledWith(
      'event-historical',
      'admin-1',
      expect.any(Function),
    );
    expect(eventHistorical.seedCuratedAnchors.mock.invocationCallOrder[0]).toBeLessThan(
      eventHistorical.importFromWikidata.mock.invocationCallOrder[0],
    );
    expect(eventHistorical.importFromWikidata.mock.invocationCallOrder[0]).toBeLessThan(
      eventHistorical.refreshFromFirecrawl.mock.invocationCallOrder[0],
    );
    expect(eventHistorical.refreshFromFirecrawl.mock.invocationCallOrder[0]).toBeLessThan(
      eventHistorical.recomputeFeedbackAnchors.mock.invocationCallOrder[0],
    );
    expect(eventHistorical.recomputeFeedbackAnchors.mock.invocationCallOrder[0]).toBeLessThan(
      eventHistorical.applyAnchorsAll.mock.invocationCallOrder[0],
    );
  });
});
