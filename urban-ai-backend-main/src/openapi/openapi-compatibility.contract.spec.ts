import { readFileSync } from 'fs';
import { join } from 'path';

jest.mock('../auth/auth.service', () => ({ AuthService: class AuthService {} }));
jest.mock('../waitlist/waitlist.service', () => ({ WaitlistService: class WaitlistService {} }));
jest.mock('../propriedades/propriedade.service', () => ({
  PropriedadeService: class PropriedadeService {},
}));
jest.mock('../propriedades/pricing-calculate.service', () => ({
  PricingCalculateService: class PricingCalculateService {},
}));
jest.mock('../payments/payments.service', () => ({ PaymentsService: class PaymentsService {} }));
jest.mock('../plans/plans.service', () => ({ PlansService: class PlansService {} }));
jest.mock('../health/health.service', () => ({ HealthService: class HealthService {} }));
jest.mock('../event-intelligence/event-intelligence.service', () => ({
  EventIntelligenceService: class EventIntelligenceService {},
}));

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { AuthController } from '../auth/auth.controller';
import { HealthController } from '../health/health.controller';
import { HostEventsController } from '../host-panels/host-events.controller';
import { PaymentsController } from '../payments/payments.controller';
import { PlansController } from '../plans/plans.controller';
import { PropriedadeController } from '../propriedades/propriedade.controller';
import { buildOpenApiConfig } from './openapi.config';
import { CRITICAL_API_OPERATIONS, projectCriticalOpenApiContract } from './openapi-contract';

describe('OpenAPI critical compatibility contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const callable = new Proxy(function noop() {}, {
      get: (_target, property) => (property === 'then' ? undefined : callable),
      apply: () => undefined,
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [
        AuthController,
        PropriedadeController,
        PaymentsController,
        PlansController,
        HealthController,
        HostEventsController,
      ],
    })
      .useMocker(() => callable)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes SemVer contract metadata without changing current URLs', () => {
    expect(document.info.version).toBe('1.0.0');
    expect((document as any)['x-urban-ai-api-compatibility']).toMatchObject({
      strategy: 'stable-unprefixed',
      urlPrefix: null,
      compatibility: 'backward-compatible-with-current-urls',
    });
    expect(Object.keys(document.paths).some((route) => /^\/v\d+(?:\/|$)/.test(route))).toBe(false);
    for (const [, route] of CRITICAL_API_OPERATIONS) expect(document.paths).toHaveProperty(route);
  });

  it('matches the reviewed v1 structural snapshot for critical operations', () => {
    const baselinePath = join(__dirname, '..', '..', 'contracts', 'openapi-critical.v1.json');
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    expect(projectCriticalOpenApiContract(document)).toEqual(baseline);
  });
});
