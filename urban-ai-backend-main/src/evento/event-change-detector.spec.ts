import {
  EventSnapshot,
  detectEventChanges,
  isReschedule,
  normalizeSourceStatus,
  readEventHistoryConfig,
  selectPossiblyCancelled,
} from './event-change-detector';

const NOW = new Date('2026-10-31T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const daysAhead = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

const snap = (over: Partial<EventSnapshot> = {}): EventSnapshot => ({
  dataInicio: new Date('2026-11-20T22:00:00Z'), // 19:00 em SP
  venue: 'allianz parque',
  url: 'https://site.com/show',
  status: null,
  ...over,
});

describe('readEventHistoryConfig', () => {
  it('padrões seguros: registra, mas não aplica remarcação', () => {
    expect(readEventHistoryConfig({} as NodeJS.ProcessEnv)).toEqual({
      enabled: true,
      applyReschedule: false,
      possiblyCancelledDays: 7,
      rescheduleToleranceMinutes: 30,
    });
  });

  it('lê overrides e ignora valores inválidos', () => {
    expect(
      readEventHistoryConfig({
        EVENT_HISTORY_ENABLED: 'false',
        EVENT_HISTORY_APPLY_RESCHEDULE: 'true',
        EVENT_POSSIBLY_CANCELLED_DAYS: '14',
        EVENT_RESCHEDULE_TOLERANCE_MIN: 'abc',
      } as NodeJS.ProcessEnv),
    ).toEqual({ enabled: false, applyReschedule: true, possiblyCancelledDays: 14, rescheduleToleranceMinutes: 30 });
  });
});

describe('normalizeSourceStatus', () => {
  it.each([
    ['Cancelado', 'cancelled'],
    ['CANCELLED', 'cancelled'],
    ['canceled', 'cancelled'],
    ['Evento suspenso', 'cancelled'],
    ['Adiado', 'postponed'],
    ['postponed', 'postponed'],
    ['confirmado', 'active'],
    ['scheduled', 'active'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeSourceStatus(raw)).toBe(expected);
  });

  it('vazio ou ausente não vira status', () => {
    expect(normalizeSourceStatus('')).toBeNull();
    expect(normalizeSourceStatus('   ')).toBeNull();
    expect(normalizeSourceStatus(undefined)).toBeNull();
    expect(normalizeSourceStatus(null)).toBeNull();
  });
});

describe('isReschedule', () => {
  it('mudou o dia em São Paulo', () => {
    expect(isReschedule(new Date('2026-11-20T22:00:00Z'), new Date('2026-11-21T22:00:00Z'))).toBe(true);
  });

  it('mudou o horário além da tolerância (19:00 -> 21:00)', () => {
    expect(isReschedule(new Date('2026-11-20T22:00:00Z'), new Date('2026-11-21T00:00:00Z'))).toBe(true);
  });

  it('diferença abaixo da tolerância não é remarcação', () => {
    expect(isReschedule(new Date('2026-11-20T22:00:00Z'), new Date('2026-11-20T22:15:00Z'))).toBe(false);
  });

  it('o dia virou por fuso (UTC) mas é o mesmo dia em SP: não é remarcação', () => {
    // 23:00 SP e 23:10 SP; em UTC já é o dia seguinte
    expect(isReschedule(new Date('2026-11-21T02:00:00Z'), new Date('2026-11-21T02:10:00Z'))).toBe(false);
  });

  it('nova data só com o dia (00:00 SP) no mesmo dia não é remarcação', () => {
    expect(isReschedule(new Date('2026-11-20T22:00:00Z'), new Date('2026-11-20T03:00:00Z'))).toBe(false);
  });

  it('datas ausentes ou inválidas nunca disparam', () => {
    expect(isReschedule(null, new Date())).toBe(false);
    expect(isReschedule(new Date(), new Date('x'))).toBe(false);
  });
});

describe('detectEventChanges', () => {
  it('sem diferença, nada a registrar', () => {
    expect(detectEventChanges(snap(), snap(), { sameSource: true })).toEqual([]);
  });

  it('detecta remarcação, troca de venue e de URL da mesma fonte', () => {
    const changes = detectEventChanges(
      snap(),
      snap({ dataInicio: new Date('2026-12-05T22:00:00Z'), venue: 'neo quimica arena', url: 'https://site.com/novo' }),
      { sameSource: true },
    );
    expect(changes.map((c) => c.type)).toEqual(['rescheduled', 'venue_changed', 'url_changed']);
    expect(changes[0]).toMatchObject({
      field: 'dataInicio',
      oldValue: '2026-11-20T22:00:00.000Z',
      newValue: '2026-12-05T22:00:00.000Z',
    });
    expect(changes[1]).toMatchObject({ field: 'venue', oldValue: 'allianz parque', newValue: 'neo quimica arena' });
  });

  it('fonte diferente não gera remarcação/venue/URL (divergência natural entre fontes)', () => {
    const changes = detectEventChanges(
      snap(),
      snap({ dataInicio: new Date('2026-11-20T23:30:00Z'), venue: 'estadio do palmeiras', url: 'https://outra.com/x' }),
      { sameSource: false },
    );
    expect(changes).toEqual([]);
  });

  it('cancelamento declarado vale de qualquer fonte', () => {
    const changes = detectEventChanges(snap(), snap({ status: 'cancelled' }), { sameSource: false });
    expect(changes).toEqual([{ type: 'cancelled', field: 'status', oldValue: null, newValue: 'cancelled' }]);
  });

  it('adiado é registrado como postponed; status ativo não gera nada', () => {
    expect(detectEventChanges(snap(), snap({ status: 'postponed' }), { sameSource: true })[0]).toMatchObject({
      type: 'postponed',
    });
    expect(detectEventChanges(snap(), snap({ status: 'active' }), { sameSource: true })).toEqual([]);
  });

  it('venue ou URL ausente de um dos lados não conta como mudança', () => {
    expect(detectEventChanges(snap({ venue: null, url: null }), snap(), { sameSource: true })).toEqual([]);
    expect(detectEventChanges(snap(), snap({ venue: null, url: null }), { sameSource: true })).toEqual([]);
  });

  it('respeita a tolerância configurada', () => {
    const later = snap({ dataInicio: new Date('2026-11-20T22:45:00Z') });
    expect(detectEventChanges(snap(), later, { sameSource: true, rescheduleToleranceMinutes: 60 })).toEqual([]);
    expect(detectEventChanges(snap(), later, { sameSource: true, rescheduleToleranceMinutes: 30 })).toHaveLength(1);
  });
});

describe('selectPossiblyCancelled (sumiço da fonte)', () => {
  const sourceAlive = new Map([['sympla-api', daysAgo(0.1)]]);
  const candidate = (over: Record<string, unknown> = {}) => ({
    eventId: 'e1',
    source: 'sympla-api',
    dataInicio: daysAhead(20),
    lastSeenAt: daysAgo(9),
    ...over,
  });
  const ignore = (s: string) => s.startsWith('admin-');

  it('marca evento futuro não visto há N dias numa fonte que segue ativa', () => {
    expect(selectPossiblyCancelled([candidate()], sourceAlive, NOW, 7, ignore).map((c) => c.eventId)).toEqual(['e1']);
  });

  it('visto há menos de N dias não é marcado', () => {
    expect(selectPossiblyCancelled([candidate({ lastSeenAt: daysAgo(3) })], sourceAlive, NOW, 7, ignore)).toEqual([]);
  });

  it('evento já passado nunca é marcado', () => {
    expect(selectPossiblyCancelled([candidate({ dataInicio: daysAgo(1) })], sourceAlive, NOW, 7, ignore)).toEqual([]);
  });

  it('fonte ignorada (curadoria manual) nunca é marcada', () => {
    const alive = new Map([['admin-manual', daysAgo(0.1)]]);
    expect(selectPossiblyCancelled([candidate({ source: 'admin-manual' })], alive, NOW, 7, ignore)).toEqual([]);
  });

  it('fonte inteira muda há N dias: é falha do coletor, não cancelamento', () => {
    const dead = new Map([['sympla-api', daysAgo(10)]]);
    expect(selectPossiblyCancelled([candidate()], dead, NOW, 7, ignore)).toEqual([]);
    expect(selectPossiblyCancelled([candidate()], new Map(), NOW, 7, ignore)).toEqual([]);
  });

  it('sem lastSeenAt ou sem source não marca', () => {
    expect(selectPossiblyCancelled([candidate({ lastSeenAt: null })], sourceAlive, NOW, 7, ignore)).toEqual([]);
    expect(selectPossiblyCancelled([candidate({ source: null })], sourceAlive, NOW, 7, ignore)).toEqual([]);
  });
});
