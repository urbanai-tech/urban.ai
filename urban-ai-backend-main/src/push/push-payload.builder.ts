import {
  addDaysToDateKey,
  saoPauloLocalToInstant,
  saoPauloParts,
  toSaoPauloDateKey,
} from 'src/common/sp-date';

/**
 * Montagem dos payloads de Web Push (puro, sem I/O) + política de categoria/horário.
 * O service worker (Urban-front-main/public/sw.js) consome estes campos:
 * tag/renotify colapsam duplicatas, actions[].url vira deep link, badgeCount alimenta o selo do app.
 */

export type PushCategory = 'pricing' | 'events' | 'weekly' | 'system' | 'test';

export type PushAction = {
  /** Identificador devolvido no clique. `later` e `dismiss` só fecham a notificação. */
  action: string;
  title: string;
  /** Rota interna aberta quando a ação é tocada. */
  url?: string;
};

export type PwaPushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  /** Com `tag`, uma nova notificação de mesma tag vibra/toca de novo em vez de substituir em silêncio. */
  renotify?: boolean;
  icon?: string;
  badge?: string;
  /** Imagem grande (só https ou do próprio app). */
  image?: string;
  /** Selo do ícone do app (pendentes). 0 limpa. */
  badgeCount?: number;
  requireInteraction?: boolean;
  /**
   * Instante (ISO) depois do qual o aviso perde o sentido (ex.: evento já começou). Só importa quando o
   * push é adiado pelo horário de silêncio: ao enviar, itens vencidos são descartados.
   */
  expiresAt?: string;
  /** Ignora o horário de silêncio (uso restrito: teste do usuário, alertas de cobrança). */
  urgent?: boolean;
  data?: Record<string, unknown>;
  actions?: PushAction[];
};

const MAX_TITLE = 120;
const MAX_BODY = 240;
const MAX_ACTIONS = 2;

/** Categoria pelo `data.type` do payload (mesmo valor gravado em communication_logs.kind). */
export function pushCategoryFromType(type: unknown): PushCategory {
  if (typeof type !== 'string') return 'system';
  const value = type.trim();
  if (value === 'test') return 'test';
  if (value === 'weekly_event_report') return 'weekly';
  if (value.startsWith('event_')) return 'events';
  if (
    value.startsWith('pricing_') ||
    value.startsWith('base_price_') ||
    value.startsWith('property_analysis_')
  ) {
    return 'pricing';
  }
  return 'system';
}

export type PushCategoryPreferenceField = 'pushPricing' | 'pushEvents' | 'weeklyReport';

/** Coluna de communication-preferences que liga/desliga a categoria; `null` = sempre permitido. */
export function preferenceFieldFor(category: PushCategory): PushCategoryPreferenceField | null {
  if (category === 'pricing') return 'pushPricing';
  if (category === 'events') return 'pushEvents';
  if (category === 'weekly') return 'weeklyReport';
  return null;
}

export type QuietHours = { startHour: number; endHour: number } | null;

export const DEFAULT_QUIET_HOURS: QuietHours = { startHour: 22, endHour: 8 };

/** `PUSH_QUIET_HOURS="22-8"` (horas de São Paulo); "off" desliga. Valor inválido cai no padrão. */
export function parseQuietHours(raw: string | undefined | null): QuietHours {
  if (raw === undefined || raw === null || raw.trim() === '') return DEFAULT_QUIET_HOURS;
  if (/^(off|none|0)$/i.test(raw.trim())) return null;
  const match = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(raw.trim());
  if (!match) return DEFAULT_QUIET_HOURS;
  const startHour = Number(match[1]);
  const endHour = Number(match[2]);
  if (startHour > 23 || endHour > 23 || startHour === endHour) return DEFAULT_QUIET_HOURS;
  return { startHour, endHour };
}

/** True quando `now` cai na janela de silêncio (inclui virada de meia-noite). Hora de São Paulo. */
export function isWithinQuietHours(now: Date, quiet: QuietHours): boolean {
  if (!quiet) return false;
  const { hour } = saoPauloParts(now);
  const { startHour, endHour } = quiet;
  return startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
}

