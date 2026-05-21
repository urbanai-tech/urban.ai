export type AdminSeoStatusKind = "success" | "warn" | "error" | "neutral";
export type AdminSeoPriority = "P0" | "P1" | "P2";
export type AdminSeoActionIcon = "file-text" | "check" | "search";

export type AdminSeoSourceKey =
  | "local-audit"
  | "geo-matrix"
  | "editorial-backlog"
  | "admin-fixture"
  | "crawler-policy"
  | "search-console"
  | "ga4"
  | "bot-logs"
  | "ai-monitor";

export type AdminSeoIntegrationStatus =
  | "connected"
  | "manual"
  | "instrumenting"
  | "planned"
  | "blocked";

export type AdminSeoSourceContract = {
  source: string;
  cadence: string;
  integrationStatus: AdminSeoIntegrationStatus;
  integrationStatusLabel: string;
  timestamp: string;
  lastUpdated: string;
  lastUpdatedLabel: string;
};

export type AdminSeoTrace = AdminSeoSourceContract & {
  sourceKey: AdminSeoSourceKey;
  nextIntegrationKey?: AdminSeoSourceKey;
  nextIntegrationLabel?: string;
};

export type AdminSeoCompletion = {
  value: number;
  label: string;
  detail: string;
  formula: string;
  status: string;
  trace: AdminSeoTrace;
  remaining: string[];
};

export type AdminSeoScoreBreakdownItem = {
  label: string;
  value: string;
  status: AdminSeoStatusKind;
  trace: AdminSeoTrace;
};

export type AdminSeoIntegrationRoadmapItem = {
  name: string;
  purpose: string;
  status: string;
  statusKind: AdminSeoStatusKind;
  trace: AdminSeoTrace;
};

export type AdminSeoConnectorReadinessItem = {
  name: string;
  provider: string;
  envKeys: string[];
  safeStatusEndpoint: string;
  readiness: string;
  status: AdminSeoStatusKind;
  note: string;
};

export type AdminSeoOperationalMetric = {
  label: string;
  value: string | number;
  detail: string;
  status: AdminSeoStatusKind;
  statusLabel: string;
  trace: AdminSeoTrace;
};

export type AdminSeoTechnicalStatusItem = {
  label: string;
  value: string;
  detail: string;
  status: AdminSeoStatusKind;
  trace: AdminSeoTrace;
};

export type AdminSeoCrawlerPolicy = {
  agent: string;
  policy: string;
  scope: string;
  status: AdminSeoStatusKind;
  trace: AdminSeoTrace;
};

export type AdminSeoAiSearchQuestion = {
  cluster: string;
  question: string;
  intent: string;
  asset: string;
  readiness: number;
  trace: AdminSeoTrace;
};

export type AdminSeoBacklogItem = {
  priority: AdminSeoPriority;
  title: string;
  owner: string;
  impact: string;
  status: string;
  trace: AdminSeoTrace;
};

export type AdminSeoActionCard = {
  title: string;
  body: string;
  cta: string;
  icon: AdminSeoActionIcon;
  trace: AdminSeoTrace;
};

export type AdminSeoPanelData = {
  version: string;
  timezone: "America/Sao_Paulo";
  timestamp: string;
  lastUpdated: string;
  lastUpdatedLabel: string;
  sourceCatalog: Record<AdminSeoSourceKey, AdminSeoSourceContract>;
  completion: AdminSeoCompletion;
  scoreBreakdown: AdminSeoScoreBreakdownItem[];
  integrationRoadmap: AdminSeoIntegrationRoadmapItem[];
  connectorReadiness: AdminSeoConnectorReadinessItem[];
  operationalMetrics: AdminSeoOperationalMetric[];
  technicalStatus: AdminSeoTechnicalStatusItem[];
  crawlerPolicy: AdminSeoCrawlerPolicy[];
  aiSearchQuestions: AdminSeoAiSearchQuestion[];
  backlog: AdminSeoBacklogItem[];
  actionCards: AdminSeoActionCard[];
};

const PANEL_TIMESTAMP = "2026-05-19T08:40:00-03:00";
const PANEL_LAST_UPDATED_LABEL = "19/05/2026 08:40 BRT";

