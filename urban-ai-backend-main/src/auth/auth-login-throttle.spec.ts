import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { APP_THROTTLERS } from '../common/throttle-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import { AccountDataService } from './account-data.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { EmailService } from '../email/email.service';

describe('limite de login (AuthController real + throttlers reais do app)', () => {
  let app: INestApplication;
  const authService = {
    login: jest.fn().mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      refreshExpiresAt: new Date(Date.now() + 60_000),
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(APP_THROTTLERS)],
      controllers: [AuthController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: AuthService, useValue: authService },
        { provide: WaitlistService, useValue: {} },
        { provide: AccountDataService, useValue: {} },
        { provide: AdminAuditService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();
    const nest = moduleRef.createNestApplication<NestExpressApplication>();
    nest.set('trust proxy', 1);
    await nest.init();
    app = nest;
  });

  afterAll(async () => {
    await app.close();
  });

  it('bloqueia a 6ª tentativa de login no minuto, por IP real', async () => {
    const http = app.getHttpServer();
    const login = (ip: string) =>
      request(http)
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'a@b.co', password: 'x' });

    for (let i = 0; i < 5; i++) {
      const res = await login('203.0.113.50');
      expect(res.status).toBeLessThan(400);
      // espaça para não bater no burst "short" (10/s), que não é o foco aqui
      await new Promise((r) => setTimeout(r, 120));
    }
    await login('203.0.113.50').then((res) => expect(res.status).toBe(429));
    await login('203.0.113.51').then((res) => expect(res.status).toBeLessThan(400));
  });
});
