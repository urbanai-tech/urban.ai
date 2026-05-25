import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, ACCESS_TOKEN_COOKIE } from './jwt.strategy';
import { ExtractJwt } from 'passport-jwt';
import { Request } from 'express';

describe('JwtStrategy', () => {
  const userRepo = (user: any = { id: 'user-id-1', username: 'alice', role: 'host', ativo: true }) => ({
    findOne: jest.fn().mockResolvedValue(user),
  });

  describe('construction', () => {
    it('fails fast if JWT_SECRET is not set', () => {
      const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

      expect(() => new JwtStrategy(config, userRepo() as any)).toThrow(/JWT_SECRET/);
    });

    it('constructs successfully when JWT_SECRET is present', () => {
      const config = {
        get: jest.fn().mockReturnValue('a-very-strong-secret-abc'),
      } as unknown as ConfigService;

      expect(() => new JwtStrategy(config, userRepo() as any)).not.toThrow();
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
    it('maps the active database user to the request user payload', async () => {
      const config = {
        get: jest.fn().mockReturnValue('secret'),
      } as unknown as ConfigService;
      const repo = userRepo();
      const strategy = new JwtStrategy(config, repo as any);

      const user = await strategy.validate({
        sub: 'user-id-1',
        profile: { role: 'anfitriao' },
      });

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id-1' },
        select: ['id', 'username', 'role', 'ativo'],
      });
      expect(user).toEqual({
        userId: 'user-id-1',
        username: 'alice',
        role: 'host',
        profile: { role: 'anfitriao' },
      });
    });

    it('rejects inactive or missing users', async () => {
      const config = {
        get: jest.fn().mockReturnValue('secret'),
      } as unknown as ConfigService;
      const strategy = new JwtStrategy(config, userRepo({ id: 'u1', ativo: false }) as any);

      await expect(strategy.validate({ sub: 'u1' })).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