export const adminSeoSourceCatalog = {
  "local-audit": {
    source: "Auditoria local: sitemap, robots, canonical e schema",
    cadence: "Semanal e pos-release",
    integrationStatus: "manual",
    integrationStatusLabel: "Base publicada",
    timestamp: "2026-05-19T08:20:00-03:00",
    lastUpdated: "2026-05-19T08:20:00-03:00",
    lastUpdatedLabel: "19/05/2026 08:20 BRT",
  },
  "geo-matrix": {
    source: "Matriz GEO e leitura manual de paginas publicas",
    cadence: "Quinzenal",
    integrationStatus: "manual",
    integrationStatusLabel: "Manual validado",
    timestamp: "2026-05-19T08:25:00-03:00",
    lastUpdated: "2026-05-19T08:25:00-03:00",
    lastUpdatedLabel: "19/05/2026 08:25 BRT",
  },
  "editorial-backlog": {
    source: "Backlog editorial SEO/GEO",
    cadence: "Semanal",
    integrationStatus: "manual",
    integrationStatusLabel: "Manual",
    timestamp: "2026-05-19T08:28:00-03:00",
    lastUpdated: "2026-05-19T08:28:00-03:00",
    lastUpdatedLabel: "19/05/2026 08:28 BRT",
  },
  "admin-fixture": {
    source: "Fixture admin SEO/GEO sem chamadas externas",
    cadence: "Revisao semanal, com rechecagem apos releases publicos",
    integrationStatus: "manual",
    integrationStatusLabel: "Score operacional",
    timestamp: PANEL_TIMESTAMP,
    lastUpdated: PANEL_TIMESTAMP,
    lastUpdatedLabel: PANEL_LAST_UPDATED_LABEL,
  },
  "crawler-policy": {
    source: "Politica local de robots, crawler policy e superficie admin",
    cadence: "Semanal e antes de campanhas",
    integrationStatus: "manual",
    integrationStatusLabel: "Politica versionada",
    timestamp: "2026-05-19T08:22:00-03:00",
    lastUpdated: "2026-05-19T08:22:00-03:00",
    lastUpdatedLabel: "19/05/2026 08:22 BRT",
  },
  "search-console": {
    source: "Google Search Console",
    cadence: "Diaria",
    integrationStatus: "instrumenting",
    integrationStatusLabel: "Conectar API",
    timestamp: PANEL_TIMESTAMP,
    lastUpdated: PANEL_TIMESTAMP,
    lastUpdatedLabel: PANEL_LAST_UPDATED_LABEL,
  },
  ga4: {
    source: "Google Analytics 4",
    cadence: "Diaria",
    integrationStatus: "instrumenting",
    integrationStatusLabel: "Eventos GEO definidos",
    timestamp: PANEL_TIMESTAMP,
    lastUpdated: PANEL_TIMESTAMP,
    lastUpdatedLabel: PANEL_LAST_UPDATED_LABEL,
  },
  "bot-logs": {
    source: "Logs de bots e edge access logs",
    cadence: "Tempo quase real",
    integrationStatus: "planned",
    integrationStatusLabel: "Planejado",
    timestamp: PANEL_TIMESTAMP,
    lastUpdated: PANEL_TIMESTAMP,
    lastUpdatedLabel: PANEL_LAST_UPDATED_LABEL,
  },
  "ai-monitor": {
    source: "Monitor AI: prompts, citacoes e fontes usadas",
    cadence: "Semanal",
    integrationStatus: "planned",
    integrationStatusLabel: "Criar rodada",
    timestamp: PANEL_TIMESTAMP,
    lastUpdated: PANEL_TIMESTAMP,
    lastUpdatedLabel: PANEL_LAST_UPDATED_LABEL,
  },
} satisfies Record<AdminSeoSourceKey, AdminSeoSourceContract>;

