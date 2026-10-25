import { toSaoPauloDateKey } from '../common/sp-date';
import { dedupHashByAddress, dedupHashByGeo } from './event-dedup-hash';
import {
  BACKFILL_CANDIDATE_SOURCE,
  BACKFILL_COLLISION_REASON,
  detectHashVariant,
  HashRecomputeEvent,
  planDedupHashRecompute,
  recordBackfillHashCollision,
} from './event-date-backfill';

const d = (iso: string) => new Date(iso);

// Jogo às 21:30 BRT de 10/05 = 00:30Z de 11/05. O legado gravou 21:30Z de 10/05 (naive lido como UTC)
// e o hash antigo foi calculado com o dia do instante gravado (10/05 em UTC e em SP).
// Aqui o caso que MUDA o dia: wall 02:00 BRT de 10/05 gravado como 02:00Z (dia SP = 09/05, errado).
const baseEvent = (over: Partial<HashRecomputeEvent> = {}): HashRecomputeEvent => ({
  id: 'ev-1',
  nome: 'Show X',
  enderecoCompleto: 'Av. Paulista, 1000',
  latitude: -23.5614,
  longitude: -46.6559,
  storedStart: d('2026-05-10T02:00:00Z'), // dia SP gravado = 09/05
  dedupHash: dedupHashByGeo('Show X', '2026-05-09', -23.5614, -46.6559),
  ...over,
});
const expectedStart = d('2026-05-10T05:00:00Z'); // 02:00 BRT de 10/05

describe('event-dedup-hash', () => {
  it('é a mesma fórmula do ingest (nome|dia|geo arredondado) e normaliza espaços/caixa', () => {
    expect(dedupHashByGeo('  Show   X ', '2026-05-10', -23.56141, -46.65591)).toBe(
      dedupHashByGeo('show x', '2026-05-10', -23.5614, -46.6559),
    );
    expect(dedupHashByAddress('Show X', '2026-05-10', ' AV. Paulista,  1000 ')).toBe(
      dedupHashByAddress('show x', '2026-05-10', 'av. paulista, 1000'),
    );
  });

  it('21:30 BRT (00:30Z) e 21:30 em dia SP geram o mesmo hash', () => {
    const a = dedupHashByGeo('Jogo', toSaoPauloDateKey(d('2026-05-11T00:30:00Z')), -23.5, -46.6);
    const b = dedupHashByGeo('Jogo', toSaoPauloDateKey(d('2026-05-10T21:30:00-03:00')), -23.5, -46.6);
    expect(a).toBe(b);
  });
});

describe('detectHashVariant', () => {
  it('reconhece hash by-geo e by-address gravados com o dia gravado', () => {
    expect(detectHashVariant(baseEvent())).toBe('geo');
    expect(
      detectHashVariant(
        baseEvent({ dedupHash: dedupHashByAddress('Show X', '2026-05-09', 'Av. Paulista, 1000') }),
      ),
    ).toBe('address');
  });

  it('reconhece hash legado calculado com o dia UTC (21:30 BRT gravado 00:30Z: UTC=11, SP=10)', () => {
    const event = baseEvent({
      storedStart: d('2026-05-11T00:30:00Z'),
      dedupHash: dedupHashByAddress('Show X', '2026-05-11', 'Av. Paulista, 1000'),
    });
    expect(detectHashVariant(event)).toBe('address');
  });

  it('sem correspondência: geo se há coordenadas, senão endereço', () => {
    expect(detectHashVariant(baseEvent({ dedupHash: 'x'.repeat(64) }))).toBe('geo');
    expect(detectHashVariant(baseEvent({ dedupHash: 'x'.repeat(64), latitude: null, longitude: null }))).toBe('address');
  });
});

