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
    title: 'Sugestao pronta',
    description: 'Ajuste recomendado',
    redirectTo: '/dashboard?propertyId=list-1',
    propertyTitle: 'Studio Paulista',
    reasons: ['Evento proximo'],
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
            description: 'Descricao antiga',
            reasons: ['Evento proximo'],
          },
        ]),
        wantsEmail: true,
        wantsPush: false,
      });

    await service.appendPendingDigest({
      user,
      item: {
        ...item,
        description: 'Descricao atualizada',
        reasons: ['Evento proximo', 'Alta demanda'],
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
      description: 'Descricao atualizada',
      reasons: ['Evento proximo', 'Alta demanda'],
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
        title: 'Sugestao atualizada',
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
    expect(saved.scheduledFor).toEqual(new Date(2026, 4, 24));
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        scheduledFor: new Date(2026, 4, 24),
      }),
    );
    jest.useRealTimers();
  });
});
