import { normalizeEventDates, toSaoPauloDateKey } from '../common/sp-date';
import { EventDedupCandidate } from '../entities/event-dedup-candidate.entity';
import { dedupHashByAddress, dedupHashByGeo } from './event-dedup-hash';

/**
 * Lógica pura do backfill de datas de eventos (D3). Usada por
 * `scripts/backfill-event-dates-sp.ts` (que cuida de I/O) e testada em
 * `event-date-backfill.spec.ts`.
 *
 * Recalcula o início/fim que a política nova (ver docs/runbooks/datas-e-fuso-horario.md)
 * produziria a partir do payload ORIGINAL guardado em `event_sources.rawPayload`
 * e compara com o que está gravado em `events`.
 */

export type DateBackfillClass =
  | 'unchanged'
  | 'instant_shift' // instante muda, mas o dia de São Paulo permanece
  | 'day_shift' // o dia de calendário de São Paulo muda (o caso que quebra preço/recomendação)
  | 'no_raw_payload'
  | 'unparseable';

export interface DateBackfillInput {
  storedStart: Date;
  storedEnd: Date | null;
  source: string | null;
  rawStart: unknown;
  rawEnd: unknown;
  /**
   * Fontes cujos datetimes SEM offset, no payload legado, eram UTC (ex.:
   * `api-football` antes da correção do coletor). Para elas o texto naive é
   * lido como UTC em vez de horário de São Paulo.
   */
  utcNaiveSources?: readonly string[];
}

export interface DateBackfillDecision {
  classification: DateBackfillClass;
  expectedStart?: Date;
  expectedEnd?: Date;
  storedDayKey?: string;
  expectedDayKey?: string;
}

const NAIVE_RE = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/;
const HAS_OFFSET_RE = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/;

function asLegacyUtc(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  return NAIVE_RE.test(raw) && !HAS_OFFSET_RE.test(raw) ? `${raw.replace(' ', 'T')}Z` : value;
}

export function classifyEventDateBackfill(input: DateBackfillInput): DateBackfillDecision {
  if (input.rawStart === undefined || input.rawStart === null || input.rawStart === '') {
    return { classification: 'no_raw_payload' };
  }
  const utcNaive = Boolean(input.source && input.utcNaiveSources?.includes(input.source));
  const rawStart = utcNaive ? asLegacyUtc(input.rawStart) : input.rawStart;
  const rawEnd = utcNaive ? asLegacyUtc(input.rawEnd) : input.rawEnd;

  const normalized = normalizeEventDates(rawStart as string | Date, (rawEnd ?? null) as string | Date | null);
  if (!normalized) return { classification: 'unparseable' };

  const storedDayKey = toSaoPauloDateKey(input.storedStart);
  const expectedDayKey = toSaoPauloDateKey(normalized.dataInicio);
  const startSame = input.storedStart.getTime() === normalized.dataInicio.getTime();
  const endSame = !input.storedEnd || input.storedEnd.getTime() === normalized.dataFim.getTime();

  const base = {
    expectedStart: normalized.dataInicio,
    expectedEnd: normalized.dataFim,
    storedDayKey,
    expectedDayKey,
  };
  if (startSame && endSame) return { classification: 'unchanged', ...base };
  if (storedDayKey !== expectedDayKey) return { classification: 'day_shift', ...base };
  return { classification: 'instant_shift', ...base };
}

// ---------------------------------------------------------------------------
// Recomputo do dedupHash (D3)
// ---------------------------------------------------------------------------

export type HashRecomputeAction =
  | 'no_hash' // evento legado sem dedupHash: nada a recomputar
  | 'day_unchanged' // o dia de SP não muda: o hash continua válido
  | 'already_current' // o hash gravado já é o que a fórmula nova produziria
  | 'update' // novo hash livre: pode ser gravado junto com as datas
  | 'collision'; // novo hash já pertence a outro evento: NÃO sobrescrever

export type HashVariant = 'geo' | 'address';

export interface HashRecomputeEvent {
  id: string;
  nome: string;
  enderecoCompleto: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  dedupHash: string | null;
  storedStart: Date;
}

export interface HashRecomputeInput {
  event: HashRecomputeEvent;
  expectedStart: Date;
  /**
   * Id do evento que já detém o hash novo (consulta ao banco), se houver.
   * Ignorado quando é o próprio evento.
   */
  holderEventId?: string | null;
  /**
   * Hashes novos já reservados por outros eventos NESTA execução
   * (hash -> id do evento), para detectar colisão entre dois eventos corrigidos.
   */
  plannedHashes?: ReadonlyMap<string, string>;
}

