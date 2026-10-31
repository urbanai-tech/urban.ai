import {
  LeadTimeRow,
  buildLeadTimeReport,
  eventSizeBucket,
  leadDays,
  leadTimeStats,
  percentile,
} from './event-lead-time';

const DAY = 86_400_000;
const EVENT_DAY = new Date('2026-12-01T22:00:00Z');
const row = (daysBefore: number, over: Partial<LeadTimeRow> = {}): LeadTimeRow => ({
  firstSeenAt: new Date(EVENT_DAY.getTime() - daysBefore * DAY),
  dataInicio: EVENT_DAY,
  source: 'sympla-api',
  categoria: 'Show',
  venueCapacity: null,
  expectedAttendance: null,
  ...over,
});

describe('percentile / leadTimeStats', () => {
  it('interpola entre vizinhos e cobre vazio e unitário', () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([7], 90)).toBe(7);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([10, 20, 30, 40, 50], 25)).toBe(20);
  });

  it('mediana, quartis e média', () => {
    expect(leadTimeStats([30, 10, 20])).toEqual({ count: 3, medianDays: 20, p25Days: 15, p75Days: 25, meanDays: 20 });
    expect(leadTimeStats([])).toEqual({ count: 0, medianDays: null, p25Days: null, p75Days: null, meanDays: null });
  });
});

describe('leadDays', () => {
  it('é a antecedência em dias entre first_seen e a data do evento', () => {
    expect(leadDays(row(21))).toBe(21);
    expect(leadDays(row(0.5))).toBeCloseTo(0.5);
  });

  it('negativa quando o evento entrou depois de começar; null com data inválida', () => {
    expect(leadDays(row(-2))).toBe(-2);
    expect(leadDays({ firstSeenAt: new Date('x'), dataInicio: EVENT_DAY })).toBeNull();
  });
});

describe('eventSizeBucket', () => {
  it('usa o maior entre público esperado e capacidade do venue', () => {
    expect(eventSizeBucket({ venueCapacity: 43_000, expectedAttendance: null })).toBe('large');
    expect(eventSizeBucket({ venueCapacity: 500, expectedAttendance: 12_000 })).toBe('large');
    expect(eventSizeBucket({ venueCapacity: 3_000, expectedAttendance: null })).toBe('medium');
    expect(eventSizeBucket({ venueCapacity: 800, expectedAttendance: null })).toBe('small');
    expect(eventSizeBucket({ venueCapacity: null, expectedAttendance: null })).toBe('unknown');
    expect(eventSizeBucket({ venueCapacity: 0, expectedAttendance: 0 })).toBe('unknown');
  });
});

describe('buildLeadTimeReport', () => {
  const rows: LeadTimeRow[] = [
    row(45, { source: 'allianz_parque', categoria: 'Esporte', venueCapacity: 43_000 }),
    row(40, { source: 'allianz-parque', categoria: 'Esporte', venueCapacity: 43_000 }),
    row(20, { source: 'sympla-api', categoria: 'Show', venueCapacity: 2_500 }),
    row(10, { source: 'sympla-api', categoria: 'Show' }),
    row(3, { source: 'sp-cultura', categoria: null }),
    row(-1, { source: 'sympla-api' }), // entrou depois de começar
  ];
  const report = buildLeadTimeReport(rows);

  it('exclui das estatísticas o que entrou depois de começar, mas conta', () => {
    expect(report.lateDiscovered).toBe(1);
    expect(report.overall.count).toBe(5);
    expect(report.overall.medianDays).toBe(20);
  });

  it('distribuição por faixa de antecedência', () => {
    expect(Object.fromEntries(report.distribution.map((b) => [b.key, b.count]))).toEqual({
      d0_6: 1,
      d7_13: 1,
      d14_29: 1,
      d30_59: 2,
      d60_plus: 0,
    });
  });

  it('agrupa por fonte (normalizando _ e caixa), ordenando por volume', () => {
    expect(report.bySource.map((g) => [g.key, g.count])).toEqual([
      ['allianz-parque', 2],
      ['sympla-api', 2],
      ['sp-cultura', 1],
    ]);
    expect(report.bySource[0].medianDays).toBe(42.5);
  });

  it('agrupa por categoria e porte, com rótulos de ausência', () => {
    expect(report.byCategory.map((g) => g.key)).toEqual(['esporte', 'show', '(sem categoria)']);
    expect(report.bySize.map((g) => [g.key, g.count])).toEqual([
      ['large', 2],
      ['medium', 1],
      ['unknown', 2],
    ]);
  });

  it('sem linhas devolve relatório vazio coerente', () => {
    const empty = buildLeadTimeReport([]);
    expect(empty.overall.count).toBe(0);
    expect(empty.overall.medianDays).toBeNull();
    expect(empty.distribution.every((b) => b.count === 0)).toBe(true);
    expect(empty.bySource).toEqual([]);
  });

  it('limita o número de grupos por fonte', () => {
    const many = Array.from({ length: 20 }, (_, i) => row(10 + i, { source: `src-${String(i).padStart(2, '0')}` }));
    expect(buildLeadTimeReport(many, 5).bySource).toHaveLength(5);
  });
});
