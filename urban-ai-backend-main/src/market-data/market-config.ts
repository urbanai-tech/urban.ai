import { MARKET_SOURCE_ORDER, MarketSourceId } from './market-data.types';

/**
 * Configuração do mercado por env (ADR 0028). Todos os padrões são seguros:
 * sem env nenhuma, o comportamento é o do market intel original (3 km, ≥ 5 anfitriões)
 * e a coleta própria fica desligada.
 */
export interface MarketConfig {
  /** Fontes ligadas (`MARKET_SOURCES`, padrão: customers,licensed_dataset,inside_airbnb). */
  enabledSources: Set<MarketSourceId>;
  /** `MARKET_SCRAPING_ENABLED` — padrão false: aguardando parecer jurídico. */
  scrapingEnabled: boolean;
  /** `MARKET_INTEL_MIN_GROUP_SIZE` (piso 3): anfitriões distintos para usar dados de clientes. */
  minHosts: number;
  /** `MARKET_EXTERNAL_MIN_LISTINGS` (piso 5): anúncios distintos para usar dados externos. */
  minExternalListings: number;
  /** `MARKET_EXTERNAL_MAX_AGE_DAYS`: dado externo mais velho que isto não entra. */
  externalMaxAgeDays: number;
  defaultRadiusKm: number;
  minRadiusKm: number;
  maxRadiusKm: number;
  /** `MARKET_ENGINE_SIGNAL_ENABLED` — padrão false: o v2 em sombra recebe as métricas. */
  engineSignalEnabled: boolean;
}

export const MARKET_DEFAULT_MIN_HOSTS = 5;
export const MARKET_FLOOR_MIN_HOSTS = 3;
export const MARKET_DEFAULT_MIN_EXTERNAL_LISTINGS = 8;
export const MARKET_FLOOR_MIN_EXTERNAL_LISTINGS = 5;
export const MARKET_DEFAULT_EXTERNAL_MAX_AGE_DAYS = 548; // ~18 meses

function toInt(raw: string | undefined): number | null {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `customers` é a base e nunca some; sem env, ligam as três fontes de dados já ingeridos. */
export function parseEnabledSources(raw: string | undefined): Set<MarketSourceId> {
  const wanted = String(raw ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!wanted.length) return new Set<MarketSourceId>(['customers', 'licensed_dataset', 'inside_airbnb']);
  const valid = new Set<string>(MARKET_SOURCE_ORDER);
  const picked = wanted.filter((item): item is MarketSourceId => valid.has(item));
  return new Set<MarketSourceId>(['customers', ...picked]);
}

export function resolveMarketConfig(env: NodeJS.ProcessEnv = process.env): MarketConfig {
  const minHosts = toInt(env.MARKET_INTEL_MIN_GROUP_SIZE);
  const minExternal = toInt(env.MARKET_EXTERNAL_MIN_LISTINGS);
  const maxAge = toInt(env.MARKET_EXTERNAL_MAX_AGE_DAYS);
  const scrapingEnabled = String(env.MARKET_SCRAPING_ENABLED ?? '').trim().toLowerCase() === 'true';
  const sources = parseEnabledSources(env.MARKET_SOURCES);
  // O scraping só liga se a flag dele estiver explicitamente true, mesmo que conste em MARKET_SOURCES.
  if (!scrapingEnabled) sources.delete('own_scraping');
  return {
    enabledSources: sources,
    scrapingEnabled,
    minHosts: minHosts === null ? MARKET_DEFAULT_MIN_HOSTS : Math.max(MARKET_FLOOR_MIN_HOSTS, minHosts),
    minExternalListings:
      minExternal === null
        ? MARKET_DEFAULT_MIN_EXTERNAL_LISTINGS
        : Math.max(MARKET_FLOOR_MIN_EXTERNAL_LISTINGS, minExternal),
    externalMaxAgeDays: maxAge === null || maxAge <= 0 ? MARKET_DEFAULT_EXTERNAL_MAX_AGE_DAYS : maxAge,
    defaultRadiusKm: 3,
    minRadiusKm: 1,
    maxRadiusKm: 5,
    engineSignalEnabled: String(env.MARKET_ENGINE_SIGNAL_ENABLED ?? '').trim().toLowerCase() === 'true',
  };
}

/** Raio pedido, limitado a [min, max]; ausente ou inválido = padrão. */
export function clampRadiusKm(
  raw: unknown,
  config: Pick<MarketConfig, 'defaultRadiusKm' | 'minRadiusKm' | 'maxRadiusKm'>,
): number {
  const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? ''));
  if (!Number.isFinite(parsed)) return config.defaultRadiusKm;
  return Math.min(config.maxRadiusKm, Math.max(config.minRadiusKm, Math.round(parsed * 10) / 10));
}
