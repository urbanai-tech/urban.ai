// Domínio puro da página /admin/event-coverage (sem React) — testado em
// scripts/event-coverage-domain.test.mjs.

export type CoverageBadgeKind = "success" | "warn" | "error" | "neutral";

export interface CoverageHint {
  key: string;
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  /** Rota interna do admin que resolve o problema. */
  href?: string;
  hrefLabel?: string;
  /** Caminho do runbook no repositório (docs/runbooks/...). */
  runbook?: string;
}

interface HintReason {
  code: string;
  severity: "critical" | "warning" | "info";
  message: string;
  source?: string;
}

export function statusMeta(status: string): { label: string; badge: CoverageBadgeKind; summary: string } {
  switch (status) {
    case "ok":
      return { label: "Pronto para vender", badge: "success", summary: "Meta atingida com fontes saudáveis." };
    case "at_risk":
      return {
        label: "Em risco",
        badge: "warn",
        summary: "A meta foi atingida, mas depende de fontes paradas ou de eventos sem coordenadas.",
      };
    default:
      return { label: "Insuficiente", badge: "error", summary: "Menos eventos futuros do que a meta." };
  }
}

export function sourceHealthMeta(health: string): { label: string; badge: CoverageBadgeKind } {
  switch (health) {
    case "healthy":
      return { label: "Saudável", badge: "success" };
    case "stale":
      return { label: "Parada", badge: "warn" };
    case "zero_yield":
      return { label: "Sem dados", badge: "error" };
    case "never_delivered":
      return { label: "Nunca entregou", badge: "error" };
    default:
      return { label: "Manual / não monitorada", badge: "neutral" };
  }
}

/** "agora", "há 3 h", "há 2 d" — ou "sem registro". */
export function formatSinceIngest(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return "sem registro";
  if (hours < 1) return "agora";
  if (hours < 48) return `há ${Math.round(hours)} h`;
  return `há ${Math.round(hours / 24)} d`;
}

