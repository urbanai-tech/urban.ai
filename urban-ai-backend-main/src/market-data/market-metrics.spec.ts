import { customers, externals, rec } from './__fixtures__/market-fixtures-spec';
import {
  computeEventEffect,
  computeMarketMetrics,
  computeSeasonality,
  computeTrend30d,
  dailyMedians,
} from './market-metrics';
import { dateKeyAddDays } from './market-math';
import { MarketListingRecord } from './market-data.types';

const FROM = '2026-10-02';
const TO = '2026-10-31';
const dates = Array.from({ length: 30 }, (_, i) => dateKeyAddDays(FROM, i));

function input(records: MarketListingRecord[], extra: Partial<Parameters<typeof computeMarketMetrics>[0]> = {}) {
  return {
    records,
    ownAdr: 300,
    ownOccupancy: 0.5,
    ownDaily: new Map<string, number>(),
    dates,
    from: FROM,
    to: TO,
    eventDays: new Set<string>(),
    minSample: 5,
    ...extra,
  };
}

/** Série sintética: diária base + variação por data. */
function withSeries(record: MarketListingRecord, adrOf: (date: string) => number, days: string[]) {
  return { ...record, observations: days.map((date) => ({ date, adr: adrOf(date), occupancy: null })) };
}

describe('computeMarketMetrics', () => {
  it('percentil, mediana e p25–p75 de ADR sobre o comp set', () => {
    const m = computeMarketMetrics(input(customers(5)));
    expect(m.comparablesCount).toBe(5);
    expect(m.medianAdr).toBe(300);
    expect(m.adrPercentiles).toEqual({ p25: 200, p50: 300, p75: 400 });
    expect(m.percentile).toBe(60); // 300 ≥ 100, 200 e 300 (3 de 5)
  });

  it('ocupação: mediana e p25–p75 só com amostra mínima; senão indisponível (não vira 0%)', () => {
    const enough = computeMarketMetrics(
      input(customers(5).map((r, i) => ({ ...r, occupancy: 0.5 + i * 0.1 }))),
    );
    expect(enough.medianOccupancy).toBe(0.7);
    expect(enough.occupancyPercentiles).toEqual({ p25: 0.6, p50: 0.7, p75: 0.8 });
    expect(enough.occupancySample).toBe(5);

    const few = computeMarketMetrics(
      input(customers(5).map((r, i) => ({ ...r, occupancy: i < 2 ? 0.6 : null }))),
    );
    expect(few.medianOccupancy).toBeNull();
    expect(few.occupancyPercentiles).toBeNull();
    expect(few.occupancySample).toBe(2);
  });

  it('marca a ocupação como estimativa quando a maioria vem do proxy (Inside Airbnb)', () => {
    const records = externals(8, 'inside_airbnb').map((r) => ({ ...r, occupancy: 0.6, occupancyIsProxy: true }));
    expect(computeMarketMetrics(input(records)).occupancyIsProxy).toBe(true);
    const observed = externals(8).map((r) => ({ ...r, occupancy: 0.6, occupancyIsProxy: false }));
    expect(computeMarketMetrics(input(observed)).occupancyIsProxy).toBe(false);
  });

  it('série diária: mediana dos comps com amostra mínima; senão cai na mediana geral', () => {
    const records = customers(6).map((r) =>
      withSeries(r, () => (r.adr as number), [dates[0], dates[1]]),
    );
    const m = computeMarketMetrics(input(records, { ownDaily: new Map([[dates[0], 280]]) }));
    expect(m.daily).toHaveLength(30);
    expect(m.daily[0]).toEqual({ date: dates[0], yourAdr: 280, medianAdr: 350 });
    // dia sem observação: preço base do anfitrião e mediana geral
    expect(m.daily[10]).toEqual({ date: dates[10], yourAdr: 300, medianAdr: 350 });
  });

  it('anúncio sem série usa a diária única; com série, a mediana da janela', () => {
    const flat = rec({ source: 'licensed_dataset', adr: 999 });
    const series = withSeries(flat, () => 250, [dates[3], dates[4], dates[5]]);
    const m = computeMarketMetrics(input([series, ...externals(7).map((r) => ({ ...r, adr: 250 }))]));
    expect(m.medianAdr).toBe(250);
  });
});