export interface HashRecomputeDecision {
  action: HashRecomputeAction;
  variant?: HashVariant;
  oldHash?: string | null;
  newHash?: string;
  /** Evento que já tem o hash novo (quando action = 'collision'). */
  holderEventId?: string;
}

function hasUsableGeo(lat: number | string | null, lng: number | string | null): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hashFor(variant: HashVariant, event: HashRecomputeEvent, dayKey: string): string {
  return variant === 'geo'
    ? dedupHashByGeo(event.nome, dayKey, Number(event.latitude), Number(event.longitude))
    : dedupHashByAddress(event.nome, dayKey, event.enderecoCompleto ?? '');
}

/**
 * Descobre qual fórmula gerou o hash gravado. O hash legado pode ter sido
 * calculado com o dia UTC ou com o dia de SP do instante gravado, e por geo ou
 * por endereço (eventos ingeridos sem geocoding congelam o hash by-address).
 * Sem correspondência, escolhe geo se há coordenadas, senão endereço.
 */
export function detectHashVariant(event: HashRecomputeEvent): HashVariant {
  if (event.dedupHash) {
    const days = [utcDayKey(event.storedStart), toSaoPauloDateKey(event.storedStart)];
    for (const variant of ['geo', 'address'] as HashVariant[]) {
      if (variant === 'geo' && !hasUsableGeo(event.latitude, event.longitude)) continue;
      if (days.some((day) => hashFor(variant, event, day) === event.dedupHash)) return variant;
    }
  }
  return hasUsableGeo(event.latitude, event.longitude) ? 'geo' : 'address';
}

/**
 * Decide o que fazer com o `dedupHash` de um evento cuja data foi corrigida.
 * Mesma fórmula do ingest (`event-dedup-hash.ts`) com o dia de SP novo. Nunca
 * sobrescreve um hash que outro evento já usa (índice UNIQUE): devolve
 * `collision` para o chamador registrar um `EventDedupCandidate`.
 */
export function planDedupHashRecompute(input: HashRecomputeInput): HashRecomputeDecision {
  const { event } = input;
  if (!event.dedupHash) return { action: 'no_hash', oldHash: null };

  const storedDay = toSaoPauloDateKey(event.storedStart);
  const expectedDay = toSaoPauloDateKey(input.expectedStart);
  if (storedDay === expectedDay) return { action: 'day_unchanged', oldHash: event.dedupHash };

  const variant = detectHashVariant(event);
  const newHash = hashFor(variant, event, expectedDay);
  if (newHash === event.dedupHash) return { action: 'already_current', variant, oldHash: event.dedupHash, newHash };

  const holder =
    (input.holderEventId && input.holderEventId !== event.id ? input.holderEventId : null) ??
    (input.plannedHashes?.get(newHash) && input.plannedHashes.get(newHash) !== event.id
      ? input.plannedHashes.get(newHash)!
      : null);
  if (holder) return { action: 'collision', variant, oldHash: event.dedupHash, newHash, holderEventId: holder };

  return { action: 'update', variant, oldHash: event.dedupHash, newHash };
}

export const BACKFILL_COLLISION_REASON = 'date_backfill_hash_collision';
export const BACKFILL_CANDIDATE_SOURCE = 'date_backfill';

/** Subconjunto do repositório de candidatos usado aqui (facilita o teste). */
export interface DedupCandidateRepoLike {
  findOne(options: unknown): Promise<{ id: string; status: string } | null>;
  create(data: Partial<EventDedupCandidate>): EventDedupCandidate;
  save(entity: EventDedupCandidate): Promise<unknown>;
}

/**
 * Registra para revisão do admin que dois eventos viraram o mesmo evento depois
 * da correção de fuso: `canonical` é quem já tem o hash; `duplicate` é o evento
 * corrigido. Idempotente (par único, em qualquer direção) e respeita decisões
 * já tomadas (`approved`/`rejected`). Devolve o que aconteceu.
 */
export async function recordBackfillHashCollision(
  repo: DedupCandidateRepoLike,
  canonicalEventId: string,
  duplicateEventId: string,
): Promise<'created' | 'existing'> {
  const existing = await repo.findOne({
    where: [
      { canonicalEventId, duplicateEventId },
      { canonicalEventId: duplicateEventId, duplicateEventId: canonicalEventId },
    ],
  });
  if (existing) return 'existing';

  await repo.save(
    repo.create({
      canonicalEventId,
      duplicateEventId,
      status: 'pending',
      confidenceBand: 'high',
      score: 1,
      reason: BACKFILL_COLLISION_REASON,
      signals: { date: 1, name: 1, hash: 1 },
      source: BACKFILL_CANDIDATE_SOURCE,
      sourceId: null,
    }),
  );
  return 'created';
}