export const adminSeoPanelData = {
  version: "2026-05-19.admin-seo-fixture.v2",
  timezone: "America/Sao_Paulo",
  timestamp: PANEL_TIMESTAMP,
  lastUpdated: PANEL_TIMESTAMP,
  lastUpdatedLabel: PANEL_LAST_UPDATED_LABEL,
  sourceCatalog: adminSeoSourceCatalog,
  completion: {
    value: 97,
    label: "Completude geral da entrega SEO / SGO / GEO",
    detail:
      "Score consolidado a partir da base tecnica, cobertura GEO, imagens OG, contratos de medicao, conectores real-ready e governanca de evidencias.",
    formula: "Tecnico 45% + GEO 35% + governanca 20%",
    status: "Score operacional",
    trace: trace("admin-fixture", "search-console"),
    remaining: [
      "Configurar credenciais reais e ativar coletas de Search Console, GA4, logs de bots e AI Monitor",
      "Publicar imagens reais de produto/campanha quando aprovadas",
      "Aprovar cases quantitativos apos fonte, periodo, amostra, consentimento e revisao",
    ],
  },
  scoreBreakdown: [
    {
      label: "Base tecnica publicada",
      value: "96%",
      status: "success",
      trace: trace("local-audit", "search-console"),
    },
    {
      label: "Conteudo GEO citavel",
      value: "92%",
      status: "success",
      trace: trace("geo-matrix", "ai-monitor"),
    },
    {
      label: "Governanca e painel",
      value: "96%",
      status: "success",
      trace: trace("admin-fixture", "ga4"),
    },
  ],
  integrationRoadmap: [
    {
      name: "Search Console",
      purpose: "Cobertura, queries, CTR e paginas indexadas",
      status: "Conectar API",
      statusKind: "warn",
      trace: trace("search-console"),
    },
    {
      name: "GA4",
      purpose: "Sessao organica, conversao e jornadas por pagina GEO",
      status: "Eventos GEO definidos",
      statusKind: "warn",
      trace: trace("ga4"),
    },
    {
      name: "Logs de bots",
      purpose: "Frequencia de crawl por Googlebot, Bingbot e bots generativos",
      status: "Planejado",
      statusKind: "neutral",
      trace: trace("bot-logs"),
    },
    {
      name: "Monitor AI",
      purpose: "Prompts, citacoes, fontes usadas e gap de respostas",
      status: "Criar rodada",
      statusKind: "neutral",
      trace: trace("ai-monitor"),
    },
  ],
  connectorReadiness: [
    {
      name: "Search Console",
      provider: "Google Search Console API",
      envKeys: [
        "SEO_GSC_SITE_URL",
        "SEO_GOOGLE_CLIENT_EMAIL",
        "SEO_GOOGLE_PRIVATE_KEY",
      ],
      safeStatusEndpoint: "/api/admin/seo/connectors",
      readiness: "Real-ready",
      status: "warn",
      note:
        "Contrato pronto; falta configurar envs server-side e executar coleta real.",
    },
    {
      name: "GA4",
      provider: "GA4 Data API",
      envKeys: [
        "SEO_GA4_PROPERTY_ID",
        "SEO_GOOGLE_CLIENT_EMAIL",
        "SEO_GOOGLE_PRIVATE_KEY",
      ],
      safeStatusEndpoint: "/api/admin/seo/connectors",
      readiness: "Eventos publicos definidos",
      status: "warn",
      note:
        "Eventos dos hubs ja existem; falta credencial da Data API para metricas agregadas.",
    },
    {
      name: "Logs de bots",
      provider: "Edge access logs ou arquivo local",
      envKeys: [
        "SEO_BOT_LOG_SOURCE",
        "SEO_BOT_LOG_LOCAL_PATH ou SEO_BOT_LOG_ENDPOINT + SEO_BOT_LOG_TOKEN",
      ],
      safeStatusEndpoint: "/api/admin/seo/connectors",
      readiness: "Real-ready",
      status: "neutral",
      note:
        "Status seguro ja detecta presenca de fonte sem expor token ou ler logs.",
    },
    {
      name: "AI Monitor",
      provider: "Dataset proprio ou monitor externo",
      envKeys: [
        "SEO_AI_MONITOR_SOURCE",
        "SEO_AI_MONITOR_DATASET_PATH ou SEO_AI_MONITOR_ENDPOINT + SEO_AI_MONITOR_API_KEY",
      ],
      safeStatusEndpoint: "/api/admin/seo/connectors",
      readiness: "Real-ready",
      status: "neutral",
      note:
        "Pronto para registrar rodadas de prompt e citacoes sem inventar observacoes.",
    },
  ],
  operationalMetrics: [
    {
      label: "Cobertura indexavel",
      value: "84%",
      detail: "Paginas criticas com canonical, schema e crawl liberado.",
      status: "success",
      statusLabel: "Confiavel",
      trace: trace("local-audit", "search-console"),
    },
    {
      label: "AI answer readiness",
      value: "82/100",
      detail:
        "Hubs citaveis, FAQ e entidades estruturadas para respostas generativas.",
      status: "success",
      statusLabel: "Operacional",
      trace: trace("geo-matrix", "ai-monitor"),
    },
    {
      label: "Perguntas mapeadas",
      value: 48,
      detail: "12 perguntas ainda precisam de fonte primaria ou evidencia quantitativa.",
      status: "warn",
      statusLabel: "Completar fonte",
      trace: trace("editorial-backlog", "ga4"),
    },
    {
      label: "Backlog critico",
      value: 3,
      detail:
        "Dependencias externas para sair de estimativa manual para medicao real.",
      status: "warn",
      statusLabel: "Integrar",
      trace: trace("admin-fixture", "bot-logs"),
    },
  ],
  technicalStatus: [
    {
      label: "Sitemap XML",
      value: "Ativo",
      detail: "Rotas publicas e landing pages no indice",
      status: "success",
      trace: trace("local-audit", "search-console"),
    },
    {
      label: "Robots",
      value: "Restritivo correto",
      detail: "Admin, auth e app privado fora do crawl",
      status: "success",
      trace: trace("crawler-policy", "bot-logs"),
    },
    {
      label: "Schema.org",
      value: "Ativo",
      detail: "Organization, WebSite, SoftwareApplication, Offer, FAQPage",
      status: "success",
      trace: trace("local-audit", "search-console"),
    },
    {
      label: "Canonicals",
      value: "Ativo",
      detail: "Home canonica em / e paginas publicas com URL absoluta",
      status: "success",
      trace: trace("local-audit", "search-console"),
    },
    {
      label: "Open Graph",
      value: "Ativo",
      detail: "Imagem global 1200x630 publicada; faltam imagens reais por campanha",
      status: "success",
      trace: trace("local-audit", "ga4"),
    },
    {
      label: "Performance",
      value: "Monitorar",
      detail: "Manter LCP mobile abaixo de 2.5s",
      status: "neutral",
      trace: trace("admin-fixture", "ga4"),
    },
  ],
  crawlerPolicy: [
    {
      agent: "Googlebot / Bingbot",
      policy: "Allow publico",
      scope: "Home, lancamento, precos, sobre, contato, legal",
      status: "success",
      trace: trace("crawler-policy", "bot-logs"),
    },
    {
      agent: "GPTBot / ClaudeBot / PerplexityBot",
      policy: "Allow conteudo institucional",
      scope: "Liberar somente paginas com claims auditaveis",
      status: "warn",
      trace: trace("crawler-policy", "ai-monitor"),
    },
    {
      agent: "Admin e app autenticado",
      policy: "Disallow",
      scope: "/admin, /dashboard, /painel, /portfolio, /properties",
      status: "success",
      trace: trace("crawler-policy", "bot-logs"),
    },
    {
      agent: "Scrapers genericos",
      policy: "Rate limit externo",
      scope: "Tratar via edge/WAF, sem alterar middleware nesta entrega",
      status: "neutral",
      trace: trace("crawler-policy", "bot-logs"),
    },
  ],
  aiSearchQuestions: [
    {
      cluster: "Categoria",
      question: "O que a Urban AI faz para anfitrioes de aluguel de temporada?",
      intent: "Descoberta",
      asset: "Landing + schema Organization",
      readiness: 82,
      trace: trace("geo-matrix", "ai-monitor"),
    },
    {
      cluster: "Valor",
      question: "Como IA melhora preco e ocupacao de imoveis?",
      intent: "Educacional",
      asset: "FAQ + estudo de caso alpha",
      readiness: 64,
      trace: trace("geo-matrix", "ai-monitor"),
    },
    {
      cluster: "Comparacao",
      question: "Urban AI substitui gestor, PMS ou channel manager?",
      intent: "Comparativo",
      asset: "Pagina de posicionamento",
      readiness: 58,
      trace: trace("editorial-backlog", "ai-monitor"),
    },
    {
      cluster: "Confianca",
      question: "Quais dados a Urban AI usa e como protege privacidade?",
      intent: "Risco",
      asset: "Privacidade + security notes",
      readiness: 76,
      trace: trace("geo-matrix", "ai-monitor"),
    },
    {
      cluster: "Compra",
      question: "Quanto custa usar a Urban AI e quando vale a pena?",
      intent: "Conversao",
      asset: "Precos + calculadora ROI",
      readiness: 69,
      trace: trace("editorial-backlog", "ga4"),
    },
  ],
  backlog: [
    {
      priority: "P0",
      title: "Publicar FAQPage para perguntas AI Search",
      owner: "Growth",
      impact: "Aumenta citabilidade em respostas gerativas",
      status: "Base publicada",
      trace: trace("editorial-backlog", "ai-monitor"),
    },
    {
      priority: "P0",
      title: "Auditar robots para bots generativos",
      owner: "Eng",
      impact: "Evita exposicao de areas privadas e libera conteudo certo",
      status: "Base publicada",
      trace: trace("crawler-policy", "bot-logs"),
    },
    {
      priority: "P1",
      title: "Criar pagina de comparacao PMS vs Urban AI",
      owner: "Marketing",
      impact: "Captura consultas comparativas de alta intencao",
      status: "Briefing",
      trace: trace("editorial-backlog", "ai-monitor"),
    },
    {
      priority: "P1",
      title: "Adicionar SoftwareApplication schema",
      owner: "Eng",
      impact: "Melhora entidade de produto em Knowledge Graph",
      status: "Base publicada",
      trace: trace("local-audit", "search-console"),
    },
    {
      priority: "P2",
      title: "Adicionar imagens reais por campanha",
      owner: "Design",
      impact: "Aumenta confianca visual alem do OG global gerado",
      status: "Backlog",
      trace: trace("editorial-backlog", "ga4"),
    },
    {
      priority: "P2",
      title: "Aprovar cases quantitativos publicos",
      owner: "Growth",
      impact: "Fecha o marco de 100% com evidencia auditavel",
      status: "Em validacao",
      trace: trace("editorial-backlog", "ai-monitor"),
    },
  ],
  actionCards: [
    {
      title: "Brief para conteudo GEO",
      body:
        "Transformar perguntas com readiness abaixo de 70 em blocos FAQ, evidencias e respostas curtas citaveis.",
      cta: "Preparar pauta",
      icon: "file-text",
      trace: trace("editorial-backlog", "ai-monitor"),
    },
    {
      title: "Checklist tecnico",
      body:
        "Validar sitemap, canonical, schema, robots e metadados antes de qualquer campanha publica.",
      cta: "Abrir checklist",
      icon: "check",
      trace: trace("local-audit", "search-console"),
    },
    {
      title: "Monitor de citacoes",
      body:
        "Registrar prompts, respostas e fontes citadas por ChatGPT, Perplexity, Gemini e Google AI Overviews.",
      cta: "Criar rodada",
      icon: "search",
      trace: trace("ai-monitor"),
    },
  ],
} satisfies AdminSeoPanelData;

function trace(
  sourceKey: AdminSeoSourceKey,
  nextIntegrationKey?: AdminSeoSourceKey,
): AdminSeoTrace {
  const source = adminSeoSourceCatalog[sourceKey];
  const nextIntegration = nextIntegrationKey
    ? adminSeoSourceCatalog[nextIntegrationKey]
    : undefined;

  return {
    sourceKey,
    source: source.source,
    cadence: source.cadence,
    integrationStatus: source.integrationStatus,
    integrationStatusLabel: source.integrationStatusLabel,
    timestamp: source.timestamp,
    lastUpdated: source.lastUpdated,
    lastUpdatedLabel: source.lastUpdatedLabel,
    nextIntegrationKey,
    nextIntegrationLabel: nextIntegration?.source,
  };
}
