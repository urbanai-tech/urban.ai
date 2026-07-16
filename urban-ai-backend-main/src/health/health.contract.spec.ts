import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { buildOpenApiConfig } from '../openapi/openapi.config';

describe('Health HTTP and OpenAPI contract', () => {
  const originalEnv = process.env;
  let app: INestApplication;

  beforeEach(async () => {
    process.env = {
      APP_ENV: 'staging',
      DATABASE_URL: 'mysql://user:pass@localhost:3306/app',
      JWT_SECRET: 'secret',
      FRONT_BASE_URL: 'https://app.test',
      CORS_ALLOWED_ORIGINS: 'https://app.test',
    } as NodeJS.ProcessEnv;

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useFactory: () => new HealthService(undefined as any),
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    process.env = originalEnv;
  });

  it('keeps liveness public when readiness configuration is missing', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);

    expect(response.body).toMatchObject({ status: 'ok' });
  });

  it('fails readiness closed when the token is not configured', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(503);

    expect(response.body.message).toBe('Health readiness token is not configured.');
  });

  it('rejects an invalid readiness token', async () => {
    process.env.HEALTH_READINESS_TOKEN = 'expected';

    await request(app.getHttpServer())
      .get('/health')
      .set('Authorization', 'Bearer wrong')
      .expect(401);
  });

  it('returns 503 with diagnostics when authenticated but not ready', async () => {
    process.env.HEALTH_READINESS_TOKEN = 'expected';

    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Authorization', 'Bearer expected')
      .expect(503);

    expect(response.body).toMatchObject({
      status: 'degraded',
      checks: {
        db: { status: 'skipped', configured: true },
      },
    });
  });

  it('documents liveness and protected readiness response contracts', () => {
    const config = buildOpenApiConfig();
    const document = SwaggerModule.createDocument(app, config);

    expect(document.paths['/health/live']?.get?.responses).toHaveProperty('200');
    expect(document.paths['/health']?.get?.responses).toEqual(
      expect.objectContaining({
        200: expect.any(Object),
        401: expect.any(Object),
        503: expect.any(Object),
      }),
    );
    expect(document.paths['/health']?.get?.security).toEqual([{ bearer: [] }]);
  });
});
