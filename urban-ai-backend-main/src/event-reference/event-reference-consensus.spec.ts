import { EventIdentityService } from '../evento/event-identity.service';
import {
  canAutoDecide,
  clusterObservations,
  decideReference,
  type ConsensusOptions,
  type Observation,
  type VoteLike,
} from './event-reference-consensus';

const identity = new EventIdentityService();
const opts: ConsensusOptions = { minAgree: 2, nameSimilarity: 0.7, divergenceDays: 3 };

const obs = (over: Partial<Observation>): Observation => ({
  validatorKey: 'web:sympla.com.br',
  validatorKind: 'tavily',
  sourceUrl: 'https://sympla.com.br/e/1',
  extractor: 'gemini',
  name: 'Palmeiras x Corinthians',
  dateKey: '2026-11-10',
  time: null,
  venueKey: 'allianz-parque',
  venueName: 'Allianz Parque',
  category: null,
  size: 'grande',
  snippet: null,
  ...over,
});

const vote = (key: string, kind: VoteLike['validatorKind'] = 'tavily', verdict: VoteLike['verdict'] = 'support'): VoteLike => ({
  validatorKey: key,
  validatorKind: kind,
  verdict,
});

const ref = { name: 'Palmeiras x Corinthians', dateKey: '2026-11-10', venueKey: 'allianz-parque' as string | null };

describe('clusterObservations', () => {
  it('junta nome parecido no mesmo dia e venue; separa dia, venue ou nome diferentes', () => {
    const clusters = clusterObservations(
      [
        obs({}),
        obs({ validatorKey: 'web:ingresso.com', name: 'PALMEIRAS X CORINTHIANS - Allianz Parque' }),
        obs({ validatorKey: 'web:a.com', dateKey: '2026-11-11' }),
        obs({ validatorKey: 'web:b.com', venueKey: 'morumbis', venueName: 'Morumbi' }),
        obs({ validatorKey: 'web:c.com', name: 'Festival Totalmente Diferente' }),
      ],
      identity,
      0.7,
    );
    expect(clusters).toHaveLength(4);
    expect(clusters[0].observations).toHaveLength(2);
  });
});

describe('decideReference — regra de consenso', () => {
  it('aprova com 2 fontes independentes (1 externa)', () => {
    const d = decideReference({ ref, votes: [vote('web:sympla.com.br'), vote('db:spider-x', 'events_db')], siblings: [] }, identity, opts);
    expect(d.status).toBe('aprovado');
    expect(d.independentSources).toBe(2);
    expect(d.webSources).toBe(1);
  });

  it('duas páginas do mesmo site contam uma vez só (mesma chave)', () => {
    const d = decideReference(
      { ref, votes: [vote('web:sympla.com.br'), { ...vote('web:sympla.com.br', 'firecrawl') }], siblings: [] },
      identity,
      opts,
    );
    expect(d.independentSources).toBe(1);
    expect(d.status).toBe('candidato');
  });

  it('só o banco de eventos não aprova (evita recall circular)', () => {
    const d = decideReference(
      { ref, votes: [vote('db:a', 'events_db'), vote('db:b', 'events_db')], siblings: [] },
      identity,
      opts,
    );
    expect(d.status).toBe('candidato');
    expect(d.reason).toMatch(/falta uma fonte externa/);
  });

  it('uma fonte só fica candidato; sem votos, sem evidência', () => {
    expect(decideReference({ ref, votes: [vote('web:a.com')], siblings: [] }, identity, opts).status).toBe('candidato');
    expect(decideReference({ ref, votes: [], siblings: [] }, identity, opts).reason).toBe('sem evidência');
  });

  it('divergência de data com referência do mesmo evento vira conflito, mesmo com consenso', () => {
    const d = decideReference(
      {
        ref,
        votes: [vote('web:a.com'), vote('web:b.com')],
        siblings: [{ id: 's1', name: 'Palmeiras x Corinthians', dateKey: '2026-11-11', venueKey: 'allianz-parque', status: 'candidato' }],
      },
      identity,
      opts,
    );
    expect(d.status).toBe('conflito');
    expect(d.reason).toMatch(/divergência de data/);
  });

  it('ignora irmãs rejeitadas, de outro venue, de outro nome ou a mais de 3 dias', () => {
    const base = { id: 's', name: 'Palmeiras x Corinthians', dateKey: '2026-11-11', venueKey: 'allianz-parque', status: 'candidato' as const };
    const siblings = [
      { ...base, status: 'rejeitado' as const },
      { ...base, venueKey: 'morumbis' },
      { ...base, name: 'Show Qualquer Outro' },
      { ...base, dateKey: '2026-11-20' },
      { ...base, dateKey: '2026-11-10' }, // mesma data não é divergência
    ];
    const d = decideReference({ ref, votes: [vote('web:a.com'), vote('web:b.com')], siblings }, identity, opts);
    expect(d.status).toBe('aprovado');
  });

  it('o juiz independente que rejeita derruba a aprovação para conflito; confirmar não muda nada', () => {
    const votes = [vote('web:a.com'), vote('web:b.com')];
    expect(decideReference({ ref, votes: [...votes, vote('judge:anthropic', 'judge', 'reject')], siblings: [] }, identity, opts).status).toBe('conflito');
    const ok = decideReference({ ref, votes: [...votes, vote('judge:anthropic', 'judge', 'confirm')], siblings: [] }, identity, opts);
    expect(ok.status).toBe('aprovado');
    expect(ok.judge).toBe('confirm');
    // O juiz sozinho nunca aprova.
    expect(decideReference({ ref, votes: [vote('judge:anthropic', 'judge', 'confirm')], siblings: [] }, identity, opts).status).toBe('candidato');
  });

  it('respeita minAgree maior', () => {
    const d = decideReference({ ref, votes: [vote('web:a.com'), vote('web:b.com')], siblings: [] }, identity, { ...opts, minAgree: 3 });
    expect(d.status).toBe('candidato');
  });
});

describe('canAutoDecide', () => {
  it('não mexe em decisão humana nem em rejeição', () => {
    expect(canAutoDecide({ status: 'candidato', approvedBy: null })).toBe(true);
    expect(canAutoDecide({ status: 'conflito', approvedBy: null })).toBe(true);
    expect(canAutoDecide({ status: 'aprovado', approvedBy: 'auto-consenso' })).toBe(true);
    expect(canAutoDecide({ status: 'aprovado', approvedBy: 'user-1' })).toBe(false);
    expect(canAutoDecide({ status: 'rejeitado', approvedBy: null })).toBe(false);
  });
});