describe('planDedupHashRecompute', () => {
  it('recalcula o hash com o novo dia de SP quando o dia muda e o hash novo está livre', () => {
    const r = planDedupHashRecompute({ event: baseEvent(), expectedStart });
    expect(r.action).toBe('update');
    expect(r.variant).toBe('geo');
    expect(r.newHash).toBe(dedupHashByGeo('Show X', '2026-05-10', -23.5614, -46.6559));
    expect(r.newHash).not.toBe(r.oldHash);
  });

  it('o hash novo é o que o ingest produziria para o instante corrigido', () => {
    const r = planDedupHashRecompute({ event: baseEvent(), expectedStart });
    const ingest = dedupHashByGeo('Show X', toSaoPauloDateKey(expectedStart), -23.5614, -46.6559);
    expect(r.newHash).toBe(ingest);
  });

  it('mantém a variante by-address (evento sem geocoding congelado no hash por endereço)', () => {
    const event = baseEvent({ dedupHash: dedupHashByAddress('Show X', '2026-05-09', 'Av. Paulista, 1000') });
    const r = planDedupHashRecompute({ event, expectedStart });
    expect(r.variant).toBe('address');
    expect(r.newHash).toBe(dedupHashByAddress('Show X', '2026-05-10', 'Av. Paulista, 1000'));
  });

  it('não mexe quando o dia de SP não muda (só o horário)', () => {
    const r = planDedupHashRecompute({
      event: baseEvent({ storedStart: d('2026-05-10T21:30:00Z') }), // 18:30 BRT de 10/05
      expectedStart: d('2026-05-11T00:30:00Z'), // 21:30 BRT de 10/05
    });
    expect(r.action).toBe('day_unchanged');
    expect(r.newHash).toBeUndefined();
  });

  it('evento legado sem dedupHash não ganha hash', () => {
    expect(planDedupHashRecompute({ event: baseEvent({ dedupHash: null }), expectedStart }).action).toBe('no_hash');
  });

  it('COLISÃO com evento existente no banco: não sobrescreve e devolve o dono do hash', () => {
    const r = planDedupHashRecompute({ event: baseEvent(), expectedStart, holderEventId: 'ev-other' });
    expect(r.action).toBe('collision');
    expect(r.holderEventId).toBe('ev-other');
    expect(r.newHash).toBe(dedupHashByGeo('Show X', '2026-05-10', -23.5614, -46.6559));
  });

  it('COLISÃO entre dois eventos corrigidos na mesma execução (hash já reservado)', () => {
    const first = planDedupHashRecompute({ event: baseEvent({ id: 'ev-1' }), expectedStart });
    const planned = new Map([[first.newHash!, 'ev-1']]);
    const second = planDedupHashRecompute({
      event: baseEvent({ id: 'ev-2', dedupHash: dedupHashByGeo('Show X', '2026-05-08', -23.5614, -46.6559) }),
      expectedStart,
      plannedHashes: planned,
    });
    expect(second.action).toBe('collision');
    expect(second.holderEventId).toBe('ev-1');
  });

  it('o próprio evento como dono do hash não é colisão', () => {
    const r = planDedupHashRecompute({ event: baseEvent(), expectedStart, holderEventId: 'ev-1' });
    expect(r.action).toBe('update');
  });
});

describe('recordBackfillHashCollision', () => {
  const makeRepo = (existing: any = null) => ({
    findOne: jest.fn().mockResolvedValue(existing),
    create: jest.fn((v) => v),
    save: jest.fn().mockResolvedValue(undefined),
  });

  it('cria candidato pendente (canônico = dono do hash, duplicata = evento corrigido)', async () => {
    const repo = makeRepo();
    await expect(recordBackfillHashCollision(repo as any, 'ev-other', 'ev-1')).resolves.toBe('created');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalEventId: 'ev-other',
        duplicateEventId: 'ev-1',
        status: 'pending',
        confidenceBand: 'high',
        reason: BACKFILL_COLLISION_REASON,
        source: BACKFILL_CANDIDATE_SOURCE,
      }),
    );
    // procura o par nas duas direções (índice único)
    expect(repo.findOne.mock.calls[0][0].where).toEqual([
      { canonicalEventId: 'ev-other', duplicateEventId: 'ev-1' },
      { canonicalEventId: 'ev-1', duplicateEventId: 'ev-other' },
    ]);
  });

  it('é idempotente: par já existente (qualquer status) não é recriado nem reaberto', async () => {
    const repo = makeRepo({ id: 'c1', status: 'rejected' });
    await expect(recordBackfillHashCollision(repo as any, 'ev-other', 'ev-1')).resolves.toBe('existing');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
