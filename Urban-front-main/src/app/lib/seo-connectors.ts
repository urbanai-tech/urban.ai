export type SeoConnectorKey =
  | "search-console"
  | "ga4"
  | "bot-logs"
  | "ai-monitor";

export type SeoConnectorStatus = "configured" | "partial" | "missing";

export type SeoConnectorCapability =
  | "search-performance"
  | "index-coverage"
  | "organic-sessions"
  | "organic-conversions"
  | "bot-crawl-events"
  | "ai-citation-monitoring";

export type SeoConnectorCredentialMode =
  | "google-service-account"
  | "local-file-or-http-source"
  | "dataset-or-http-source";

export type SeoEnvRequirement = {
  name: string;
  label: string;
  required: boolean;
  secret: boolean;
  purpose: string;
};

export type SeoEnvRequirementStatus = SeoEnvRequirement & {
  present: boolean;
  valueReturned: false;
};

export type SeoConnectorDefinition = {
  key: SeoConnectorKey;
  name: string;
  provider: string;
  cadence: string;
  credentialMode: SeoConnectorCredentialMode;
  capabilities: readonly SeoConnectorCapability[];
  env: readonly SeoEnvRequirement[];
  notes: string;
};

export type SeoConnectorOperationalItem = {
  key: SeoConnectorKey;
  name: string;
  provider: string;
  cadence: string;
  status: SeoConnectorStatus;
  statusLabel: string;
  credentialMode: SeoConnectorCredentialMode;
  capabilities: readonly SeoConnectorCapability[];
  env: SeoEnvRequirementStatus[];
  blockers: string[];
  canAttemptExternalFetch: boolean;
  externalFetchAttempted: false;
  externalFetchRequiredForStatus: false;
  dataReturned: false;
  placeholder: {
    state: "no-data-collected";
    message: string;
  };
};

export type SeoConnectorOperationalStatus = {
  version: string;
  checkedAt: string;
  timezone: "America/Sao_Paulo";
  safeForClient: true;
  secretsReturned: false;
  externalFetchAttempted: false;
  externalFetchRequiredForStatus: false;
  summary: {
    total: number;
    configured: number;
    partial: number;
    missing: number;
    readyForFetch: number;
  };
  connectors: SeoConnectorOperationalItem[];
};

export type SearchConsolePerformanceRow = {
  source: "search-console";
  date: string;
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
};

export type Ga4OrganicLandingPageRow = {
  source: "ga4";
  date: string;
  landingPage: string;
  sessions: number;
  engagedSessions: number;
  conversions: number;
  conversionRate: number;
};

export type BotLogHit = {
  source: "bot-logs";
  timestamp: string;
  botFamily: "googlebot" | "bingbot" | "gptbot" | "claudebot" | "perplexitybot" | "other";
  userAgent: string;
  path: string;
  statusCode: number;
};

export type AiMonitorObservation = {
  source: "ai-monitor";
  checkedAt: string;
  engine: "chatgpt" | "gemini" | "perplexity" | "google-ai-overviews" | "other";
  prompt: string;
  citedUrls: string[];
  brandMentioned: boolean;
  notes?: string;
};

export type SeoConnectorDataset = {
  searchConsole: SearchConsolePerformanceRow[];
  ga4: Ga4OrganicLandingPageRow[];
  botLogs: BotLogHit[];
  aiMonitor: AiMonitorObservation[];
};

type EnvReader = Record<string, string | undefined>;

const STATUS_VERSION = "2026-05-19.seo-connectors.v1";

