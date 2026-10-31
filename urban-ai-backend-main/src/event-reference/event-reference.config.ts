import { readFileSync } from 'fs';
import { SP_VENUES } from '../knn-engine/data/sp-venues';
import type { EventReferenceSize } from '../entities/event-reference.entity';

/**
 * ADR 0026 — configuração da curadoria da lista de referência e das métricas de cobertura.
 * Tudo por env, com padrão seguro: sem chaves, a curadoria só alimenta a fila humana.
 *
 *   EVENT_REFERENCE_CURATION_ENABLED     auto (liga o cron se houver Gemini + 1 provedor); true/false força
 *   EVENT_REFERENCE_VENUES_FILE          JSON com a lista de venues (substitui a semente)
 *   EVENT_REFERENCE_HORIZON_DAYS         default 90
 *   EVENT_REFERENCE_MIN_AGREE            default 2 (validadores independentes para aprovar)
 *   EVENT_REFERENCE_MAX_VENUES_PER_RUN   default 0 (todos; rotaciona por dia quando limitado)
 *   EVENT_REFERENCE_MAX_SEARCH_CALLS     default 30 (Tavily + SerpAPI por execução)
 *   EVENT_REFERENCE_MAX_SCRAPE_CALLS     default 12 (Firecrawl por execução)
 *   EVENT_REFERENCE_MAX_LLM_CALLS        default 60 (extrações Gemini por execução)
 *   EVENT_REFERENCE_MAX_JUDGE_CALLS      default 20 (juiz Anthropic por execução)
 *   EVENT_REFERENCE_DOCS_PER_SEARCH      default 4 (resultados de busca lidos por consulta)
 *   EVENT_COVERAGE_METRICS_ENABLED       default true (casamento + snapshot diário)
 *   EVENT_COVERAGE_RECALL_FLOOR_PCT      default 70 (alerta abaixo disso; 0 desliga)
 *   EVENT_COVERAGE_ALERT_MIN_SAMPLE      default 20 (mínimo de referências para alertar)
 *   EVENT_COVERAGE_PRECISION_SAMPLE      default 200 (eventos do banco na amostra de precisão)
 *   EVENT_COVERAGE_PUBLIC_MIN_SAMPLE     default 10 (referências grandes mínimas para publicar o recall)
 */
export interface EventReferenceConfig {
  curationEnabled: boolean;
  metricsEnabled: boolean;
  horizonDays: number;
  minAgree: number;
  nameSimilarity: number;
  divergenceDays: number;
  maxVenuesPerRun: number;
  maxSearchCalls: number;
  maxScrapeCalls: number;
  maxLlmCalls: number;
  maxJudgeCalls: number;
  docsPerSearch: number;
  recallFloorPct: number;
  alertMinSample: number;
  precisionSample: number;
  publicMinSample: number;
}

export interface ProviderAvailability {
  tavily: boolean;
  serpapi: boolean;
  firecrawl: boolean;
  gemini: boolean;
  anthropic: boolean;
}

function positiveInt(raw: string | undefined, fallback: number, allowZero = false): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const value = Math.floor(parsed);
  return value > 0 || (allowZero && value === 0) ? value : fallback;
}

export function readProviderAvailability(env: NodeJS.ProcessEnv = process.env): ProviderAvailability {
  const has = (name: string) => Boolean(env[name]?.trim());
  return {
    tavily: has('TAVILY_API_KEY'),
    serpapi: has('SERPAPI_KEY'),
    firecrawl: has('FIRECRAWL_API_KEY'),
    gemini: has('GEMINI_API_KEY'),
    anthropic: has('ANTHROPIC_API_KEY'),
  };
}

/** Há LLM de extração e ao menos uma fonte externa para ler? */
export function canCurateFromWeb(providers: ProviderAvailability): boolean {
  return providers.gemini && (providers.tavily || providers.serpapi || providers.firecrawl);
}

