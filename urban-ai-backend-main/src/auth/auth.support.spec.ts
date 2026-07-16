import 'reflect-metadata';
import { ExecutionContext, ForbiddenException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AuthModule } from './auth.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LocalAuthGuard } from './local-auth.guard';
import { RegisterDto } from './register.dto';
import { RolesGuard } from './roles.guard';
import { PermissionsEnum } from './enuns/PermissionsEnum';
import { situacoesEnum } from './enuns/situacoesEnum';

describe('Auth module and supporting contracts', () => {
  it('registers the expected controller, providers and exports', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).toHaveLength(1);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule)).toHaveLength(4);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, AuthModule)).toHaveLength(2);
  });

  it('builds JwtModule options with configured and default expiration', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule) as any[];
    const dynamicJwt = imports.find((entry) => entry?.module === JwtModule);
    const factory = dynamicJwt.providers.find((provider: any) => provider.useFactory)?.useFactory;
    expect(factory({ get: (key: string) => key === 'JWT_SECRET' ? 'secret' : '30m' } as ConfigService))
      .toEqual({ secret: 'secret', signOptions: { expiresIn: '30m' } });
    expect(factory({ get: (key: string) => key === 'JWT_SECRET' ? 'secret' : undefined } as ConfigService))
      .toEqual({ secret: 'secret', signOptions: { expiresIn: '15m' } });
    expect(() => factory({ get: () => undefined } as unknown as ConfigService)).toThrow(/JWT_SECRET/);
  });

  it('keeps permission and situation enums importable at runtime', () => {
    expect(Object.values(PermissionsEnum).length).toBeGreaterThan(0);
    expect(Object.values(situacoesEnum).length).toBeGreaterThan(0);
  });
});

describe('authentication guards', () => {
  it('constructs the JWT passport guard', () => {
    expect(new JwtAuthGuard()).toBeInstanceOf(JwtAuthGuard);
  });

  it('delegates LocalAuthGuard activation and returns the authenticated user', () => {
    const guard = new LocalAuthGuard();
    const parent = Object.getPrototypeOf(LocalAuthGuard.prototype);
    const spy = jest.spyOn(parent, 'canActivate').mockReturnValue(true);
    const context = {} as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
    expect(spy).toHaveBeenCalledWith(context);
    expect(guard.handleRequest(null, { id: 'u1' })).toEqual({ id: 'u1' });
    spy.mockRestore();
  });

  it.each([
    [new Error('invalid'), undefined, 'invalid'],
    [null, undefined, undefined],
  ])('rejects a missing local user or strategy error', (error, user, message) => {
    const guard = new LocalAuthGuard();
    expect(() => guard.handleRequest(error, user)).toThrow(UnauthorizedException);
    try { guard.handleRequest(error, user); } catch (caught: any) {
      if (message) expect(caught.message).toContain(message);
    }
  });
});

describe('RolesGuard', () => {
  const context = (user?: any) => ({
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext);

  const create = (roles: string[] | undefined, dbUser?: any) => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(roles) } as unknown as Reflector;
    const findOne = jest.fn().mockResolvedValue(dbUser);
    const dataSource = { getRepository: jest.fn().mockReturnValue({ findOne }) };
    return { guard: new RolesGuard(reflector, dataSource as any), findOne };
  };

  it('allows routes without role metadata', async () => {
    const { guard, findOne } = create(undefined);
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('allows routes with an empty role list', async () => {
    const { guard, findOne } = create([]);
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('requires an authenticated principal when roles are present', async () => {
    const { guard } = create(['admin']);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([null, { id: 'u1', role: 'admin', ativo: false }])('rejects missing or inactive database users', async (dbUser) => {
    const { guard } = create(['admin'], dbUser);
    await expect(guard.canActivate(context({ userId: 'u1' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a role mismatch and allows an authorized current database role', async () => {
    const mismatch = create(['admin'], { id: 'u1', role: 'host', ativo: true });
    await expect(mismatch.guard.canActivate(context({ userId: 'u1' }))).rejects.toBeInstanceOf(ForbiddenException);
    const allowed = create(['admin', 'owner'], { id: 'u1', role: 'admin', ativo: true });
    await expect(allowed.guard.canActivate(context({ userId: 'u1' }))).resolves.toBe(true);
    expect(allowed.findOne).toHaveBeenCalledWith({
      where: { id: 'u1' }, select: ['id', 'role', 'ativo'],
    });
  });
});

describe('RegisterDto runtime validation', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

  it('accepts bounded optional acquisition fields', async () => {
    await expect(pipe.transform({
      username: 'Ana Maria', email: 'ana@test.com', password: 'Senha123!',
      source: 'landing', referredBy: 'friend-1',
    }, { type: 'body', metatype: RegisterDto })).resolves.toBeInstanceOf(RegisterDto);
  });

  it.each([
    { username: 'A', email: 'ana@test.com', password: 'Senha123!' },
    { username: 'Ana', email: 'invalid', password: 'Senha123!' },
    { username: 'Ana', email: 'ana@test.com', password: 'short' },
    { username: 'Ana', email: 'ana@test.com', password: 'Senha123!', source: 2 },
  ])('rejects malformed registration values', async (input) => {
    await expect(pipe.transform(input, { type: 'body', metatype: RegisterDto })).rejects.toBeDefined();
  });
});
