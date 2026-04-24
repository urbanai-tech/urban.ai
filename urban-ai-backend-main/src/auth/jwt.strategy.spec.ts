import { ConfigService } from '@nestjs/config';
import { JwtStrategy, ACCESS_TOKEN_COOKIE } from './jwt.strategy';
import { ExtractJwt } from 'passport-jwt';
import { Request } from 'express';

describe('JwtStrategy', () => {
  describe('construction', () => {
    it('fails fast if JWT_SECRET is not set', () => {
      const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

      expect(() => new JwtStrategy(config)).toThrow(/JWT_SECRET/);
    });

    it('constructs successfully when JWT_SECRET is present', () => {
      const config = {
        get: jest.fn().mockReturnValue('a-very-strong-secret-abc'),
      } as unknown as ConfigService;

      expect(() => new JwtStrategy(config)).not.toThrow();
    });
  });

  describe('jwtFromRequest extractors', () => {
    // Recriamos o pipeline igual ao constructor para testar a ordem de resolução.
    const extractors = [
      (req: Request) => req?.cookies?.[ACCESS_TOKEN_COOKIE] || null,
      ExtractJwt.fromAuthHeaderAsBearerToken(),
    ];

    function runExtractors(req: Partial<Request>): string | null {
      for (const ex of extractors) {
        const token = ex(req as Request);
        if (token) return token;
      }
      return null;
    }

    it('returns the cookie token first when both cookie and header are present', () => {
      const req: Partial<Request> = {
        cookies: { [ACCESS_TOKEN_COOKIE]: 'cookie-token' },
        headers: { authorization: 'Bearer header-token' },
      };

      expect(runExtractors(req)).toBe('cookie-token');
    });

    it('falls back to Authorization header when cookie is absent', () => {
      const req: Partial<Request> = {
        cookies: {},
        headers: { authorization: 'Bearer header-token' },
      };

      expect(runExtractors(req)).toBe('header-token');
    });

    it('returns null when neither cookie nor header are present', () => {
      const req: Partial<Request> = { cookies: {}, headers: {} };

      expect(runExtractors(req)).toBeNull();
    });
  });

  describe('validate', () => {
    it('maps the JWT payload to { userId, username, profile }', async () => {
      const config = {
        get: jest.fn().mockReturnValue('secret'),
      } as unknown as ConfigService;
      const strategy = new JwtStrategy(config);

      const user = await strategy.validate({
        sub: 'user-id-1',
        username: 'alice',
        profile: { role: 'anfitriao' },
      });

      expect(user).toEqual({
        userId: 'user-id-1',
        username: 'alice',
        profile: { role: 'anfitriao' },
      });
    });
  });
});
