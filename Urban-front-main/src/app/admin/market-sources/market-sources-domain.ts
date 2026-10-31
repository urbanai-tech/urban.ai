import type {
  MarketAdminSourceId,
  MarketHealthReport,
  MarketHealthSource,
  MarketUploadLicense,
} from "../../service/api/market-admin";

/**
 * Regras puras de /admin/market-sources (ADR 0028): rótulos, selos de saúde, cobertura e
 * validação do upload do dataset licenciado. Sem React: testável com `node --test`.
 */

export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const LABEL_RE = /^[a-z0-9][a-z0-9_-]{1,23}$/;
const CITY_RE = /^[a-z0-9][a-z0-9-]{1,47}$/;
const MAPPING_FIELDS = new Set([
  "externalId",
  "latitude",
  "longitude",
  "adr",
  "occupancy",
  "observedDate",
  "neighborhood",
  "roomType",
  "bedrooms",
  "accommodates",
  "airbnbListingId",
  "city",
  "adrUnit",
  "occupancyScale",
]);

export const LICENSE_OPTIONS: ReadonlyArray<{ value: MarketUploadLicense; label: string; help: string }> = [
  {
    value: "licensed_internal_only",
    label: "Pago · uso interno apenas",
    help: "Alimenta o motor e o admin; nunca aparece para o anfitrião.",
  },
  {
    value: "licensed_display_aggregate",
    label: "Pago · exibição agregada ao cliente",
    help: "O contrato permite mostrar agregados (mediana, faixas) ao anfitrião.",
  },
  {
    value: "cc_by_4",
    label: "Aberto · CC BY 4.0 (com atribuição)",
    help: "Exibido com a atribuição da fonte (ex.: Inside Airbnb).",
  },
];

const LICENSE_LABELS: Record<string, string> = {
  first_party: "Dado dos clientes",
  cc_by_4: "CC BY 4.0",
  licensed_display_aggregate: "Pago · exibição agregada",
  licensed_internal_only: "Pago · uso interno",
  unknown: "Sem licença (não usado)",
};

export function licenseLabel(license: string): string {
  return LICENSE_LABELS[license] ?? license;
}

/** "2026-10-01" → "01/10/2026"; sem data → "—". */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export type SourceStatusMeta = { badge: "success" | "warn" | "error" | "neutral"; label: string; detail: string };

/** Selo de cada fonte: desligada (e por quê), sem dado, desatualizada ou saudável. */
export function sourceStatusMeta(source: MarketHealthSource): SourceStatusMeta {
  if (!source.enabled) {
    return { badge: "neutral", label: "Desligada", detail: source.reason ?? "Desligada por configuração." };
  }
  if (source.id === "customers") {
    return source.listings > 0
      ? { badge: "success", label: "Ativa", detail: "Dado dos clientes, sempre atual." }
      : { badge: "warn", label: "Sem imóveis", detail: "Nenhum imóvel ativo de clientes para comparar." };
  }
  if (source.listings === 0) {
    return { badge: "warn", label: "Sem dados", detail: "Ligada, mas nenhum anúncio foi importado ainda." };
  }
  if (source.stale) {
    return {
      badge: "warn",
      label: "Desatualizada",
      detail: `Última coleta em ${formatDay(source.lastCollectedAt)}: importe um arquivo mais novo.`,
    };
  }
  return { badge: "success", label: "Atualizada", detail: `Última coleta em ${formatDay(source.lastCollectedAt)}.` };
}

export type CoverageMeta = {
  badge: "success" | "warn" | "error";
  label: string;
  pctText: string;
  targetText: string;
  summary: string;
};

/** Cobertura de imóveis com comp set suficiente contra a meta (80%). */
export function coverageMeta(coverage: MarketHealthReport["coverage"]): CoverageMeta {
  const targetText = `${Math.round(coverage.target * 100)}%`;
  if (coverage.ratio === null) {
    return {
      badge: "warn",
      label: "Sem amostra",
      pctText: "—",
      targetText,
      summary: "Nenhum imóvel ativo com coordenadas para avaliar a cobertura.",
    };
  }
  const pct = Math.round(coverage.ratio * 100);
  const ok = coverage.ratio >= coverage.target;
  const near = coverage.ratio >= coverage.target * 0.6;
  return {
    badge: ok ? "success" : near ? "warn" : "error",
    label: ok ? "Meta atingida" : near ? "Abaixo da meta" : "Longe da meta",
    pctText: `${pct}%`,
    targetText,
    summary: `${coverage.withSufficientCompSet} de ${coverage.sampled} imóveis avaliados têm comp set suficiente (meta ${targetText}).`,
  };
}

