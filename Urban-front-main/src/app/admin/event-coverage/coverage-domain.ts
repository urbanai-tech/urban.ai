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
