import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { PaymentsService } from '../payments/payments.service';

type Repo<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: Repo<User>;
  let refreshRepo: Repo<RefreshToken>;
  let jwt: { sign: jest.Mock };
  let payments: { createPayment: jest.Mock };

  const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    refreshRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (d) => ({ id: 'rt-1', ...d })),
      update: jest.fn(),
    };
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    payments = { createPayment: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwt },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepo },
        { provide: PaymentsService, useValue: payments },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('rejects duplicate email with ConflictException', async () => {
      userRepo.findOne!.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ username: 'x', email: 'taken@test.com', password: 'pw' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(userRepo.save).not.toHaveBeenCalled();
      expect(payments.createPayment).not.toHaveBeenCalled();
    });

    it('persists a bcrypt hash (not the plaintext) for a new registration', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      userRepo.create!.mockImplementation((data) => data);
      userRepo.save!.mockImplementation(async (data) => ({ id: 'new-id', ...data }));

      await service.register({ username: 'u', email: 'new@test.com', password: 'minhasenha' });

      const saved = userRepo.save!.mock.calls[0][0];
      expect(saved.password).toMatch(/^\$2[aby]\$12\$/);
      expect(saved.password).not.toBe('minhasenha');
      expect(await bcrypt.compare('minhasenha', saved.password)).toBe(true);
      expect(payments.createPayment).toHaveBeenCalled();
    });

    it('bcrypts the pre-hashed (hex-64) password from the legacy frontend', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      userRepo.create!.mockImplementation((data) => data);
      userRepo.save!.mockImplementation(async (data) => ({ id: 'new-id', ...data }));

      const preHashed = sha256('whatever');
      await service.register({ username: 'u', email: 'new@test.com', password: preHashed });

      const saved = userRepo.save!.mock.calls[0][0];
      expect(saved.password).toMatch(/^\$2[aby]\$12\$/);
      // O caller pode depois logar mandando a mesma forma pré-hashada:
      expect(await bcrypt.compare(preHashed, saved.password)).toBe(true);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when user does not exist', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.login('nobody@test.com', 'pw')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException on wrong password (bcrypt-stored user)', async () => {
      userRepo.findOne!.mockResolvedValue({
        id: 'u1',
        email: 'u@test.com',
        password: await bcrypt.hash('correct', 12),
        username: 'u',
      });

      await expect(service.login('u@test.com', 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('returns a token pair on correct password for a bcrypt-stored user (no rehash)', async () => {
      const user = {
        id: 'u1',
        email: 'u@test.com',
        password: await bcrypt.hash('correct', 12),
        username: 'u',
      };
      userRepo.findOne!.mockResolvedValue(user);

      const result = await service.login('u@test.com', 'correct');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(result.refreshExpiresAt).toBeInstanceOf(Date);
      expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u1', username: 'u' });
      // A única gravação no user repo deve ser ausente (bcrypt já está no banco).
      expect(userRepo.save).not.toHaveBeenCalled();
      // Refresh token persistido.
      expect(refreshRepo.save).toHaveBeenCalledTimes(1);
    });

    it('accepts a legacy SHA-256 password and transparently rehashes to bcrypt', async () => {
      const legacyUser = {
        id: 'u-legacy',
        email: 'legacy@test.com',
        password: sha256('minhasenha'),
        username: 'legacy',
      };
      userRepo.findOne!.mockResolvedValue(legacyUser);
      userRepo.save!.mockImplementation(async (u) => u);

      const result = await service.login('legacy@test.com', 'minhasenha');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(userRepo.save).toHaveBeenCalledTimes(1);
      const savedUser = userRepo.save!.mock.calls[0][0];
      expect(savedUser.password).toMatch(/^\$2[aby]\$12\$/);
      expect(await bcrypt.compare('minhasenha', savedUser.password)).toBe(true);
    });

    it('rejects login for google_* accounts (no password auth)', async () => {
      userRepo.findOne!.mockResolvedValue({
        id: 'u-google',
        email: 'g@test.com',
        password: 'google_abc-123',
        username: 'g',
      });

      await expect(service.login('g@test.com', 'qualquercoisa')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('rotateRefreshToken', () => {
    it('throws when the refresh token does not exist', async () => {
      refreshRepo.findOne!.mockResolvedValue(null);

      await expect(service.rotateRefreshToken('deadbeef')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws and revokes all user sessions when a revoked token is reused', async () => {
      const user = { id: 'u1', username: 'u' };
      refreshRepo.findOne!.mockResolvedValue({
        id: 'rt-old',
        user,
        revokedAt: new Date('2026-01-01'),
        expiresAt: new Date('2099-01-01'),
      });

      await expect(service.rotateRefreshToken('reused-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      // Deve ter tentado revogar todos os refresh ativos do user
      expect(refreshRepo.update).toHaveBeenCalled();
    });

    it('throws when the refresh token is expired', async () => {
      const user = { id: 'u1', username: 'u' };
      refreshRepo.findOne!.mockResolvedValue({
        id: 'rt-old',
        user,
        revokedAt: null,
        expiresAt: new Date('2000-01-01'),
      });

      await expect(service.rotateRefreshToken('expired-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('revokes the current token and issues a new pair on happy path', async () => {
      const user = { id: 'u1', username: 'u' };
      const record = {
        id: 'rt-current',
        user,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      refreshRepo.findOne!.mockResolvedValue(record);

      const tokens = await service.rotateRefreshToken('valid-token');

      // A linha antiga foi marcada como revogada via .save
      expect(refreshRepo.save).toHaveBeenCalled();
      const savedOld = refreshRepo.save!.mock.calls.find(
        (call) => call[0]?.id === 'rt-current',
      );
      expect(savedOld[0].revokedAt).toBeInstanceOf(Date);

      // Novo par emitido
      expect(tokens.accessToken).toBe('signed.jwt.token');
      expect(tokens.refreshToken).not.toBe('valid-token');
    });
  });

  describe('getProfileById', () => {
    it('never returns the password field', async () => {
      userRepo.findOne!.mockResolvedValue({
        id: 'u1',
        email: 'u@test.com',
        password: await bcrypt.hash('secret', 12),
        username: 'u',
      });

      const profile = await service.getProfileById('u1');

      expect((profile as any).password).toBeUndefined();
      expect(profile).toMatchObject({ id: 'u1', email: 'u@test.com', username: 'u' });
    });
  });
});
