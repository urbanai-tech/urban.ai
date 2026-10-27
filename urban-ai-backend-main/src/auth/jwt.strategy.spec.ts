import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, ACCESS_TOKEN_COOKIE } from './jwt.strategy';
import { ExtractJwt } from 'passport-jwt';
import { Request } from 'express';

describe('JwtStrategy', () => {
  const userRepo = (user: any = { id: 'user-id-1', username: 'alice', role: 'host', ativo: true }) => ({
    findOne: jest.fn().mockResolvedValue(user),
    query: jest.fn().mockResolvedValue([{ cutoff: null }]),
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
        select: ['id', 'username', 'role', 'ativo', 'emailVerifiedAt'],
      });
      expect(user).toEqual({
        userId: 'user-id-1',
        username: 'alice',
        role: 'host',
        emailVerified: false,
        profile: { role: 'anfitriao' },
      });
    });

    it('exposes emailVerified=true when the user confirmed the e-mail', async () => {
      const config = { get: jest.fn().mockReturnValue('secret') } as unknown as ConfigService;
      const strategy = new JwtStrategy(
        config,
        userRepo({ id: 'u2', username: 'bob', role: 'host', ativo: true, emailVerifiedAt: new Date() }) as any,
      );

      await expect(strategy.validate({ sub: 'u2' })).resolves.toMatchObject({ emailVerified: true });
    });

    it('rejects inactive or missing users', async () => {
      const config = {
        get: jest.fn().mockReturnValue('secret'),
      } as unknown as ConfigService;
      const strategy = new JwtStrategy(config, userRepo({ id: 'u1', ativo: false }) as any);

      await expect(strategy.validate({ sub: 'u1' })).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('sessions_valid_after (corte de sessões)', () => {
    const cutoff = new Date('2026-10-27T12:00:00Z');
    const base = { id: 'u1', username: 'alice', role: 'host', ativo: true };
    const strategy = (query: jest.Mock) =>
      new JwtStrategy(
        { get: jest.fn().mockReturnValue('a-very-strong-secret-abc') } as any,
        { findOne: jest.fn().mockResolvedValue(base), query } as any,
      );
    const iatBefore = Math.floor(cutoff.getTime() / 1000) - 60;
    const iatAfter = Math.floor(cutoff.getTime() / 1000) + 5;

    it('recusa access token emitido antes do corte', async () => {
      const query = jest.fn().mockResolvedValue([{ cutoff }]);
      await expect(strategy(query).validate({ sub: 'u1', iat: iatBefore })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('recusa token sem iat quando há corte', async () => {
      const query = jest.fn().mockResolvedValue([{ cutoff }]);
      await expect(strategy(query).validate({ sub: 'u1' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('aceita token emitido depois do corte e usuários sem corte', async () => {
      await expect(
        strategy(jest.fn().mockResolvedValue([{ cutoff }])).validate({ sub: 'u1', iat: iatAfter }),
      ).resolves.toMatchObject({ userId: 'u1' });
      await expect(
        strategy(jest.fn().mockResolvedValue([{ cutoff: null }])).validate({ sub: 'u1', iat: 1 }),
      ).resolves.toMatchObject({ userId: 'u1' });
    });

    it('migration pendente (coluna ausente): não quebra a autenticação e ignora o corte', async () => {
      const query = jest
        .fn()
        .mockRejectedValue(Object.assign(new Error("Unknown column 'sessions_valid_after'"), { code: 'ER_BAD_FIELD_ERROR' }));
      await expect(strategy(query).validate({ sub: 'u1', iat: 1 })).resolves.toMatchObject({ userId: 'u1' });
    });

    it('outros erros do banco continuam falhando (não viram acesso liberado em silêncio)', async () => {
      const query = jest.fn().mockRejectedValue(new Error('connection lost'));
      await expect(strategy(query).validate({ sub: 'u1', iat: 1 })).rejects.toThrow('connection lost');
    });
  });
});