/** Próximo fim do silêncio (ex.: 08:00 BRT) estritamente depois de `now`. */
export function nextQuietEnd(now: Date, quiet: QuietHours): Date {
  const endHour = quiet ? quiet.endHour : 8;
  const today = toSaoPauloDateKey(now);
  const at = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return saoPauloLocalToInstant(y, m, d, endHour, 0, 0, 0);
  };
  const candidate = at(today);
  return candidate.getTime() > now.getTime() ? candidate : at(addDaysToDateKey(today, 1));
}

/** Validade máxima de um push adiado (24h), reduzida pelo `expiresAt` do payload quando houver. */
export const DEFERRED_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function deferralExpiry(createdAt: Date, payloadExpiresAt?: string): Date {
  const cap = createdAt.getTime() + DEFERRED_MAX_AGE_MS;
  const own = payloadExpiresAt ? Date.parse(payloadExpiresAt) : NaN;
  return new Date(Number.isFinite(own) ? Math.min(cap, own) : cap);
}

export type DeferredRow = {
  id: string;
  subscriptionId: string;
  tag?: string | null;
  createdAt: Date;
  expiresAt?: Date | null;
};

/**
 * Antes de enviar os adiados: descarta vencidos (expiresAt ou mais de 24h) e, para a mesma
 * `tag` no mesmo dispositivo, mantém só o mais recente (ex.: o último resumo de preços).
 * Itens sem tag nunca colapsam.
 */
export function planDeferredDrain(
  rows: DeferredRow[],
  now: Date,
): { send: DeferredRow[]; expired: DeferredRow[]; superseded: DeferredRow[] } {
  const expired: DeferredRow[] = [];
  const live: DeferredRow[] = [];
  for (const row of rows) {
    const limit = row.expiresAt ? row.expiresAt.getTime() : row.createdAt.getTime() + DEFERRED_MAX_AGE_MS;
    const hardLimit = row.createdAt.getTime() + DEFERRED_MAX_AGE_MS;
    if (now.getTime() >= Math.min(limit, hardLimit)) expired.push(row);
    else live.push(row);
  }
  const latestByKey = new Map<string, DeferredRow>();
  for (const row of live) {
    if (!row.tag) continue;
    const key = `${row.subscriptionId}|${row.tag}`;
    const current = latestByKey.get(key);
    if (!current || row.createdAt.getTime() >= current.createdAt.getTime()) latestByKey.set(key, row);
  }
  const send: DeferredRow[] = [];
  const superseded: DeferredRow[] = [];
  for (const row of live) {
    if (row.tag && latestByKey.get(`${row.subscriptionId}|${row.tag}`) !== row) superseded.push(row);
    else send.push(row);
  }
  send.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return { send, expired, superseded };
}

/** Categorias que respeitam o horário de silêncio; teste e `urgent` passam direto. */
export function respectsQuietHours(category: PushCategory, payload: Pick<PwaPushPayload, 'urgent'>): boolean {
  if (payload.urgent) return false;
  return category !== 'test';
}

export type PushPolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: 'category_disabled' | 'quiet_hours' | 'rate_limited' };

