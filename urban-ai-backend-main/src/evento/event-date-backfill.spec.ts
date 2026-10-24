import { classifyEventDateBackfill } from './event-date-backfill';

const d = (iso: string) => new Date(iso);

describe('classifyEventDateBackfill', () => {
  it('api-football legado (UTC naive "2026-05-11 00:30:00") já estava no instante certo -> unchanged', () => {
    const r = classifyEventDateBackfill({
      storedStart: d('2026-05-11T00:30:00Z'),
      storedEnd: d('2026-05-11T00:30:00Z'),
      source: 'api-football',
      rawStart: '2026-05-11 00:30:00',
      rawEnd: null,
      utcNaiveSources: ['api-football'],
    });
    expect(r.classification).toBe('unchanged');
    expect(r.expectedDayKey).toBe('2026-05-10');
  });

  it('naive local gravado como UTC (wall 02:00 BRT salvo como 02:00Z) muda o dia de SP -> day_shift', () => {
    const r = classifyEventDateBackfill({
      storedStart: d('2026-05-10T02:00:00Z'), // dia SP = 09/05 (errado)
      storedEnd: d('2026-05-10T02:00:00Z'),
      source: 'sp-cultura',
      rawStart: '2026-05-10T02:00:00',
      rawEnd: null,
    });
    expect(r.classification).toBe('day_shift');
    expect(r.storedDayKey).toBe('2026-05-09');
    expect(r.expectedDayKey).toBe('2026-05-10');
    expect(r.expectedStart?.toISOString()).toBe('2026-05-10T05:00:00.000Z');
  });

  it('naive local noturno gravado como UTC (21:30) só desloca o instante -> instant_shift', () => {
    const r = classifyEventDateBackfill({
      storedStart: d('2026-05-10T21:30:00Z'),
      storedEnd: d('2026-05-10T21:30:00Z'),
      source: 'usp-eventos',
      rawStart: '2026-05-10 21:30:00',
      rawEnd: null,
    });
    expect(r.classification).toBe('instant_shift');
    expect(r.expectedStart?.toISOString()).toBe('2026-05-11T00:30:00.000Z');
  });

  it('sem rawPayload ou ilegível não é tocado', () => {
    const base = { storedStart: d('2026-05-10T12:00:00Z'), storedEnd: null, source: 'x', rawEnd: null };
    expect(classifyEventDateBackfill({ ...base, rawStart: undefined }).classification).toBe('no_raw_payload');
    expect(classifyEventDateBackfill({ ...base, rawStart: 'amanhã' }).classification).toBe('unparseable');
  });

  it('data pura vira dia inteiro de SP', () => {
    const r = classifyEventDateBackfill({
      storedStart: d('2026-05-10T00:00:00Z'), // legado: UTC midnight = 09/05 21:00 em SP
      storedEnd: d('2026-05-10T00:00:00Z'),
      source: 'sp-cultura',
      rawStart: '2026-05-10',
      rawEnd: '2026-05-10',
    });
    expect(r.classification).toBe('day_shift');
    expect(r.expectedStart?.toISOString()).toBe('2026-05-10T03:00:00.000Z');
    expect(r.expectedEnd?.toISOString()).toBe('2026-05-11T02:59:59.999Z');
  });
});
