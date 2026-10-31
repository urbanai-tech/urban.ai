import { MarketIntelBuild } from './market-intel.service';
import { MarketSourceId } from './market-data.types';

/**
 * Insumo de mercado para o motor v2 EM SOMBRA (ADR 0015/0019/0028). Estrutura compacta e só de
 * agregados; o v1 nunca a recebe e o preço do v2 não muda por causa dela (entra como driver
 * informativo, peso 0, e em `details.shadowV2.market`).
 */
export interface MarketSignalV2 {
  /** Versão do formato, para evolução sem quebrar o que já foi gravado. */
  version: 1;
  /** Posição da diária do imóvel entre os comparáveis (0–100). */
  percentile: number;
  medianAdr: number;
  p25Adr: number | null;
  p75Adr: number | null;
  /** Diária do imóvel ÷ mediana do bairro (1,00 = igual). */
  priceVsMedian: number | null;
  sampleSize: number;
  radiusKm: number;
  sources: Array<{ source: MarketSourceId; listings: number; latestCollectedAt: string | null }>;
  medianOccupancy: number | null;
  trend30dPercentilePoints: number | null;
  trend30dMedianAdrChangePct: number | null;
  eventUpliftPct: number | null;
  generatedAt: string;
}

/** null quando o mercado não tem amostra suficiente (nunca fabrica sinal). */
export function toMarketSignalV2(build: MarketIntelBuild, ownAdr: number, now: Date = new Date()): MarketSignalV2 | null {
  const metrics = build.metrics;
  if (!metrics || build.compSet.insufficient) return null;
  return {
    version: 1,
    percentile: metrics.percentile,
    medianAdr: metrics.medianAdr,
    p25Adr: metrics.adrPercentiles?.p25 ?? null,
    p75Adr: metrics.adrPercentiles?.p75 ?? null,
    priceVsMedian: ownAdr > 0 && metrics.medianAdr > 0 ? Number((ownAdr / metrics.medianAdr).toFixed(2)) : null,
    sampleSize: metrics.comparablesCount,
    radiusKm: build.radiusKm,
    sources: build.compSet.sources.map((s) => ({
      source: s.source,
      listings: s.listings,
      latestCollectedAt: s.latestCollectedAt,
    })),
    medianOccupancy: metrics.medianOccupancy,
    trend30dPercentilePoints: metrics.trend30d.percentilePoints,
    trend30dMedianAdrChangePct: metrics.trend30d.medianAdrChangePct,
    eventUpliftPct: metrics.eventEffect?.upliftPct ?? null,
    generatedAt: now.toISOString(),
  };
}
