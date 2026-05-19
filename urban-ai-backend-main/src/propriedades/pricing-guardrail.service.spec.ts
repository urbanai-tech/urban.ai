import { PricingGuardrailService } from './pricing-guardrail.service';

describe('PricingGuardrailService', () => {
  let service: PricingGuardrailService;

  beforeEach(() => {
    service = new PricingGuardrailService();
  });

  it('uses the balanced preset when no user limits are configured', () => {
    expect(service.resolve({ pricingStrategy: 'balanced' })).toMatchObject({
      strategy: 'balanced',
      maxReducaoPercent: 10,
      maxAumentoPercent: 20,
      source: 'preset_default',
      minMultiplier: 0.9,
      maxMultiplier: 1.2,
    });
  });

  it('accepts legacy moderate alias as balanced', () => {
    expect(service.resolve({ pricingStrategy: 'moderate' })).toMatchObject({
      strategy: 'balanced',
      maxReducaoPercent: 10,
      maxAumentoPercent: 20,
    });
  });

  it('normalizes negative and comma-formatted user limits', () => {
    expect(
      service.resolve({
        pricingStrategy: 'aggressive',
        percentualInicial: '-12,5',
        percentualFinal: '37,5',
      }),
    ).toMatchObject({
      strategy: 'aggressive',
      maxReducaoPercent: 12.5,
      maxAumentoPercent: 37.5,
      source: 'user_config',
      minMultiplier: 0.875,
      maxMultiplier: 1.375,
    });
  });

  it('uses a capped AI preset instead of unlimited pricing', () => {
    expect(service.resolve({ pricingStrategy: 'ai', percentualFinal: null })).toMatchObject({
      strategy: 'ai',
      maxReducaoPercent: 25,
      maxAumentoPercent: 45,
    });
  });

  it('clamps unsafe custom limits to platform-level caps', () => {
    expect(
      service.resolve({
        pricingStrategy: 'balanced',
        percentualInicial: 90,
        percentualFinal: 250,
      }),
    ).toMatchObject({
      maxReducaoPercent: 50,
      maxAumentoPercent: 100,
    });
  });
});
