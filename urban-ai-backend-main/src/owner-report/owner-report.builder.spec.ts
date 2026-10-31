import {
  buildOwnerReport,
  MIN_CALENDAR_COVERAGE,
  OwnerReportAnalysisRow,
  OwnerReportOccupancyRow,
  OwnerReportPropertyInput,
  summarizeForEmail,
} from './owner-report.builder';

const NOW = new Date('2026-10-01T12:00:00Z'); // 1º dia útil de outubro; relatório de setembro

let seq = 0;
function analysis(overrides: Partial<OwnerReportAnalysisRow> = {}): OwnerReportAnalysisRow {
  seq += 1;
  return {
    id: `analysis-secret-${seq}`,
    endereco: { id: 'address-secret-1' },
    evento: { id: `event-secret-${seq}`, nome: `Evento ${seq}`, dataInicio: '2026-09-12T15:00:00Z', relevancia: 70 },
    criadoEm: '2026-09-01T12:00:00Z',
    aceitoEm: null,
    aplicadoEm: null,
    resultadoRegistradoEm: null,
    precoSugerido: 300,
    seuPrecoAtual: 200,
    precoAplicado: null,
    reservaStatus: null,
    receitaReal: null,
    noitesReservadas: null,
    diferencaPercentual: 50,
    ...overrides,
  };
}

function applied(overrides: Partial<OwnerReportAnalysisRow> = {}): OwnerReportAnalysisRow {
  return analysis({
    aceitoEm: '2026-09-02T12:00:00Z',
    aplicadoEm: '2026-09-03T12:00:00Z',
    precoAplicado: 300,
    ...overrides,
  });
}

function withOutcome(overrides: Partial<OwnerReportAnalysisRow> = {}): OwnerReportAnalysisRow {
  return applied({
    resultadoRegistradoEm: '2026-09-20T12:00:00Z',
    reservaStatus: 'booked',
    receitaReal: 900,
    noitesReservadas: 3,
    ...overrides,
  });
}

function days(status: string, dates: string[], extra: Partial<OwnerReportOccupancyRow> = {}): OwnerReportOccupancyRow[] {
  return dates.map((date) => ({ date, status, origin: 'stays_sync', ...extra }));
}

function monthDates(month: string, from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => `${month}-${String(from + i).padStart(2, '0')}`);
}

function build(properties: Array<Partial<OwnerReportPropertyInput>>, now = NOW, periodKey = '2026-09') {
  return buildOwnerReport({
    ownerName: 'Maria Souza',
    preparedBy: 'Ana Host',
    periodKey,
    now,
    properties: properties.map((p, i) => ({ title: `Imóvel ${i + 1}`, location: 'Pinheiros, São Paulo', analyses: [], occupancy: [], ...p })),
  });
}

