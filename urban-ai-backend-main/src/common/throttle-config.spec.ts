import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { APP_THROTTLERS, PerMinuteThrottle } from './throttle-config';

@Controller('cost')
class CostProbeController {
  @Get('limited')
  @PerMinuteThrottle(2)
  limited() {
    return { ok: true };
  }
}

describe('PerMinuteThrottle com a configuração real de throttlers do app', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(APP_THROTTLERS)],
      controllers: [CostProbeController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    const nest = moduleRef.createNestApplication<NestExpressApplication>();
    nest.set('trust proxy', 1);
    await nest.init();
    app = nest;
  });

  afterAll(async () => {
    await app.close();
  });

  it('corta no limite da rota (2/min) por IP real, sem afetar outro cliente', async () => {
    const http = app.getHttpServer();
    const get = (ip: string) => request(http).get('/cost/limited').set('X-Forwarded-For', ip);

    await get('203.0.113.10').expect(200);
    await get('203.0.113.10').expect(200);
    await get('203.0.113.10').expect(429);
    await get('203.0.113.11').expect(200);
  });
});
