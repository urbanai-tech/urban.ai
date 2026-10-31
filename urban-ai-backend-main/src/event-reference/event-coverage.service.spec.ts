import * as Sentry from '@sentry/nestjs';
import { EventIdentityService } from '../evento/event-identity.service';
import { EventCoverageService } from './event-coverage.service';
import { FakeRepo } from './fake-repo.testkit';
import { referenceFingerprint } from './event-reference-normalize';

jest.mock('@sentry/nestjs', () => ({ captureMessage: jest.fn() }));

const identity = new EventIdentityService();
const NOW = new Date('2026-11-20T15:00:00.000Z'); // 2026-11-20 em São Paulo

const ENV = ['EVENT_COVERAGE_RECALL_FLOOR_PCT', 'EVENT_COVERAGE_ALERT_MIN_SAMPLE', 'ADMIN_ALERT_EMAIL', 'OPS_ALERT_EMAIL'];
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {};
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  (Sentry.captureMessage as jest.Mock).mockClear();
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const ref = (over: Record<string, any>) => {
  const name = over.name ?? 'Palmeiras x Corinthians';
  const dateKey = over.dateKey ?? '2026-11-10';
  const venueName = over.venueName ?? 'Allianz Parque';
  return {
    name,
    normalizedName: identity.normalizeText(name),
    venueKey: 'allianz-parque',
    venueName,
    normalizedVenue: identity.normalizeVenue(venueName),
    dateKey,
    category: 'esporte',
    size: 'grande',
    status: 'aprovado',
    origin: 'csv',
    approvedBy: 'user-1',
    matchedEventId: null,
    matchedAt: null,
    fingerprint: referenceFingerprint(identity, { name, dateKey, venue: venueName }),
    ...over,
  };
};

const ev = (id: string, nome: string, iso: string, over: Record<string, any> = {}) => ({
  id,
  nome,
  dataInicio: new Date(iso),
  venueName: 'Allianz Parque',
  normalizedVenue: 'allianz parque',
  categoria: 'esporte',
  outOfScope: false,
  dedupStatus: 'canonical',
  ...over,
});

function build(opts: { refs?: any[]; events?: any[]; votes?: any[]; mailer?: any } = {}) {
  const refRepo = new FakeRepo<any>();
  const voteRepo = new FakeRepo<any>();
  const snapshotRepo = new FakeRepo<any>();
  const eventRepo = new FakeRepo<any>();
  refRepo.rows = (opts.refs ?? []).map((r, i) => ({ id: r.id ?? `ref-${i}`, ...r }));
  voteRepo.rows = opts.votes ?? [];
  eventRepo.rows = opts.events ?? [];
  // Contagem de votos externos a favor, como a query agregada do serviço faz no MySQL.
  (voteRepo as any).createQueryBuilder = () => {
    const builder: any = {
      select: () => builder,
      addSelect: () => builder,
      where: () => builder,
      andWhere: () => builder,
      groupBy: () => builder,
      getRawMany: async () => {
        const totals = new Map<string, number>();
        for (const v of voteRepo.rows) {
          if (v.verdict === 'support' && v.validatorKind !== 'events_db') totals.set(v.referenceId, (totals.get(v.referenceId) ?? 0) + 1);
        }
        return [...totals.entries()].map(([referenceId, total]) => ({ referenceId, total }));
      },
    };
    return builder;
  };
  const service = new EventCoverageService(
    refRepo as any,
    voteRepo as any,
    snapshotRepo as any,
    eventRepo as any,
    identity,
    opts.mailer,
  );
  return { service, refRepo, snapshotRepo, voteRepo };
}