describe('buildOwnerReport: regra "nunca fabricar número"', () => {
  it('sem nenhum dado: tudo é null (nunca zero) e o texto diz que não há dado', () => {
    const report = build([{}, {}]);
    expect(report.summary.dataStatus).toBe('none');
    expect(report.summary.totalRevenue).toBeNull();
    expect(report.summary.averageDailyRate).toBeNull();
    expect(report.summary.occupancyPct).toBeNull();
    expect(report.summary.confirmedExtra).toBeNull();
    expect(report.summary.headline).toMatch(/ainda não há resultado registrado/);
    for (const property of report.properties) {
      expect(property.revenue).toBeNull();
      expect(property.averageDailyRate).toBeNull();
      expect(property.occupancy.pct).toBeNull();
      expect(property.hasData).toBe(false);
      expect(property.dataMessage).toMatch(/Sem resultado registrado nem calendário/);
      expect(property.comparison).toEqual({ revenue: null, averageDailyRate: null, occupancyPct: null });
    }
  });

  it('resultado "unknown" ou só observação não conta como resultado', () => {
    const report = build([
      {
        analyses: [
          applied({ resultadoRegistradoEm: '2026-09-20T12:00:00Z', reservaStatus: 'unknown' }),
          applied({ resultadoRegistradoEm: '2026-09-20T12:00:00Z', reservaStatus: null, receitaReal: null }),
        ],
      },
    ]);
    expect(report.properties[0].revenue).toBeNull();
    expect(report.summary.dataStatus).toBe('none');
  });

  it('receita registrada: soma só o que o anfitrião registrou; diária média usa só pares receita+noites', () => {
    const report = build([
      {
        analyses: [
          withOutcome({ receitaReal: 900, noitesReservadas: 3 }), // 300/noite
          withOutcome({ receitaReal: 500, noitesReservadas: 1, evento: { id: 'e2', nome: 'B', dataInicio: '2026-09-20T15:00:00Z', relevancia: 40 } }),
          // receita sem noites: entra na receita, não distorce a diária média
          withOutcome({ receitaReal: 400, noitesReservadas: null, evento: { id: 'e3', nome: 'C', dataInicio: '2026-09-25T15:00:00Z', relevancia: 10 } }),
        ],
      },
    ]);
    const p = report.properties[0];
    expect(p.revenue).toBe(1800);
    expect(p.revenueSource).toBe('recorded_outcomes');
    expect(p.averageDailyRate).toBe(350); // (900+500)/(3+1)
    expect(p.adrSource).toBe('recorded_outcomes');
    expect(report.summary.totalRevenue).toBe(1800);
    expect(report.summary.averageDailyRate).toBe(350);
    expect(report.summary.dataStatus).toBe('complete');
  });

  it('resultado conta no mês do EVENTO, não no mês em que foi registrado', () => {
    const report = build([
      { analyses: [withOutcome({ resultadoRegistradoEm: '2026-10-05T12:00:00Z', receitaReal: 700, noitesReservadas: 2 })] },
    ]);
    expect(report.properties[0].revenue).toBe(700);
    const october = build([{ analyses: [withOutcome({ resultadoRegistradoEm: '2026-10-05T12:00:00Z', receitaReal: 700 })] }], new Date('2026-11-03T12:00:00Z'), '2026-10');
    expect(october.properties[0].revenue).toBeNull();
  });

  it('re-análises do mesmo evento não contam a receita duas vezes (vale o último registro)', () => {
    const event = { id: 'mesmo-evento', nome: 'Show', dataInicio: '2026-09-12T15:00:00Z', relevancia: 80 };
    const report = build([
      {
        analyses: [
          withOutcome({ evento: event, receitaReal: 800, noitesReservadas: 2, resultadoRegistradoEm: '2026-09-18T12:00:00Z' }),
          withOutcome({ evento: event, receitaReal: 900, noitesReservadas: 2, resultadoRegistradoEm: '2026-09-21T12:00:00Z' }),
        ],
      },
    ]);
    expect(report.properties[0].revenue).toBe(900);
  });

  it('imóveis sem dado ficam fora da soma e aparecem como "sem dado" (nunca completados com zero)', () => {
    const report = build([{ analyses: [withOutcome()] }, {}]);
    expect(report.summary.propertiesWithRevenue).toBe(1);
    expect(report.summary.totalRevenue).toBe(900);
    expect(report.summary.dataStatus).toBe('partial');
    expect(report.summary.headline).toMatch(/1 de 2 imóveis têm receita registrada/);
    expect(report.properties[1].revenue).toBeNull();
    expect(report.properties[1].dataMessage).not.toBeNull();
  });
});

