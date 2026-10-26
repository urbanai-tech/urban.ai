import { buildOutcomesComparison, distancePercent, OutcomeRow } from './outcomes-comparison';

const row = (id: string, overrides: Partial<OutcomeRow> = {}): OutcomeRow => ({
  id,
  endereco: { id: 'a', list: { titulo: 'Studio' } },
  evento: { nome: 'Show', dataInicio: new Date('2026-10-10T22:00:00Z') },
  usuarioProprietario: { email: 'ana@example.com' },
  precoSugerido: '300.00',
  shadowV2Preco: '280.00',
  shadowV2Versao: 'pricing-engine-v2.0',
  precoAplicado: '290.00',
  resultadoRegistradoEm: new Date('2026-10-12T12:00:00Z'),
  reservaStatus: 'booked',
  receitaReal: '870.00',
  noitesReservadas: 3,
  ...overrides,
});

describe('distancePercent', () => {
  it('é relativa ao preço aplicado', () => {
    expect(distancePercent(200, 220)).toBeCloseTo(10);
    expect(distancePercent(200, 180)).toBeCloseTo(10);
    expect(distancePercent(200, 200)).toBe(0);
  });
});

describe('buildOutcomesComparison', () => {
  it('compara v1, v2, aplicado e resultado por recomendação', () => {
    const { rows } = buildOutcomesComparison([row('1')]);
    expect(rows).toEqual([
      expect.objectContaining({
        analysisId: '1',
        property: 'Studio',
        v1Price: 300,
        v2Price: 280,
        v2Version: 'pricing-engine-v2.0',
        appliedPrice: 290,
        v2VsV1Percent: -6.7,
        appliedVsV1Percent: -3.3,
        closer: 'tie',
        outcome: 'booked',
        revenue: 870,
        nights: 3,
      }),
    ]);
  });

  it('closer: v1 / v2 conforme quem ficou mais perto do preço aplicado', () => {
    const { rows } = buildOutcomesComparison([
      row('a', { precoAplicado: '295' }), // v1=300 (5) x v2=280 (15) -> v1
      row('b', { precoAplicado: '282' }), // v1 (18) x v2 (2) -> v2
    ]);
    expect(rows.map((r) => r.closer)).toEqual(['v1', 'v2']);
  });

  it('ignora linhas sem preço aplicado ou sem resultado concreto, e duplicadas', () => {
    const { summary } = buildOutcomesComparison([
      row('1'),
      row('1'),
      row('2', { precoAplicado: null }),
      row('3', { resultadoRegistradoEm: null }),
      row('4', { reservaStatus: 'unknown', receitaReal: null, noitesReservadas: null }),
    ]);
    expect(summary.n).toBe(1);
  });

  it('sem v2 guardado: v2 e closer ficam null e a linha não entra nas distâncias', () => {
    const { rows, summary } = buildOutcomesComparison([row('1', { shadowV2Preco: null, shadowV2Versao: null })]);
    expect(rows[0]).toMatchObject({ v2Price: null, v2Version: null, v2VsV1Percent: null, closer: null });
    expect(summary).toMatchObject({ n: 1, nWithV2: 0, meanDistanceV1Percent: null, meanDistanceV2Percent: null });
  });

  it('conta resultados e só soma a receita registrada', () => {
    const { summary } = buildOutcomesComparison([
      row('1'),
      row('2', { reservaStatus: 'not_booked', receitaReal: null, noitesReservadas: 0 }),
      row('3', { reservaStatus: 'blocked', receitaReal: '0' }),
      row('4', { receitaReal: '130.50' }),
    ]);
    expect(summary).toMatchObject({ n: 4, booked: 2, notBooked: 1, blocked: 1, nWithRevenue: 2, recordedRevenue: 1000.5 });
  });

  it('amostra pequena: mostra n e NENHUMA conclusão', () => {
    const result = buildOutcomesComparison([row('1'), row('2', { precoAplicado: '281' })]);
    expect(result.conclusions.available).toBe(false);
    expect((result.conclusions as any).reason).toContain('n = 2');
    expect((result.conclusions as any).reason).toContain('mínimo 30');
    expect(result.summary.n).toBe(2);
  });

  it('com n suficiente (>= minSample com v1 e v2) conclui só proximidade, avisando que não é A/B', () => {
    const many = Array.from({ length: 30 }, (_, i) => row(String(i), { precoAplicado: '282' }));
    const result = buildOutcomesComparison(many, 30);
    expect(result.conclusions.available).toBe(true);
    const text = (result.conclusions as any).text as string;
    expect(text).toContain('n = 30');
    expect(text).toContain('o v2 ficou, em média, mais perto');
    expect(text).toContain('não houve teste A/B');
    expect(result.summary).toMatchObject({ closerToV2: 30, closerToV1: 0, meanDistanceV1Percent: 6.4, meanDistanceV2Percent: 0.7 });
  });

  it('o limiar conta só linhas com v1 E v2 (linhas só com v1 não inflam o n)', () => {
    const rows = [
      ...Array.from({ length: 29 }, (_, i) => row(`a${i}`)),
      ...Array.from({ length: 10 }, (_, i) => row(`b${i}`, { shadowV2Preco: null })),
    ];
    const result = buildOutcomesComparison(rows, 30);
    expect(result.summary.n).toBe(39);
    expect(result.conclusions.available).toBe(false);
  });
});