export function readEventReferenceConfig(env: NodeJS.ProcessEnv = process.env): EventReferenceConfig {
  const explicit = env.EVENT_REFERENCE_CURATION_ENABLED?.trim().toLowerCase();
  const curationEnabled =
    explicit === 'true' ? true : explicit === 'false' ? false : canCurateFromWeb(readProviderAvailability(env));
  return {
    curationEnabled,
    metricsEnabled: (env.EVENT_COVERAGE_METRICS_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
    horizonDays: positiveInt(env.EVENT_REFERENCE_HORIZON_DAYS, 90),
    minAgree: Math.max(2, positiveInt(env.EVENT_REFERENCE_MIN_AGREE, 2)),
    nameSimilarity: 0.7,
    divergenceDays: 3,
    maxVenuesPerRun: positiveInt(env.EVENT_REFERENCE_MAX_VENUES_PER_RUN, 0, true),
    maxSearchCalls: positiveInt(env.EVENT_REFERENCE_MAX_SEARCH_CALLS, 30, true),
    maxScrapeCalls: positiveInt(env.EVENT_REFERENCE_MAX_SCRAPE_CALLS, 12, true),
    maxLlmCalls: positiveInt(env.EVENT_REFERENCE_MAX_LLM_CALLS, 60, true),
    maxJudgeCalls: positiveInt(env.EVENT_REFERENCE_MAX_JUDGE_CALLS, 20, true),
    docsPerSearch: positiveInt(env.EVENT_REFERENCE_DOCS_PER_SEARCH, 4),
    recallFloorPct: Math.min(100, positiveInt(env.EVENT_COVERAGE_RECALL_FLOOR_PCT, 70, true)),
    alertMinSample: positiveInt(env.EVENT_COVERAGE_ALERT_MIN_SAMPLE, 20),
    precisionSample: positiveInt(env.EVENT_COVERAGE_PRECISION_SAMPLE, 200),
    publicMinSample: positiveInt(env.EVENT_COVERAGE_PUBLIC_MIN_SAMPLE, 10),
  };
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export interface ReferenceVenueConfig {
  key: string;
  name: string;
  aliases: string[];
  city: string;
  /** Porte padrão dos eventos do venue (a curadoria pode sobrescrever por evento). */
  size: EventReferenceSize;
  category: string | null;
  /** Página oficial de agenda (Firecrawl). Opcional; sem ela só busca e banco votam. */
  officialUrl: string | null;
  lat: number | null;
  lng: number | null;
}

export function sizeFromCapacity(capacity?: number | null): EventReferenceSize {
  if (!capacity || !Number.isFinite(capacity)) return 'medio';
  if (capacity >= 20_000) return 'grande';
  if (capacity >= 3_000) return 'medio';
  return 'pequeno';
}

function catalog(name: string): { lat: number | null; lng: number | null; size: EventReferenceSize } {
  const venue = SP_VENUES.find((v) => v.name === name);
  return { lat: venue?.lat ?? null, lng: venue?.lng ?? null, size: sizeFromCapacity(venue?.capacity) };
}

function venue(
  key: string,
  name: string,
  catalogName: string | null,
  aliases: string[],
  options: { category?: string; officialUrl?: string; size?: EventReferenceSize } = {},
): ReferenceVenueConfig {
  const base = catalogName ? catalog(catalogName) : { lat: null, lng: null, size: 'medio' as EventReferenceSize };
  return {
    key,
    name,
    aliases,
    city: 'São Paulo',
    size: options.size ?? base.size,
    category: options.category ?? null,
    officialUrl: options.officialUrl ?? null,
    lat: base.lat,
    lng: base.lng,
  };
}

/**
 * Semente da lista de venues/calendários de SP (ADR 0026). Coordenadas e porte vêm do catálogo
 * de venues já usado pelo motor (`sp-venues.ts`). As URLs oficiais são ponto de partida para a
 * leitura via Firecrawl: se mudarem, a execução só registra aviso — ajuste por
 * EVENT_REFERENCE_VENUES_FILE sem mexer em código.
 */
export const DEFAULT_REFERENCE_VENUES: ReferenceVenueConfig[] = [
  venue('allianz-parque', 'Allianz Parque', 'Allianz Parque', ['Arena Palmeiras', 'Palestra Itália'], {
    officialUrl: 'https://www.allianzparque.com.br/',
  }),
  venue('morumbis', 'Estádio do Morumbi', 'Estádio do Morumbi', ['Morumbi', 'MorumBIS', 'Cícero Pompeu de Toledo']),
  venue('neo-quimica-arena', 'Neo Química Arena', 'Neo Química Arena', ['Arena Corinthians', 'Itaquerão']),
  venue('interlagos', 'Autódromo de Interlagos', 'Autódromo de Interlagos', ['Interlagos', 'Autódromo José Carlos Pace']),
  venue('distrito-anhembi', 'Distrito Anhembi', 'Anhembi', ['Anhembi', 'Sambódromo do Anhembi'], {
    officialUrl: 'https://www.distritoanhembi.com.br/',
  }),
  venue('sao-paulo-expo', 'São Paulo Expo', 'São Paulo Expo', ['SP Expo', 'Expo Imigrantes'], {
    officialUrl: 'https://www.saopauloexpo.com.br/',
  }),
  venue('expo-center-norte', 'Expo Center Norte', 'Expo Center Norte', ['Centro de Exposições Norte'], {
    officialUrl: 'https://www.expocenternorte.com.br/',
  }),
  venue('transamerica-expo', 'Transamérica Expo', null, ['Transamerica Expo Center', 'Expo Transamérica'], {
    size: 'grande',
  }),
  venue('ibirapuera', 'Parque Ibirapuera', 'Ginásio do Ibirapuera', ['Ibirapuera', 'Ginásio do Ibirapuera', 'Auditório Ibirapuera'], {
    size: 'grande',
  }),
  venue('pacaembu', 'Estádio do Pacaembu', 'Estádio do Pacaembu', ['Pacaembu', 'Estádio Municipal Paulo Machado de Carvalho']),
  venue('bienal', 'Pavilhão da Bienal', null, ['Bienal de São Paulo', 'Pavilhão Ciccillo Matarazzo', 'Bienal do Livro'], {
    size: 'grande',
  }),
  venue('vibra-sao-paulo', 'Vibra São Paulo', 'Vibra São Paulo', ['Vibra SP', 'Citibank Hall']),
  venue('espaco-unimed', 'Espaço Unimed', 'Espaço Unimed', ['Espaço das Américas']),
  venue('tokio-marine-hall', 'Tokio Marine Hall', 'Tokio Marine Hall', ['Tom Brasil', 'Credicard Hall']),
  venue('audio', 'Audio', 'Audio', ['Audio Club', 'Audio SP']),
  venue('casa-natura-musical', 'Casa Natura Musical', null, ['Natura Musical'], { size: 'pequeno' }),
  venue('carioca-club', 'Carioca Club', null, [], { size: 'pequeno' }),
];

function validVenue(raw: unknown): ReferenceVenueConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const key = typeof v.key === 'string' ? v.key.trim().toLowerCase() : '';
  const name = typeof v.name === 'string' ? v.name.trim() : '';
  if (!/^[a-z0-9-]{2,64}$/.test(key) || name.length < 2 || name.length > 160) return null;
  const aliases = Array.isArray(v.aliases)
    ? v.aliases.filter((a): a is string => typeof a === 'string' && a.trim().length > 0).map((a) => a.trim())
    : [];
  const size = v.size === 'grande' || v.size === 'pequeno' || v.size === 'medio' ? v.size : 'medio';
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  let officialUrl: string | null = null;
  if (typeof v.officialUrl === 'string' && /^https:\/\//i.test(v.officialUrl.trim())) officialUrl = v.officialUrl.trim();
  return {
    key,
    name,
    aliases,
    city: typeof v.city === 'string' && v.city.trim() ? v.city.trim().slice(0, 80) : 'São Paulo',
    size,
    category: typeof v.category === 'string' && v.category.trim() ? v.category.trim().slice(0, 64) : null,
    officialUrl,
    lat: num(v.lat),
    lng: num(v.lng),
  };
}

/** Lê o arquivo de venues do env (JSON array); em qualquer falha usa a semente. */
export function loadReferenceVenues(
  env: NodeJS.ProcessEnv = process.env,
  readFile: (path: string) => string = (p) => readFileSync(p, 'utf8'),
): { venues: ReferenceVenueConfig[]; source: 'seed' | 'file'; warning?: string } {
  const file = env.EVENT_REFERENCE_VENUES_FILE?.trim();
  if (!file) return { venues: DEFAULT_REFERENCE_VENUES, source: 'seed' };
  try {
    const parsed = JSON.parse(readFile(file));
    const list = (Array.isArray(parsed) ? parsed : []).map(validVenue).filter((v): v is ReferenceVenueConfig => !!v);
    if (list.length === 0) {
      return { venues: DEFAULT_REFERENCE_VENUES, source: 'seed', warning: 'arquivo de venues sem itens válidos; usando a semente' };
    }
    return { venues: list, source: 'file' };
  } catch {
    return { venues: DEFAULT_REFERENCE_VENUES, source: 'seed', warning: 'arquivo de venues ilegível; usando a semente' };
  }
}