/** O que fazer agora, em ordem de prioridade. */
export function marketHints(report: MarketHealthReport): string[] {
  const hints: string[] = [];
  const external = report.sources.filter((s) => s.id === "licensed_dataset" || s.id === "inside_airbnb");
  if (external.every((s) => s.listings === 0)) {
    hints.push("Nenhuma fonte externa tem dados: envie um dataset licenciado (CSV) ou importe o Inside Airbnb para ampliar a cobertura.");
  }
  for (const source of external) {
    if (source.enabled && source.stale) {
      hints.push(`${source.label}: dado desatualizado (coleta em ${formatDay(source.lastCollectedAt)}). Reimporte um arquivo mais novo.`);
    }
  }
  const meta = coverageMeta(report.coverage);
  if (report.coverage.ratio !== null && report.coverage.ratio < report.coverage.target) {
    hints.push(`Cobertura em ${meta.pctText} (meta ${meta.targetText}): importe bairros onde há clientes sem comp set suficiente.`);
  }
  const scraping = report.sources.find((s) => s.id === "own_scraping");
  if (scraping && !scraping.enabled) {
    hints.push(`Coleta própria desligada (${scraping.reason ?? "aguardando parecer jurídico"}); não há coleta contra sites de terceiros.`);
  }
  return hints;
}

export type UploadForm = {
  file: File | null;
  datasetLabel: string;
  city: string;
  license: string;
  collectedAt: string;
  mapping: string;
};

export const EMPTY_UPLOAD_FORM: UploadForm = {
  file: null,
  datasetLabel: "",
  city: "sao-paulo",
  license: "", // sem padrão: a licença é uma decisão consciente
  collectedAt: "",
  mapping: "",
};

export type UploadErrors = Partial<Record<"file" | "datasetLabel" | "city" | "license" | "collectedAt" | "mapping", string>>;

/** Mesmas regras do backend, para o admin ver o erro antes de enviar 25 MB. */
export function validateUpload(form: UploadForm, today: string): UploadErrors {
  const errors: UploadErrors = {};
  if (!form.file) errors.file = "Escolha um arquivo CSV.";
  else if (!/\.csv$/i.test(form.file.name)) errors.file = "O arquivo deve ser .csv (converta Parquet para CSV antes).";
  else if (form.file.size > UPLOAD_MAX_BYTES) errors.file = "Arquivo acima de 25 MB: divida em partes.";
  else if (form.file.size === 0) errors.file = "O arquivo está vazio.";
  if (!LABEL_RE.test(form.datasetLabel)) {
    errors.datasetLabel = "Use 2 a 24 caracteres: letras minúsculas, números, hífen ou sublinhado (ex.: airroi).";
  }
  if (!CITY_RE.test(form.city)) errors.city = "Use o slug do mercado em minúsculas (ex.: sao-paulo).";
  if (!LICENSE_OPTIONS.some((option) => option.value === form.license)) {
    errors.license = "Escolha a licença contratada: ela define se o dado pode ser mostrado ao anfitrião.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.collectedAt)) errors.collectedAt = "Informe a data de coleta do arquivo.";
  else if (form.collectedAt > today) errors.collectedAt = "A data de coleta não pode estar no futuro.";
  if (form.mapping.trim()) {
    const problem = mappingProblem(form.mapping);
    if (problem) errors.mapping = problem;
  }
  return errors;
}

function mappingProblem(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 'Mapeamento não é um JSON válido (ex.: {"adr":"preco","externalId":"id"}).';
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "O mapeamento deve ser um objeto { campo: \"coluna\" }.";
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!MAPPING_FIELDS.has(key)) return `Campo desconhecido no mapeamento: "${key}".`;
    if (typeof value !== "string") return `O valor de "${key}" deve ser texto.`;
  }
  return null;
}

export function hasUploadErrors(errors: UploadErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Texto curto de cada fonte para a tabela por bairro. */
export function sourceShortLabel(id: MarketAdminSourceId): string {
  switch (id) {
    case "customers":
      return "Clientes";
    case "licensed_dataset":
      return "Dataset licenciado";
    case "inside_airbnb":
      return "Inside Airbnb";
    default:
      return "Coleta própria";
  }
}
