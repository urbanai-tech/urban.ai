import { PricingRecommendationDigestService } from './pricing-recommendation-digest.service';

describe('PricingRecommendationDigestService', () => {
  function makeService() {
    const repo = {
      create: jest.fn((value) => value),
      findOne: jest.fn(),
      save: jest.fn(async (value) => value),
      update: jest.fn(),
    };
    const service = new PricingRecommendationDigestService(repo as any);
    return { repo, service };
  }

  const user = {
    id: 'user-1',
    email: 'ana@example.com',
    username: 'Ana',
  } as any;

  const item = {
    notificationId: 'notification-1',
    title: 'Sugestão pronta',
    description: 'Ajuste recomendado',
    redirectTo: '/dashboard?propertyId=list-1',
    propertyTitle: 'Studio Paulista',
    reasons: ['Evento próximo'],
    createdAt: '2026-05-23T12:00:00Z',
  };

  it('deduplicates pending digest items by notification id', async () => {
    const { repo, service } = makeService();
    repo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'digest-1',
        userId: 'user-1',
        status: 'pending',
        scheduledFor: new Date('2026-05-23T12:02:00Z'),
        itemsJson: JSON.stringify([
          {
            ...item,
            description: 'Descrição antiga',
            reasons: ['Evento próximo'],
          },
        ]),
        wantsEmail: true,
        wantsPush: false,
      });

    await service.appendPendingDigest({
      user,
      item: {
        ...item,
        description: 'Descrição atualizada',
        reasons: ['Evento próximo', 'Alta demanda'],
      },
      wantsEmail: true,
      wantsPush: false,
      delayMs: 120000,
    });

    const saved = repo.save.mock.calls[0][0];
    const items = JSON.parse(saved.itemsJson);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      notificationId: 'notification-1',
      description: 'Descrição atualizada',
        reasons: ['Evento próximo', 'Alta demanda'],
    });
    expect(saved.itemCount).toBe(1);
  });

  it('deduplicates pending digest items by property, redirect and day when notification id is absent', async () => {
    const { repo, service } = makeService();
    repo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'digest-1',
        userId: 'user-1',
        status: 'pending',
        scheduledFor: new Date('2026-05-23T12:02:00Z'),
        itemsJson: JSON.stringify([{ ...item, notificationId: undefined }]),
        wantsEmail: true,
        wantsPush: false,
      });

    await service.appendPendingDigest({
      user,
      item: {
        ...item,
        notificationId: undefined,
        title: 'Sugestão atualizada',
      },
      wantsEmail: true,
      wantsPush: false,
      delayMs: 120000,
    });

    const saved = repo.save.mock.calls[0][0];
    expect(JSON.parse(saved.itemsJson)).toHaveLength(1);
    expect(saved.itemCount).toBe(1);
  });

  it('defers a new email digest to the next day when the user already received one today', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-23T15:30:00Z'));
    const { repo, service } = makeService();
    repo.findOne
      .mockResolvedValueOnce({ id: 'sent-digest-1' })
      .mockResolvedValueOnce(null);

    await service.appendPendingDigest({
      user,
      item,
      wantsEmail: true,
      wantsPush: false,
      delayMs: 120000,
    });

    const saved = repo.save.mock.calls[0][0];
    // 00:00 BRT de 24/05 = 03:00Z (independe do TZ do processo)
    expect(saved.scheduledFor).toEqual(new Date('2026-05-24T03:00:00Z'));
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        scheduledFor: new Date('2026-05-24T03:00:00Z'),
      }),
    );
    jest.useRealTimers();
  });

  it('usa o dia de São Paulo: 21:30 BRT (00:30Z) ainda é "hoje" e adia para 00:00 BRT do dia seguinte', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-24T00:30:00Z')); // 23/05 21:30 BRT
    const { repo, service } = makeService();
    repo.findOne.mockResolvedValueOnce({ id: 'sent-digest-1' }).mockResolvedValueOnce(null);

    await service.appendPendingDigest({ user, item, wantsEmail: true, wantsPush: false, delayMs: 120000 });

    // início do "hoje" consultado = 00:00 BRT de 23/05 (03:00Z), não 00:00Z de 24/05
    const sentWhere = repo.findOne.mock.calls[0][0].where.sentAt;
    expect(sentWhere.value).toEqual(new Date('2026-05-23T03:00:00Z'));
    expect(repo.save.mock.calls[0][0].scheduledFor).toEqual(new Date('2026-05-24T03:00:00Z'));
    jest.useRealTimers();
  });

  it('agrupa itens sem notificationId pelo dia de SP (21:30 BRT e 10:00 BRT do mesmo dia são o mesmo item)', () => {
    const { service } = makeService();
    const key = (createdAt: string) =>
      (service as any).digestItemKey({ ...item, notificationId: undefined, createdAt });
    expect(key('2026-05-24T00:30:00Z')).toBe(key('2026-05-23T13:00:00Z')); // ambos 23/05 em SP
    expect(key('2026-05-24T00:30:00Z')).toContain(':2026-05-23');
    expect(key('2026-05-24T03:00:00Z')).toContain(':2026-05-24'); // 00:00 BRT já é o dia seguinte
  });

  it('itemDay cai no dia de hoje em SP quando createdAt é ausente ou inválido', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-24T00:30:00Z'));
    const { service } = makeService();
    expect((service as any).itemDay(undefined)).toBe('2026-05-23');
    expect((service as any).itemDay('lixo')).toBe('2026-05-23');
    jest.useRealTimers();
  });
});
