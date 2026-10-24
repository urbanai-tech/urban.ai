import { computePriceV2, resolvePricingEngineMode, resolvePricingV2Config, toSnapshotDrivers } from './pricing-engine-v2';
import { cloneDefaultPricingRules } from './pricing-rules';

/**
 * Calendário de referência (São Paulo): 2026-10-26 seg, 10-28 qua, 10-29 qui,
 * 10-30 sex, 10-31 sáb, 11-01 dom.
 */
const config = resolvePricingV2Config({});
const FAR = '2026-09-01'; // "hoje" distante → última hora não dispara

function noRules() {
  return cloneDefaultPricingRules().map((r) => ({ ...r, enabled: false }));
}

describe('computePriceV2 — reduções', () => {
  it('dia útil lento sem evento fica ABAIXO da base (weekday -8% e no-event -5%)', () => {
    const r = computePriceV2({ basePrice: 300, context: { targetDate: '2026-10-28', today: FAR } }, config);
    expect(r.suggestedPrice).toBeCloseTo(300 * 0.95 * 0.92, 2);
    expect(r.multiplier).toBeLessThan(1);
    const keys = r.drivers.filter((d) => d.applied).map((d) => d.key);
    expect(keys).toEqual(['baseline_no_event', 'rule_weekday_discount']);
  });

  it('baseline sem evento sozinho (quinta, sem regras) = -5%', () => {
    const r = computePriceV2({ basePrice: 200, context: { targetDate: '2026-10-29', today: FAR, rules: noRules() } }, config);
    expect(r.suggestedPrice).toBe(190);
    expect(r.drivers.find((d) => d.key === 'baseline_no_event')!.deltaPercent).toBe(-5);
  });

  it('última hora sem reserva reduz; com noite reservada não reduz', () => {
    const rules = noRules().map((r) => (r.type === 'last_minute' ? { ...r, enabled: true } : r));
    const free = computePriceV2(
      { basePrice: 200, context: { targetDate: '2026-10-29', today: '2026-10-27', rules } },
      { ...config, noEventAdjustmentPercent: 0 },
    );
    expect(free.suggestedPrice).toBe(176); // -12%
    expect(free.drivers.find((d) => d.key === 'rule_last_minute')!.explanation).toContain('Faltam 2 dia(s)');

    const booked = computePriceV2(
      { basePrice: 200, context: { targetDate: '2026-10-29', today: '2026-10-27', rules, occupancy: { targetNightBooked: true } } },
      { ...config, noEventAdjustmentPercent: 0 },
    );
    expect(booked.suggestedPrice).toBe(200);
  });

  it('noite-lacuna entre duas reservadas reduz -20%', () => {
    const rules = noRules().map((r) => (r.type === 'gap_night_filler' ? { ...r, enabled: true } : r));
    const r = computePriceV2(
      {
        basePrice: 250,
        context: {
          targetDate: '2026-10-29',
          today: FAR,
          rules,
          occupancy: { prevNightBooked: true, nextNightBooked: true, targetNightBooked: false },
        },
      },
      { ...config, noEventAdjustmentPercent: 0 },
    );
    expect(r.suggestedPrice).toBe(200);
    expect(r.drivers.find((d) => d.key === 'rule_gap_night_filler')!.applied).toBe(true);
  });

  it('regras de redução NÃO se aplicam em noite com sinal de demanda de evento', () => {
    const r = computePriceV2(
      {
        basePrice: 300,
        event: { lat: -23.5, lng: -46.6 },
        attractivity: { score: 90, travelTime: 10 },
        context: { targetDate: '2026-10-28', today: '2026-10-27' },
      },
      config,
    );
    expect(r.demandSignal).toBe(true);
    expect(r.drivers.some((d) => d.key === 'rule_weekday_discount' || d.key === 'rule_last_minute')).toBe(false);
    expect(r.suggestedPrice).toBe(318); // +12% proximidade × magnitude 0,5 (porte desconhecido) = +6%, sem desconto
  });

  it('regra configurada pelo anfitrião com sinal trocado é limitada (desconto nunca vira aumento)', () => {
    const rules = noRules().map((r) =>
      r.type === 'weekday_discount' ? { ...r, enabled: true, params: { percent: 40 } } : r,
    );
    const r = computePriceV2({ basePrice: 100, context: { targetDate: '2026-10-26', today: FAR, rules } }, { ...config, noEventAdjustmentPercent: 0 });
    expect(r.suggestedPrice).toBe(100);
  });
});