describe('casamento referência × banco + snapshot diário', () => {
  it('casa as referências aprovadas e calcula recall dos últimos 30 dias por porte e venue', async () => {
    const { service, refRepo, snapshotRepo } = build({
      refs: [
        ref({ id: 'a', name: 'Palmeiras x Corinthians', dateKey: '2026-11-10' }),
        ref({ id: 'b', name: 'Festival Fantasma', dateKey: '2026-11-12' }), // sem evento no banco
        ref({ id: 'c', name: 'Show Medio', dateKey: '2026-11-15', size: 'medio', venueKey: 'audio', venueName: 'Audio', category: 'show' }),
        ref({ id: 'd', name: 'Ainda Candidato', dateKey: '2026-11-11', status: 'candidato' }), // não entra
      ],
      events: [
        ev('e-a', 'Palmeiras x Corinthians - Brasileirão', '2026-11-10T22:00:00.000Z'),
        ev('e-c', 'Show Medio', '2026-11-15T23:00:00.000Z', { venueName: 'Audio', normalizedVenue: 'audio', categoria: 'show' }),
      ],
    });

    const result = await service.runMatchAndMetrics(NOW);

    expect(result).toMatchObject({ snapshotDate: '2026-11-20', referencesChecked: 3, matched: 2, unmatched: 1, newlyMatched: 2 });
    expect(result.recallPast30Pct).toBe(66.67);
    expect(refRepo.rows.find((r) => r.id === 'a')).toMatchObject({ matchedEventId: 'e-a' });
    expect(refRepo.rows.find((r) => r.id === 'b').matchedEventId).toBeNull();

    const row = (scope: string, dimension: string, value: string) =>
      snapshotRepo.rows.find((r) => r.scope === scope && r.dimension === dimension && r.dimensionValue === value);
    expect(row('past30', 'total', 'all')).toMatchObject({ referenceTotal: 3, referenceMatched: 2, recallPct: 66.67 });
    expect(row('past30', 'size', 'grande')).toMatchObject({ referenceTotal: 2, referenceMatched: 1, recallPct: 50 });
    expect(row('past30', 'venue', 'audio')).toMatchObject({ recallPct: 100 });
    expect(row('past30', 'category', 'show')).toBeTruthy();
  });

  it('é idempotente por dia: reexecutar reescreve o snapshot sem duplicar linhas', async () => {
    const { service, snapshotRepo } = build({
      refs: [ref({ id: 'a' })],
      events: [ev('e-a', 'Palmeiras x Corinthians', '2026-11-10T22:00:00.000Z')],
    });
    await service.runMatchAndMetrics(NOW);
    const first = snapshotRepo.rows.length;
    await service.runMatchAndMetrics(NOW);
    expect(snapshotRepo.rows).toHaveLength(first);
  });

  it('percebe quando o evento sumiu do banco (perda de casamento)', async () => {
    const { service, refRepo } = build({
      refs: [ref({ id: 'a', matchedEventId: 'e-velho', matchedAt: new Date('2026-11-01T00:00:00Z') })],
      events: [],
    });
    const result = await service.runMatchAndMetrics(NOW);
    expect(result.lostMatch).toBe(1);
    expect(refRepo.rows[0].matchedEventId).toBeNull();
  });

  it('mede a precisão da amostra do banco nos venues da lista (confirmado, refutado, não verificado)', async () => {
    const { service, snapshotRepo } = build({
      refs: [
        ref({ id: 'ok', name: 'Jogo Confirmado', dateKey: '2026-11-25' }),
        ref({ id: 'no', name: 'Show Cancelado', dateKey: '2026-11-26', status: 'rejeitado' }),
        ref({ id: 'cand', name: 'Festival Candidato', dateKey: '2026-11-27', status: 'candidato' }),
      ],
      votes: [{ referenceId: 'cand', verdict: 'support', validatorKind: 'tavily', validatorKey: 'web:x.com' }],
      events: [
        ev('1', 'Jogo Confirmado', '2026-11-25T22:00:00.000Z'),
        ev('2', 'Show Cancelado', '2026-11-26T22:00:00.000Z'),
        ev('3', 'Festival Candidato', '2026-11-27T22:00:00.000Z'),
        ev('4', 'Evento Sem Referencia', '2026-11-28T22:00:00.000Z'),
        ev('5', 'Evento em Bar', '2026-11-28T22:00:00.000Z', { venueName: 'Bar do Zé', normalizedVenue: 'bar do ze' }), // fora da lista
      ],
    });
    const result = await service.runMatchAndMetrics(NOW);
    expect(result.precisionSample).toBe(4);
    expect(result.precisionPct).toBe(50);
    const total = snapshotRepo.rows.find((r) => r.scope === 'next90' && r.dimension === 'total');
    expect(total).toMatchObject({ precisionSample: 4, precisionConfirmed: 2, precisionRefuted: 1, precisionPct: 50 });
  });

  it('sem referências aprovadas, não inventa recall', async () => {
    const { service, snapshotRepo } = build({ refs: [], events: [] });
    const result = await service.runMatchAndMetrics(NOW);
    expect(result.recallPast30Pct).toBeNull();
    expect(snapshotRepo.rows).toHaveLength(0);
  });
});

