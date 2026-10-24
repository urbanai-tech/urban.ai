import { calculateBacktest, meetsQualityGate } from '../backtesting';
import { DisplacementCostMatrix } from '../cost-matrix';
import { TravelTimeEngine } from '../isochrone';
import { PropertyClassifier } from '../knn-classifier';
import { deriveKnnLabels } from '../knn-labels';
import { UrbanAIPricingEngine } from '../pricing-engine';
import { generateSyntheticMarket, haversineKmSimple, SyntheticMarketOptions } from './synthetic-market';

/**
 * Backtest offline v1 × v2 sobre o mercado sintético determinístico.
 * Ver o aviso de honestidade em `synthetic-market.ts`.
 */

/** Tempo de viagem determinístico (mesma heurística do TravelTimeEngine, sem turf). */
class HaversineTravelEngine {
  async calculateTravelTime(origin: any, destination: any, mode = 'transit') {
    const distanceKm = haversineKmSimple(origin, destination);
    const speed = mode === 'driving' ? 15 : 20;
    let hours = distanceKm / speed;
    if (mode === 'driving' && distanceKm > 5) hours *= 1.5;
    return { distanceKm: Number(distanceKm.toFixed(2)), travelTimeMinutes: Math.round(hours * 60), mode };
  }
}

export interface MultiplierDistribution {
  min: number;
  p10: number;
  p50: number;
  p90: number;
  max: number;
  buckets: Record<string, number>;
}

export interface EngineBacktestMetrics {
  mapePercent: number;
  mapeEventNightsPercent: number;
  mapeNoEventNightsPercent: number;
  passesQualityGate: boolean;
  pctBelowBase: number;
  pctAboveBase: number;
  distribution: MultiplierDistribution;
}

export interface EngineComparisonReport {
  seed: number;
  properties: number;
  nights: number;
  eventNights: number;
  inflatedLlmEventNights: number;
  naive: EngineBacktestMetrics;
  v1: EngineBacktestMetrics;
  v2: EngineBacktestMetrics;
}

const BUCKETS: Array<[string, (m: number) => boolean]> = [
  ['<0.90', (m) => m < 0.9],
  ['0.90-0.99', (m) => m >= 0.9 && m < 0.995],
  ['=1.00', (m) => m >= 0.995 && m <= 1.005],
  ['1.01-1.10', (m) => m > 1.005 && m <= 1.1],
  ['1.11-1.30', (m) => m > 1.1 && m <= 1.3],
  ['1.31-1.60', (m) => m > 1.3 && m <= 1.6],
  ['>1.60', (m) => m > 1.6],
];

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx];
}

function r(n: number, d = 2) {
  return Number(n.toFixed(d));
}

function metrics(rows: Array<{ predicted: number; actual: number; base: number; hasEvent: boolean }>): EngineBacktestMetrics {
  const all = calculateBacktest(rows);
  const ev = calculateBacktest(rows.filter((x) => x.hasEvent));
  const noEv = calculateBacktest(rows.filter((x) => !x.hasEvent));
  const mult = rows.map((x) => x.predicted / x.base).sort((a, b) => a - b);
  const buckets: Record<string, number> = {};
  for (const [name, test] of BUCKETS) {
    buckets[name] = r((mult.filter(test).length / mult.length) * 100, 1);
  }
  return {
    mapePercent: r(all.mapePercent),
    mapeEventNightsPercent: r(ev.mapePercent),
    mapeNoEventNightsPercent: r(noEv.mapePercent),
    passesQualityGate: meetsQualityGate(rows).passes,
    pctBelowBase: r((mult.filter((m) => m < 0.995).length / mult.length) * 100, 1),
    pctAboveBase: r((mult.filter((m) => m > 1.005).length / mult.length) * 100, 1),
    distribution: {
      min: r(mult[0], 3),
      p10: r(quantile(mult, 0.1), 3),
      p50: r(quantile(mult, 0.5), 3),
      p90: r(quantile(mult, 0.9), 3),
      max: r(mult[mult.length - 1], 3),
      buckets,
    },
  };
}

