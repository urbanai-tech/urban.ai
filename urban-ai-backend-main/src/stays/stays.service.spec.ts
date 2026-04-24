import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaysService } from './stays.service';
import { StaysConnector } from './stays-connector';
import { StaysAccount } from '../entities/stays-account.entity';
import { StaysListing } from '../entities/stays-listing.entity';
import { PriceUpdate } from '../entities/price-update.entity';
import { User } from '../entities/user.entity';

type Repo<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('StaysService', () => {
  let service: StaysService;
  let accountRepo: Repo<StaysAccount>;
  let listingRepo: Repo<StaysListing>;
  let priceUpdateRepo: Repo<PriceUpdate>;
  let userRepo: Repo<User>;
  let connector: {
    ping: jest.Mock;
    listListings: jest.Mock;
    pushPrice: jest.Mock;
  };

  beforeEach(async () => {
    accountRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (d) => ({ id: 'acc-1', ...d })),
    };
    listingRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (d) => ({ id: 'l-1', ...d })),
    };
    priceUpdateRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((d) => ({ id: 'pu-1', ...d })),
      save: jest.fn().mockImplementation(async (d) => d),
    };
    userRepo = { findOne: jest.fn() };
    connector = {
      ping: jest.fn(),
      listListings: jest.fn(),
      pushPrice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaysService,
        { provide: getRepositoryToken(StaysAccount), useValue: accountRepo },
        { provide: getRepositoryToken(StaysListing), useValue: listingRepo },
        { provide: getRepositoryToken(PriceUpdate), useValue: priceUpdateRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: StaysConnector, useValue: connector },
      ],
    }).compile();

    service = module.get<StaysService>(StaysService);
  });

  describe('connectAccount', () => {
    it('rejects when the accessToken fails the ping validation', async () => {
      userRepo.findOne!.mockResolvedValue({ id: 'u1' });
      connector.ping.mockResolvedValue(false);

      await expect(
        service.connectAccount('u1', { clientId: 'c', accessToken: 'bad' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(accountRepo.save).not.toHaveBeenCalled();
    });

    it('persists a new account with status=active when ping passes', async () => {
      userRepo.findOne!.mockResolvedValue({ id: 'u1' });
      accountRepo.findOne!.mockResolvedValue(null);
      connector.ping.mockResolvedValue(true);

      const result = await service.connectAccount('u1', { clientId: 'c1', accessToken: 't1' });

      expect(result.status).toBe('active');
      expect(accountRepo.save).toHaveBeenCalled();
    });

    it('overwrites an existing account when reconnecting', async () => {
      userRepo.findOne!.mockResolvedValue({ id: 'u1' });
      accountRepo.findOne!.mockResolvedValue({
        id: 'acc-old',
        clientId: 'old-c',
        accessToken: 'old-t',
        status: 'error',
        lastErrorMessage: 'previous error',
      });
      connector.ping.mockResolvedValue(true);

      await service.connectAccount('u1', { clientId: 'new-c', accessToken: 'new-t' });

      const saved = accountRepo.save!.mock.calls[0][0];
      expect(saved).toMatchObject({
        clientId: 'new-c',
        accessToken: 'new-t',
        status: 'active',
        lastErrorAt: null,
        lastErrorMessage: null,
      });
    });
  });

  describe('pushPrice — guardrails de variação', () => {
    function withActiveAccount(overrides: Partial<StaysAccount> = {}) {
      const user = { id: 'u1' };
      const account = {
        id: 'acc-1',
        user,
        accessToken: 't',
        status: 'active',
        maxIncreasePercent: 25,
        maxDecreasePercent: 20,
        ...overrides,
      } as any;
      accountRepo.findOne!.mockResolvedValue(account);
      return { user, account };
    }

    function withListing(listingId = 'l-1', basePriceCents = 10000) {
      const listing = {
        id: listingId,
        staysListingId: `stays-${listingId}`,
        account: { id: 'acc-1' },
        active: true,
        basePriceCents,
      };
      listingRepo.findOne!.mockResolvedValue(listing);
      return listing;
    }

    it('rejects when increase exceeds the account cap (+25%)', async () => {
      withActiveAccount();
      withListing();

      await expect(
        service.pushPrice('u1', {
          listingId: 'l-1',
          targetDate: '2026-05-01',
          previousPriceCents: 10000,
          newPriceCents: 13000, // +30%
          origin: 'ai_auto',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(connector.pushPrice).not.toHaveBeenCalled();
    });

    it('rejects when decrease exceeds the account cap (-20%)', async () => {
      withActiveAccount();
      withListing();

      await expect(
        service.pushPrice('u1', {
          listingId: 'l-1',
          targetDate: '2026-05-01',
          previousPriceCents: 10000,
          newPriceCents: 7000, // -30%
          origin: 'ai_auto',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows a push within the variation caps', async () => {
      withActiveAccount();
      withListing();
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      connector.pushPrice.mockResolvedValue({ ok: true, externalReference: 'ext-1' });

      const result = await service.pushPrice('u1', {
        listingId: 'l-1',
        targetDate: '2026-05-01',
        previousPriceCents: 10000,
        newPriceCents: 11500, // +15%
        origin: 'ai_auto',
      });

      expect(connector.pushPrice).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('success');
    });

    it('honors custom caps set on the account', async () => {
      withActiveAccount({ maxIncreasePercent: 50, maxDecreasePercent: 40 });
      withListing();
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      connector.pushPrice.mockResolvedValue({ ok: true });

      // +40% seria bloqueado com teto padrão 25%, mas não com teto custom 50%
      const result = await service.pushPrice('u1', {
        listingId: 'l-1',
        targetDate: '2026-05-01',
        previousPriceCents: 10000,
        newPriceCents: 14000,
        origin: 'ai_auto',
      });

      expect(result.status).toBe('success');
    });

    it('skips the caps when previousPriceCents is zero (no baseline)', async () => {
      withActiveAccount();
      withListing('l-1', 0);
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      connector.pushPrice.mockResolvedValue({ ok: true });

      // Não temos preço anterior para comparar — aceita qualquer valor novo.
      const result = await service.pushPrice('u1', {
        listingId: 'l-1',
        targetDate: '2026-05-01',
        previousPriceCents: 0,
        newPriceCents: 50000,
        origin: 'user_manual',
      });

      expect(result.status).toBe('success');
    });
  });

  describe('pushPrice — idempotência', () => {
    it('returns the existing PriceUpdate when idempotency key matches', async () => {
      accountRepo.findOne!.mockResolvedValue({
        id: 'acc-1',
        user: { id: 'u1' },
        accessToken: 't',
        status: 'active',
        maxIncreasePercent: 25,
        maxDecreasePercent: 20,
      });
      listingRepo.findOne!.mockResolvedValue({
        id: 'l-1',
        staysListingId: 'stays-l-1',
        account: { id: 'acc-1' },
        active: true,
      });

      const previousRecord = {
        id: 'pu-previous',
        status: 'success',
        targetDate: '2026-05-01',
        newPriceCents: 11500,
      };
      priceUpdateRepo.findOne!.mockResolvedValue(previousRecord);

      const result = await service.pushPrice('u1', {
        listingId: 'l-1',
        targetDate: '2026-05-01',
        previousPriceCents: 10000,
        newPriceCents: 11500,
        origin: 'ai_auto',
      });

      expect(result).toBe(previousRecord);
      expect(connector.pushPrice).not.toHaveBeenCalled();
      expect(priceUpdateRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('pushPrice — connector failures', () => {
    it('marks PriceUpdate as rejected when Stays returns ok=false', async () => {
      accountRepo.findOne!.mockResolvedValue({
        id: 'acc-1',
        user: { id: 'u1' },
        accessToken: 't',
        status: 'active',
        maxIncreasePercent: 25,
        maxDecreasePercent: 20,
      });
      listingRepo.findOne!.mockResolvedValue({
        id: 'l-1',
        staysListingId: 'stays-l-1',
        account: { id: 'acc-1' },
        active: true,
      });
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      connector.pushPrice.mockResolvedValue({ ok: false, rejectedReason: 'listing inactive' });

      const result = await service.pushPrice('u1', {
        listingId: 'l-1',
        targetDate: '2026-05-01',
        previousPriceCents: 10000,
        newPriceCents: 11500,
        origin: 'ai_auto',
      });

      expect(result.status).toBe('rejected');
      expect(result.errorMessage).toBe('listing inactive');
    });

    it('marks account as error when connector throws (network/5xx)', async () => {
      const account = {
        id: 'acc-1',
        user: { id: 'u1' },
        accessToken: 't',
        status: 'active',
        maxIncreasePercent: 25,
        maxDecreasePercent: 20,
        lastErrorAt: null,
        lastErrorMessage: null,
      };
      accountRepo.findOne!.mockResolvedValue(account);
      listingRepo.findOne!.mockResolvedValue({
        id: 'l-1',
        staysListingId: 'stays-l-1',
        account: { id: 'acc-1' },
        active: true,
      });
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      connector.pushPrice.mockRejectedValue(new Error('ECONNRESET'));

      await expect(
        service.pushPrice('u1', {
          listingId: 'l-1',
          targetDate: '2026-05-01',
          previousPriceCents: 10000,
          newPriceCents: 11500,
          origin: 'ai_auto',
        }),
      ).rejects.toThrow();

      // A conta foi marcada como error
      const accountSaves = accountRepo.save!.mock.calls.map((c) => c[0]);
      expect(accountSaves.some((a) => a.status === 'error')).toBe(true);
    });

    it('rejects when listing is inactive', async () => {
      accountRepo.findOne!.mockResolvedValue({
        id: 'acc-1',
        user: { id: 'u1' },
        accessToken: 't',
        status: 'active',
        maxIncreasePercent: 25,
        maxDecreasePercent: 20,
      });
      listingRepo.findOne!.mockResolvedValue({
        id: 'l-1',
        staysListingId: 'stays-l-1',
        account: { id: 'acc-1' },
        active: false, // inativo
      });

      await expect(
        service.pushPrice('u1', {
          listingId: 'l-1',
          targetDate: '2026-05-01',
          previousPriceCents: 10000,
          newPriceCents: 11500,
          origin: 'ai_auto',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when account is not active (disconnected/pending/error)', async () => {
      accountRepo.findOne!.mockResolvedValue({
        id: 'acc-1',
        user: { id: 'u1' },
        status: 'disconnected',
      });

      await expect(
        service.pushPrice('u1', {
          listingId: 'l-1',
          targetDate: '2026-05-01',
          previousPriceCents: 10000,
          newPriceCents: 11500,
          origin: 'ai_auto',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
