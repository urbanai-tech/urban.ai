import type { EventChangeType } from '../entities/event-change-history.entity';
import { saoPauloParts, toSaoPauloDateKey } from '../common/sp-date';

/**
 * Lógica pura (sem I/O) do histórico de eventos: compara o que já temos de um evento com o que a
 * fonte acabou de enviar e decide o que é uma mudança "relevante" (remarcação, venue, URL,
 * cancelamento), além de apontar eventos futuros que sumiram da fonte.
 *
 * Config (env, opcionais — ver docs/runbooks/eventos-historico-mudancas.md):
 *   EVENT_HISTORY_ENABLED             default true   (liga/desliga o registro; nunca bloqueia a ingestão)
 *   EVENT_HISTORY_APPLY_RESCHEDULE    default false  (aplica a nova data no evento; padrão só registra)
 *   EVENT_POSSIBLY_CANCELLED_DAYS     default 7      (dias sem ver um evento futuro na fonte)
 *   EVENT_RESCHEDULE_TOLERANCE_MIN    default 30     (diferença de horário abaixo disso não é remarcação)
 */

export type SourceEventStatus = 'active' | 'cancelled' | 'postponed';

export interface EventHistoryConfig {
  enabled: boolean;
  applyReschedule: boolean;
  possiblyCancelledDays: number;
  rescheduleToleranceMinutes: number;
}

export interface EventSnapshot {
  dataInicio: Date | null;
  /** Venue/endereço já normalizado (EventIdentityService.normalizeVenue). */
  venue: string | null;
  /** URL canônica (EventIdentityService.canonicalizeUrl). */
  url: string | null;
  /** Status declarado pela fonte, quando houver. */
  status: SourceEventStatus | null;
}

export interface DetectedChange {
  type: EventChangeType;
  field: 'dataInicio' | 'venue' | 'url' | 'status' | 'lastSeenAt';
  oldValue: string | null;
  newValue: string | null;
}

function positiveNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readEventHistoryConfig(env: NodeJS.ProcessEnv = process.env): EventHistoryConfig {
  const flag = (raw: string | undefined, fallback: boolean) => {
    const value = raw?.trim().toLowerCase();
    if (value === undefined || value === '') return fallback;
    return !['false', '0', 'no', 'off'].includes(value);
  };
  return {
    enabled: flag(env.EVENT_HISTORY_ENABLED, true),
    applyReschedule: flag(env.EVENT_HISTORY_APPLY_RESCHEDULE, false),
    possiblyCancelledDays: Math.round(positiveNumber(env.EVENT_POSSIBLY_CANCELLED_DAYS, 7)),
    rescheduleToleranceMinutes: positiveNumber(env.EVENT_RESCHEDULE_TOLERANCE_MIN, 30),
  };
}

const CANCELLED_WORDS = ['cancel', 'suspens', 'suspend', 'called off'];
const POSTPONED_WORDS = ['adiad', 'postpon', 'remarc', 'resched'];

/** Mapeia o texto de status da fonte ("Cancelado", "canceled", "Adiado"...) para um status canônico. */
export function normalizeSourceStatus(raw: string | null | undefined): SourceEventStatus | null {
  if (typeof raw !== 'string') return null;
  const text = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  if (!text) return null;
  if (CANCELLED_WORDS.some((w) => text.includes(w))) return 'cancelled';
  if (POSTPONED_WORDS.some((w) => text.includes(w))) return 'postponed';
  return 'active';
}

const isValidDate = (d: Date | null | undefined): d is Date => d instanceof Date && !Number.isNaN(d.getTime());

/** "00:00" em São Paulo: evento de dia inteiro (a fonte não informou horário). */
function isSaoPauloMidnight(date: Date): boolean {
  const p = saoPauloParts(date);
  return p.hour === 0 && p.minute === 0;
}

