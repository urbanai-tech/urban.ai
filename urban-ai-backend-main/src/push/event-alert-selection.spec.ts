import {
  EVENT_ALERT_DEFAULTS,
  EventAlertCandidate,
  eventAlertKey,
  resolveEventAlertConfig,
  selectEventAlerts,
} from './event-alert-selection';

const NOW = new Date('2026-10-27T15:00:00Z');
const inDays = (days: number) => new Date(NOW.getTime() + days * 24 * 3600 * 1000);

function candidate(overrides: Partial<EventAlertCandidate> = {}): EventAlertCandidate {
  return {
    userId: 'host-1',
    propertyId: 'prop-1',
    eventId: 'ev-1',
    eventName: 'Show',
    relevance: 80,
    startsAt: inDays(5),
    distanceKm: 1,
    ...overrides,
  };
}

const select = (candidates: EventAlertCandidate[], extra: Partial<Parameters<typeof selectEventAlerts>[0]> = {}) =>
  selectEventAlerts({
    candidates,
    now: NOW,
    alreadyAlerted: new Set(),
    usedTodayByProperty: new Map(),
    usedTodayByHost: new Map(),
    ...extra,
  });

describe('selectEventAlerts', () => {
  it('seleciona evento relevante dentro da janela', () => {
    const result = select([candidate()]);
    expect(result.selected).toHaveLength(1);
    expect(result.skipped).toEqual([]);
  });

  it('relevância: abaixo do limite (60) ou desconhecida não avisa; no limite avisa', () => {
    const result = select([
      candidate({ eventId: 'a', propertyId: 'pa', relevance: 59 }),
      candidate({ eventId: 'b', propertyId: 'pb', relevance: null }),
      candidate({ eventId: 'c', propertyId: 'pc', relevance: 60 }),
    ]);
    expect(result.selected.map((c) => c.eventId)).toEqual(['c']);
    expect(result.skipped.map((s) => [s.candidate.eventId, s.reason]).sort()).toEqual([
      ['a', 'low_relevance'],
      ['b', 'low_relevance'],
    ]);
  });

  it('limite de relevância configurável', () => {
    const config = { ...EVENT_ALERT_DEFAULTS, minRelevance: 85 };
    expect(select([candidate({ relevance: 80 })], { config }).skipped[0].reason).toBe('low_relevance');
    expect(select([candidate({ relevance: 90 })], { config }).selected).toHaveLength(1);
  });

  it('janela de 14 dias: 14d entra, depois disso e já iniciado ficam de fora', () => {
    const result = select([
      candidate({ eventId: 'in', propertyId: 'p1', startsAt: inDays(14) }),
      candidate({ eventId: 'far', propertyId: 'p2', startsAt: new Date(inDays(14).getTime() + 1000) }),
      candidate({ eventId: 'started', propertyId: 'p3', startsAt: new Date(NOW.getTime() - 1000) }),
      candidate({ eventId: 'now', propertyId: 'p4', startsAt: NOW }),
      candidate({ eventId: 'bad', propertyId: 'p5', startsAt: new Date('invalid') }),
    ]);
    expect(result.selected.map((c) => c.eventId)).toEqual(['in']);
    const reasons = Object.fromEntries(result.skipped.map((s) => [s.candidate.eventId, s.reason]));
    expect(reasons).toEqual({ far: 'outside_window', started: 'outside_window', now: 'outside_window', bad: 'invalid_start' });
  });

  it('idempotência: host+evento já avisado nunca repete; outro host recebe o mesmo evento', () => {
    const result = select(
      [candidate(), candidate({ userId: 'host-2', propertyId: 'prop-2' })],
      { alreadyAlerted: new Set([eventAlertKey('host-1', 'ev-1')]) },
    );
    expect(result.selected.map((c) => c.userId)).toEqual(['host-2']);
    expect(result.skipped[0]).toMatchObject({ reason: 'already_alerted' });
  });

  it('evento perto de dois imóveis do mesmo anfitrião gera um aviso só (imóvel mais perto)', () => {
    const result = select([
      candidate({ propertyId: 'longe', distanceKm: 4 }),
      candidate({ propertyId: 'perto', distanceKm: 0.8 }),
    ]);
    expect(result.selected.map((c) => c.propertyId)).toEqual(['perto']);
    expect(result.skipped[0]).toMatchObject({ reason: 'already_alerted' });
  });

  it('no máximo 1 aviso por imóvel por dia: fica o mais relevante', () => {
    const result = select([
      candidate({ eventId: 'media', relevance: 65 }),
      candidate({ eventId: 'mega', relevance: 95 }),
    ]);
    expect(result.selected.map((c) => c.eventId)).toEqual(['mega']);
    expect(result.skipped).toMatchObject([{ reason: 'property_daily_limit' }]);
  });

  it('o que já foi enviado hoje conta no limite do imóvel', () => {
    const result = select([candidate()], { usedTodayByProperty: new Map([['prop-1', 1]]) });
    expect(result.selected).toEqual([]);
    expect(result.skipped[0].reason).toBe('property_daily_limit');
  });

  it('no máximo 3 por anfitrião por dia (imóveis diferentes), contando o que saiu hoje', () => {
    const many = ['a', 'b', 'c', 'd'].map((id, i) =>
      candidate({ eventId: id, propertyId: `p-${id}`, relevance: 90 - i }),
    );
    const fresh = select(many);
    expect(fresh.selected.map((c) => c.eventId)).toEqual(['a', 'b', 'c']);
    expect(fresh.skipped).toMatchObject([{ candidate: { eventId: 'd' }, reason: 'host_daily_limit' }]);

    const withUsed = select(many, { usedTodayByHost: new Map([['host-1', 2]]) });
    expect(withUsed.selected.map((c) => c.eventId)).toEqual(['a']);
  });

  it('limites por anfitrião não vazam para outro anfitrião', () => {
    const result = select(
      [candidate({ eventId: 'a' }), candidate({ userId: 'host-2', propertyId: 'prop-2', eventId: 'b' })],
      { usedTodayByHost: new Map([['host-1', 3]]) },
    );
    expect(result.selected.map((c) => c.userId)).toEqual(['host-2']);
  });

  it('prioridade: relevância, depois início mais cedo', () => {
    const result = select([
      candidate({ eventId: 'tarde', propertyId: 'p1', relevance: 70, startsAt: inDays(9) }),
      candidate({ eventId: 'cedo', propertyId: 'p2', relevance: 70, startsAt: inDays(2) }),
      candidate({ eventId: 'top', propertyId: 'p3', relevance: 99, startsAt: inDays(12) }),
    ]);
    expect(result.selected.map((c) => c.eventId)).toEqual(['top', 'cedo', 'tarde']);
  });
});