describe('buildOwnerReport: ocupação só com calendário real', () => {
  it('calendário completo (>=80% dos dias): ocupação = reservadas / (reservadas + livres), bloqueados fora', () => {
    const report = build([
      {
        occupancy: [
          ...days('booked', monthDates('2026-09', 1, 12), { revenueCents: 30_000 }),
          ...days('available', monthDates('2026-09', 13, 28)),
          ...days('blocked', monthDates('2026-09', 29, 30)),
        ],
      },
    ]);
    const p = report.properties[0];
    // 12 / (12 + 16) = 42,86%
    expect(p.occupancy.pct).toBeCloseTo(42.86, 2);
    expect(p.occupancy.occupiedNights).toBe(12);
    expect(p.occupancy.source).toBe('stays');
    expect(p.revenue).toBe(3600);
    expect(p.revenueSource).toBe('calendar');
    expect(p.averageDailyRate).toBe(300);
    expect(report.summary.occupancyPct).toBeCloseTo(42.86, 2);
  });

  it(`calendário incompleto (< ${MIN_CALENDAR_COVERAGE * 100}% dos dias): sem ocupação e a nota explica`, () => {
    const report = build([{ occupancy: [...days('booked', monthDates('2026-09', 1, 10)), ...days('available', monthDates('2026-09', 11, 15))] }]);
    const p = report.properties[0];
    expect(p.occupancy.pct).toBeNull();
    expect(p.occupancy.occupiedNights).toBeNull();
    expect(p.occupancy.note).toMatch(/Calendário incompleto: 15 de 30 dias/);
    expect(report.summary.occupancyPct).toBeNull();
  });

  it('origens "inferred" e "airbnb_calendar" nunca contam; "unknown" também não', () => {
    const report = build([
      {
        occupancy: [
          ...days('booked', monthDates('2026-09', 1, 30), { origin: 'inferred' }),
          ...days('booked', monthDates('2026-09', 1, 30), { origin: 'airbnb_calendar' }),
          ...days('unknown', monthDates('2026-09', 1, 30), { origin: 'manual' }),
        ],
      },
    ]);
    expect(report.properties[0].occupancy.pct).toBeNull();
    expect(report.properties[0].occupancy.note).toMatch(/Sem calendário/);
  });

  it('origem mista (manual + stays) é informada como "mixed"', () => {
    const report = build([
      {
        occupancy: [
          ...days('booked', monthDates('2026-09', 1, 15), { origin: 'manual' }),
          ...days('available', monthDates('2026-09', 16, 30), { origin: 'stays_sync' }),
        ],
      },
    ]);
    expect(report.properties[0].occupancy.source).toBe('mixed');
  });

  it('diária reservada sem valor de receita não vira receita zero', () => {
    const report = build([{ occupancy: days('booked', monthDates('2026-09', 1, 30), { revenueCents: null }) }]);
    const p = report.properties[0];
    expect(p.occupancy.pct).toBe(100);
    expect(p.revenue).toBeNull();
    expect(p.averageDailyRate).toBeNull();
  });
});

describe('buildOwnerReport: efeito das recomendações aplicadas', () => {
  it('efeito confirmado só com reserva/receita registrada e preço aplicado acima do de partida', () => {
    const report = build([
      { analyses: [withOutcome({ seuPrecoAtual: 200, precoAplicado: 300, noitesReservadas: 3, receitaReal: 900 })] },
    ]);
    const item = report.properties[0].applied.items[0];
    expect(item.outcome).toEqual({ status: 'booked', revenue: 900, nights: 3, confirmedExtra: 300 });
    expect(report.summary.confirmedExtra).toBe(300);
    expect(report.summary.recommendationsApplied).toBe(1);
  });

  it('não reservou, ou aplicou abaixo do preço de partida: sem efeito confirmado', () => {
    const notBooked = build([
      { analyses: [applied({ resultadoRegistradoEm: '2026-09-20T12:00:00Z', reservaStatus: 'not_booked' })] },
    ]);
    expect(notBooked.properties[0].applied.items[0].outcome).toEqual({ status: 'not_booked', revenue: null, nights: null, confirmedExtra: null });
    const lower = build([{ analyses: [withOutcome({ seuPrecoAtual: 400, precoAplicado: 300 })] }]);
    expect(lower.properties[0].applied.items[0].outcome.confirmedExtra).toBeNull();
    expect(lower.summary.confirmedExtra).toBeNull();
  });

  it('sem resultado registrado o relatório diz isso: pendente (evento passou) ou aguardando (evento futuro)', () => {
    const report = build([
      {
        analyses: [
          applied({ evento: { id: 'p', nome: 'Já passou', dataInicio: '2026-09-10T15:00:00Z', relevancia: 50 } }),
          applied({ evento: { id: 'f', nome: 'Ainda não aconteceu', dataInicio: '2026-09-30T23:00:00Z', relevancia: 50 } }),
        ],
      },
    ], new Date('2026-09-29T12:00:00Z'));
    const items = report.properties[0].applied.items;
    expect(items.map((i) => i.outcome.status)).toEqual(['pending', 'awaiting_event']);
    expect(report.properties[0].pendingOutcomes).toBe(1);
    expect(report.summary.pendingOutcomes).toBe(1);
    expect(items.every((i) => i.outcome.revenue === null && i.outcome.confirmedExtra === null)).toBe(true);
    expect(report.properties[0].dataMessage).toMatch(/1 aplicação aguardando/);
  });

  it('lista eventos do mês por relevância, com contagem total', () => {
    const analyses = Array.from({ length: 8 }, (_, i) =>
      analysis({ evento: { id: `ev-${i}`, nome: `Ev ${i}`, dataInicio: '2026-09-10T15:00:00Z', relevancia: i * 10 } }),
    );
    const report = build([{ analyses }]);
    const events = report.properties[0].events;
    expect(events.total).toBe(8);
    expect(events.items).toHaveLength(6);
    expect(events.items[0].name).toBe('Ev 7');
  });
});