describe('computePriceV2 — guardrails', () => {
  it('piso: redução combinada limitada a maxDecreasePercent (default 20%)', () => {
    const r = computePriceV2(
      {
        basePrice: 300,
        context: {
          targetDate: '2026-10-28',
          today: '2026-10-27',
          occupancy: { prevNightBooked: true, nextNightBooked: true },
          rules: cloneDefaultPricingRules().map((x) => (x.type === 'occupancy_floor' ? { ...x, enabled: false } : x)),
        },
      },
      config,
    );
    // -5% * -8% * -12% * -20% = -38,5% → limitado a -20%
    expect(r.uncappedMultiplier).toBeLessThan(0.7);
    expect(r.multiplier).toBe(0.8);
    expect(r.suggestedPrice).toBe(240);
    expect(r.guardrail.capped).toBe('floor');
    expect(r.drivers.find((d) => d.key === 'guardrail_max_decrease')!.applied).toBe(true);
  });

  it('guardrail do imóvel (maxDecreasePercent=10) é respeitado', () => {
    const r = computePriceV2(
      { basePrice: 300, context: { targetDate: '2026-10-28', today: '2026-10-27', guardrail: { maxDecreasePercent: 10 }, rules: noRules().map((x) => (x.type === 'last_minute' || x.type === 'weekday_discount' ? { ...x, enabled: true } : x)) } },
      config,
    );
    expect(r.multiplier).toBe(0.9);
  });

  it('teto: aumento limitado a maxIncreasePercent', () => {
    const r = computePriceV2(
      {
        basePrice: 100,
        event: { lat: -23.5, lng: -46.6, relevancia: 100, relevanciaConfianca: 0.9, expectedAttendance: 60000 },
        attractivity: { score: 95, travelTime: 5 },
        context: { targetDate: '2026-10-31', today: FAR, distanceKm: 1, guardrail: { maxIncreasePercent: 30 } },
      },
      config,
    );
    // A 1 km (raio default 3 km → proximidade e^-1/3 ≈ 0,72): orgânico = 1,086 × 1,143 ≈ 1,24
    // < regra de evento 1,25 → regra; × sábado +15% = 1,4375 → teto 1,30
    expect(r.uncappedMultiplier).toBeCloseTo(1.25 * 1.15, 3);
    expect(r.drivers.find((d) => d.key === 'rule_event_uplift')!.applied).toBe(true);
    expect(r.multiplier).toBe(1.3);
    expect(r.guardrail.capped).toBe('ceiling');
  });

  it('piso de preço (occupancy_floor) interrompe a queda mas nunca sobe acima da base', () => {
    const rules = cloneDefaultPricingRules().map((x) => (x.type === 'occupancy_floor' ? { ...x, params: { minPrice: 190 } } : x));
    const r = computePriceV2({ basePrice: 200, context: { targetDate: '2026-10-28', today: FAR, rules } }, config);
    expect(r.suggestedPrice).toBe(190);
    expect(r.guardrail.capped).toBe('occupancy_floor');

    const above = computePriceV2(
      { basePrice: 120, context: { targetDate: '2026-10-28', today: FAR, rules: rules.map((x) => (x.type === 'occupancy_floor' ? { ...x, params: { minPrice: 180 } } : x)) } },
      config,
    );
    expect(above.suggestedPrice).toBe(120); // piso 180 > base 120 → segura na base, não sobe
  });

  it('basePrice inválido lança erro explícito', () => {
    expect(() => computePriceV2({ basePrice: 0 }, config)).toThrow('basePrice inválido');
  });
});

