/**
 * Regras puras (sem React) do "o que vem a seguir" quando o imóvel ainda não
 * tem sugestão de preço (MKT-05).
 *
 * O estado vazio nunca deve ser uma tela em branco: explica por que não há
 * sugestão, mostra os próximos eventos da cidade (catálogo da API) e diz
 * quando e como o anfitrião será avisado. Só usa dados que a API já expõe;
 * a única "data futura" é o resumo semanal por e-mail, que o backend envia
 * toda segunda-feira às 8h30 (America/Sao_Paulo).
 */

export const WEEKLY_REPORT_WEEKDAY = 1; // segunda-feira
export const WEEKLY_REPORT_HOUR = 8;
export const WEEKLY_REPORT_MINUTE = 30;
/** São Paulo não tem horário de verão desde 2019: offset fixo de UTC-3. */
const SP_UTC_OFFSET_HOURS = -3;
const DAY_MS = 86_400_000;
export const CATALOG_LOOKAHEAD_DAYS = 60;
export const CATALOG_MAX_ITEMS = 3;

export type CatalogEventLike = {
  id: string;
  name: string;
  startsAt: string;
  city?: string | null;
  venueName?: string | null;
};

/** Relógio de parede de São Paulo: reaproveita os campos UTC de uma data deslocada. */
function toSpWallClock(date: Date): Date {
  return new Date(date.getTime() + SP_UTC_OFFSET_HOURS * 3_600_000);
}

/** Próximo disparo do resumo semanal (segunda 8h30 em SP), sempre no futuro. */
export function nextWeeklyReportAt(now: Date = new Date()): Date {
  const wall = toSpWallClock(now);
  const daysUntil = (WEEKLY_REPORT_WEEKDAY - wall.getUTCDay() + 7) % 7;
  const candidateWall = Date.UTC(
    wall.getUTCFullYear(),
    wall.getUTCMonth(),
    wall.getUTCDate() + daysUntil,
    WEEKLY_REPORT_HOUR,
    WEEKLY_REPORT_MINUTE,
  );
  let candidate = candidateWall - SP_UTC_OFFSET_HOURS * 3_600_000;
  if (candidate <= now.getTime()) candidate += 7 * DAY_MS;
  return new Date(candidate);
}

/** Janela do catálogo: de hoje (dia SP) até `days` dias à frente, em YYYY-MM-DD. */
export function catalogWindow(now: Date = new Date(), days: number = CATALOG_LOOKAHEAD_DAYS) {
  const iso = (date: Date) => toSpWallClock(date).toISOString().slice(0, 10);
  return { from: iso(now), to: iso(new Date(now.getTime() + days * DAY_MS)) };
}

/** Cidade do primeiro imóvel pronto que tem cidade preenchida. */
export function pickCatalogCity(
  properties: ReadonlyArray<{ cidade?: string | null } | null | undefined>,
): string | null {
  for (const property of properties) {
    const city = String(property?.cidade ?? "").trim();
    if (city) return city;
  }
  return null;
}

/** Próximos eventos da cidade: só futuros, válidos, em ordem de data e sem repetir id. */
export function pickUpcomingCityEvents<T extends CatalogEventLike>(
  items: ReadonlyArray<T> | null | undefined,
  now: Date = new Date(),
  limit: number = CATALOG_MAX_ITEMS,
): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (!item || !item.id || !item.name || seen.has(item.id)) return false;
      const start = new Date(item.startsAt).getTime();
      if (!Number.isFinite(start) || start < now.getTime() - DAY_MS) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, Math.max(0, limit));
}

/** Explicação curta do porquê de não haver sugestão agora. */
export function whyNoSuggestionCopy(input: { city: string | null; upcomingCount: number }): string {
  const check = "Confira em Imóveis se o endereço e a diária de referência estão preenchidos.";
  if (input.upcomingCount > 0 && input.city) {
    return `Há eventos marcados em ${input.city}, mas nenhum fica perto o bastante deste imóvel para mexer na procura. O My Urban só sugere preço quando o evento muda a demanda de verdade. ${check}`;
  }
  return `Não encontramos evento futuro que combine com este imóvel: o My Urban só sugere preço quando um evento mexe na procura de verdade. Seguimos procurando. ${check}`;
}