describe('alerta de recall abaixo do piso', () => {
  const WORDS = ['aurora', 'boreal', 'cobalto', 'delta', 'eclipse', 'fenix', 'granito', 'horizonte', 'iris', 'jade',
    'kiwi', 'lunar', 'mistral', 'nebulosa', 'opala', 'prisma', 'quasar', 'rubi', 'safira', 'topazio'];
  // Nomes sem dígitos: a normalização do dedup descarta tokens de 1 caractere.
  const many = (matched: number, total: number) =>
    Array.from({ length: total }, (_, i) =>
      ref({ id: `r${i}`, name: `Festival ${WORDS[i]} Especial`, dateKey: '2026-11-10' }),
    ).map((r, i) => ({ ...r, id: `r${i}`, _matched: i < matched }));

  function scenario(matched: number, total: number, mailer?: any) {
    const refs = many(matched, total);
    const events = refs
      .filter((r) => r._matched)
      .map((r) => ev(`e-${r.id}`, r.name, '2026-11-10T22:00:00.000Z'));
    return build({ refs, events, mailer });
  }

  it('dispara Sentry e e-mail quando o recall cai abaixo do piso (com amostra mínima)', async () => {
    process.env.EVENT_COVERAGE_RECALL_FLOOR_PCT = '70';
    process.env.EVENT_COVERAGE_ALERT_MIN_SAMPLE = '10';
    process.env.ADMIN_ALERT_EMAIL = 'ops@example.com';
    const mailer = { sendTextEmailCron: jest.fn().mockResolvedValue({ enviado: true, status: 200 }) };
    const { service } = scenario(5, 20, mailer);
    const result = await service.runMatchAndMetrics(NOW);
    expect(result.recallPast30Pct).toBe(25);
    expect(result.alerted).toBe(true);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Recall de cobertura de eventos abaixo do piso',
      expect.objectContaining({ level: 'error' }),
    );
    expect(mailer.sendTextEmailCron).toHaveBeenCalledTimes(1);
    expect(mailer.sendTextEmailCron.mock.calls[0][1]).toMatch(/25%/);
  });

  it('não repete o alerta no mesmo dia', async () => {
    process.env.EVENT_COVERAGE_ALERT_MIN_SAMPLE = '10';
    const { service } = scenario(5, 20);
    expect((await service.runMatchAndMetrics(NOW)).alerted).toBe(true);
    expect((await service.runMatchAndMetrics(NOW)).alerted).toBe(false);
  });

  it('não alerta com recall acima do piso, amostra pequena ou piso desligado', async () => {
    process.env.EVENT_COVERAGE_ALERT_MIN_SAMPLE = '10';
    expect((await scenario(19, 20).service.runMatchAndMetrics(NOW)).alerted).toBe(false);
    expect((await scenario(1, 5).service.runMatchAndMetrics(NOW)).alerted).toBe(false);
    process.env.EVENT_COVERAGE_RECALL_FLOOR_PCT = '0';
    expect((await scenario(1, 20).service.runMatchAndMetrics(NOW)).alerted).toBe(false);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