describe('computePriceV2 — eventos sem dupla contagem', () => {
  it('proximidade conta uma vez e categoria KNN não soma +10%', () => {
    const r = computePriceV2(
      {
        basePrice: 100,
        classification: { categoryId: 1, categoryName: 'Standard' },
        event: { lat: -23.5, lng: -46.6 },
        attractivity: { score: 100, travelTime: 8 },
        context: { targetDate: '2026-11-01', today: FAR },
      },
      config,
    );
    expect(r.suggestedPrice).toBe(106); // +12% × magnitude 0,5; v1 daria 1 + 0,1 + 0,5 + 0,3 = 1,9×
    expect(r.drivers.find((d) => d.key === 'knn_category')).toMatchObject({ applied: false, deltaPercent: 0 });
  });

  it('regra event_uplift substitui a proximidade quando o evento é de alto impacto e dentro do raio', () => {
    const r = computePriceV2(
      {
        basePrice: 100,
        event: { lat: -23.5, lng: -46.6, expectedAttendance: 45000 },
        attractivity: { score: 100, travelTime: 8 },
        context: { targetDate: '2026-11-01', today: FAR, distanceKm: 2 },
      },
      config,
    );
    expect(r.drivers.map((d) => d.key)).toContain('rule_event_uplift');
    expect(r.drivers.map((d) => d.key)).not.toContain('event_proximity');
    expect(r.suggestedPrice).toBe(125);
  });

  it('regra de evento absorve a relevância IA (não soma os dois)', () => {
    const r = computePriceV2(
      {
        basePrice: 100,
        event: { lat: -23.5, lng: -46.6, expectedAttendance: 45000, relevancia: 50, relevanciaConfianca: 0.9 },
        attractivity: { score: 100, travelTime: 8 },
        context: { targetDate: '2026-11-01', today: FAR, distanceKm: 2 },
      },
      config,
    );
    expect(r.suggestedPrice).toBe(125);
    expect(r.drivers.find((d) => d.key === 'gemini_relevance')).toMatchObject({ applied: false, deltaPercent: 0 });
  });

  it('relevância IA longe do evento é zerada', () => {
    const r = computePriceV2(
      {
        basePrice: 100,
        event: { lat: -23.5, lng: -46.6, relevancia: 100, relevanciaConfianca: 0.9 },
        attractivity: { score: 30, travelTime: 70 },
        context: { targetDate: '2026-11-01', today: FAR },
      },
      config,
    );
    expect(r.suggestedPrice).toBe(100);
    expect(r.drivers.find((d) => d.key === 'gemini_relevance')!.applied).toBe(false);
  });
});

describe('computePriceV2 — explicabilidade', () => {
  it('todo resultado traz drivers no formato do PricingDecisionSnapshot', () => {
    const r = computePriceV2({ basePrice: 300, context: { targetDate: '2026-10-28', today: FAR } }, config);
    for (const d of r.drivers) {
      expect(typeof d.key).toBe('string');
      expect(typeof d.label).toBe('string');
      expect(typeof d.weight).toBe('number');
      expect(typeof d.explanation).toBe('string');
    }
    const snap = toSnapshotDrivers(r.drivers);
    expect(Object.keys(snap[0]).sort()).toEqual(['explanation', 'key', 'label', 'weight']);
    expect(snap[0].explanation).toContain('Efeito: -5%');
    expect(r.reasoning).toContain('Motor v2');
  });

  it('multiplicador final é o produto dos drivers aplicados (sem guardrail ativo)', () => {
    const r = computePriceV2({ basePrice: 300, context: { targetDate: '2026-10-28', today: FAR } }, config);
    const product = r.drivers.filter((d) => d.applied).reduce((m, d) => m * (1 + d.weight), 1);
    expect(r.multiplier).toBeCloseTo(product, 3);
  });
});

describe('resolvePricingEngineMode', () => {
  it('default shadow; true → v2; false → v1', () => {
    expect(resolvePricingEngineMode(undefined)).toBe('shadow');
    expect(resolvePricingEngineMode('')).toBe('shadow');
    expect(resolvePricingEngineMode('shadow')).toBe('shadow');
    expect(resolvePricingEngineMode('true')).toBe('v2');
    expect(resolvePricingEngineMode('ON')).toBe('v2');
    expect(resolvePricingEngineMode('false')).toBe('v1');
  });
});