export async function runEngineComparison(options: SyntheticMarketOptions = {}): Promise<EngineComparisonReport> {
  const market = generateSyntheticMarket(options);

  // Treino do classificador com o mesmo conjunto: rótulo legado = `category ?? 1`
  // (como o bootstrap fazia), rótulo v2 = percentil de ADR no bairro.
  const { labels } = deriveKnnLabels(
    market.properties.map((p) => ({ lat: p.lat, lng: p.lng, adr: p.basePrice, neighborhoodKey: p.neighborhood })),
  );
  const classifier = new PropertyClassifier();
  classifier.train(
    market.properties.map((p, i) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      metroDistance: p.metroDistance,
      amenitiesCount: p.amenitiesCount,
      category: 1,
      derivedCategory: labels[i].category,
    })),
  );
  const travel = new HaversineTravelEngine() as unknown as TravelTimeEngine;
  const engine = new UrbanAIPricingEngine(travel, classifier, new DisplacementCostMatrix(travel));
  // Silencia o logger do engine no backtest.
  (engine as any).logger = { debug: () => undefined, warn: () => undefined, log: () => undefined };

  const naive: Parameters<typeof metrics>[0] = [];
  const v1: Parameters<typeof metrics>[0] = [];
  const v2: Parameters<typeof metrics>[0] = [];
  let inflated = 0;

  for (const n of market.nights) {
    const p = n.property;
    const prop = { id: p.id, lat: p.lat, lng: p.lng, metroDistance: p.metroDistance, amenitiesCount: p.amenitiesCount };
    const hasEvent = !!n.event;
    if (n.event?.inflatedByLlm) inflated++;
    const base = p.basePrice;
    const actual = n.realizedPrice;

    naive.push({ predicted: base, actual, base, hasEvent });

    // v1 "como implantado": só existe sugestão em noite com evento; sem evento o
    // anfitrião fica no preço base. Teto do sistema = +100% (SYSTEM_MAX_AUMENTO_PERCENT).
    let v1Price = base;
    if (n.event) {
      const res = await engine.suggestPrice(
        prop,
        { name: n.event.name, lat: n.event.lat, lng: n.event.lng, relevancia: n.event.relevancia },
        base,
        { mode: 'v1' },
      );
      v1Price = Math.min(res.suggestedPrice, base * 2);
    }
    v1.push({ predicted: v1Price, actual, base, hasEvent });

    const eventV2 = n.event
      ? {
          name: n.event.name,
          lat: n.event.lat,
          lng: n.event.lng,
          relevancia: n.event.relevancia,
          raioImpactoKm: n.event.raioImpactoKm,
          venueCapacity: n.event.attendanceObservable ? n.event.attendance : null,
          expectedAttendance: n.event.attendanceObservable ? n.event.attendance : null,
        }
      : null;
    const res2 = await engine.suggestPrice(prop, eventV2, base, {
      mode: 'v2',
      targetDate: n.dateKey,
      today: n.todayKey,
      distanceKm: n.eventDistanceKm,
      occupancy: { prevNightBooked: n.prevNightBooked, nextNightBooked: n.nextNightBooked, targetNightBooked: false },
    });
    v2.push({ predicted: res2.suggestedPrice, actual, base, hasEvent });
  }

  return {
    seed: market.seed,
    properties: market.properties.length,
    nights: market.nights.length,
    eventNights: market.nights.filter((n) => n.event).length,
    inflatedLlmEventNights: inflated,
    naive: metrics(naive),
    v1: metrics(v1),
    v2: metrics(v2),
  };
}

export function formatComparisonReport(rep: EngineComparisonReport): string {
  const row = (name: string, m: EngineBacktestMetrics) =>
    `| ${name} | ${m.mapePercent}% | ${m.mapeEventNightsPercent}% | ${m.mapeNoEventNightsPercent}% | ` +
    `${m.passesQualityGate ? 'sim' : 'não'} | ${m.pctBelowBase}% | ${m.pctAboveBase}% | ` +
    `${m.distribution.min} / ${m.distribution.p10} / ${m.distribution.p50} / ${m.distribution.p90} / ${m.distribution.max} |`;
  const bucketRow = (name: string, m: EngineBacktestMetrics) =>
    `| ${name} | ${Object.values(m.distribution.buckets).map((v) => `${v}%`).join(' | ')} |`;
  return [
    `Semente ${rep.seed}: ${rep.properties} imóveis, ${rep.nights} noites (${rep.eventNights} com evento; ${rep.inflatedLlmEventNights} com score de LLM inflado).`,
    '',
    '| Motor | MAPE | MAPE c/ evento | MAPE s/ evento | Gate ≤15% | % abaixo da base | % acima da base | multiplicador min / p10 / p50 / p90 / max |',
    '|---|---|---|---|---|---|---|---|',
    row('Base (não mexer)', rep.naive),
    row('v1', rep.v1),
    row('v2', rep.v2),
    '',
    `| Motor | ${BUCKETS.map(([n]) => n).join(' | ')} |`,
    `|---|${BUCKETS.map(() => '---').join('|')}|`,
    bucketRow('v1', rep.v1),
    bucketRow('v2', rep.v2),
  ].join('\n');
}
