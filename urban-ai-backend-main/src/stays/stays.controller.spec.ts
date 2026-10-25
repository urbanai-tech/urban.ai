import { BadRequestException, ParseUUIDPipe, ValidationPipe } from '@nestjs/common';
import { StaysController } from './stays.controller';
import { StaysService } from './stays.service';
import { ConnectStaysDto, LinkStaysListingDto, ListPriceUpdatesQueryDto } from './stays.dto';

const req = (userId = 'owner') => ({ user: { userId }, ip: '127.0.0.1', headers: { 'user-agent': 'jest' } }) as any;

describe('StaysController', () => {
  describe('account public state', () => {
    it.each(['active', 'disconnected', 'error', 'pending'])('preserves %s without exposing credentials', async (status) => {
      const saved = {
        id: 'account-1', status, clientId: 'test-client', apiAccountSlug: 'conta',
        lastSyncAt: null, consentVersion: 'v1', consentAcceptedAt: null,
        accessToken: 'synthetic-secret', user: { id: 'owner', email: 'private@example.invalid' },
        lastErrorMessage: 'internal diagnostic', consecutiveFailures: 2,
      };
      const getAccount = jest.fn().mockResolvedValue(saved);
      const controller = new StaysController({ getAccount } as unknown as StaysService);
      const result = await controller.account(req());
      expect(getAccount).toHaveBeenCalledWith('owner');
      expect(result).toEqual({
        id: 'account-1', status, clientId: 'test-client', accountSlug: 'conta',
        lastSyncAt: null, consentVersion: 'v1', consentAcceptedAt: null,
      });
      expect(JSON.stringify(result)).not.toContain('synthetic-secret');
    });

    it('returns null only when no account exists', async () => {
      const controller = new StaysController({ getAccount: jest.fn().mockResolvedValue(null) } as unknown as StaysService);
      expect(await controller.account(req())).toBeNull();
    });

    it('propagates lookup failures instead of reporting no account', async () => {
      const controller = new StaysController({ getAccount: jest.fn().mockRejectedValue(new Error('database unavailable')) } as unknown as StaysService);
      await expect(controller.account(req())).rejects.toThrow('database unavailable');
    });
  });

  describe('listing ↔ property link', () => {
    it('always scopes link/unlink to the authenticated user', async () => {
      const linkListingToProperty = jest.fn().mockResolvedValue({ id: 'l1', propriedade: { id: 'p1' }, staysListingId: 'r1' });
      const controller = new StaysController({ linkListingToProperty } as unknown as StaysService);
      await expect(controller.linkProperty(req('u1'), 'l1', { propriedadeId: 'p1' })).resolves.toMatchObject({ id: 'l1', propriedadeId: 'p1' });
      await controller.unlinkProperty(req('u1'), 'l1');
      expect(linkListingToProperty.mock.calls).toEqual([['u1', 'l1', 'p1'], ['u1', 'l1', null]]);
    });

    it('validates path ids as UUID', async () => {
      await expect(new ParseUUIDPipe().transform('not-a-uuid', { type: 'param' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lists price history with the public projection only', async () => {
      const listPriceUpdates = jest.fn().mockResolvedValue([{
        id: 'pu', listing: { id: 'l1' }, targetDate: '2026-11-01', previousPriceCents: 1, newPriceCents: 2,
        currency: 'BRL', origin: 'rollback', status: 'success', errorMessage: null, rollbackOf: { id: 'orig' },
        createdAt: 'x', ip: '10.0.0.1', userAgent: 'secret-agent', idempotencyKey: 'k',
      }]);
      const controller = new StaysController({ listPriceUpdates } as unknown as StaysService);
      const [row] = await controller.priceUpdates(req('u1'), { listingId: 'l1' });
      expect(listPriceUpdates).toHaveBeenCalledWith('u1', 'l1', 20);
      expect(row).toEqual({
        id: 'pu', listingId: 'l1', targetDate: '2026-11-01', previousPriceCents: 1, newPriceCents: 2,
        currency: 'BRL', origin: 'rollback', status: 'success', errorMessage: null, rollbackOfId: 'orig', createdAt: 'x',
      });
    });

    it('exposes environment capabilities', () => {
      const getCapabilities = jest.fn().mockReturnValue({ priceWritesEnabled: false, autoApplyEnabled: false, autoApplyDryRun: true });
      const controller = new StaysController({ getCapabilities } as unknown as StaysService);
      expect(controller.capabilities()).toEqual({ priceWritesEnabled: false, autoApplyEnabled: false, autoApplyDryRun: true });
    });
  });

  describe('runtime DTOs', () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    const base = { clientId: 'client', accessToken: 'token-123', consentAccepted: true, consentVersion: 'v1' };

    it.each(['conta', 'minha-conta-2'])('accepts account slug %j', async (accountSlug) => {
      await expect(pipe.transform({ ...base, accountSlug }, { type: 'body', metatype: ConnectStaysDto })).resolves.toBeDefined();
    });

    it.each(['https://conta.stays.net', 'conta.stays.net', 'Conta', 'x'.repeat(64), 'a/b'])(
      'rejects account identifier %j (no free URLs reach the server)', async (accountSlug) => {
        await expect(pipe.transform({ ...base, accountSlug }, { type: 'body', metatype: ConnectStaysDto }))
          .rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it('rejects the legacy apiBaseUrl field', async () => {
      await expect(pipe.transform({ ...base, apiBaseUrl: 'https://evil.example' }, { type: 'body', metatype: ConnectStaysDto }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires a UUID to link and bounds the history query', async () => {
      await expect(pipe.transform({}, { type: 'body', metatype: LinkStaysListingDto })).rejects.toBeInstanceOf(BadRequestException);
      await expect(pipe.transform({ propriedadeId: 'x' }, { type: 'body', metatype: LinkStaysListingDto })).rejects.toBeInstanceOf(BadRequestException);
      await expect(pipe.transform({ limit: '500' }, { type: 'query', metatype: ListPriceUpdatesQueryDto })).rejects.toBeInstanceOf(BadRequestException);
      await expect(pipe.transform({ limit: '5' }, { type: 'query', metatype: ListPriceUpdatesQueryDto })).resolves.toEqual(expect.objectContaining({ limit: 5 }));
    });
  });
});