export function formatPct(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${String(value).replace(".", ",")}%`;
}

/** Progresso 0–100 (limitado) de `count` em relação à `target`. */
export function progressPct(count: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((count / target) * 100)));
}

/** Rótulo curto "26/10" a partir de "2026-10-26" (sem passar por Date: evita deslocar o dia). */
export function shortDay(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return month && day ? `${day}/${month}` : dateKey;
}

export interface HistogramBar {
  date: string;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Barras do histograma em coordenadas de viewBox (largura `width`, altura `height`). */
export function histogramBars(
  histogram: Array<{ date: string; count: number }>,
  width = 600,
  height = 120,
  gap = 3,
): HistogramBar[] {
  const n = histogram.length;
  if (n === 0) return [];
  const max = Math.max(1, ...histogram.map((d) => d.count));
  const barWidth = Math.max(1, (width - gap * (n - 1)) / n);
  return histogram.map((d, i) => {
    const barHeight = d.count > 0 ? Math.max(2, Math.round((d.count / max) * height)) : 0;
    return {
      date: d.date,
      count: d.count,
      x: Math.round((i * (barWidth + gap)) * 100) / 100,
      y: height - barHeight,
      width: Math.round(barWidth * 100) / 100,
      height: barHeight,
    };
  });
}

const RUNBOOK_COLLECTORS = "docs/runbooks/coletores-zero-yield.md";
const RUNBOOK_MANUAL = "docs/runbooks/eventos-fallback-manual.md";
const RUNBOOK_GEOCODER = "docs/runbooks/backfill-geocoder.md";
const RUNBOOK_DEDUP = "docs/runbooks/event-dedup-identity.md";

/** Dicas "o que fazer" por problema (uma por motivo; por fonte para fontes paradas). */
export function buildHints(reasons: HintReason[]): CoverageHint[] {
  const hints: CoverageHint[] = [];
  for (const r of reasons) {
    switch (r.code) {
      case "below_target":
      case "no_sources":
        hints.push({
          key: r.code,
          severity: r.severity,
          title: "Faltam eventos futuros",
          body: "Importe um lote por CSV (fallback manual) e confira se os coletores estão rodando.",
          href: "/admin/events/import",
          hrefLabel: "Importar CSV",
          runbook: RUNBOOK_MANUAL,
        });
        break;
      case "unhealthy_sources":
        hints.push({
          key: r.code,
          severity: r.severity,
          title: "A meta depende de fontes paradas",
          body: "Sem as fontes paradas o total cai abaixo da meta. Recupere os coletores ou complemente por CSV.",
          href: "/admin/collectors-health",
          hrefLabel: "Ver coletores",
          runbook: RUNBOOK_COLLECTORS,
        });
        break;
      case "source_zero_yield":
      case "source_stale":
        hints.push({
          key: `${r.code}:${r.source ?? ""}`,
          severity: r.severity,
          title: r.source ? `Fonte ${r.source} sem dados novos` : "Fonte sem dados novos",
          body:
            r.code === "source_zero_yield"
              ? "O coletor termina sem itens: provável mudança no site/API de origem. Siga o diagnóstico do runbook."
              : "Sem ingestão dentro da janela esperada. Verifique o agendamento e a chave da fonte.",
          href: "/admin/collectors-health",
          hrefLabel: "Ver coletores",
          runbook: RUNBOOK_COLLECTORS,
        });
        break;
      case "source_never_delivered":
        hints.push({
          key: `${r.code}:${r.source ?? ""}`,
          severity: r.severity,
          title: r.source ? `Fonte ${r.source} configurada, mas nunca entregou` : "Fonte configurada nunca entregou",
          body: "A fonte está configurada e nunca trouxe um evento: confira se o coletor está agendado, a chave está correta e o site/API responde. Se for intencional, inclua-a em COLLECTOR_ZERO_YIELD_IGNORE_SOURCES.",
          href: "/admin/collectors-health",
          hrefLabel: "Ver coletores",
          runbook: RUNBOOK_COLLECTORS,
        });
        break;
      case "low_geocoding":
        hints.push({
          key: r.code,
          severity: r.severity,
          title: "Eventos sem coordenadas",
          body: "Sem lat/lng o evento não entra no motor. Rode o geocoder ou corrija o endereço.",
          href: "/admin/events",
          hrefLabel: "Ver eventos",
          runbook: RUNBOOK_GEOCODER,
        });
        break;
      case "low_category":
        hints.push({
          key: r.code,
          severity: r.severity,
          title: "Eventos sem categoria",
          body: "A categoria melhora o enriquecimento e a relevância. Revise os eventos sem categoria.",
          href: "/admin/events",
          hrefLabel: "Ver eventos",
        });
        break;
      case "dedup_pending":
        hints.push({
          key: r.code,
          severity: r.severity,
          title: "Duplicatas aguardando revisão",
          body: "Aprove ou rejeite os candidatos para não inflar a contagem de eventos.",
          href: "/admin/events/dedup",
          hrefLabel: "Revisar duplicatas",
          runbook: RUNBOOK_DEDUP,
        });
        break;
      default:
        break;
    }
  }
  return hints;
}

// ---------------------------------------------------------------------------
// Página unificada: abas, mudanças de evento e lead time (EVB)
// ---------------------------------------------------------------------------

export type CoverageTabId = "cobertura" | "qualidade" | "regioes" | "mudancas";

export const COVERAGE_TABS: Array<{ id: CoverageTabId; label: string }> = [
  { id: "cobertura", label: "Cobertura" },
  { id: "qualidade", label: "Qualidade" },
  { id: "regioes", label: "Regiões" },
  { id: "mudancas", label: "Mudanças" },
];

/** Aba a partir de `?tab=`; valor ausente ou desconhecido cai em "cobertura". */
export function parseCoverageTab(value: string | null | undefined): CoverageTabId {
  return COVERAGE_TABS.find((t) => t.id === value)?.id ?? "cobertura";
}

export function changeTypeMeta(type: string): { label: string; badge: CoverageBadgeKind } {
  switch (type) {
    case "first_seen":
      return { label: "Novo", badge: "success" };
    case "rescheduled":
      return { label: "Remarcado", badge: "warn" };
    case "postponed":
      return { label: "Adiado", badge: "warn" };
    case "venue_changed":
      return { label: "Local mudou", badge: "warn" };
    case "url_changed":
      return { label: "Link mudou", badge: "neutral" };
    case "cancelled":
      return { label: "Cancelado", badge: "error" };
    case "possibly_cancelled":
      return { label: "Possivelmente cancelado", badge: "error" };
    case "reappeared":
      return { label: "Reapareceu", badge: "success" };
    default:
      return { label: type, badge: "neutral" };
  }
}

const SP_TIME_ZONE = "America/Sao_Paulo";

/** "20/11 19:00" a partir de um instante ISO, no relógio de São Paulo (nulo ou inválido: "—"). */
export function formatSpDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const read = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${read("day")}/${read("month")} ${read("hour")}:${read("minute")}`;
}