describe('sazonalidade', () => {
  function monthly(records: number, months: Record<number, number>) {
    return Array.from({ length: records }, (_, i) => ({
      ...rec({ source: 'licensed_dataset', sourceListingId: `s${i}` }),
      observations: Object.entries(months).flatMap(([month, adr]) =>
        [1, 8, 15].map((d) => ({ date: `2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, adr, occupancy: null })),
      ),
    }));
  }

  it('índice por mês = mediana do mês ÷ mediana geral', () => {
    const points = computeSeasonality(monthly(4, { 1: 400, 6: 200 }), 10) as any[];
    expect(points).toHaveLength(2);
    expect(points.find((p) => p.month === 1).index).toBeCloseTo(1.33, 2);
    expect(points.find((p) => p.month === 6).index).toBeCloseTo(0.67, 2);
  });

  it('só devolve meses com amostra mínima e exige pelo menos dois meses', () => {
    expect(computeSeasonality(monthly(1, { 1: 400, 6: 200 }), 10)).toBeNull(); // 3 obs por mês
    expect(computeSeasonality(monthly(4, { 3: 300 }), 10)).toBeNull();
    expect(computeSeasonality(customers(5), 10)).toBeNull(); // sem observações
  });
});

describe('efeito dos eventos no bairro', () => {
  it('compara a mediana do bairro em dias com evento × dias sem', () => {
    const medians = new Map<string, number>();
    dates.slice(0, 10).forEach((d, i) => medians.set(d, i < 3 ? 360 : 300));
    const effect = computeEventEffect(medians, new Set(dates.slice(0, 3)));
    expect(effect).toEqual({ upliftPct: 20, eventDays: 3, baselineDays: 7 });
  });

  it('sem dados suficientes devolve null (não fabrica efeito)', () => {
    const medians = new Map(dates.slice(0, 4).map((d) => [d, 300] as [string, number]));
    expect(computeEventEffect(medians, new Set([dates[0]]))).toBeNull();
    expect(computeEventEffect(new Map(), new Set())).toBeNull();
  });

  it('dailyMedians respeita a amostra mínima por dia', () => {
    const records = customers(6).map((r, i) => withSeries(r, () => 100 + i, i < 4 ? [dates[0]] : [dates[1]]));
    const medians = dailyMedians(records, dates, 5);
    expect(medians.size).toBe(0); // 4 no dia 0 e 2 no dia 1: nenhum chega a 5
    expect(dailyMedians(records, dates, 4).get(dates[0])).toBeDefined();
  });

  it('entra nas métricas quando há série e dias de evento', () => {
    const eventDays = dates.slice(0, 3);
    const records = customers(6).map((r) =>
      withSeries(r, (date) => (eventDays.includes(date) ? 360 : 300), dates.slice(0, 10)),
    );
    const m = computeMarketMetrics(input(records, { eventDays: new Set(eventDays) }));
    expect(m.eventEffect).toEqual({ upliftPct: 20, eventDays: 3, baselineDays: 7 });
  });
});

describe('tendência de 30 dias', () => {
  const curDays = [dateKeyAddDays(TO, -5), dateKeyAddDays(TO, -10)];
  const prevDays = [dateKeyAddDays(TO, -35), dateKeyAddDays(TO, -40)];

  function trendRecords(n: number, prev: number, cur: number) {
    return customers(n).map((r) => ({
      ...r,
      observations: [
        ...prevDays.map((date) => ({ date, adr: prev, occupancy: null })),
        ...curDays.map((date) => ({ date, adr: cur, occupancy: null })),
      ],
    }));
  }

  it('calcula a variação da mediana e do percentil entre os dois períodos de 30 dias', () => {
    const trend = computeTrend30d(trendRecords(6, 200, 240), TO, 230, new Map(), 5);
    expect(trend.available).toBe(true);
    expect(trend.medianAdrChangePct).toBe(20);
    expect(trend.previousMedianAdr).toBe(200);
    expect(trend.currentMedianAdr).toBe(240);
    // com a diária própria (230) fixa: antes estava acima de todos (100), agora abaixo (0)
    expect(trend.percentilePoints).toBe(-100);
    expect(trend.ownBasis).toBe('current');
  });

  it('usa a diária própria observada no período anterior quando existe', () => {
    const ownDaily = new Map(prevDays.concat([dateKeyAddDays(TO, -33)]).map((d) => [d, 190] as [string, number]));
    const trend = computeTrend30d(trendRecords(6, 200, 240), TO, 230, ownDaily, 5);
    expect(trend.ownBasis).toBe('observed');
    expect(trend.percentilePoints).toBe(0 - 0); // 190 < 200 antes (0); 230 < 240 agora (0)
  });

  it('sem histórico nos dois períodos fica indisponível, com o motivo', () => {
    const trend = computeTrend30d(customers(6), TO, 300, new Map(), 5);
    expect(trend.available).toBe(false);
    expect(trend.percentilePoints).toBeNull();
    expect(trend.reason).toMatch(/Histórico insuficiente/);
    const few = computeTrend30d(trendRecords(3, 200, 240), TO, 230, new Map(), 5);
    expect(few.available).toBe(false);
    expect(few.pairedListings).toBe(3);
  });

  it('percentileTrend legado = 0 quando indisponível, no bloco de métricas', () => {
    const m = computeMarketMetrics(input(customers(5)));
    expect(m.trend30d.available).toBe(false);
    expect(m.listingsWithHistory).toBe(0);
  });
});
