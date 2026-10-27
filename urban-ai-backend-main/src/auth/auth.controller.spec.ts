import * as crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';
import { ROLES_KEY } from './roles.decorator';
import { RegisterDto } from './register.dto';
import { TERMS_VERSION } from './terms.constants';

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

describe('AuthController', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects administrative fields in the public registration payload', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      pipe.transform(
        {
          username: 'Host seguro',
          email: 'host@urbanai.test',
          password: 'Senha123!',
          role: 'admin',
          ativo: false,
        },
        { type: 'body', metatype: RegisterDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('corpo das respostas de sessão (fase 2)', () => {
    const tokens = {
      accessToken: 'secret-access-jwt',
      refreshToken: 'secret-refresh-raw',
      refreshExpiresAt: new Date(Date.now() + 60_000),
    };

    function expectNoTokens(body: unknown) {
      const json = JSON.stringify(body);
      expect(json).not.toContain('secret-access-jwt');
      expect(json).not.toContain('secret-refresh-raw');
      expect(json).not.toMatch(/accessToken|refreshToken/i);
    }

    it('login entrega o token só por cookie httpOnly', async () => {
      const authService = { login: jest.fn().mockResolvedValue(tokens) };
      const controller = new AuthController(authService as any, {} as any, {} as any, {} as any, {} as any);
      const res = { cookie: jest.fn() };
      const body = await controller.login({ email: 'a@b.c', password: 'x' }, { headers: {}, ip: 'ip' } as any, res as any);
      expectNoTokens(body);
      expect(res.cookie).toHaveBeenCalledWith('urbanai_access_token', 'secret-access-jwt', expect.objectContaining({ httpOnly: true }));
    });

    it('google, refresh e waitlist/accept também não devolvem token no corpo', async () => {
      const user = { id: 'u1', username: 'u', email: 'u@x.y' };
      const authService = {
        googleLogin: jest.fn().mockResolvedValue({ ...tokens, user }),
        rotateRefreshToken: jest.fn().mockResolvedValue(tokens),
        findUserByEmail: jest.fn().mockResolvedValue(null),
        register: jest.fn().mockResolvedValue(user),
        issueTokens: jest.fn().mockResolvedValue(tokens),
      };
      const waitlist = {
        lookupByInviteToken: jest.fn().mockResolvedValue({ id: 'w1', email: 'u@x.y', name: 'U' }),
        markConverted: jest.fn(),
      };
      const controller = new AuthController(authService as any, waitlist as any, {} as any, {} as any, {} as any);
      const res = { cookie: jest.fn() };
      const req = { headers: {}, ip: 'ip', cookies: { urbanai_refresh_token: 'raw' } } as any;
      expectNoTokens(await controller.googleLogin({ idToken: 't' }, req, res as any));
      expectNoTokens(await controller.refresh(req, res as any));
      expectNoTokens(await controller.acceptWaitlistInvite(
        { token: 'invite', password: 'senha-forte-123' } as any, req, res as any,
      ));
    });
  });

  describe('login cookies', () => {
    it('treats COOKIE_DOMAIN=none as a host-only cookie in staging', async () => {
      process.env = { ...originalEnv, APP_ENV: 'staging', COOKIE_DOMAIN: 'none' };
      const authService = {
        login: jest.fn().mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          refreshExpiresAt: new Date(Date.now() + 60_000),
        }),
      };
      const controller = new AuthController(authService as any, {} as any, {} as any, {} as any, {} as any);
      const res = { cookie: jest.fn() };

      await controller.login(
        { email: 'admin@urbanai.test', password: 'hash' },
        { headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' } as any,
        res as any,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'urbanai_access_token',
        'access-token',
        expect.not.objectContaining({ domain: expect.any(String) }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'urbanai_refresh_token',
        'refresh-token',
        expect.not.objectContaining({ domain: expect.any(String) }),
      );
    });
  });

  describe('acceptWaitlistInvite', () => {
    let controller: AuthController;
    let authService: {
      findUserByEmail: jest.Mock;
      register: jest.Mock;
      issueTokens: jest.Mock;
    };
    let waitlistService: {
      lookupByInviteToken: jest.Mock;
      markConverted: jest.Mock;
    };

    const entry = {
      id: 'waitlist-1',
      email: 'ricardoandradedesign@gmail.com',
      name: 'Ricardo',
    };

    beforeEach(() => {
      authService = {
        findUserByEmail: jest.fn().mockResolvedValue(null),
        register: jest.fn().mockImplementation(async (input) => ({
          id: 'user-1',
          username: input.username,
          email: input.email,
        })),
        issueTokens: jest.fn().mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          refreshExpiresAt: new Date(Date.now() + 60_000),
        }),
      };
      waitlistService = {
        lookupByInviteToken: jest.fn().mockResolvedValue(entry),
        markConverted: jest.fn().mockResolvedValue(undefined),
      };
      controller = new AuthController(authService as any, waitlistService as any, {} as any, {} as any, {} as any);
    });

    it('forwards raw invite passwords for bcrypt hashing in AuthService', async () => {
      const res = { cookie: jest.fn() };

      await controller.acceptWaitlistInvite(
        { token: 'invite-token', password: 'Senha123!' },
        { headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' } as any,
        res as any,
      );

      expect(authService.register).toHaveBeenCalledWith(
        {
          username: 'Ricardo',
          email: entry.email,
          password: 'Senha123!',
        },
        { emailVerified: true },
      );
      expect(waitlistService.markConverted).toHaveBeenCalledWith(entry.id);
    });

    it('keeps already pre-hashed invite passwords unchanged', async () => {
      const res = { cookie: jest.fn() };
      const preHashedPassword = sha256('Senha123!');

      await controller.acceptWaitlistInvite(
        { token: 'invite-token', password: preHashedPassword },
        { headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' } as any,
        res as any,
      );

      expect(authService.register).toHaveBeenCalledWith(
        {
          username: 'Ricardo',
          email: entry.email,
          password: preHashedPassword,
        },
        { emailVerified: true },
      );
    });
  });

  describe('LGPD self-service authorization contracts', () => {
    it('deletes only the user id from the authenticated principal, re-authenticating with the body', async () => {
      const authService = { deleteOwnAccount: jest.fn().mockResolvedValue(undefined) };
      const controller = new AuthController(authService as any, {} as any, {} as any, {} as any, {} as any);
      const res = { clearCookie: jest.fn() };

      await expect(
        controller.deleteOwnAccount({ user: { userId: 'owner-1' } } as any, { password: 'hash' }, res as any),
      ).resolves.toEqual({ deleted: true });

      expect(authService.deleteOwnAccount).toHaveBeenCalledWith('owner-1', { password: 'hash' });
      expect(res.clearCookie).toHaveBeenCalledTimes(2); // access + refresh
    });

    it('does not clear the session when the deletion is refused (wrong password, Stripe failure)', async () => {
      const authService = { deleteOwnAccount: jest.fn().mockRejectedValue(new BadRequestException('Senha incorreta.')) };
      const controller = new AuthController(authService as any, {} as any, {} as any, {} as any, {} as any);
      const res = { clearCookie: jest.fn() };

      await expect(
        controller.deleteOwnAccount({ user: { userId: 'owner-1' } } as any, { password: 'x' }, res as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(res.clearCookie).not.toHaveBeenCalled();
    });

    it('exports only the principal data as a downloadable, non-cacheable JSON', async () => {
      const bundle = { format: 'urban-ai-data-export/v1' };
      const accountData = { exportUserData: jest.fn().mockResolvedValue(bundle) };
      const controller = new AuthController({} as any, {} as any, accountData as any, {} as any, {} as any);
      const res = { setHeader: jest.fn() };

      await expect(controller.exportMyData({ user: { userId: 'owner-1' } } as any, res as any)).resolves.toBe(bundle);

      expect(accountData.exportUserData).toHaveBeenCalledWith('owner-1');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringMatching(/^attachment; filename="urbanai-meus-dados-\d{4}-\d{2}-\d{2}\.json"$/));
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    });

    it('protects export with JwtAuthGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.exportMyData) ?? [];
      expect(guards.map((g: any) => g.name)).toContain('JwtAuthGuard');
    });

    it('refuses reading another user unless the principal is admin', async () => {
      const authService = { findUserById: jest.fn() };
      const controller = new AuthController(authService as any, {} as any, {} as any, {} as any, {} as any);

      expect(() =>
        controller.getUser('other-user', { user: { userId: 'owner-1', role: 'host' } }),
      ).toThrow(ForbiddenException);
      expect(authService.findUserById).not.toHaveBeenCalled();
    });

    it('allows self-access and explicit admin access to user data', async () => {
      const authService = {
        findUserById: jest.fn().mockImplementation(async (id) => ({ id })),
      };
      const controller = new AuthController(authService as any, {} as any, {} as any, {} as any, {} as any);

      await expect(
        controller.getUser('owner-1', { user: { userId: 'owner-1', role: 'host' } }),
      ).resolves.toEqual({ id: 'owner-1' });
      await expect(
        controller.getUser('other-user', { user: { userId: 'admin-1', role: 'admin' } }),
      ).resolves.toEqual({ id: 'other-user' });
    });

    it('fails closed when the request has no principal', () => {
      const controller = new AuthController({ findUserById: jest.fn() } as any, {} as any, {} as any, {} as any, {} as any);
      expect(() => controller.getUser('u1', undefined as any)).toThrow(ForbiddenException);
    });

    it('keeps self-delete authenticated and administrative delete RBAC-protected', () => {
      const selfGuards = Reflect.getMetadata(
        GUARDS_METADATA,
        AuthController.prototype.deleteOwnAccount,
      );
      const adminGuards = Reflect.getMetadata(
        GUARDS_METADATA,
        AuthController.prototype.deleteUser,
      );
      const adminRoles = Reflect.getMetadata(ROLES_KEY, AuthController.prototype.deleteUser);

      expect(selfGuards.map((guard) => guard.name)).toEqual(['JwtAuthGuard']);
      expect(adminGuards.map((guard) => guard.name)).toEqual(['JwtAuthGuard', 'RolesGuard']);
      expect(adminRoles).toEqual(['admin']);
    });
  });

  describe('registration modes', () => {
    it('registers a regular user when prelaunch is disabled', async () => {
      process.env = { ...originalEnv, LAUNCH_MODE: 'production', PRELAUNCH_MODE: 'true' };
      const authService = { register: jest.fn().mockResolvedValue({ id: 'u1' }) };
      const waitlistService = { signup: jest.fn() };
      const controller = new AuthController(authService as any, waitlistService as any, {} as any, {} as any, {} as any);

      await expect(
        controller.register(
          { username: 'Ana', email: 'ana@test.com', password: 'Senha123!', termsAccepted: true, termsVersion: TERMS_VERSION },
          { headers: {} } as any,
        ),
      ).resolves.toEqual({ mode: 'registered', user: { id: 'u1' } });
      expect(waitlistService.signup).not.toHaveBeenCalled();
    });

    it.each([
      [{ LAUNCH_MODE: 'prelaunch' }, { 'x-forwarded-for': '10.0.0.1, 10.0.0.2', 'user-agent': 'ua' }, '10.0.0.1'],
      [{ PRELAUNCH_MODE: 'true' }, {}, '127.0.0.1'],
    ])('routes a prelaunch signup to the waitlist', async (env, headers, expectedIp) => {
      process.env = { ...originalEnv, ...env };
      delete process.env.LAUNCH_MODE;
      Object.assign(process.env, env);
      const authService = { register: jest.fn() };
      const waitlistService = { signup: jest.fn().mockResolvedValue({ position: 2 }) };
      const controller = new AuthController(authService as any, waitlistService as any, {} as any, {} as any, {} as any);

      await expect(
        controller.register(
          { username: 'Ana', email: 'ana@test.com', password: 'Senha123!', termsAccepted: true, termsVersion: TERMS_VERSION },
          { headers, ip: '127.0.0.1' } as any,
        ),
      ).resolves.toEqual({ mode: 'waitlist', position: 2 });
      expect(waitlistService.signup).toHaveBeenCalledWith(expect.objectContaining({
        email: 'ana@test.com', name: 'Ana', source: 'auth-register', signupIp: expectedIp,
      }));
    });
  });

  describe('invite rejection paths', () => {
    const create = (entry: any = null, existing: any = null) => {
      const authService = {
        findUserByEmail: jest.fn().mockResolvedValue(existing),
        register: jest.fn(),
        issueTokens: jest.fn(),
      };
      const waitlistService = {
        lookupByInviteToken: jest.fn().mockResolvedValue(entry),
        markConverted: jest.fn().mockResolvedValue(undefined),
      };
      return { controller: new AuthController(authService as any, waitlistService as any, {} as any, {} as any, {} as any), authService, waitlistService };
    };

    it.each([
      [{ password: 'Senha123!' }, 'token'],
      [{ token: 't', password: 'curta' }, 'password'],
    ])('rejects malformed invite input: %s', async (data, _reason) => {
      const { controller } = create();
      await expect(controller.acceptWaitlistInvite(data as any, {} as any, {} as any))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects missing or expired invite entries', async () => {
      const { controller } = create();
      await expect(controller.acceptWaitlistInvite(
        { token: 'expired', password: 'Senha123!' }, {} as any, {} as any,
      )).rejects.toBeInstanceOf(BadRequestException);
    });

    it('marks an invite converted before reporting an existing account conflict', async () => {
      const entry = { id: 'w1', email: 'ana@test.com' };
      const { controller, waitlistService } = create(entry, { id: 'u1' });
      await expect(controller.acceptWaitlistInvite(
        { token: 'used', password: 'Senha123!' }, {} as any, {} as any,
      )).rejects.toBeInstanceOf(ConflictException);
      expect(waitlistService.markConverted).toHaveBeenCalledWith('w1');
    });

    it.each([
      [{ username: '  Beatriz  ' }, { id: 'w1', email: 'b@test.com', name: 'Fallback' }, 'Beatriz'],
      [{}, { id: 'w1', email: 'b@test.com', name: undefined }, 'b'],
    ])('uses the safest available invite username', async (extra, entry, expectedUsername) => {
      const { controller, authService } = create(entry);
      authService.register.mockImplementation(async (input) => ({ id: 'u1', ...input }));
      authService.issueTokens.mockResolvedValue({
        accessToken: 'access', refreshToken: 'refresh', refreshExpiresAt: new Date(Date.now() + 60_000),
      });
      await controller.acceptWaitlistInvite(
        { token: 'valid', password: 'Senha123!', ...extra },
        { headers: {} } as any,
        { cookie: jest.fn() } as any,
      );
      expect(authService.register).toHaveBeenCalledWith(
        expect.objectContaining({ username: expectedUsername }),
        { emailVerified: true },
      );
    });
  });

  describe('session endpoints', () => {
    const tokens = {
      accessToken: 'access', refreshToken: 'refresh', refreshExpiresAt: new Date(Date.now() + 60_000),
    };

    it.each([
      [{ idToken: 'google-token' }, 'google-token'],
      [{ credential: 'credential-token' }, 'credential-token'],
      [{ token: 'legacy-token' }, 'legacy-token'],
    ])('accepts every supported Google token alias', async (body, expected) => {
      const authService = { googleLogin: jest.fn().mockResolvedValue({ ...tokens, user: { id: 'u1' } }) };
      const controller = new AuthController(authService as any, {} as any, {} as any, {} as any, {} as any);
      const res = { cookie: jest.fn() };
      await expect(controller.googleLogin(body, { headers: {}, ip: 'ip' } as any, res as any))
        .resolves.toEqual({ authenticated: true, user: { id: 'u1' } });
      expect(authService.googleLogin).toHaveBeenCalledWith({ idToken: expected }, expect.any(Object));
    });

    it('preserves HTTP errors and wraps unexpected Google errors', async () => {
      const httpController = new AuthController({
        googleLogin: jest.fn().mockRejectedValue(new BadRequestException('Token inválido')),
      } as any, {} as any, {} as any, {} as any, {} as any);
      await expect(httpController.googleLogin({}, { headers: {} } as any, {} as any))
        .rejects.toBeInstanceOf(BadRequestException);
      const broken = new AuthController({ googleLogin: jest.fn().mockRejectedValue(new Error('boom')) } as any, {} as any, {} as any, {} as any, {} as any);
      await expect(broken.googleLogin({ idToken: 't' }, { headers: {} } as any, {} as any))
        .rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('requires a refresh cookie and rotates a present token', async () => {
      const authService = { rotateRefreshToken: jest.fn().mockResolvedValue(tokens) };
      const controller = new AuthController(authService as any, {} as any, {} as any, {} as any, {} as any);
      await expect(controller.refresh({ cookies: {}, headers: {} } as any, {} as any))
        .rejects.toBeInstanceOf(UnauthorizedException);
      const res = { cookie: jest.fn() };
      await expect(controller.refresh(
        { cookies: { urbanai_refresh_token: 'raw' }, headers: {}, ip: 'ip' } as any,
        res as any,
      )).resolves.toEqual({ refreshed: true });
      expect(res.cookie).toHaveBeenCalledWith('urbanai_access_token', 'access', expect.objectContaining({ httpOnly: true }));
      expect(authService.rotateRefreshToken).toHaveBeenCalledWith('raw', expect.any(Object));
    });

    it.each([true, false])('clears cookies on logout (refresh present: %s)', async (present) => {
      process.env = { ...originalEnv, NODE_ENV: 'production' };
      const authService = { revokeRefreshToken: jest.fn() };
      const controller = new AuthController(authService as any, {} as any, {} as any, {} as any, {} as any);
      const res = { clearCookie: jest.fn() };
      await controller.logout(
        { cookies: present ? { urbanai_refresh_token: 'raw' } : {} } as any,
        res as any,
      );
      expect(authService.revokeRefreshToken).toHaveBeenCalledTimes(present ? 1 : 0);
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('thin authenticated delegates', () => {
    it('delegates admin, identity and profile operations with the authenticated id', async () => {
      const authService = {
        deleteUser: jest.fn(), update: jest.fn().mockResolvedValue({ id: 'u1', username: 'New', email: 'u1@test.com' }),
        findUserById: jest.fn().mockResolvedValue({ id: 'u1', username: 'Old', email: 'u1@test.com', role: 'host' }),
        getProfileById: jest.fn().mockResolvedValue({ id: 'u1' }),
        updateProfileById: jest.fn().mockResolvedValue({ id: 'u1', username: 'New' }),
      };
      const audit = { record: jest.fn() };
      const controller = new AuthController(authService as any, {} as any, {} as any, audit as any, {} as any);
      await controller.deleteUser('u2');
      expect(controller.me({ user: { userId: 'u1' } })).toEqual({ userId: 'u1' });
      await expect(controller.updateUser('u1', { username: 'New' })).resolves.toEqual({ id: 'u1', username: 'New', email: 'u1@test.com' });
      await expect(controller.getProfileById({ user: { userId: 'u1' } })).resolves.toEqual({ id: 'u1' });
      await expect(controller.updateProfileById({ username: 'New' }, { user: { userId: 'u1' } }))
        .resolves.toEqual({ id: 'u1', username: 'New' });
      expect(authService.deleteUser).toHaveBeenCalledWith('u2');
      expect(authService.updateProfileById).toHaveBeenCalledWith('u1', { username: 'New' });
    });
  });

  describe('PUT /auth/profile — troca de e-mail', () => {
    it('envia o código de confirmação ao NOVO e-mail só quando a verificação ficou pendente', async () => {
      const authService = {
        updateProfileById: jest.fn()
          .mockResolvedValueOnce({ id: 'u1', email: 'novo@test.com', emailVerificationPending: true })
          .mockResolvedValueOnce({ id: 'u1', email: 'novo@test.com' }),
      };
      const emailService = { enviarCodigo: jest.fn().mockResolvedValue({}) };
      const controller = new AuthController(authService as any, {} as any, {} as any, {} as any, emailService as any);
      await controller.updateProfileById({ email: 'novo@test.com', currentPassword: 'x' } as any, { user: { userId: 'u1' } });
      expect(emailService.enviarCodigo).toHaveBeenCalledWith('novo@test.com');
      await controller.updateProfileById({ username: 'Ana' } as any, { user: { userId: 'u1' } });
      expect(emailService.enviarCodigo).toHaveBeenCalledTimes(1);
    });
  });

  describe('cookie policy', () => {
    it.each([
      ['production', undefined, undefined, '.myurbanai.com', 'lax', true],
      ['development', '.custom.test', 'strict', '.custom.test', 'strict', false],
      ['development', undefined, 'none', undefined, 'none', true],
    ])('derives secure cookie attributes from environment', (env, domain, sameSite, expectedDomain, expectedSameSite, secure) => {
      process.env = { ...originalEnv, APP_ENV: env };
      if (domain) process.env.COOKIE_DOMAIN = domain; else delete process.env.COOKIE_DOMAIN;
      if (sameSite) process.env.COOKIE_SAME_SITE = sameSite; else delete process.env.COOKIE_SAME_SITE;
      const controller = new AuthController({} as any, {} as any, {} as any, {} as any, {} as any);
      expect((controller as any).cookieOpts(100, true)).toEqual(expect.objectContaining({
        domain: expectedDomain, sameSite: expectedSameSite, secure, path: '/auth', maxAge: 100,
      }));
    });
  });
});
