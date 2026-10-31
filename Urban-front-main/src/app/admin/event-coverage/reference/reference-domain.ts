// Domínio puro da página /admin/event-coverage/reference (sem React) — testado em
// scripts/event-reference-domain.test.mjs. Contratos: ADR 0026.

export type ReferenceBadgeKind = "success" | "warn" | "error" | "neutral";

export function statusMeta(status: string): { label: string; badge: ReferenceBadgeKind } {
  switch (status) {
    case "aprovado":
      return { label: "Aprovada", badge: "success" };
    case "conflito":
      return { label: "Conflito", badge: "error" };
    case "rejeitado":
      return { label: "Rejeitada", badge: "neutral" };
    default:
      return { label: "Candidata", badge: "warn" };
  }
}

export function sizeLabel(size: string): string {
  switch (size) {
    case "grande":
      return "Grande";
    case "pequeno":
      return "Pequeno";
    default:
      return "Médio";
  }
}

const DIMENSION_LABELS: Record<string, string> = {
  total: "Total",
  size: "Porte",
  category: "Categoria",
  venue: "Venue",
};

export function dimensionLabel(dimension: string): string {
  return DIMENSION_LABELS[dimension] ?? dimension;
}

/** Rótulo do valor de uma dimensão: porte vira "Grande", demais ficam como vieram. */
export function dimensionValueLabel(dimension: string, value: string): string {
  if (dimension === "total") return "Todos";
  if (dimension === "size") return sizeLabel(value);
  if (value === "sem-categoria") return "Sem categoria";
  return value;
}

/** Quem validou: "web:sympla.com.br" -> "sympla.com.br"; "db:sympla" -> "Banco · sympla". */
export function validatorLabel(key: string, kind?: string): string {
  if (kind === "judge" || key.startsWith("judge:")) return `Juiz · ${key.replace(/^judge:/, "")}`;
  if (key.startsWith("db:")) return `Banco · ${key.slice(3)}`;
  if (key === "web:google-events") return "Google Events (SerpAPI)";
  if (key.startsWith("web:")) return key.slice(4);
  return key;
}

export function verdictLabel(verdict: string): string {
  switch (verdict) {
    case "support":
      return "Confirma";
    case "confirm":
      return "Juiz confirma";
    case "reject":
      return "Juiz rejeita";
    default:
      return "Sem conclusão";
  }
}

/** `2026-11-10` -> `10/11/2026` (sem passar por Date, para não deslocar o dia). */
export function formatDateKey(key: string | null | undefined): string {
  if (!key) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : key;
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/** Selo do recall contra o piso configurado. */
export function recallTone(value: number | null | undefined, floor: number): ReferenceBadgeKind {
  if (value === null || value === undefined || !Number.isFinite(value)) return "neutral";
  if (floor > 0 && value < floor) return "error";
  if (value < 90) return "warn";
  return "success";
}

export interface SeriesPoint {
  date: string;
  recallPast30Pct: number | null;
}

export interface SparkPoint {
  x: number;
  y: number;
  date: string;
  value: number;
}

/**
 * Pontos do gráfico de recall (0–100%) em um viewBox `width × height`; ignora dias sem recall.
 * Um único ponto fica no centro; sem pontos, lista vazia.
 */
export function sparkPoints(series: SeriesPoint[], width: number, height: number, padding = 8): SparkPoint[] {
  const valid = series.filter((p) => p.recallPast30Pct !== null && Number.isFinite(p.recallPast30Pct));
  if (valid.length === 0) return [];
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  return valid.map((p, i) => {
    const value = Math.max(0, Math.min(100, p.recallPast30Pct as number));
    const x = valid.length === 1 ? width / 2 : padding + (innerW * i) / (valid.length - 1);
    const y = padding + innerH * (1 - value / 100);
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, date: p.date, value };
  });
}

export function sparkPath(points: SparkPoint[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
}

/** Y do piso (linha de alerta) no mesmo viewBox. */
export function floorY(floorPct: number, height: number, padding = 8): number {
  const innerH = height - padding * 2;
  return Math.round((padding + innerH * (1 - Math.max(0, Math.min(100, floorPct)) / 100)) * 10) / 10;
}

export function normalizeApiError(err: unknown, fallback: string): string {
  const e = err as { response?: { status?: number; data?: { message?: string | string[] } }; message?: string };
  const status = e?.response?.status;
  if (status === 401 || status === 403) return "Acesso negado.";
  const message = e?.response?.data?.message;
  if (Array.isArray(message)) return message.join(" ");
  return message || e?.message || fallback;
}
