import { dayDiff, type IdentityLike } from './event-reference-normalize';
import type { EventReferenceStatus, EventReferenceSize } from '../entities/event-reference.entity';
import type {
  EventReferenceExtractor,
  EventReferenceValidatorKind,
  EventReferenceVerdict,
} from '../entities/event-reference-vote.entity';

/**
 * Regra de consenso da curadoria (ADR 0026), pura e sem I/O.
 *
 * Um "validador" é uma fonte independente: `web:<domínio>` (várias páginas do mesmo site contam
 * uma vez) ou `db:<fonte>` (um coletor do banco). Aprovação automática exige:
 *   - >= `minAgree` validadores independentes concordando em nome + data + venue;
 *   - pelo menos um deles externo (web): o banco sozinho não aprova, para o recall não virar
 *     circular (o banco "confirmando" a si mesmo);
 *   - nenhuma divergência de data com outra referência do mesmo evento/venue;
 *   - o juiz independente (se existir) não rejeitar.
 * Divergência ou rejeição do juiz -> `conflito` (fila humana). O resto fica `candidato`.
 */

export interface Observation {
  /** Chave de independência (`web:dominio` | `db:fonte`). */
  validatorKey: string;
  validatorKind: Exclude<EventReferenceValidatorKind, 'judge'>;
  sourceUrl: string | null;
  extractor: EventReferenceExtractor;
  name: string;
  dateKey: string;
  time: string | null;
  venueKey: string;
  venueName: string;
  category: string | null;
  size: EventReferenceSize;
  snippet: string | null;
}

export interface ObservationCluster {
  name: string;
  dateKey: string;
  time: string | null;
  venueKey: string;
  venueName: string;
  category: string | null;
  size: EventReferenceSize;
  observations: Observation[];
}

/** Agrupa observações do mesmo evento (mesmo venue, mesmo dia, nome parecido). */
export function clusterObservations(
  observations: Observation[],
  identity: Pick<IdentityLike, 'tokenSetSimilarity'>,
  nameSimilarity: number,
): ObservationCluster[] {
  const clusters: ObservationCluster[] = [];
  for (const obs of observations) {
    const home = clusters.find(
      (c) =>
        c.venueKey === obs.venueKey &&
        c.dateKey === obs.dateKey &&
        identity.tokenSetSimilarity(c.name, obs.name) >= nameSimilarity,
    );
    if (home) {
      home.observations.push(obs);
      if (!home.time && obs.time) home.time = obs.time;
      if (!home.category && obs.category) home.category = obs.category;
      // Nome de exibição: o mais curto entre os que concordam costuma ser o mais limpo.
      if (obs.name.length < home.name.length && obs.name.length >= 3) home.name = obs.name;
      continue;
    }
    clusters.push({
      name: obs.name,
      dateKey: obs.dateKey,
      time: obs.time,
      venueKey: obs.venueKey,
      venueName: obs.venueName,
      category: obs.category,
      size: obs.size,
      observations: [obs],
    });
  }
  return clusters;
}

export interface VoteLike {
  validatorKey: string;
  validatorKind: EventReferenceValidatorKind;
  verdict: EventReferenceVerdict;
}

export interface SiblingLike {
  id: string;
  name: string;
  dateKey: string;
  venueKey: string | null;
  status: EventReferenceStatus;
}

export interface ConsensusOptions {
  minAgree: number;
  nameSimilarity: number;
  divergenceDays: number;
}

export interface ReferenceDecision {
  status: Extract<EventReferenceStatus, 'aprovado' | 'candidato' | 'conflito'>;
  reason: string;
  independentSources: number;
  webSources: number;
  judge: 'confirm' | 'reject' | 'unsure' | null;
}

export function decideReference(
  input: {
    ref: { name: string; dateKey: string; venueKey: string | null };
    votes: VoteLike[];
    siblings: SiblingLike[];
  },
  identity: Pick<IdentityLike, 'tokenSetSimilarity'>,
  opts: ConsensusOptions,
): ReferenceDecision {
  const supporters = new Map<string, VoteLike>();
  for (const vote of input.votes) {
    if (vote.verdict === 'support' && !supporters.has(vote.validatorKey)) supporters.set(vote.validatorKey, vote);
  }
  const independentSources = supporters.size;
  const webSources = [...supporters.values()].filter((v) => v.validatorKind !== 'events_db').length;
  const judgeVote = input.votes.find((v) => v.validatorKind === 'judge');
  const judge = judgeVote && judgeVote.verdict !== 'support' ? (judgeVote.verdict as ReferenceDecision['judge']) : null;
  const base = { independentSources, webSources, judge };

  const divergent = input.siblings.find((s) => {
    if (s.status === 'rejeitado') return false;
    if (!input.ref.venueKey || s.venueKey !== input.ref.venueKey) return false;
    const diff = Math.abs(dayDiff(s.dateKey, input.ref.dateKey));
    if (diff < 1 || diff > opts.divergenceDays) return false;
    return identity.tokenSetSimilarity(s.name, input.ref.name) >= opts.nameSimilarity;
  });
  if (divergent) {
    return {
      ...base,
      status: 'conflito',
      reason: `divergência de data com "${divergent.name}" (${divergent.dateKey})`,
    };
  }

  if (judge === 'reject') {
    return { ...base, status: 'conflito', reason: 'o juiz independente rejeitou a referência' };
  }

  if (independentSources >= opts.minAgree && webSources >= 1) {
    return {
      ...base,
      status: 'aprovado',
      reason: `consenso de ${independentSources} fontes independentes`,
    };
  }

  let reason: string;
  if (independentSources === 0) reason = 'sem evidência';
  else if (independentSources >= opts.minAgree) reason = 'só o banco de eventos concorda; falta uma fonte externa';
  else reason = `apenas ${independentSources} fonte independente (mínimo ${opts.minAgree})`;
  return { ...base, status: 'candidato', reason };
}

/** Só decisões automáticas podem ser reavaliadas; decisão humana e rejeição ficam como estão. */
export function canAutoDecide(ref: { status: EventReferenceStatus; approvedBy: string | null; origin?: string }): boolean {
  if (ref.status === 'rejeitado') return false;
  if (ref.status === 'aprovado') return ref.approvedBy === 'auto-consenso';
  return true;
}