describe('resolveEventAlertConfig', () => {
  it('usa padrões conservadores e aceita ajustes válidos do ambiente', () => {
    expect(resolveEventAlertConfig({})).toEqual({ minRelevance: 60, windowDays: 14, maxPerPropertyPerDay: 1, maxPerHostPerDay: 3 });
    expect(
      resolveEventAlertConfig({
        PUSH_EVENT_ALERT_MIN_RELEVANCE: '75',
        PUSH_EVENT_ALERT_WINDOW_DAYS: '7',
        PUSH_EVENT_ALERT_MAX_PER_HOST_PER_DAY: '2',
      } as any),
    ).toMatchObject({ minRelevance: 75, windowDays: 7, maxPerHostPerDay: 2 });
  });

  it('valores inválidos caem no padrão (relevância 0 é válida)', () => {
    expect(resolveEventAlertConfig({ PUSH_EVENT_ALERT_MIN_RELEVANCE: 'abc', PUSH_EVENT_ALERT_WINDOW_DAYS: '-3' } as any))
      .toMatchObject({ minRelevance: 60, windowDays: 14 });
    expect(resolveEventAlertConfig({ PUSH_EVENT_ALERT_MIN_RELEVANCE: '150' } as any).minRelevance).toBe(60);
    expect(resolveEventAlertConfig({ PUSH_EVENT_ALERT_MIN_RELEVANCE: '0' } as any).minRelevance).toBe(0);
  });
});
