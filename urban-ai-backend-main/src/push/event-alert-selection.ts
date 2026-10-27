import { toSaoPauloDateKey } from 'src/common/sp-date';

/**
 * Seleção (pura, sem I/O) dos eventos que viram push de "evento relevante perto do seu imóvel".
 * Os candidatos vêm das análises de preço (`analise_preco`): é o vínculo imóvel x evento que o
 * pipeline já calcula por proximidade/raio e que o resumo semanal e o digest de preços também usam.
 */

export type EventAlertCandidate = {
  userId: string;
  propertyId: string;
  propertyName?: string | null;
  neighborhood?: string | null;
  eventId: string;
  eventName: string;
  /** `events.relevancia` (0-100); nulo = ainda não enriquecido, nunca avisa. */
  relevance: number | null;
  startsAt: Date;
  imageUrl?: string | null;
  /** Distância imóvel x evento (km); desempata qual imóvel é citado no aviso. */
  distanceKm?: number | null;
};

export type EventAlertSkipReason =
  | 'invalid_start'
  | 'outside_window'
  | 'low_relevance'
  | 'already_alerted'
  | 'property_daily_limit'
  | 'host_daily_limit';

export type EventAlertConfig = {
  minRelevance: number;
  windowDays: number;
  maxPerPropertyPerDay: number;
  maxPerHostPerDay: number;
};

export const EVENT_ALERT_DEFAULTS: EventAlertConfig = {
  // 60 = faixa "alta" do painel admin (60-79) em diante; conservador de propósito (mega = 80+).
  minRelevance: 60,
  windowDays: 14,
  maxPerPropertyPerDay: 1,
  maxPerHostPerDay: 3,
};

export type EventAlertSelection = {
  selected: EventAlertCandidate[];
  skipped: { candidate: EventAlertCandidate; reason: EventAlertSkipReason }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function positiveInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(Math.floor(parsed), max) : fallback;
}

/** Lê o limite de relevância e os limites do ambiente; valor inválido cai no padrão. */
export function resolveEventAlertConfig(env: NodeJS.ProcessEnv = process.env): EventAlertConfig {
  const min = Number(env.PUSH_EVENT_ALERT_MIN_RELEVANCE);
  return {
    minRelevance: env.PUSH_EVENT_ALERT_MIN_RELEVANCE !== undefined && env.PUSH_EVENT_ALERT_MIN_RELEVANCE !== '' &&
      Number.isFinite(min) && min >= 0 && min <= 100
      ? min
      : EVENT_ALERT_DEFAULTS.minRelevance,
    windowDays: positiveInt(env.PUSH_EVENT_ALERT_WINDOW_DAYS, EVENT_ALERT_DEFAULTS.windowDays, 60),
    maxPerPropertyPerDay: positiveInt(
      env.PUSH_EVENT_ALERT_MAX_PER_PROPERTY_PER_DAY,
      EVENT_ALERT_DEFAULTS.maxPerPropertyPerDay,
      10,
    ),
    maxPerHostPerDay: positiveInt(env.PUSH_EVENT_ALERT_MAX_PER_HOST_PER_DAY, EVENT_ALERT_DEFAULTS.maxPerHostPerDay, 20),
  };
}

/**
 * Escolhe o que avisar agora. Regras, nesta ordem por candidato:
 *  1. início válido, futuro e dentro da janela (padrão 14 dias);
 *  2. relevância >= limite;
 *  3. nunca repetir host+evento (`alreadyAlerted` = chaves `userId:eventId` já registradas);
 *  4. no máximo N por imóvel e M por anfitrião no dia de São Paulo (`usedToday*` = já enviados hoje).
 * Prioridade: mais relevante primeiro, depois o que começa antes, depois o imóvel mais perto. Um
 * evento perto de vários imóveis do mesmo anfitrião gera um único aviso (o do imóvel mais perto).
 */
export function selectEventAlerts(input: {
  candidates: EventAlertCandidate[];
  now: Date;
  alreadyAlerted: ReadonlySet<string>;
  usedTodayByProperty: ReadonlyMap<string, number>;
  usedTodayByHost: ReadonlyMap<string, number>;
  config?: EventAlertConfig;
}): EventAlertSelection {
  const config = input.config ?? EVENT_ALERT_DEFAULTS;
  const windowEnd = input.now.getTime() + config.windowDays * DAY_MS;
  const selected: EventAlertCandidate[] = [];
  const skipped: EventAlertSelection['skipped'] = [];
  const propertyCount = new Map(input.usedTodayByProperty);
  const hostCount = new Map(input.usedTodayByHost);
  const chosenKeys = new Set<string>();

  const ordered = [...input.candidates].sort(
    (a, b) =>
      Number(b.relevance ?? -1) - Number(a.relevance ?? -1) ||
      a.startsAt.getTime() - b.startsAt.getTime() ||
      Number(a.distanceKm ?? Infinity) - Number(b.distanceKm ?? Infinity),
  );

  for (const candidate of ordered) {
    const startMs = new Date(candidate.startsAt as Date | string).getTime();
    if (!Number.isFinite(startMs)) {
      skipped.push({ candidate, reason: 'invalid_start' });
      continue;
    }
    if (startMs <= input.now.getTime() || startMs > windowEnd) {
      skipped.push({ candidate, reason: 'outside_window' });
      continue;
    }
    const relevance = Number(candidate.relevance);
    if (candidate.relevance === null || !Number.isFinite(relevance) || relevance < config.minRelevance) {
      skipped.push({ candidate, reason: 'low_relevance' });
      continue;
    }
    const key = eventAlertKey(candidate.userId, candidate.eventId);
    if (input.alreadyAlerted.has(key) || chosenKeys.has(key)) {
      skipped.push({ candidate, reason: 'already_alerted' });
      continue;
    }
    if ((hostCount.get(candidate.userId) ?? 0) >= config.maxPerHostPerDay) {
      skipped.push({ candidate, reason: 'host_daily_limit' });
      continue;
    }
    if ((propertyCount.get(candidate.propertyId) ?? 0) >= config.maxPerPropertyPerDay) {
      skipped.push({ candidate, reason: 'property_daily_limit' });
      continue;
    }
    chosenKeys.add(key);
    selected.push(candidate);
    hostCount.set(candidate.userId, (hostCount.get(candidate.userId) ?? 0) + 1);
    propertyCount.set(candidate.propertyId, (propertyCount.get(candidate.propertyId) ?? 0) + 1);
  }
  return { selected, skipped };
}

/** Chave de idempotência do aviso: um por anfitrião e evento. */
export function eventAlertKey(userId: string, eventId: string): string {
  return `${userId}:${eventId}`;
}

/** Dia (São Paulo) usado nos limites diários. */
export function eventAlertDay(now: Date): string {
  return toSaoPauloDateKey(now);
}
