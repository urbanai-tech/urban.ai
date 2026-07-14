import * as crypto from 'crypto';
import { AuthController } from './auth.controller';

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

describe('AuthController', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
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
      const controller = new AuthController(authService as any, {} as any);
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
      controller = new AuthController(authService as any, waitlistService as any);
    });

    it('hashes raw invite passwords before registering the user', async () => {
      const res = { cookie: jest.fn() };

      await controller.acceptWaitlistInvite(
        { token: 'invite-token', password: 'Senha123!' },
        { headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' } as any,
        res as any,
      );

      expect(authService.register).toHaveBeenCalledWith({
        username: 'Ricardo',
        email: entry.email,
        password: sha256('Senha123!'),
      });
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

      expect(authService.register).toHaveBeenCalledWith({
        username: 'Ricardo',
        email: entry.email,
        password: preHashedPassword,
      });
    });
  });
});