describe('buildOwnerReport: comparação com o mês anterior', () => {
  it('compara quando os DOIS meses têm dado do imóvel', () => {
    const august = withOutcome({
      evento: { id: 'aug', nome: 'Agosto', dataInicio: '2026-08-15T15:00:00Z', relevancia: 50 },
      criadoEm: '2026-08-01T12:00:00Z',
      aplicadoEm: '2026-08-03T12:00:00Z',
      aceitoEm: '2026-08-02T12:00:00Z',
      resultadoRegistradoEm: '2026-08-20T12:00:00Z',
      receitaReal: 600,
      noitesReservadas: 2,
    });
    const report = build([{ analyses: [withOutcome({ receitaReal: 900, noitesReservadas: 3 }), august] }]);
    expect(report.properties[0].comparison.revenue).toEqual({ current: 900, previous: 600, delta: 300, deltaPct: 50 });
    expect(report.properties[0].comparison.averageDailyRate).toEqual({ current: 300, previous: 300, delta: 0, deltaPct: 0 });
    expect(report.summary.comparison.revenue).toEqual({ current: 900, previous: 600, delta: 300, deltaPct: 50 });
    expect(report.summary.comparison.comparableProperties).toBe(1);
    expect(report.previousPeriod).toEqual({ key: '2026-08', label: 'agosto de 2026' });
  });

  it('sem dado no mês anterior (ou só nele): não há comparação, nunca delta contra zero', () => {
    const onlyCurrent = build([{ analyses: [withOutcome()] }]);
    expect(onlyCurrent.properties[0].comparison.revenue).toBeNull();
    expect(onlyCurrent.summary.comparison.revenue).toBeNull();
    expect(onlyCurrent.summary.comparison.comparableProperties).toBe(0);
  });

  it('a comparação do portfólio considera só imóveis com dado nos dois meses', () => {
    const augustFor = (id: string) =>
      withOutcome({
        evento: { id, nome: id, dataInicio: '2026-08-15T15:00:00Z', relevancia: 1 },
        resultadoRegistradoEm: '2026-08-20T12:00:00Z',
        receitaReal: 1000,
      });
    const report = build([
      { analyses: [withOutcome({ receitaReal: 1200 }), augustFor('a')] },
      { analyses: [withOutcome({ receitaReal: 5000 })] }, // sem agosto: fora da comparação
    ]);
    expect(report.summary.totalRevenue).toBe(6200);
    expect(report.summary.comparison.revenue).toEqual({ current: 1200, previous: 1000, delta: 200, deltaPct: 20 });
    expect(report.summary.comparison.comparableProperties).toBe(1);
  });
});

describe('buildOwnerReport: payload', () => {
  it('não vaza ID interno (imóvel, recomendação, evento) e usa só a posição como referência', () => {
    const report = build([{ analyses: [withOutcome()], occupancy: days('booked', ['2026-09-01']) }]);
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/secret/);
    expect(json).not.toMatch(/"id"/);
    expect(report.properties[0].ref).toBe(1);
    expect(report.owner).toEqual({ name: 'Maria Souza' });
    expect(report.preparedBy).toBe('Ana Host');
  });

  it('mês corrente é marcado como parcial e a cobertura do calendário usa só os dias já transcorridos', () => {
    const now = new Date('2026-09-15T15:00:00Z');
    const report = build([{ occupancy: days('booked', monthDates('2026-09', 1, 14)) }], now);
    expect(report.period.isPartial).toBe(true);
    expect(report.properties[0].occupancy.pct).toBe(100);
    expect(build([{}]).period.isPartial).toBe(false);
  });

  it('resumo de e-mail só repete o que existe', () => {
    const empty = summarizeForEmail(build([{}]));
    expect(empty).toContain('Receita registrada: sem dado neste mês.');
    expect(empty).toContain('Ocupação: sem dado de calendário suficiente.');
    const full = summarizeForEmail(build([{ analyses: [withOutcome({ receitaReal: 1234 })] }]));
    expect(full.join(' ')).toMatch(/Receita registrada: R\$ 1\.234/);
  });
});