export const seoConnectorDefinitions = [
  {
    key: "search-console",
    name: "Google Search Console",
    provider: "Google Search Console API",
    cadence: "Diaria",
    credentialMode: "google-service-account",
    capabilities: ["search-performance", "index-coverage"],
    env: [
      {
        name: "SEO_GSC_SITE_URL",
        label: "Search Console property URL",
        required: true,
        secret: false,
        purpose: "Identifica a propriedade que sera consultada.",
      },
      {
        name: "SEO_GOOGLE_CLIENT_EMAIL",
        label: "Google service account email",
        required: true,
        secret: true,
        purpose: "Autentica a service account com acesso ao Search Console.",
      },
      {
        name: "SEO_GOOGLE_PRIVATE_KEY",
        label: "Google service account private key",
        required: true,
        secret: true,
        purpose: "Assina tokens da service account em runtime server-side.",
      },
    ],
    notes:
      "Pronto para plugar Search Analytics e cobertura, sem executar chamadas externas nesta camada de status.",
  },
  {
    key: "ga4",
    name: "Google Analytics 4",
    provider: "GA4 Data API",
    cadence: "Diaria",
    credentialMode: "google-service-account",
    capabilities: ["organic-sessions", "organic-conversions"],
    env: [
      {
        name: "SEO_GA4_PROPERTY_ID",
        label: "GA4 property ID",
        required: true,
        secret: false,
        purpose: "Identifica a propriedade GA4 para metricas organicas.",
      },
      {
        name: "SEO_GOOGLE_CLIENT_EMAIL",
        label: "Google service account email",
        required: true,
        secret: true,
        purpose: "Autentica a service account com acesso ao GA4.",
      },
      {
        name: "SEO_GOOGLE_PRIVATE_KEY",
        label: "Google service account private key",
        required: true,
        secret: true,
        purpose: "Assina tokens da service account em runtime server-side.",
      },
    ],
    notes:
      "Pronto para organic sessions, landing pages e conversoes, sem inventar dados quando a API nao esta ligada.",
  },
  {
    key: "bot-logs",
    name: "Logs de bots",
    provider: "Edge access logs ou arquivo local",
    cadence: "Tempo quase real",
    credentialMode: "local-file-or-http-source",
    capabilities: ["bot-crawl-events"],
    env: [
      {
        name: "SEO_BOT_LOG_SOURCE",
        label: "Bot log source",
        required: true,
        secret: false,
        purpose: "Nomeia a origem dos logs, como cloudflare-logpush ou local-file.",
      },
      {
        name: "SEO_BOT_LOG_LOCAL_PATH",
        label: "Local bot log path",
        required: false,
        secret: false,
        purpose: "Caminho server-side para leitura offline de logs exportados.",
      },
      {
        name: "SEO_BOT_LOG_ENDPOINT",
        label: "Bot log endpoint",
        required: false,
        secret: false,
        purpose: "Endpoint server-side opcional para uma fonte de logs.",
      },
      {
        name: "SEO_BOT_LOG_TOKEN",
        label: "Bot log token",
        required: false,
        secret: true,
        purpose: "Token opcional para autenticar a fonte HTTP de logs.",
      },
    ],
    notes:
      "Considera pronto quando ha origem e um transporte: arquivo local ou endpoint autenticado.",
  },
  {
    key: "ai-monitor",
    name: "AI Monitor",
    provider: "Dataset proprio ou monitor externo",
    cadence: "Semanal",
    credentialMode: "dataset-or-http-source",
    capabilities: ["ai-citation-monitoring"],
    env: [
      {
        name: "SEO_AI_MONITOR_SOURCE",
        label: "AI monitor source",
        required: true,
        secret: false,
        purpose: "Nomeia a origem das rodadas de prompts e citacoes.",
      },
      {
        name: "SEO_AI_MONITOR_DATASET_PATH",
        label: "AI monitor dataset path",
        required: false,
        secret: false,
        purpose: "Caminho server-side para dataset offline de observacoes.",
      },
      {
        name: "SEO_AI_MONITOR_ENDPOINT",
        label: "AI monitor endpoint",
        required: false,
        secret: false,
        purpose: "Endpoint server-side opcional para um monitor externo.",
      },
      {
        name: "SEO_AI_MONITOR_API_KEY",
        label: "AI monitor API key",
        required: false,
        secret: true,
        purpose: "Chave opcional para autenticar o monitor externo.",
      },
    ],
    notes:
      "Considera pronto quando ha origem e um transporte: dataset offline ou endpoint autenticado.",
  },
] satisfies readonly SeoConnectorDefinition[];

