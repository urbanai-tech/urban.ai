import { Inject, Injectable, Logger } from '@nestjs/common';
import { todaySaoPauloDateKey } from '../common/sp-date';
import { buildCompSet, CompSet, PrivacyGroup } from './market-comp-set';
import { MarketConfig, resolveMarketConfig } from './market-config';
import { computeMarketMetrics, MarketMetrics } from './market-metrics';
import { dateKeyAddDays, hasTypologyFilter } from './market-math';
import {
  MARKET_SOURCE_LABELS,
  MarketDataSource,
  MarketListingRecord,
  MarketSourceId,
  MarketSourceQuery,
  MarketTarget,
  MarketTypology,
  MarketUse,
} from './market-data.types';

/** Token de injeção da lista de fontes (a ordem do array é irrelevante: vale `precedence`). */
export const MARKET_DATA_SOURCES = 'MARKET_DATA_SOURCES';

/** Histórico buscado para sazonalidade e tendência (dias antes de `to`). */
export const MARKET_HISTORY_DAYS = 365;

export interface MarketIntelBuildInput {
  target: MarketTarget;
  city: string | null;
  state: string | null;
  from: string;
  to: string;
  dates: string[];
  radiusKm: number;
  typology?: MarketTypology | null;
  use: MarketUse;
  ownOccupancy: number | null;
  ownDaily: Map<string, number>;
  eventDays: Set<string>;
  /** Só os registros, sem séries (cobertura no admin). */
  light?: boolean;
  /** Config já resolvida (testes); padrão = env atual. */
  config?: MarketConfig;
  /** Hoje em YYYY-MM-DD (testes). */
  today?: string;
}

export interface MarketSourceReport {
  id: MarketSourceId;
  label: string;
  enabled: boolean;
  reason?: string;
  /** Registros candidatos (antes de tipologia, licença, dedup e privacidade). */
  candidates: number;
  error?: boolean;
}

export interface MarketInsufficiency {
  reasons: string[];
  hints: string[];
  customers: PrivacyGroup;
  external: PrivacyGroup;
}

export interface MarketIntelBuild {
  config: Pick<MarketConfig, 'minHosts' | 'minExternalListings' | 'externalMaxAgeDays'>;
  radiusKm: number;
  typologyActive: boolean;
  compSet: CompSet;
  metrics: MarketMetrics | null;
  sources: MarketSourceReport[];
  insufficiency: MarketInsufficiency | null;
  truncated: boolean;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Orquestra o mercado por bairro: consulta as fontes ligadas, monta o comp set (filtros, dedup e
 * privacidade) e calcula as métricas (ADR 0028). Uma fonte que falha não derruba as outras.
 */
@Injectable()
export class MarketIntelService {
  private readonly logger = new Logger(MarketIntelService.name);

  constructor(@Inject(MARKET_DATA_SOURCES) private readonly sources: MarketDataSource[]) {}

  /** Estado de cada fonte (ligada/desligada e por quê) — usado pela saúde no admin. */
  sourceStatuses() {
    return [...this.sources]
      .sort((a, b) => a.precedence - b.precedence)
      .map((source) => ({ id: source.id, label: source.label, ...source.status() }));
  }

  async build(input: MarketIntelBuildInput): Promise<MarketIntelBuild> {
    const config = input.config ?? resolveMarketConfig();
    const today = input.today ?? todaySaoPauloDateKey();
    const query: MarketSourceQuery = {
      latitude: input.target.latitude,
      longitude: input.target.longitude,
      city: input.city,
      state: input.state,
      radiusKm: input.radiusKm,
      from: input.from,
      to: input.to,
      historyFrom: dateKeyAddDays(input.to, -MARKET_HISTORY_DAYS),
      excludeUserId: input.target.userId,
      excludeAddressId: input.target.addressId,
      withObservations: !input.light,
    };

    const reports: MarketSourceReport[] = [];
    const records: MarketListingRecord[] = [];
    let truncated = false;
    const ordered = [...this.sources].sort((a, b) => a.precedence - b.precedence);
    const results = await Promise.all(
      ordered.map(async (source) => {
        const status = source.status();
        if (!status.enabled) return { source, status, result: null, error: false };
        try {
          return { source, status, result: await source.fetch(query), error: false };
        } catch (err) {
          this.logger.warn(`Fonte de mercado ${source.id} falhou: ${(err as Error).message}`);
          return { source, status, result: null, error: true };
        }
      }),
    );
    for (const { source, status, result, error } of results) {
      reports.push({
        id: source.id,
        label: source.label,
        enabled: status.enabled,
        reason: error ? 'falha ao consultar a fonte' : (result?.disabledReason ?? status.reason),
        candidates: result?.records.length ?? 0,
        error: error || undefined,
      });
      if (result) {
        records.push(...result.records);
        truncated = truncated || Boolean(result.truncated);
      }
    }

    const compSet = buildCompSet(records, {
      target: input.target,
      radiusKm: input.radiusKm,
      typology: input.typology,
      use: input.use,
      config,
      today,
    });

    const metrics = compSet.insufficient
      ? null
      : computeMarketMetrics({
          records: compSet.records,
          ownAdr: input.target.ownAdr,
          ownOccupancy: input.ownOccupancy,
          ownDaily: input.ownDaily,
          dates: input.dates,
          from: input.from,
          to: input.to,
          eventDays: input.eventDays,
          minSample: config.minHosts,
        });

    const typologyActive = hasTypologyFilter(input.typology);
    return {
      config: {
        minHosts: config.minHosts,
        minExternalListings: config.minExternalListings,
        externalMaxAgeDays: config.externalMaxAgeDays,
      },
      radiusKm: input.radiusKm,
      typologyActive,
      compSet,
      metrics,
      sources: reports,
      insufficiency: compSet.insufficient
        ? this.explainInsufficiency(compSet, reports, input.radiusKm, config.maxRadiusKm, typologyActive)
        : null,
      truncated,
    };
  }

  /** Diz, em português, o que falta para a amostra ser suficiente. */
  private explainInsufficiency(
    compSet: CompSet,
    reports: MarketSourceReport[],
    radiusKm: number,
    maxRadiusKm: number,
    typologyActive: boolean,
  ): MarketInsufficiency {
    const reasons: string[] = [];
    const hints: string[] = [];
    const { customers, external } = compSet.privacy;
    reasons.push(
      `${MARKET_SOURCE_LABELS.customers}: ${plural(customers.distinct, 'anfitrião distinto', 'anfitriões distintos')} na região (mínimo ${customers.required}).`,
    );
    const externalEnabled = reports.some((r) => r.id !== 'customers' && r.enabled);
    if (!externalEnabled) {
      reasons.push('Nenhuma fonte externa de mercado está ligada para esta região.');
    } else if (external.distinct === 0) {
      reasons.push('Fontes externas: nenhum anúncio atual cobre esta região e tipologia.');
    } else {
      reasons.push(
        `Fontes externas: ${plural(external.distinct, 'anúncio distinto', 'anúncios distintos')} (mínimo ${external.required}).`,
      );
    }
    const stale = compSet.excluded.stale;
    if (stale > 0) {
      reasons.push(`${plural(stale, 'anúncio externo', 'anúncios externos')} ficaram de fora por terem dado antigo demais.`);
    }
    if (radiusKm < maxRadiusKm) hints.push(`Aumente o raio de busca (até ${maxRadiusKm} km).`);
    if (typologyActive) hints.push('Afrouxe a tipologia (quartos, tipo de anúncio ou capacidade).');
    return { reasons, hints, customers, external };
  }
}