/** Texto curto do que mudou, para a tabela de mudanças. */
export function describeChange(row: {
  changeType: string;
  oldValue: string | null;
  newValue: string | null;
}): string {
  switch (row.changeType) {
    case "rescheduled":
      return `${formatSpDateTime(row.oldValue)} → ${formatSpDateTime(row.newValue)}`;
    case "venue_changed":
    case "url_changed":
      return `${row.oldValue ?? "—"} → ${row.newValue ?? "—"}`;
    case "cancelled":
    case "postponed":
      return "Declarado pela fonte";
    case "possibly_cancelled":
      return `Última vez visto ${formatSpDateTime(row.oldValue)}`;
    case "reappeared":
      return "Voltou a aparecer na fonte";
    case "first_seen":
      return "Primeira vez no radar";
    default:
      return "—";
  }
}

/** "21,5 d" (uma casa, vírgula) ou "—". */
export function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "—";
  return `${(Math.round(days * 10) / 10).toString().replace(".", ",")} d`;
}

/** Mediana de lead time contra a meta de produto (>= 21 dias). */
export function leadTimeVerdict(
  medianDays: number | null | undefined,
  targetDays: number,
): { label: string; badge: CoverageBadgeKind } {
  if (medianDays === null || medianDays === undefined || !Number.isFinite(medianDays)) {
    return { label: "Sem dados", badge: "neutral" };
  }
  if (medianDays >= targetDays) return { label: "Na meta", badge: "success" };
  if (medianDays >= targetDays / 2) return { label: "Abaixo da meta", badge: "warn" };
  return { label: "Muito abaixo da meta", badge: "error" };
}

/** Rótulos legíveis dos portes devolvidos pelo backend. */
export function sizeLabel(key: string): string {
  switch (key) {
    case "large":
      return "Grande (10 mil+)";
    case "medium":
      return "Médio (2 a 10 mil)";
    case "small":
      return "Pequeno (até 2 mil)";
    default:
      return "Sem porte informado";
  }
}

export interface ChangeSeriesPoint {
  date: string;
  firstSeen: number;
  rescheduled: number;
  cancelled: number;
  possiblyCancelled: number;
}

export interface StackedBar {
  date: string;
  total: number;
  /** Segmentos de baixo para cima (já em coordenadas de viewBox). */
  segments: Array<{
    key: "rescheduled" | "cancelled" | "possiblyCancelled";
    count: number;
    y: number;
    height: number;
  }>;
  x: number;
  width: number;
}

/**
 * Barras empilhadas (remarcados + cancelados + possivelmente cancelados) por dia, em coordenadas de
 * viewBox. Dias sem mudança ficam sem segmentos.
 */
export function changeStackBars(series: ChangeSeriesPoint[], width = 600, height = 120, gap = 3): StackedBar[] {
  const n = series.length;
  if (n === 0) return [];
  const totals = series.map((d) => d.rescheduled + d.cancelled + d.possiblyCancelled);
  const max = Math.max(1, ...totals);
  const barWidth = Math.max(1, (width - gap * (n - 1)) / n);
  return series.map((d, i) => {
    let cursor = height;
    const segments: StackedBar["segments"] = [];
    for (const key of ["rescheduled", "cancelled", "possiblyCancelled"] as const) {
      const count = d[key];
      if (count <= 0) continue;
      const h = Math.max(2, Math.round((count / max) * height));
      cursor -= h;
      segments.push({ key, count, y: cursor, height: h });
    }
    return {
      date: d.date,
      total: totals[i],
      segments,
      x: Math.round(i * (barWidth + gap) * 100) / 100,
      width: Math.round(barWidth * 100) / 100,
    };
  });
}

/** Totais da série, para o texto alternativo do gráfico. */
export function seriesTotals(series: ChangeSeriesPoint[]) {
  return series.reduce(
    (acc, d) => ({
      firstSeen: acc.firstSeen + d.firstSeen,
      rescheduled: acc.rescheduled + d.rescheduled,
      cancelled: acc.cancelled + d.cancelled,
      possiblyCancelled: acc.possiblyCancelled + d.possiblyCancelled,
    }),
    { firstSeen: 0, rescheduled: 0, cancelled: 0, possiblyCancelled: 0 },
  );
}
