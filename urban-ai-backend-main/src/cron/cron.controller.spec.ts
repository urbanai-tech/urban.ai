jest.mock('./cron.service', () => ({ CronService: class CronService {} }));

import { CronController } from './cron.controller';

describe('CronController scheduled job adapters', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records a swallowed daily failure as ok=false without changing the public return contract', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const cronService = {
      buscarAnalisesAceitas: jest.fn().mockRejectedValue(new Error('provider unavailable')),
      enviarNotificacaoCron: jest.fn().mockResolvedValue(undefined),
    };
    let trackedResult: unknown;
    const runner = {
      runOncePerWindow: jest.fn(async (_name, _window, handler) => {
        trackedResult = await handler();
        return trackedResult;
      }),
    };
    const controller = new CronController(cronService as any, runner as any);

    await expect(controller.handleDailyNotification()).resolves.toBeUndefined();
    expect(trackedResult).toEqual({ ok: false, errorMessage: 'provider unavailable' });
    expect(runner.runOncePerWindow).toHaveBeenCalledWith(
      'accepted-analysis-notifications',
      expect.any(Date),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('records a swallowed monthly refresh failure as ok=false', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const cronService = {
      refreshPropertyMetadata: jest.fn().mockRejectedValue(new Error('scrape failed')),
    };
    let trackedResult: unknown;
    const runner = {
      runOncePerWindow: jest.fn(async (_name, _window, handler) => {
        trackedResult = await handler();
        return trackedResult;
      }),
    };
    const controller = new CronController(cronService as any, runner as any);

    await expect(controller.handleMonthlyMetadataRefresh()).resolves.toBeUndefined();
    expect(trackedResult).toEqual({ ok: false, errorMessage: 'scrape failed' });
  });

  it('delegates authenticated manual endpoints to CronService', async () => {
    const cronService = {
      buscarAnalisesAceitas: jest.fn().mockResolvedValue({ processed: 2 }),
      buscarAnalisesAceitasTeste: jest.fn().mockResolvedValue({ processed: 3 }),
      refreshPropertyMetadata: jest.fn().mockResolvedValue({ updated: 4 }),
    };
    const controller = new CronController(cronService as any);

    await expect(controller.buscarAnalisesAceitas()).resolves.toEqual({ processed: 2 });
    await expect(controller.buscarAnalisesAceitasTest()).resolves.toEqual({ processed: 3 });
    await expect(controller.refreshMetadata()).resolves.toEqual({ updated: 4 });
  });

  it('tracks a successful daily run and reports its summary', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const cronService = {
      buscarAnalisesAceitas: jest.fn().mockResolvedValue({
        iniciado: true,
        total: 4,
        processed: 2,
        skipped: 1,
        failed: 1,
        failures: [],
      }),
      enviarNotificacaoCron: jest.fn().mockResolvedValue(undefined),
    };
    let trackedResult: unknown;
    const runner = {
      runOncePerWindow: jest.fn(async (_name, _window, handler) => {
        trackedResult = await handler();
        return trackedResult;
      }),
    };
    const controller = new CronController(cronService as any, runner as any);

    await controller.handleDailyNotification();

    expect(trackedResult).toEqual(expect.objectContaining({
      ok: true,
      processed: 2,
      skipped: 1,
      failed: 1,
    }));
    expect(cronService.enviarNotificacaoCron).toHaveBeenNthCalledWith(
      1, 'Cron iniciado', 'Cron iniciado',
    );
    expect(cronService.enviarNotificacaoCron).toHaveBeenNthCalledWith(
      2, 'Cron concluido', 'Cron concluido: 2 processadas, 1 ignoradas, 1 com erro',
    );
  });

  it('does not fail the daily handler when status notification itself fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const cronService = {
      buscarAnalisesAceitas: jest.fn().mockResolvedValue({
        iniciado: true, total: 0, processed: 0, skipped: 0, failed: 0, failures: [],
      }),
      enviarNotificacaoCron: jest.fn().mockRejectedValue(new Error('mail unavailable')),
    };
    const controller = new CronController(cronService as any);

    await expect(controller.handleDailyNotification()).resolves.toBeUndefined();
    expect(cronService.buscarAnalisesAceitas).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      'Falha ao enviar notificação de status do cron:',
      expect.any(Error),
    );
  });

  it('normalizes a non-Error daily failure into the tracked outcome', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const cronService = {
      buscarAnalisesAceitas: jest.fn().mockRejectedValue('provider unavailable'),
      enviarNotificacaoCron: jest.fn().mockResolvedValue(undefined),
    };
    let trackedResult: unknown;
    const runner = {
      runOncePerWindow: jest.fn(async (_name, _window, handler) => {
        trackedResult = await handler();
        return trackedResult;
      }),
    };

    await new CronController(cronService as any, runner as any).handleDailyNotification();

    expect(trackedResult).toEqual({ ok: false, errorMessage: 'provider unavailable' });
  });

  it('tracks successful and non-Error failed monthly refreshes', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const successfulService = {
      refreshPropertyMetadata: jest.fn().mockResolvedValue({ total: 5, updated: 5, errors: 0 }),
    };
    let successResult: unknown;
    const successRunner = {
      runOncePerWindow: jest.fn(async (_name, _window, handler) => {
        successResult = await handler();
        return successResult;
      }),
    };

    await new CronController(successfulService as any, successRunner as any)
      .handleMonthlyMetadataRefresh();
    expect(successResult).toEqual({
      ok: true,
      result: { total: 5, updated: 5, errors: 0 },
    });

    const failingService = { refreshPropertyMetadata: jest.fn().mockRejectedValue('scrape offline') };
    let failureResult: unknown;
    const failureRunner = {
      runOncePerWindow: jest.fn(async (_name, _window, handler) => {
        failureResult = await handler();
        return failureResult;
      }),
    };
    await new CronController(failingService as any, failureRunner as any)
      .handleMonthlyMetadataRefresh();
    expect(failureResult).toEqual({ ok: false, errorMessage: 'scrape offline' });
  });
});