export function getSeoConnectorOperationalStatus(
  env: EnvReader = process.env,
  now: Date = new Date(),
): SeoConnectorOperationalStatus {
  const connectors = seoConnectorDefinitions.map((definition) =>
    getConnectorOperationalItem(definition, env),
  );

  return {
    version: STATUS_VERSION,
    checkedAt: now.toISOString(),
    timezone: "America/Sao_Paulo",
    safeForClient: true,
    secretsReturned: false,
    externalFetchAttempted: false,
    externalFetchRequiredForStatus: false,
    summary: {
      total: connectors.length,
      configured: connectors.filter((item) => item.status === "configured").length,
      partial: connectors.filter((item) => item.status === "partial").length,
      missing: connectors.filter((item) => item.status === "missing").length,
      readyForFetch: connectors.filter((item) => item.canAttemptExternalFetch).length,
    },
    connectors,
  };
}

export function createEmptySeoConnectorDataset(): SeoConnectorDataset {
  return {
    searchConsole: [],
    ga4: [],
    botLogs: [],
    aiMonitor: [],
  };
}

function getConnectorOperationalItem(
  definition: SeoConnectorDefinition,
  env: EnvReader,
): SeoConnectorOperationalItem {
  const envStatuses = definition.env.map((requirement) => ({
    ...requirement,
    present: hasEnvValue(env, requirement.name),
    valueReturned: false as const,
  }));
  const blockers = getBlockers(definition.key, envStatuses);
  const presentCount = envStatuses.filter((item) => item.present).length;
  const status = getStatus(blockers, presentCount);

  return {
    key: definition.key,
    name: definition.name,
    provider: definition.provider,
    cadence: definition.cadence,
    status,
    statusLabel: getStatusLabel(status),
    credentialMode: definition.credentialMode,
    capabilities: definition.capabilities,
    env: envStatuses,
    blockers,
    canAttemptExternalFetch: status === "configured",
    externalFetchAttempted: false,
    externalFetchRequiredForStatus: false,
    dataReturned: false,
    placeholder: {
      state: "no-data-collected",
      message:
        "Esta camada valida readiness de configuracao e nao retorna metricas sem uma coleta real ligada.",
    },
  };
}

function getBlockers(
  key: SeoConnectorKey,
  envStatuses: SeoEnvRequirementStatus[],
): string[] {
  const present = new Set(
    envStatuses.filter((item) => item.present).map((item) => item.name),
  );

  if (key === "bot-logs") {
    return compact([
      !present.has("SEO_BOT_LOG_SOURCE")
        ? "Configurar SEO_BOT_LOG_SOURCE."
        : undefined,
      !present.has("SEO_BOT_LOG_LOCAL_PATH") &&
      !(present.has("SEO_BOT_LOG_ENDPOINT") && present.has("SEO_BOT_LOG_TOKEN"))
        ? "Configurar SEO_BOT_LOG_LOCAL_PATH ou SEO_BOT_LOG_ENDPOINT + SEO_BOT_LOG_TOKEN."
        : undefined,
    ]);
  }

  if (key === "ai-monitor") {
    return compact([
      !present.has("SEO_AI_MONITOR_SOURCE")
        ? "Configurar SEO_AI_MONITOR_SOURCE."
        : undefined,
      !present.has("SEO_AI_MONITOR_DATASET_PATH") &&
      !(present.has("SEO_AI_MONITOR_ENDPOINT") && present.has("SEO_AI_MONITOR_API_KEY"))
        ? "Configurar SEO_AI_MONITOR_DATASET_PATH ou SEO_AI_MONITOR_ENDPOINT + SEO_AI_MONITOR_API_KEY."
        : undefined,
    ]);
  }

  return envStatuses
    .filter((item) => item.required && !item.present)
    .map((item) => `Configurar ${item.name}.`);
}

function getStatus(blockers: string[], presentCount: number): SeoConnectorStatus {
  if (blockers.length === 0) return "configured";
  if (presentCount > 0) return "partial";
  return "missing";
}

function getStatusLabel(status: SeoConnectorStatus) {
  const labels: Record<SeoConnectorStatus, string> = {
    configured: "Configurado por env",
    partial: "Configuracao parcial",
    missing: "Nao configurado",
  };

  return labels[status];
}

function hasEnvValue(env: EnvReader, name: string) {
  return typeof env[name] === "string" && env[name]?.trim() !== "";
}

function compact<T>(items: Array<T | undefined>): T[] {
  return items.filter((item): item is T => item !== undefined);
}
