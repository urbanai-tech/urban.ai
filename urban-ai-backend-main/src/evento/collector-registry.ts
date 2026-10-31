/**
 * Registro das fontes de eventos conhecidas (coletores/spiders) e das variáveis de ambiente de que
 * dependem. Usado pelo painel `/admin/collectors-health` e pelo alerta de "fonte configurada que
 * nunca entregou".
 */
export interface KnownEventCollector {
  source: string;
  critical: boolean;
  requiredEnv: string[];
  aliases?: string[];
  /**
   * False para entradas que não são uma fonte real (ex.: agrupador de spiders legados) ou que não
   * devem alertar por nunca ter entregado.
   */
  expectDelivery?: boolean;
}

export const KNOWN_EVENT_COLLECTORS: KnownEventCollector[] = [
  { source: 'api-football', critical: false, requiredEnv: ['API_FOOTBALL_KEY'] },
  { source: 'sp-cultura', critical: false, requiredEnv: [] },
  { source: 'usp-eventos', critical: false, requiredEnv: [] },
  { source: 'marcha-para-jesus', critical: false, requiredEnv: [] },
  { source: 'allianz-parque', critical: false, requiredEnv: [] },
  { source: 'anhembi', critical: false, requiredEnv: [] },
  { source: 'sao-paulo-expo', critical: false, requiredEnv: [] },
  { source: 'expo-center-norte', critical: false, requiredEnv: [] },
  { source: 'transamerica-expo', critical: false, requiredEnv: [] },
  { source: 'vibra-sao-paulo', critical: false, requiredEnv: [] },
  { source: 'tokio-marine-hall', critical: false, requiredEnv: [] },
  { source: 'espaco-unimed', critical: false, requiredEnv: [] },
  { source: 'wtc-sao-paulo', critical: false, requiredEnv: [] },
  { source: 'serpapi-events', critical: false, requiredEnv: ['SERPAPI_KEY'], aliases: ['serpapi_events'] },
  { source: 'tavily', critical: false, requiredEnv: ['TAVILY_API_KEY', 'GEMINI_API_KEY'] },
  { source: 'firecrawl', critical: false, requiredEnv: ['FIRECRAWL_API_KEY', 'GEMINI_API_KEY'] },
  { source: 'legacy-scrapyd-spiders', critical: false, requiredEnv: [], expectDelivery: false },
];

/** Fontes "configuradas": as que esperamos receber (têm todas as chaves e não são pseudo-fontes). */
export function configuredCollectors(
  env: NodeJS.ProcessEnv = process.env,
  registry: KnownEventCollector[] = KNOWN_EVENT_COLLECTORS,
): KnownEventCollector[] {
  return registry.filter(
    (collector) => collector.expectDelivery !== false && collector.requiredEnv.every((name) => Boolean(env[name])),
  );
}