/**
 * Remarcação: o dia (em SP) mudou, ou o horário mudou além da tolerância. Se a nova data veio sem
 * horário (00:00) e o dia é o mesmo, não é remarcação (a fonte só perdeu a hora).
 */
export function isReschedule(previous: Date | null, incoming: Date | null, toleranceMinutes = 30): boolean {
  if (!isValidDate(previous) || !isValidDate(incoming)) return false;
  if (toSaoPauloDateKey(previous) !== toSaoPauloDateKey(incoming)) return true;
  if (isSaoPauloMidnight(incoming) || isSaoPauloMidnight(previous)) return false;
  return Math.abs(incoming.getTime() - previous.getTime()) >= toleranceMinutes * 60_000;
}

const iso = (d: Date | null) => (isValidDate(d) ? d.toISOString() : null);

export interface DetectOptions {
  rescheduleToleranceMinutes?: number;
  /**
   * Só compara data/venue/URL quando a observação vem da MESMA fonte que já descrevia o evento
   * (fontes diferentes divergem de horário/endereço por natureza e gerariam falso positivo).
   */
  sameSource: boolean;
}

/** Mudanças relevantes entre o que temos (`previous`) e o que a fonte enviou (`incoming`). */
export function detectEventChanges(
  previous: EventSnapshot,
  incoming: EventSnapshot,
  options: DetectOptions,
): DetectedChange[] {
  const changes: DetectedChange[] = [];

  if (options.sameSource) {
    if (isReschedule(previous.dataInicio, incoming.dataInicio, options.rescheduleToleranceMinutes ?? 30)) {
      changes.push({
        type: 'rescheduled',
        field: 'dataInicio',
        oldValue: iso(previous.dataInicio),
        newValue: iso(incoming.dataInicio),
      });
    }
    if (previous.venue && incoming.venue && previous.venue !== incoming.venue) {
      changes.push({ type: 'venue_changed', field: 'venue', oldValue: previous.venue, newValue: incoming.venue });
    }
    if (previous.url && incoming.url && previous.url !== incoming.url) {
      changes.push({ type: 'url_changed', field: 'url', oldValue: previous.url, newValue: incoming.url });
    }
  }

  // Status declarado pela fonte vale de qualquer fonte: cancelamento é cancelamento.
  if (incoming.status && incoming.status !== 'active' && incoming.status !== previous.status) {
    changes.push({
      type: incoming.status === 'cancelled' ? 'cancelled' : 'postponed',
      field: 'status',
      oldValue: previous.status,
      newValue: incoming.status,
    });
  }

  return changes;
}

export interface DisappearanceCandidate {
  eventId: string;
  source: string | null;
  dataInicio: Date;
  lastSeenAt: Date | null;
}

/**
 * Eventos futuros que a fonte parou de enviar há `days` dias ou mais viram "possivelmente
 * cancelado". Duas salvaguardas contra falso positivo:
 *  - fonte ignorada (curadoria manual, evento anual) nunca é marcada;
 *  - se a PRÓPRIA fonte ficou muda (nenhum item visto nos últimos `days` dias), o sumiço é falha do
 *    coletor (cabe ao zero-yield), não cancelamento do evento.
 */
export function selectPossiblyCancelled(
  candidates: DisappearanceCandidate[],
  sourceLastSeen: Map<string, Date>,
  now: Date,
  days: number,
  isIgnored: (source: string) => boolean,
): DisappearanceCandidate[] {
  const cutoff = now.getTime() - days * 86_400_000;
  return candidates.filter((c) => {
    if (!c.source || isIgnored(c.source)) return false;
    if (!isValidDate(c.dataInicio) || c.dataInicio.getTime() <= now.getTime()) return false;
    if (!isValidDate(c.lastSeenAt) || c.lastSeenAt.getTime() >= cutoff) return false;
    const sourceLast = sourceLastSeen.get(c.source);
    return Boolean(sourceLast && sourceLast.getTime() >= cutoff);
  });
}
