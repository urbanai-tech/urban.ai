import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StaysService } from './stays.service';
import { StaysConnector, StaysConnectorError } from './stays-connector';
import { StaysAccount } from '../entities/stays-account.entity';
import { StaysListing } from '../entities/stays-listing.entity';
import { PriceUpdate } from '../entities/price-update.entity';
import { User } from '../entities/user.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { List } from '../entities/list.entity';
import { Address } from '../entities/addresses.entity';

/**
 * Ciclo de vida das operações Stays com um "ledger" em memória que imita o
 * banco (PriceUpdate por idempotencyKey/rollbackOf) e um calendário Stays
 * falso que exige a baseline ao vivo — como o conector real.
 */
describe('StaysService — ciclo de vida, vínculo e conta', () => {
  const env = { ...process.env };
  let service: StaysService;
  let accounts: Map<string, any>;
  let listings: Map<string, any>;
  let records: Map<string, any>;
  let prices: Map<string, number>;
  let failNextPush: unknown;
  let sequence: number;
  let clock: number;
  let connector: any;
  let listRepo: any;
  let addressRepo: any;
  let analiseRepo: any;

  const matches = (record: any, where: any): boolean =>
    Object.entries(where).every(([key, expected]: [string, any]) => {
      const actual = record?.[key];
      if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
        if (expected._type === 'in') return expected._value.includes(actual?.id ?? actual);
        if ('_value' in expected) return expected._value.includes(actual?.id ?? actual);
        return matches(actual, expected);
      }
      return actual === expected;
    });

  beforeEach(async () => {
    process.env = { ...env, STAYS_PRICE_WRITES_ENABLED: 'true', STAYS_TOKEN_ENCRYPTION_KEY: 'k' };
    delete process.env.STAYS_API_BASE_URL;
    accounts = new Map();
    listings = new Map();
    records = new Map();
    prices = new Map();
    failNextPush = null;
    sequence = 0;
    clock = Date.parse('2026-10-25T12:00:00Z');
    for (const user of ['u1', 'u2']) {
      accounts.set(user, {
        id: `account-${user}`, user: { id: user }, clientId: user, accessToken: 'secret',
        apiAccountSlug: `conta-${user}`, status: 'active', consecutiveFailures: 0,
        consentAcceptedAt: new Date(), consentVersion: 'stays-connect-v1',
        maxIncreasePercent: 25, maxDecreasePercent: 20,
      });
      listings.set(`listing-${user}`, {
        id: `listing-${user}`, staysListingId: 'same-remote-id', active: true,
        account: { id: `account-${user}` }, propriedade: null, title: 'Apto Vila Madalena 101', shortAddress: 'Rua Aspicuelta, 10, São Paulo',
      });
    }

    const accountRepo = {
      findOne: jest.fn(async ({ where }) => accounts.get(where.user.id) ?? null),
      save: jest.fn(async (a) => a),
      create: jest.fn((a) => a),
    };
    const listingRepo = {
      findOne: jest.fn(async ({ where }) => [...listings.values()].find((l) => matches(l, where)) ?? null),
      find: jest.fn(async ({ where }) => [...listings.values()].filter((l) => matches(l, where))),
      save: jest.fn(async (l) => { listings.set(l.id, l); return l; }),
      create: jest.fn((l) => l),
    };
    const priceUpdateRepo = {
      create: jest.fn((data) => ({ id: `update-${++sequence}`, createdAt: new Date(clock + sequence), ...data })),
      save: jest.fn(async (record) => { records.set(record.id, record); return record; }),
      findOne: jest.fn(async ({ where }) => [...records.values()].find((r) => matches(r, where)) ?? null),
      find: jest.fn(async ({ where, take }) => {
        const found = [...records.values()].filter((r) => matches(r, where))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return take ? found.slice(0, take) : found;
      }),
    };
    listRepo = {
      findOne: jest.fn(async ({ where }) => {
        const owned: Record<string, string> = { 'property-u1': 'u1', 'property-u1-b': 'u1', 'property-u2': 'u2' };
        return owned[where.id] === where.user.id ? { id: where.id, titulo: 'x', user: { id: where.user.id } } : null;
      }),
      find: jest.fn(async ({ where }) => where.user.id === 'u1' ? [
        { id: 'property-u1', titulo: 'Studio Pinheiros', internalNickname: null },
        { id: 'property-u1-b', titulo: 'Apto Vila Madalena', internalNickname: '101' },
      ] : []),
    };
    addressRepo = {
      find: jest.fn(async () => [
        { list: { id: 'property-u1-b' }, logradouro: 'Rua Aspicuelta', numero: '10', bairro: 'Vila Madalena', cidade: 'São Paulo' },
        { list: { id: 'property-u1' }, logradouro: 'Rua dos Pinheiros', numero: '500', bairro: 'Pinheiros', cidade: 'São Paulo' },
      ]),
    };
    analiseRepo = { findOne: jest.fn().mockResolvedValue(null), createQueryBuilder: jest.fn() };
    connector = {
      ping: jest.fn().mockResolvedValue(true),
      listListings: jest.fn(),
      invalidateInventory: jest.fn(),
      readCurrentPriceCents: jest.fn(async (credentials) => prices.get(credentials.clientId) ?? 10000),
      pushPrice: jest.fn(async (credentials, input) => {
        if (failNextPush) {
          const error = failNextPush;
          failNextPush = null;
          throw error;
        }
        const live = prices.get(credentials.clientId) ?? 10000;
        if (live !== input.previousPriceCents) return { ok: false, rejectedReason: 'previous_price_changed' };
        prices.set(credentials.clientId, input.priceCents);
        return { ok: true };
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StaysService,
        { provide: getRepositoryToken(StaysAccount), useValue: accountRepo },
        { provide: getRepositoryToken(StaysListing), useValue: listingRepo },
        { provide: getRepositoryToken(PriceUpdate), useValue: priceUpdateRepo },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(async ({ where }) => ({ id: where.id })) } },
        { provide: getRepositoryToken(AnalisePreco), useValue: analiseRepo },
        { provide: getRepositoryToken(List), useValue: listRepo },
        { provide: getRepositoryToken(Address), useValue: addressRepo },
        { provide: StaysConnector, useValue: connector },
      ],
    }).compile();
    service = moduleRef.get(StaysService);
  });

  afterAll(() => {
    process.env = env;
  });

  const operation = {
    requestId: 'c32e0d3e-4025-4a1e-8656-22354247f579',
    listingId: 'listing-u1', targetDate: '2026-11-15',
    previousPriceCents: 10000, newPriceCents: 11000,
    currency: 'BRL', origin: 'user_accepted' as const,
  };

  // ---------- Fix 3: rollback que falhou pode ser repetido ----------
  describe('rollback retries', () => {
    it('creates a NEW attempt after a failed rollback instead of returning the failed record', async () => {
      const applied = await service.pushPrice('u1', operation);
      expect(applied.status).toBe('success');

      failNextPush = new StaysConnectorError('Stays price operation failed; reconcile calendar before retrying', 'transient');
      await expect(service.rollback('u1', applied.id)).rejects.toBeDefined();
      const failed = [...records.values()].find((r) => r.origin === 'rollback');
      expect(failed).toMatchObject({ status: 'error', rollbackOf: { id: applied.id } });
      expect(accounts.get('u1').status).toBe('active');

      const retried = await service.rollback('u1', applied.id);
      expect(retried.id).not.toBe(failed.id);
      expect(retried).toMatchObject({ status: 'success', origin: 'rollback', rollbackOf: { id: applied.id } });
      expect(retried.idempotencyKey).not.toBe(failed.idempotencyKey);
      expect(prices.get('u1')).toBe(10000);
      expect(connector.pushPrice).toHaveBeenCalledTimes(3);
    });

    it('is idempotent once a rollback succeeded', async () => {
      const applied = await service.pushPrice('u1', operation);
      const first = await service.rollback('u1', applied.id);
      const again = await service.rollback('u1', applied.id);
      expect(again).toBe(first);
      expect(connector.pushPrice).toHaveBeenCalledTimes(2);
    });

    it('refuses a parallel rollback while one is in flight, but not a stale pending one', async () => {
      const applied = await service.pushPrice('u1', operation);
      records.set('in-flight', {
        id: 'in-flight', user: { id: 'u1' }, origin: 'rollback', status: 'pending',
        rollbackOf: { id: applied.id }, createdAt: new Date(),
      });
      await expect(service.rollback('u1', applied.id)).rejects.toMatchObject({ status: 409 });
      records.get('in-flight').createdAt = new Date(Date.now() - 11 * 60_000);
      await expect(service.rollback('u1', applied.id)).resolves.toMatchObject({ status: 'success' });
    });

    it('stops after the attempt limit', async () => {
      const applied = await service.pushPrice('u1', operation);
      for (let i = 0; i < 5; i++) {
        records.set(`failed-${i}`, {
          id: `failed-${i}`, user: { id: 'u1' }, origin: 'rollback', status: 'error',
          rollbackOf: { id: applied.id }, createdAt: new Date(clock - 1000 + i),
        });
      }
      await expect(service.rollback('u1', applied.id)).rejects.toMatchObject({ status: 409 });
    });

    it('never rolls back a rollback', async () => {
      const applied = await service.pushPrice('u1', operation);
      const rb = await service.rollback('u1', applied.id);
      await expect(service.rollback('u1', rb.id)).rejects.toMatchObject({ status: 400 });
    });
  });

  // ---------- Fix 4: geração de rollback / tentativas para o auto-apply ----------
  describe('getAutoApplyState', () => {
    const auto = (requestId: string) => ({
      ...operation, requestId, origin: 'ai_auto' as const, analisePrecoId: 'analysis-1',
    });
    beforeEach(() => {
      listings.get('listing-u1').propriedade = { id: 'property-u1' };
      analiseRepo.findOne.mockResolvedValue({
        id: 'analysis-1', usuarioProprietario: { id: 'u1' }, endereco: { list: { id: 'property-u1' } },
      });
    });

    it('reports rollback generation so a re-push after rollback is a new operation', async () => {
      const first = await service.pushPrice('u1', auto('ai_auto:analysis-1:d1:g0:a0'));
      expect(await service.getAutoApplyState('analysis-1')).toMatchObject({ activeSuccess: true, rollbackGeneration: 0 });

      await service.rollback('u1', first.id);
      const afterRollback = await service.getAutoApplyState('analysis-1');
      expect(afterRollback).toMatchObject({ activeSuccess: false, rollbackGeneration: 1, failedAttempts: 0 });
      expect(afterRollback.lastRollbackAt).toBeInstanceOf(Date);

      // mesmo requestId antigo seria deduplicado (no-op) …
      expect(await service.pushPrice('u1', auto('ai_auto:analysis-1:d1:g0:a0'))).toBe(first);
      // … a nova geração publica de fato
      const second = await service.pushPrice('u1', auto('ai_auto:analysis-1:d2:g1:a0'));
      expect(second.id).not.toBe(first.id);
      expect(second.status).toBe('success');
      expect(prices.get('u1')).toBe(11000);
    });

    it('counts failed attempts so each retry gets a fresh requestId', async () => {
      prices.set('u1', 9000); // baseline mudou → rejected
      const rejected = await service.pushPrice('u1', auto('ai_auto:analysis-1:d1:g0:a0'));
      expect(rejected.status).toBe('rejected');
      const state = await service.getAutoApplyState('analysis-1');
      expect(state).toMatchObject({ activeSuccess: false, failedAttempts: 1 });
      expect(state.lastFailureAt).toBeInstanceOf(Date);
    });
  });

  describe('operation identifiers', () => {
    it('rejects reuse of a requestId with a different payload', async () => {
      await service.pushPrice('u1', operation);
      await expect(service.pushPrice('u1', { ...operation, newPriceCents: 12000 })).rejects.toMatchObject({ status: 409 });
      expect(connector.pushPrice).toHaveBeenCalledTimes(1);
    });

    it('keeps matching remote IDs and request IDs isolated between accounts', async () => {
      const first = await service.pushPrice('u1', operation);
      const second = await service.pushPrice('u2', { ...operation, listingId: 'listing-u2' });
      expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
      expect(connector.pushPrice.mock.calls.map(([credentials]) => credentials.accountSlug)).toEqual(['conta-u1', 'conta-u2']);
      await expect(service.pushPrice('u2', operation)).rejects.toMatchObject({ status: 404 });
    });

    it('blocks every write before persistence while STAYS_PRICE_WRITES_ENABLED is off', async () => {
      delete process.env.STAYS_PRICE_WRITES_ENABLED;
      await expect(service.pushPrice('u1', operation)).rejects.toThrow('escrita desligada');
      expect(records.size).toBe(0);
      expect(connector.pushPrice).not.toHaveBeenCalled();
      const preview = await service.previewPrice('u1', { listingId: 'listing-u1', targetDate: '2026-11-15', newPriceCents: 11000 });
      expect(preview.priceWritesEnabled).toBe(false);
      expect(preview.readyForPush).toBe(false);
      expect(preview.blockers.map((b) => b.code)).toContain('stays_price_writes_disabled');
      expect(service.getCapabilities()).toEqual({ priceWritesEnabled: false, autoApplyEnabled: false, autoApplyDryRun: true });
    });
  });

  // ---------- Fix 8: vínculo listing ↔ imóvel com checagem de dono ----------
  describe('linkListingToProperty (ownership)', () => {
    it('links a listing to a property owned by the same user', async () => {
      const linked = await service.linkListingToProperty('u1', 'listing-u1', 'property-u1');
      expect(linked.propriedade).toMatchObject({ id: 'property-u1' });
      expect(listRepo.findOne).toHaveBeenCalledWith({ where: { id: 'property-u1', user: { id: 'u1' } } });
    });

    it("refuses another user's property (404) without saving", async () => {
      await expect(service.linkListingToProperty('u1', 'listing-u1', 'property-u2')).rejects.toMatchObject({ status: 404 });
      expect(listings.get('listing-u1').propriedade).toBeNull();
    });

    it("refuses another user's listing (404)", async () => {
      await expect(service.linkListingToProperty('u1', 'listing-u2', 'property-u1')).rejects.toMatchObject({ status: 404 });
      await expect(service.linkListingToProperty('u1', 'listing-u2', null)).rejects.toMatchObject({ status: 404 });
    });

    it('refuses linking a property already linked to another listing of the account (409)', async () => {
      listings.set('listing-u1-b', { id: 'listing-u1-b', staysListingId: 'other', active: true, account: { id: 'account-u1' }, propriedade: null });
      await service.linkListingToProperty('u1', 'listing-u1', 'property-u1');
      await expect(service.linkListingToProperty('u1', 'listing-u1-b', 'property-u1')).rejects.toMatchObject({ status: 409 });
      // re-vincular o mesmo par é idempotente
      await expect(service.linkListingToProperty('u1', 'listing-u1', 'property-u1')).resolves.toBeDefined();
    });

    it('unlinks', async () => {
      await service.linkListingToProperty('u1', 'listing-u1', 'property-u1');
      const unlinked = await service.linkListingToProperty('u1', 'listing-u1', null);
      expect(unlinked.propriedade).toBeNull();
    });

    it('requires a Stays account', async () => {
      accounts.delete('u1');
      await expect(service.linkListingToProperty('u1', 'listing-u1', 'property-u1')).rejects.toMatchObject({ status: 404 });
    });

    it('suggests the best property by name/address similarity for unlinked listings only', async () => {
      const suggestions = await service.suggestListingMatches('u1');
      expect(suggestions).toEqual([
        expect.objectContaining({ listingId: 'listing-u1', propriedadeId: 'property-u1-b', reason: 'name_address_similarity' }),
      ]);
      expect(suggestions[0].score).toBeGreaterThanOrEqual(0.2);
      await service.linkListingToProperty('u1', 'listing-u1', 'property-u1-b');
      expect(await service.suggestListingMatches('u1')).toEqual([]);
    });

    it('lists only the active properties of the user for the selector', async () => {
      expect(await service.listLinkableProperties('u1')).toEqual([
        { id: 'property-u1', titulo: 'Studio Pinheiros', internalNickname: null },
        { id: 'property-u1-b', titulo: 'Apto Vila Madalena', internalNickname: '101' },
      ]);
      expect(listRepo.find).toHaveBeenLastCalledWith({ where: { user: { id: 'u1' }, ativo: true } });
    });

    it('returns no suggestions for users without properties', async () => {
      expect(await service.suggestListingMatches('u2')).toEqual([]);
    });
  });

  describe('getRecommendationForListing', () => {
    function queryReturning(rows: any[]) {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      analiseRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('returns null for an unlinked listing', async () => {
      expect(await service.getRecommendationForListing('u1', 'listing-u1')).toBeNull();
    });

    it('returns the newest future recommendation of the owner for the linked property', async () => {
      listings.get('listing-u1').propriedade = { id: 'property-u1' };
      const qb = queryReturning([
        { id: 'past', precoSugerido: 200, evento: { nome: 'Antigo', dataInicio: new Date('2026-01-01T12:00:00Z') } },
        { id: 'next', precoSugerido: '345.67', evento: { nome: 'Show', dataInicio: new Date('2099-01-10T23:30:00Z') } },
      ]);
      expect(await service.getRecommendationForListing('u1', 'listing-u1')).toEqual({
        analisePrecoId: 'next', targetDate: '2099-01-10', recommendedPriceCents: 34567, eventName: 'Show',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('owner.id = :userId', { userId: 'u1' });
    });

    it("refuses another user's listing", async () => {
      await expect(service.getRecommendationForListing('u1', 'listing-u2')).rejects.toMatchObject({ status: 404 });
    });
  });

  // ---------- Fix 1/7: conexão por slug e reconexão defensiva ----------
  describe('connectAccount (slug)', () => {
    const input = { accountSlug: 'conta-u1', clientId: 'u1', accessToken: 'secret-123', consentAccepted: true, consentVersion: 'v1' };

    it('stores only the slug and pings with it', async () => {
      const saved = await service.connectAccount('u1', input);
      expect(saved.apiAccountSlug).toBe('conta-u1');
      expect(connector.ping).toHaveBeenCalledWith({ clientId: 'u1', clientSecret: 'secret-123', accountSlug: 'conta-u1' });
      expect(connector.invalidateInventory).toHaveBeenCalled();
    });

    it.each(['https://evil.example', 'conta.evil', 'UPPER', '../x'])('rejects identifier %j with 400 before contacting Stays', async (accountSlug) => {
      await expect(service.connectAccount('u1', { ...input, accountSlug })).rejects.toMatchObject({ status: 400 });
      expect(connector.ping).not.toHaveBeenCalled();
    });

    it('refuses switching an existing account to another Stays account', async () => {
      await expect(service.connectAccount('u1', { ...input, accountSlug: 'outra' })).rejects.toMatchObject({ status: 400 });
      expect(connector.ping).not.toHaveBeenCalled();
    });

    it('does not 500 when the stored value is malformed; replaces it on reconnect', async () => {
      accounts.get('u1').apiAccountSlug = 'https://legacy.example/oops';
      const saved = await service.connectAccount('u1', input);
      expect(saved.apiAccountSlug).toBe('conta-u1');
    });

    it('does not 500 when the environment fallback URL is malformed', async () => {
      accounts.get('u1').apiAccountSlug = null;
      process.env.STAYS_API_BASE_URL = 'not a url';
      await expect(service.connectAccount('u1', input)).resolves.toMatchObject({ apiAccountSlug: 'conta-u1' });
    });

    it('resets the failure counter on reconnect', async () => {
      Object.assign(accounts.get('u1'), { status: 'error', consecutiveFailures: 3 });
      const saved = await service.connectAccount('u1', input);
      expect(saved).toMatchObject({ status: 'active', consecutiveFailures: 0, lastErrorMessage: null });
    });
  });

  describe('branches auxiliares', () => {
    it('lists price history scoped to the user, optionally by listing, with a bounded page', async () => {
      await service.pushPrice('u1', operation);
      const repo = (service as any).priceUpdateRepo;
      await service.listPriceUpdates('u1');
      await service.listPriceUpdates('u1', 'listing-u1', 1000);
      expect(repo.find.mock.calls.slice(-2).map(([arg]: any) => [arg.where, arg.take])).toEqual([
        [{ user: { id: 'u1' } }, 20],
        [{ user: { id: 'u1' }, listing: { id: 'listing-u1' } }, 100],
      ]);
    });

    it('marks the account as error when sync gets 401, and keeps it active on timeout', async () => {
      connector.listListings.mockRejectedValueOnce(new StaysConnectorError('Stays read failed', 'transient'));
      await expect(service.syncListings('u1')).rejects.toMatchObject({ status: 503 });
      expect(accounts.get('u1').status).toBe('active');
      connector.listListings.mockRejectedValueOnce(new StaysConnectorError('Stays authentication failed (HTTP 401)', 'auth', 401));
      await expect(service.syncListings('u1')).rejects.toMatchObject({ status: 400 });
      expect(accounts.get('u1').status).toBe('error');
    });

    it('maps a contract failure to 502 with the sanitized message', async () => {
      failNextPush = new StaysConnectorError('Stays write could not be reconciled; inspect calendar before any new write', 'contract');
      await expect(service.pushPrice('u1', operation)).rejects.toMatchObject({ status: 502 });
    });

    it('readCurrentPriceCents returns null for inactive accounts and 404 for foreign listings', async () => {
      await expect(service.readCurrentPriceCents('u1', 'listing-u2', '2026-11-15')).rejects.toMatchObject({ status: 404 });
      accounts.get('u1').status = 'error';
      expect(await service.readCurrentPriceCents('u1', 'listing-u1', '2026-11-15')).toBeNull();
    });

    it('preview flags dates without a single tariff and prices already at target', async () => {
      connector.readCurrentPriceCents.mockResolvedValueOnce(null);
      const noTariff = await service.previewPrice('u1', { listingId: 'listing-u1', targetDate: '2026-11-15', newPriceCents: 11000 });
      expect(noTariff.warnings.map((w) => w.code)).toContain('calendar_requires_pricing_mapping');
      expect(noTariff.previousPriceSource).toBe('unavailable');
      const same = await service.previewPrice('u1', { listingId: 'listing-u1', targetDate: '2026-11-15', newPriceCents: 10000 });
      expect(same.warnings.map((w) => w.code)).toContain('price_already_at_target');
      expect(same.previousPriceSource).toBe('stays_calendar');
    });

    it('preview with a requestId looks up the user_accepted operation receipt', async () => {
      const applied = await service.pushPrice('u1', operation);
      const preview = await service.previewPrice('u1', {
        requestId: operation.requestId, listingId: 'listing-u1', targetDate: operation.targetDate, newPriceCents: operation.newPriceCents,
      });
      expect(preview.existingPriceUpdateId).toBe(applied.id);
    });

    it('reports capabilities from the environment', () => {
      process.env.STAYS_AUTO_APPLY_ENABLED = 'true';
      process.env.STAYS_AUTO_APPLY_DRY_RUN = 'false';
      expect(service.getCapabilities()).toEqual({ priceWritesEnabled: true, autoApplyEnabled: true, autoApplyDryRun: false });
    });

    it('disconnect clears the credential and the inventory cache', async () => {
      await service.disconnectAccount('u1');
      expect(accounts.get('u1')).toMatchObject({ status: 'disconnected', accessToken: '' });
      expect(connector.invalidateInventory).toHaveBeenCalledWith(expect.objectContaining({ accountSlug: 'conta-u1' }));
      accounts.delete('u2');
      await expect(service.disconnectAccount('u2')).resolves.toBeUndefined();
    });

    it('recommendation skips analyses without event or with invalid prices', async () => {
      listings.get('listing-u1').propriedade = { id: 'property-u1' };
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(), leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'no-event', precoSugerido: 100, evento: null },
          { id: 'bad-price', precoSugerido: 'abc', evento: { nome: 'X', dataInicio: new Date('2099-01-01T12:00:00Z') } },
        ]),
      };
      analiseRepo.createQueryBuilder.mockReturnValue(qb);
      expect(await service.getRecommendationForListing('u1', 'listing-u1')).toBeNull();
      accounts.delete('u1');
      await expect(service.getRecommendationForListing('u1', 'listing-u1')).rejects.toMatchObject({ status: 404 });
      expect(await service.suggestListingMatches('u1')).toEqual([]);
    });

    it('caps the failure threshold from the environment', async () => {
      process.env.STAYS_ACCOUNT_ERROR_THRESHOLD = '1';
      failNextPush = new StaysConnectorError('contract', 'contract');
      await expect(service.pushPrice('u1', operation)).rejects.toBeDefined();
      expect(accounts.get('u1').status).toBe('error');
      delete process.env.STAYS_ACCOUNT_ERROR_THRESHOLD;
    });
  });
});
