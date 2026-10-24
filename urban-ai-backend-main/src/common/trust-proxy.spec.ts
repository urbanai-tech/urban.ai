import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { resolveTrustProxy } from './trust-proxy';

describe('resolveTrustProxy', () => {
  it('default: 1 hop em produção e desligado fora dela', () => {
    expect(resolveTrustProxy({ NODE_ENV: 'production' } as any)).toBe(1);
    expect(resolveTrustProxy({ APP_ENV: 'production' } as any)).toBe(1);
    expect(resolveTrustProxy({ NODE_ENV: 'development' } as any)).toBe(false);
    expect(resolveTrustProxy({} as any)).toBe(false);
  });

  it('aceita número de hops, 0/false para desligar e lista de IPs', () => {
    expect(resolveTrustProxy({ TRUST_PROXY_HOPS: '2' } as any)).toBe(2);
    expect(resolveTrustProxy({ TRUST_PROXY_HOPS: '0', NODE_ENV: 'production' } as any)).toBe(false);
    expect(resolveTrustProxy({ TRUST_PROXY_HOPS: 'false', NODE_ENV: 'production' } as any)).toBe(false);
    expect(resolveTrustProxy({ TRUST_PROXY_HOPS: 'loopback, 10.0.0.0/8' } as any)).toBe(
      'loopback, 10.0.0.0/8',
    );
  });

  it('rejeita "true" (inseguro) e volta ao default', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(resolveTrustProxy({ TRUST_PROXY_HOPS: 'true', NODE_ENV: 'production' } as any)).toBe(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

@Controller('t')
class ProbeController {
  @Get()
  ping() {
    return { ok: true };
  }
}

async function buildApp(trustProxy: number | boolean | string): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 2 }])],
    controllers: [ProbeController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.set('trust proxy', trustProxy);
  await app.init();
  return app;
}

describe('throttler atrás de proxy', () => {
  it('com trust proxy=1, clientes distintos (X-Forwarded-For) não compartilham o limite', async () => {
    const app = await buildApp(1);
    const http = app.getHttpServer();
    for (let i = 0; i < 2; i++) {
      await request(http).get('/t').set('X-Forwarded-For', '203.0.113.1').expect(200);
    }
    await request(http).get('/t').set('X-Forwarded-For', '203.0.113.1').expect(429);
    // Outro cliente real continua passando.
    await request(http).get('/t').set('X-Forwarded-For', '203.0.113.2').expect(200);
    await app.close();
  });

  it('sem trust proxy, todos caem no mesmo IP do proxy (comportamento anterior)', async () => {
    const app = await buildApp(false);
    const http = app.getHttpServer();
    await request(http).get('/t').set('X-Forwarded-For', '203.0.113.1').expect(200);
    await request(http).get('/t').set('X-Forwarded-For', '203.0.113.2').expect(200);
    await request(http).get('/t').set('X-Forwarded-For', '203.0.113.3').expect(429);
    await app.close();
  });
});
