import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
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

      const registered = await service.register({ username: 'u', email: 'new@test.com', password: 'minhasenha' });

      const saved = userRepo.save!.mock.calls[0][0];
      expect(saved.password).toMatch(/^\$2[aby]\$12\$/);
      expect(saved.password).not.toBe('minhasenha');
      expect(await bcrypt.compare('minhasenha', saved.password)).toBe(true);
      expect((registered as any).password).toBeUndefined();
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

    it('rejects login for inactive users', async () => {
      userRepo.findOne!.mockResolvedValue({
        id: 'u-inactive',
        email: 'inactive@test.com',
        password: await bcrypt.hash('correct', 12),
        username: 'inactive',
        ativo: false,
      });

      await expect(service.login('inactive@test.com', 'correct')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshRepo.save).not.toHaveBeenCalled();
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

    it('revokes active sessions and rejects refresh for inactive users', async () => {
      const user = { id: 'u-inactive', username: 'u', ativo: false };
      refreshRepo.findOne!.mockResolvedValue({
        id: 'rt-current',
        user,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await expect(service.rotateRefreshToken('valid-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshRepo.update).toHaveBeenCalledWith(
        { user: { id: 'u-inactive' }, revokedAt: expect.anything() },
        { revokedAt: expect.any(Date) },
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

  describe('googleLogin', () => {
    const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
    const originalGoogleOauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const originalNextPublicGoogleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const originalFetch = (global as any).fetch;

    const tokenPayload = (overrides: Record<string, unknown> = {}) => ({
      aud: 'client-id.apps.googleusercontent.com',
      iss: 'https://accounts.google.com',
      exp: String(Math.floor(Date.now() / 1000) + 3600),
      email: 'owner@test.com',
      email_verified: 'true',
      name: 'Owner Test',
      sub: 'google-subject-1',
      ...overrides,
    });

    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com';
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    });

    afterEach(() => {
      if (originalGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;

      if (originalGoogleOauthClientId === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_ID;
      else process.env.GOOGLE_OAUTH_CLIENT_ID = originalGoogleOauthClientId;

      if (originalNextPublicGoogleClientId === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      else process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = originalNextPublicGoogleClientId;

      (global as any).fetch = originalFetch;
    });

    function mockGoogleResponse(payload: Record<string, unknown>, ok = true) {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok,
        json: jest.fn().mockResolvedValue(payload),
      });
    }

    it('rejects calls without a Google id token', async () => {
      await expect(service.googleLogin({})).rejects.toBeInstanceOf(BadRequestException);

      expect((global as any).fetch).toBe(originalFetch);
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('fails closed when Google OAuth client id is not configured', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

      await expect(service.googleLogin({ idToken: 'id-token' })).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('rejects invalid Google token responses', async () => {
      mockGoogleResponse({ error: 'invalid_token' }, false);

      await expect(service.googleLogin({ idToken: 'bad-token' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('creates a Google user from the verified token and issues tokens', async () => {
      mockGoogleResponse(tokenPayload());
      userRepo.findOne!.mockResolvedValue(null);
      userRepo.create!.mockImplementation((data) => data);
      userRepo.save!.mockImplementation(async (data) => ({ id: 'u-google', ...data }));

      const result = await service.googleLogin({ idToken: 'verified-token' }, { ip: '127.0.0.1' });

      expect((global as any).fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/tokeninfo?id_token=verified-token',
      );
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'owner@test.com' },
        select: ['id', 'username', 'email', 'password', 'ativo'],
      });
      expect(userRepo.create).toHaveBeenCalledWith({
        username: 'Owner Test',
        email: 'owner@test.com',
        password: expect.stringMatching(/^google_/),
      });
      expect(payments.createPayment).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-google' }));
      expect(result).toMatchObject({
        accessToken: 'signed.jwt.token',
        user: { id: 'u-google', username: 'Owner Test', email: 'owner@test.com' },
      });
      expect(refreshRepo.save).toHaveBeenCalledTimes(1);
    });

    it('rejects an existing password account instead of converting it silently', async () => {
      mockGoogleResponse(tokenPayload());
      userRepo.findOne!.mockResolvedValue({
        id: 'u-local',
        email: 'owner@test.com',
        username: 'Owner Local',
        password: await bcrypt.hash('local-password', 12),
        ativo: true,
      });

      await expect(service.googleLogin({ idToken: 'verified-token' })).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(userRepo.save).not.toHaveBeenCalled();
      expect(payments.createPayment).not.toHaveBeenCalled();
      expect(refreshRepo.save).not.toHaveBeenCalled();
    });

    it('logs in an existing Google account without mutating the user record', async () => {
      mockGoogleResponse(tokenPayload({ email: 'google@test.com', name: 'Google User' }));
      userRepo.findOne!.mockResolvedValue({
        id: 'u-google',
        email: 'google@test.com',
        username: 'Google User',
        password: 'google_existing',
        ativo: true,
      });

      const result = await service.googleLogin({ credential: 'verified-token' });

      expect(userRepo.save).not.toHaveBeenCalled();
      expect(payments.createPayment).not.toHaveBeenCalled();
      expect(result.user).toEqual({
        id: 'u-google',
        username: 'Google User',
        email: 'google@test.com',
      });
      expect(refreshRepo.save).toHaveBeenCalledTimes(1);
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
