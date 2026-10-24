import { NotFoundException } from '@nestjs/common';
import {
  ACCOUNT_EXPORT_ANALYSES_LIMIT,
  ACCOUNT_EXPORT_FORMAT,
  AccountDataService,
} from './account-data.service';

const repo = (result: unknown) => ({
  find: jest.fn().mockResolvedValue(result),
  findOne: jest.fn().mockResolvedValue(result),
});

function build(overrides: Partial<Record<string, unknown>> = {}) {
  const user = {
    id: 'u1',
    username: 'Ana',
    email: 'ana@test.com',
    role: 'host',
    ativo: true,
    password: '$2b$12$hash-que-nunca-deve-sair',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    emailVerifiedAt: new Date('2026-01-02T00:00:00Z'),
    termsAcceptedAt: new Date('2026-01-01T00:00:00Z'),
    termsVersion: '2026-05-11',
    refreshSecret: 'nao-exportar',
  };
  const repos = {
    users: repo(user),
    lists: repo([{ id: 'l1', titulo: 'Apto', id_do_anuncio: '123', user }]),
    addresses: repo([{ id: 'a1', cep: '01000-000', cidade: 'São Paulo', list: { id: 'l1' }, user }]),
    analyses: repo([
      { id: 'an1', precoSugerido: 300, endereco: 'a1', evento: 'e1', usuarioProprietario: 'u1' },
    ]),
    payments: repo([
      {
        status: 'active', planName: 'pro', billingCycle: 'monthly', listingsContratados: 2,
        customerId: 'cus_SECRET', subscriptionId: 'sub_SECRET', recentStripeEventIds: ['evt_1'],
      },
    ]),
    stays: repo({
      clientId: 'client-1', status: 'active', accessToken: 'TOKEN-SECRETO',
      consentAcceptedAt: new Date('2026-02-01T00:00:00Z'), consentVersion: 'v1',
      consentIp: '1.2.3.4', consentUserAgent: 'UA',
    }),
    prefs: repo({ emailPricing: true, marketing: false, staysAlerts: true, billingAlerts: true }),
    ...overrides,
  } as any;
  const service = new AccountDataService(
    repos.users, repos.lists, repos.addresses, repos.analyses, repos.payments, repos.stays, repos.prefs,
  );
  return { service, repos };
}

describe('AccountDataService.exportUserData', () => {
  it('monta o pacote do titular com todas as seções', async () => {
    const { service } = build();

    const bundle: any = await service.exportUserData('u1');

    expect(bundle.format).toBe(ACCOUNT_EXPORT_FORMAT);
    expect(new Date(bundle.generatedAt).getTime()).not.toBeNaN();
    expect(bundle.user).toMatchObject({ id: 'u1', email: 'ana@test.com', username: 'Ana' });
    expect(bundle.properties).toEqual([{ id: 'l1', titulo: 'Apto', id_do_anuncio: '123' }]);
    expect(bundle.addresses[0]).toMatchObject({ id: 'a1', cep: '01000-000', propertyId: 'l1' });
    expect(bundle.analyses.items[0]).toMatchObject({ id: 'an1', addressId: 'a1', eventId: 'e1' });
    expect(bundle.analyses.truncated).toBe(false);
    expect(bundle.payments[0]).toMatchObject({ status: 'active', planName: 'pro', billingCycle: 'monthly' });
    expect(bundle.staysAccount).toMatchObject({ clientId: 'client-1', status: 'active' });
    expect(bundle.communicationPreferences).toMatchObject({ emailPricing: true, marketing: false });
    expect(bundle.consents).toEqual({
      terms: { acceptedAt: new Date('2026-01-01T00:00:00Z'), version: '2026-05-11' },
      stays: { acceptedAt: new Date('2026-02-01T00:00:00Z'), version: 'v1' },
      marketingCommunications: false,
    });
  });

  it('nunca inclui hash de senha, tokens, IDs do Stripe ou contexto técnico de consentimento', async () => {
    const { service } = build();

    const serialized = JSON.stringify(await service.exportUserData('u1'));

    for (const secret of [
      'hash-que-nunca-deve-sair', 'TOKEN-SECRETO', 'cus_SECRET', 'sub_SECRET', 'evt_1', 'nao-exportar',
      '"password"', '"accessToken"', '"customerId"', '"subscriptionId"',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('consulta somente registros do próprio usuário', async () => {
    const { service, repos } = build();

    await service.exportUserData('u1');

    expect(repos.users.findOne).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(repos.lists.find).toHaveBeenCalledWith({ where: { user: { id: 'u1' } } });
    expect(repos.addresses.find).toHaveBeenCalledWith({ where: { user: { id: 'u1' } } });
    expect(repos.analyses.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioProprietario: { id: 'u1' } } }),
    );
    expect(repos.payments.find).toHaveBeenCalledWith({ where: { user: { id: 'u1' } } });
    expect(repos.stays.findOne).toHaveBeenCalledWith({ where: { user: { id: 'u1' } } });
    expect(repos.prefs.findOne).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('funciona para quem não tem Stays nem preferências e sinaliza análises truncadas', async () => {
    const many = Array.from({ length: ACCOUNT_EXPORT_ANALYSES_LIMIT + 1 }, (_, i) => ({ id: `an${i}` }));
    const { service } = build({ stays: repo(null), prefs: repo(null), analyses: repo(many) });

    const bundle: any = await service.exportUserData('u1');

    expect(bundle.staysAccount).toBeNull();
    expect(bundle.communicationPreferences).toBeNull();
    expect(bundle.consents.stays).toBeNull();
    expect(bundle.analyses.truncated).toBe(true);
    expect(bundle.analyses.items).toHaveLength(ACCOUNT_EXPORT_ANALYSES_LIMIT);
  });

  it('falha fechado quando o usuário não existe', async () => {
    const { service } = build({ users: repo(null) });
    await expect(service.exportUserData('ghost')).rejects.toBeInstanceOf(NotFoundException);
  });
});
