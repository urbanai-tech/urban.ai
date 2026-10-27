import {
  buildEventAlertPayload,
  buildPricingDigestPayload,
  buildSystemNotificationPayload,
  buildWeeklySummaryPayload,
  decidePushPolicy,
  DEFAULT_QUIET_HOURS,
  isWithinQuietHours,
  nearestUpcomingEventRef,
  normalizeInternalUrl,
  normalizePushPayload,
  parseQuietHours,
  preferenceFieldFor,
  pushCategoryFromType,
} from './push-payload.builder';

// São Paulo = UTC-3 (sem horário de verão desde 2019).
const brt = (hhmm: string, day = '2026-10-26') => new Date(`${day}T${hhmm}:00-03:00`);

describe('push-payload.builder', () => {
  describe('categoria e preferência', () => {
    it.each([
      ['pricing_recommendation', 'pricing'],
      ['pricing_recommendation_digest', 'pricing'],
      ['base_price_pending_batch', 'pricing'],
      ['property_analysis_finished', 'pricing'],
      ['event_alert', 'events'],
      ['weekly_event_report', 'weekly'],
      ['test', 'test'],
      ['system_notification', 'system'],
      [undefined, 'system'],
    ])('%s -> %s', (type, category) => {
      expect(pushCategoryFromType(type)).toBe(category);
    });

    it('mapeia categorias para as colunas de communication-preferences', () => {
      expect(preferenceFieldFor('pricing')).toBe('pushPricing');
      expect(preferenceFieldFor('events')).toBe('pushEvents');
      expect(preferenceFieldFor('weekly')).toBe('weeklyReport');
      expect(preferenceFieldFor('system')).toBeNull();
      expect(preferenceFieldFor('test')).toBeNull();
    });
  });

  describe('horário de silêncio', () => {
    it('janela padrão 22h-8h cruza a meia-noite no fuso de São Paulo', () => {
      expect(isWithinQuietHours(brt('21:59'), DEFAULT_QUIET_HOURS)).toBe(false);
      expect(isWithinQuietHours(brt('22:00'), DEFAULT_QUIET_HOURS)).toBe(true);
      expect(isWithinQuietHours(brt('02:30'), DEFAULT_QUIET_HOURS)).toBe(true);
      expect(isWithinQuietHours(brt('07:59'), DEFAULT_QUIET_HOURS)).toBe(true);
      expect(isWithinQuietHours(brt('08:00'), DEFAULT_QUIET_HOURS)).toBe(false);
      // 01:00Z ainda é 22:00 do dia anterior em São Paulo.
      expect(isWithinQuietHours(new Date('2026-10-27T01:00:00Z'), DEFAULT_QUIET_HOURS)).toBe(true);
      // 12:00Z = 09:00 BRT: não é silêncio, embora seja "meio do dia" em UTC.
      expect(isWithinQuietHours(new Date('2026-10-26T12:00:00Z'), DEFAULT_QUIET_HOURS)).toBe(false);
    });

    it('janela no mesmo dia e desligada', () => {
      expect(isWithinQuietHours(brt('13:00'), { startHour: 12, endHour: 14 })).toBe(true);
      expect(isWithinQuietHours(brt('15:00'), { startHour: 12, endHour: 14 })).toBe(false);
      expect(isWithinQuietHours(brt('23:00'), null)).toBe(false);
    });

    it('lê PUSH_QUIET_HOURS com fallback seguro', () => {
      expect(parseQuietHours(undefined)).toEqual(DEFAULT_QUIET_HOURS);
      expect(parseQuietHours('')).toEqual(DEFAULT_QUIET_HOURS);
      expect(parseQuietHours('23-7')).toEqual({ startHour: 23, endHour: 7 });
      expect(parseQuietHours('off')).toBeNull();
      expect(parseQuietHours('25-7')).toEqual(DEFAULT_QUIET_HOURS);
      expect(parseQuietHours('9-9')).toEqual(DEFAULT_QUIET_HOURS);
      expect(parseQuietHours('lixo')).toEqual(DEFAULT_QUIET_HOURS);
    });
  });

  describe('decidePushPolicy', () => {
    const base = {
      category: 'pricing' as const,
      payload: {},
      preferences: { pushPricing: true, pushEvents: true, weeklyReport: true },
      now: brt('10:00'),
      quietHours: DEFAULT_QUIET_HOURS,
      deliveriesLast24h: 0,
      maxPerDay: 6,
    };

    it('permite quando tudo está ligado, fora do silêncio e abaixo do teto', () => {
      expect(decidePushPolicy(base)).toEqual({ allowed: true });
    });

    it('respeita o opt-out por categoria (e só o false explícito bloqueia)', () => {
      expect(decidePushPolicy({ ...base, preferences: { pushPricing: false } })).toEqual({
        allowed: false,
        reason: 'category_disabled',
      });
      expect(decidePushPolicy({ ...base, category: 'events', preferences: { pushEvents: false } })).toEqual({
        allowed: false,
        reason: 'category_disabled',
      });
      expect(decidePushPolicy({ ...base, category: 'weekly', preferences: { weeklyReport: false } })).toEqual({
        allowed: false,
        reason: 'category_disabled',
      });
      expect(decidePushPolicy({ ...base, preferences: null })).toEqual({ allowed: true });
      expect(decidePushPolicy({ ...base, category: 'events', preferences: { pushPricing: false } })).toEqual({
        allowed: true,
      });
    });

    it('bloqueia no silêncio, exceto teste e urgente', () => {
      const night = { ...base, now: brt('23:30') };
      expect(decidePushPolicy(night)).toEqual({ allowed: false, reason: 'quiet_hours' });
      expect(decidePushPolicy({ ...night, category: 'system' })).toEqual({ allowed: false, reason: 'quiet_hours' });
      expect(decidePushPolicy({ ...night, category: 'test' })).toEqual({ allowed: true });
      expect(decidePushPolicy({ ...night, payload: { urgent: true } })).toEqual({ allowed: true });
    });

    it('aplica o teto diário (teste não conta)', () => {
      expect(decidePushPolicy({ ...base, deliveriesLast24h: 6 })).toEqual({ allowed: false, reason: 'rate_limited' });
      expect(decidePushPolicy({ ...base, deliveriesLast24h: 5 })).toEqual({ allowed: true });
      expect(decidePushPolicy({ ...base, category: 'test', deliveriesLast24h: 99 })).toEqual({ allowed: true });
    });

    it('opt-out tem precedência sobre os outros motivos', () => {
      expect(
        decidePushPolicy({ ...base, preferences: { pushPricing: false }, now: brt('23:30'), deliveriesLast24h: 50 }),
      ).toEqual({ allowed: false, reason: 'category_disabled' });
    });
  });

  describe('builders', () => {
    it('resumo de preços: singular/plural, tag do dia de SP, renotify, ações e selo', () => {
      const one = buildPricingDigestPayload({ count: 1, digestId: 'd1', now: new Date('2026-10-27T01:30:00Z') });
      expect(one.title).toBe('Recomendação de preço para revisar');
      expect(one.tag).toBe('pricing-digest-2026-10-26');
      expect(one.renotify).toBe(true);
      expect(one.badgeCount).toBe(1);
      expect(one.actions).toEqual([
        { action: 'view', title: 'Ver recomendação', url: '/dashboard?source=pwa_push_pricing_digest&action=view' },
        { action: 'later', title: 'Aplicar depois' },
      ]);
      expect(one.data).toEqual({ type: 'pricing_recommendation_digest', count: 1, digestId: 'd1' });
      const many = buildPricingDigestPayload({ count: 4 });
      expect(many.title).toBe('Recomendações de preço para revisar');
      expect(many.body).toContain('4 recomendações');
    });

    it('resumo semanal mantém URL/tag/tipo usados pelo relatório', () => {
      const payload = buildWeeklySummaryPayload({
        body: '2 eventos relevantes para 1 imóvel nos próximos 30 dias.',
        lookaheadDays: 30,
        properties: 1,
        now: new Date('2026-05-22T00:30:00Z'),
      });
      expect(payload).toMatchObject({
        title: 'Seu resumo semanal',
        url: '/painel?source=pwa_push_weekly_report',
        tag: 'weekly-event-report-2026-05-21',
        data: { type: 'weekly_event_report', lookaheadDays: 30, properties: 1 },
      });
    });

    it('alerta de evento: deep link do imóvel, tag estável por evento e imagem opcional', () => {
      const payload = buildEventAlertPayload({
        eventName: 'Fórmula 1 — GP de São Paulo',
        neighborhood: 'Interlagos',
        startsOn: '2026-11-08',
        propertyId: 'p 1',
        propertyName: 'Studio Paulista',
        imageUrl: 'https://cdn.example.com/gp.png',
      });
      expect(pushCategoryFromType(payload.data?.type)).toBe('events');
      expect(payload.title).toBe('Fórmula 1 — GP de São Paulo em Interlagos');
      expect(payload.body).toContain('08/11');
      expect(payload.url).toBe('/dashboard?propertyId=p%201&source=pwa_push_event');
      expect(payload.tag).toBe('event-p 1-2026-11-08-formula-1-gp-de-sao-paulo');
      expect(payload.image).toBe('https://cdn.example.com/gp.png');
      expect(payload.actions?.[0]).toMatchObject({ action: 'view', url: payload.url });
    });

    it('notificação de sistema só ganha ações/renotify quando é de preço', () => {
      const pricing = buildSystemNotificationPayload({
        title: 't', body: 'b', url: '/dashboard?propertyId=1', tag: 'x', type: 'pricing_recommendation', notificationId: 'n1',
      });
      expect(pricing.renotify).toBe(true);
      expect(pricing.actions).toHaveLength(2);
      expect(pricing.data).toEqual({ type: 'pricing_recommendation', notificationId: 'n1' });
      const generic = buildSystemNotificationPayload({
        title: 't', body: 'b', url: '/notificacao', tag: 'x', type: 'system_notification',
      });
      expect(generic.renotify).toBeUndefined();
      expect(generic.actions).toBeUndefined();
    });
  });

  describe('normalizePushPayload', () => {
    it('limita tamanhos, ações e selo; remove imagem insegura e links externos', () => {
      const normalized = normalizePushPayload({
        title: 'x'.repeat(300),
        body: 'y'.repeat(500),
        url: 'https://evil.example/phish?x=1',
        tag: 't',
        renotify: true,
        image: 'http://insecure.example/a.png',
        badgeCount: 250,
        actions: [
          { action: 'a', title: 'A', url: '//evil.example' },
          { action: 'b', title: 'B' },
          { action: 'c', title: 'C' },
        ],
      });
      expect(normalized.title).toHaveLength(120);
      expect(normalized.body).toHaveLength(240);
      expect(normalized.url).toBe('/phish?x=1');
      expect(normalized.image).toBeUndefined();
      expect(normalized.badgeCount).toBe(99);
      expect(normalized.renotify).toBe(true);
      expect(normalized.actions).toEqual([
        { action: 'a', title: 'A', url: '/notificacao' },
        { action: 'b', title: 'B' },
      ]);
      expect(normalized.badge).toBe('/pwa-badge-96.png');
    });

    it('renotify sem tag é descartado; sem ações usa "Ver"; sem url cai em /notificacao', () => {
      const normalized = normalizePushPayload({ title: 'x', renotify: true });
      expect(normalized.renotify).toBeUndefined();
      expect(normalized.actions).toEqual([{ action: 'open', title: 'Ver' }]);
      expect(normalized.url).toBe('/notificacao');
      expect(normalized.badgeCount).toBeUndefined();
    });

    it('normalizeInternalUrl aceita rotas internas e rejeita protocolo-relativo', () => {
      expect(normalizeInternalUrl('/dashboard?a=1')).toBe('/dashboard?a=1');
      expect(normalizeInternalUrl('//evil.example')).toBe('/notificacao');
      expect(normalizeInternalUrl('/\\evil.example')).toBe('/notificacao');
      expect(normalizeInternalUrl('javascript:alert(1)')).toBe('/notificacao');
      expect(normalizeInternalUrl(undefined)).toBe('/notificacao');
    });
  });
  describe('nearestUpcomingEventRef', () => {
    const now = new Date('2026-10-27T12:00:00Z');
    it('escolhe o início mais próximo entre os que ainda não começaram', () => {
      expect(
        nearestUpcomingEventRef(['2026-11-05T20:00:00Z', null, '2026-10-30T22:00:00Z', '2026-10-26T20:00:00Z', 'lixo'], now),
      ).toEqual({ startsAt: '2026-10-30T22:00:00.000Z' });
      expect(nearestUpcomingEventRef([new Date('2026-10-28T01:00:00Z')], now)).toEqual({ startsAt: '2026-10-28T01:00:00.000Z' });
    });
    it('sem início futuro válido devolve undefined (vale só a idade máxima)', () => {
      expect(nearestUpcomingEventRef([], now)).toBeUndefined();
      expect(nearestUpcomingEventRef([null, undefined, '2026-10-01T00:00:00Z'], now)).toBeUndefined();
      expect(buildPricingDigestPayload({ count: 1, event: nearestUpcomingEventRef([], now) }).expiresAt).toBeUndefined();
    });
  });
});