export function decidePushPolicy(input: {
  category: PushCategory;
  payload: Pick<PwaPushPayload, 'urgent'>;
  preferences: Partial<Record<PushCategoryPreferenceField, boolean>> | null;
  now: Date;
  quietHours: QuietHours;
  deliveriesLast24h: number;
  maxPerDay: number;
}): PushPolicyDecision {
  const field = preferenceFieldFor(input.category);
  // Preferência ausente = padrão ligado; só `false` explícito bloqueia (opt-out respeitado).
  if (field && input.preferences?.[field] === false) return { allowed: false, reason: 'category_disabled' };
  if (respectsQuietHours(input.category, input.payload) && isWithinQuietHours(input.now, input.quietHours)) {
    return { allowed: false, reason: 'quiet_hours' };
  }
  if (input.category !== 'test' && input.deliveriesLast24h >= input.maxPerDay) {
    return { allowed: false, reason: 'rate_limited' };
  }
  return { allowed: true };
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export function buildPricingDigestPayload(input: {
  count: number;
  digestId?: string;
  now?: Date;
  /** Evento mais próximo ligado às recomendações: o aviso adiado expira no início dele. */
  event?: PushEventRef | null;
}): PwaPushPayload {
  const count = Math.max(1, Math.floor(input.count));
  const day = toSaoPauloDateKey(input.now ?? new Date());
  return {
    title: plural(count, 'Recomendação de preço para revisar', 'Recomendações de preço para revisar'),
    body:
      count === 1
        ? 'A Urban AI preparou uma recomendação nova para revisar.'
        : `A Urban AI preparou ${count} recomendações para revisar em um só lugar.`,
    url: '/dashboard?source=pwa_push_pricing_digest',
    tag: `pricing-digest-${day}`,
    renotify: true,
    badgeCount: count,
    expiresAt: eventExpiryIso(input.event),
    actions: [
      { action: 'view', title: 'Ver recomendação', url: '/dashboard?source=pwa_push_pricing_digest&action=view' },
      { action: 'later', title: 'Aplicar depois' },
    ],
    data: { type: 'pricing_recommendation_digest', count, digestId: input.digestId },
  };
}

export function buildWeeklySummaryPayload(input: {
  body: string;
  lookaheadDays: number;
  properties: number;
  now?: Date;
}): PwaPushPayload {
  return {
    title: 'Seu resumo semanal',
    body: input.body,
    url: '/painel?source=pwa_push_weekly_report',
    tag: `weekly-event-report-${toSaoPauloDateKey(input.now ?? new Date())}`,
    actions: [{ action: 'view', title: 'Abrir resumo', url: '/painel?source=pwa_push_weekly_report' }],
    data: { type: 'weekly_event_report', lookaheadDays: input.lookaheadDays, properties: input.properties },
  };
}

/** Notificação de sistema (a que já existe em notificações): ganha ações de preço quando a categoria é preço. */
export function buildSystemNotificationPayload(input: {
  title: string;
  body: string;
  url: string;
  tag: string;
  type: string;
  notificationId?: string;
  event?: PushEventRef | null;
}): PwaPushPayload {
  const pricing = pushCategoryFromType(input.type) === 'pricing';
  return {
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.tag,
    expiresAt: eventExpiryIso(input.event),
    ...(pricing
      ? {
          renotify: true,
          actions: [
            { action: 'view', title: 'Ver recomendação', url: input.url },
            { action: 'later', title: 'Aplicar depois' },
          ],
        }
      : {}),
    data: { type: input.type, notificationId: input.notificationId },
  };
}

/** Alerta de evento relevante perto de um imóvel (categoria "eventos"). */
export function buildEventAlertPayload(input: {
  eventName: string;
  neighborhood?: string | null;
  /** Dia do evento, `YYYY-MM-DD` (calendário de São Paulo). */
  startsOn: string;
  /** Início do evento (`dataInicio`, ISO). Sem ele, o aviso vale até o fim do dia `startsOn`. */
  startsAt?: string | Date | null;
  propertyId?: string;
  propertyName?: string | null;
  imageUrl?: string | null;
}): PwaPushPayload {
  const where = input.neighborhood ? ` em ${input.neighborhood}` : '';
  const target = input.propertyId
    ? `/dashboard?propertyId=${encodeURIComponent(input.propertyId)}&source=pwa_push_event`
    : '/dashboard?source=pwa_push_event';
  const [year, month, day] = input.startsOn.split('-');
  const humanDate = year && month && day ? `${day}/${month}` : input.startsOn;
  return {
    title: truncate(`${input.eventName}${where}`, MAX_TITLE),
    body: truncate(
      input.propertyName
        ? `Em ${humanDate}. Veja como isso muda o preço de ${input.propertyName}.`
        : `Em ${humanDate}. Veja como isso muda a demanda e o preço dos seus imóveis.`,
      MAX_BODY,
    ),
    url: target,
    tag: `event-${input.propertyId ?? 'all'}-${input.startsOn}-${slug(input.eventName)}`,
    image: input.imageUrl ?? undefined,
    // Adiado pelo silêncio: vale até o início do evento (ou o fim do dia, se só há a data).
    expiresAt: eventExpiryIso({ startsAt: input.startsAt, startsOn: input.startsOn }),
    actions: [
      { action: 'view', title: 'Ver recomendação', url: target },
      { action: 'later', title: 'Aplicar depois' },
    ],
    data: { type: 'event_alert', propertyId: input.propertyId, startsOn: input.startsOn },
  };
}

/** Normaliza e limita o payload antes de gravar/enviar: tamanhos, ações (máx. 2) e links internos. */
export function normalizePushPayload(payload: PwaPushPayload): PwaPushPayload {
  const actions = (payload.actions?.length ? payload.actions : [{ action: 'open', title: 'Ver' }])
    .filter((item) => item && typeof item.action === 'string' && typeof item.title === 'string')
    .slice(0, MAX_ACTIONS)
    .map((item) => ({
      action: item.action.slice(0, 32),
      title: item.title.slice(0, 40),
      ...(item.url ? { url: normalizeInternalUrl(item.url) } : {}),
    }));
  const badgeCount = Number(payload.badgeCount);
  return {
    title: String(payload.title || 'Urban AI').slice(0, MAX_TITLE),
    body: payload.body ? String(payload.body).slice(0, MAX_BODY) : undefined,
    url: normalizeInternalUrl(payload.url),
    tag: payload.tag ? String(payload.tag).slice(0, 120) : undefined,
    renotify: payload.renotify && payload.tag ? true : undefined,
    icon: payload.icon || '/pwa-icon-192.png',
    badge: payload.badge || '/pwa-badge-96.png',
    image: normalizeImageUrl(payload.image),
    badgeCount: Number.isFinite(badgeCount) && badgeCount >= 0 ? Math.min(Math.floor(badgeCount), 99) : undefined,
    requireInteraction: Boolean(payload.requireInteraction),
    urgent: payload.urgent ? true : undefined,
    expiresAt: payload.expiresAt && Number.isFinite(Date.parse(payload.expiresAt)) ? payload.expiresAt : undefined,
    data: payload.data || {},
    actions,
  };
}

export function normalizeInternalUrl(url?: string): string {
  if (!url) return '/notificacao';
  // "//host" e "/\host" são links protocolo-relativos: não são rotas internas.
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '/notificacao';
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/notificacao';
  } catch {
    return '/notificacao';
  }
}

function normalizeImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return /^https:\/\//i.test(url) ? url : undefined;
}

/** Evento ao qual um aviso está ligado: instante de início (`startsAt`, ISO) e/ou só o dia (`startsOn`). */
export type PushEventRef = { startsAt?: string | Date | null; startsOn?: string | null };

/**
 * Quando um aviso adiado ligado a um evento deixa de valer: no INÍCIO do evento (`startsAt`); se só há
 * o dia, no fim desse dia em São Paulo (23:59:59.999 BRT). Sem referência de evento, undefined
 * (vale só a idade máxima de 24h).
 */
export function eventExpiryIso(event?: PushEventRef | null): string | undefined {
  if (!event) return undefined;
  if (event.startsAt) {
    const ms = event.startsAt instanceof Date ? event.startsAt.getTime() : Date.parse(event.startsAt);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  const match = event.startsOn ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.startsOn) : null;
  if (!match) return undefined;
  return saoPauloLocalToInstant(Number(match[1]), Number(match[2]), Number(match[3]), 23, 59, 59, 999).toISOString();
}

/**
 * Evento de referência de um aviso que cobre vários eventos (ex.: resumo de preços): o que começa
 * primeiro entre os que ainda não começaram, para o aviso adiado expirar naquele instante. Sem nenhum
 * início válido e futuro, undefined (vale só a idade máxima de 24h).
 */
export function nearestUpcomingEventRef(
  startsAt: Array<string | Date | null | undefined>,
  now: Date = new Date(),
): PushEventRef | undefined {
  let best: number | null = null;
  for (const value of startsAt) {
    if (!value) continue;
    const ms = value instanceof Date ? value.getTime() : Date.parse(value);
    if (!Number.isFinite(ms) || ms <= now.getTime()) continue;
    if (best === null || ms < best) best = ms;
  }
  return best === null ? undefined : { startsAt: new Date(best).toISOString() };
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
