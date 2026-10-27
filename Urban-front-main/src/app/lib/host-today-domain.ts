/**
 * Regras puras (sem React) das abas Hoje, Calendário e Avisos.
 *
 * - Hoje: ordena as próximas oportunidades por data e, no mesmo dia, pelo
 *   ganho por noite (R$), para a decisão mais urgente e valiosa vir primeiro.
 * - Calendário: agrupa sugestões por dia (agenda densa no celular).
 * - Avisos: agrupa por "Hoje", "Ontem", "Esta semana" e "Anteriores".
 *
 * Datas sempre no fuso de São Paulo: o produto é para anfitriões de SP e o
 * "dia" do evento é o dia local, não o dia UTC.
 */

export const HOST_TIME_ZONE = "America/Sao_Paulo";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HOST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" do instante no fuso de São Paulo; null se a data é inválida. */
export function spDayKey(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return dayKeyFormatter.format(date);
}

function dayKeyToUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Diferença em dias de calendário (SP) entre `value` e `now`. Positivo = futuro. */
export function daysFromToday(value: string | number | Date, now: Date = new Date()): number | null {
  const target = spDayKey(value);
  const today = spDayKey(now);
  if (!target || !today) return null;
  return Math.round((dayKeyToUtc(target) - dayKeyToUtc(today)) / 86_400_000);
}

/** "hoje", "amanhã", "em 3 dias"; passado vira "há 2 dias". */
export function relativeDayLabel(value: string | number | Date, now: Date = new Date()): string {
  const diff = daysFromToday(value, now);
  if (diff === null) return "";
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  if (diff > 1) return `em ${diff} dias`;
  return `há ${Math.abs(diff)} dias`;
}

/** Aceita número, "450", "450.5" e "1.234,50". NaN quando não dá para ler. */
export function toPriceNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return Number.NaN;
  if (typeof value === "number") return value;
  const s = value.trim();
  if (!s) return Number.NaN;
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  return Number(s);
}

export type OpportunityLike = {
  dataInicio: string;
  dataFim?: string | null;
  precoSugerido: string | number;
  seuPrecoAtual?: string | number | null;
};

/** Ganho (ou redução) por noite em R$; 0 quando falta o preço atual. */
export function deltaPerNight(item: OpportunityLike): number {
  const suggested = toPriceNumber(item.precoSugerido);
  const current = toPriceNumber(item.seuPrecoAtual ?? undefined);
  if (!Number.isFinite(suggested) || !Number.isFinite(current)) return 0;
  return suggested - current;
}

/**
 * Oportunidades acionáveis (terminam hoje ou depois, no dia de SP), em ordem:
 * 1. dia de início mais próximo;
 * 2. no mesmo dia, maior ganho por noite;
 * 3. empate: ordem original (sort estável).
 */
export function sortOpportunities<T extends OpportunityLike>(items: readonly T[], now: Date = new Date()): T[] {
  const today = spDayKey(now) ?? "";
  return items
    .filter((item) => {
      const endKey = spDayKey(item.dataFim || item.dataInicio);
      return endKey !== null && endKey >= today;
    })
    .map((item, index) => ({ item, index, start: spDayKey(item.dataInicio) ?? "", delta: deltaPerNight(item) }))
    .sort((a, b) => {
      // Evento multi-dia já em andamento conta como "hoje".
      const startA = a.start < today ? today : a.start;
      const startB = b.start < today ? today : b.start;
      if (startA !== startB) return startA < startB ? -1 : 1;
      if (a.delta !== b.delta) return b.delta - a.delta;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export type DayGroup<T> = { dayKey: string; items: T[] };

/** Agrupa por dia de SP da data de início, dias em ordem crescente. Itens sem data válida ficam de fora. */
export function groupByStartDay<T extends { dataInicio: string }>(items: readonly T[]): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = spDayKey(item.dataInicio);
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([dayKey, list]) => ({ dayKey, items: list }));
}

export type NotificationBucket = "today" | "yesterday" | "week" | "older";

export const NOTIFICATION_BUCKET_LABEL: Record<NotificationBucket, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  week: "Esta semana",
  older: "Anteriores",
};

const BUCKET_ORDER: NotificationBucket[] = ["today", "yesterday", "week", "older"];

/** Hoje / Ontem / últimos 7 dias / antes disso. Data inválida ou futura (relógio torto) cai em "Hoje"/"Anteriores". */
export function notificationBucket(createdAt: string, now: Date = new Date()): NotificationBucket {
  const diff = daysFromToday(createdAt, now);
  if (diff === null) return "older";
  if (diff >= 0) return "today";
  if (diff === -1) return "yesterday";
  if (diff >= -6) return "week";
  return "older";
}

export type NotificationGroup<T> = { bucket: NotificationBucket; label: string; items: T[] };

/** Grupos não vazios na ordem Hoje → Anteriores, mantendo a ordem da API dentro de cada grupo. */
export function groupNotificationsByDay<T extends { createdAt: string }>(
  items: readonly T[],
  now: Date = new Date(),
): NotificationGroup<T>[] {
  const buckets = new Map<NotificationBucket, T[]>();
  for (const item of items) {
    const bucket = notificationBucket(item.createdAt, now);
    const list = buckets.get(bucket);
    if (list) list.push(item);
    else buckets.set(bucket, [item]);
  }
  return BUCKET_ORDER.filter((bucket) => buckets.has(bucket)).map((bucket) => ({
    bucket,
    label: NOTIFICATION_BUCKET_LABEL[bucket],
    items: buckets.get(bucket)!,
  }));
}

/** Texto do estado vazio do período no Calendário. */
export function emptyPeriodCopy(input: {
  periodLabel: string;
  nextPeriodLabel?: string | null;
  nextPeriodCount?: number;
}): { title: string; body: string } {
  if (input.nextPeriodLabel) {
    const count = Math.max(0, Math.floor(input.nextPeriodCount ?? 0));
    const countLabel = count === 1 ? "1 sugestão" : `${count} sugestões`;
    return {
      title: `Nenhuma sugestão em ${input.periodLabel}`,
      body: `Nenhuma sugestão nesta janela — próximos eventos em ${input.nextPeriodLabel} (${countLabel}).`,
    };
  }
  return {
    title: "Sem sugestões nos próximos meses",
    body: "Não encontramos evento futuro que combine com este imóvel. Seguimos procurando e avisamos em Avisos quando surgir uma oportunidade.",
  };
}
