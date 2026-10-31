import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OWNER_CONSENT_VERSION } from './owner-report.constants';
import { PropertyOwnersService } from './property-owners.service';

const HOST = 'host-1';
const OTHER_HOST = 'host-2';

type OwnerRow = Record<string, any>;

function makeService(seed: { owners?: OwnerRow[]; addresses?: OwnerRow[]; links?: OwnerRow[] } = {}) {
  const owners: OwnerRow[] = [...(seed.owners ?? [])];
  const links: OwnerRow[] = [...(seed.links ?? [])];
  const addresses: OwnerRow[] = seed.addresses ?? [
    { id: 'addr-1', ativo: true, user: { id: HOST }, list: { id: 'list-1', titulo: 'Studio Paulista', user: { id: HOST } }, bairro: 'Bela Vista', cidade: 'São Paulo' },
    { id: 'addr-2', ativo: true, user: { id: HOST }, list: { id: 'list-2', titulo: 'Loft Pinheiros', user: { id: HOST } } },
    { id: 'addr-x', ativo: true, user: { id: OTHER_HOST }, list: { id: 'list-x', titulo: 'Alheio', user: { id: OTHER_HOST } } },
  ];

  const ownerRepo = {
    find: jest.fn(async ({ where }: any) => owners.filter((o) => !where?.userId || o.userId === where.userId)),
    findOne: jest.fn(async ({ where }: any) =>
      owners.find((o) => Object.entries(where).every(([k, v]) => o[k] === v)) ?? null,
    ),
    create: jest.fn((value: OwnerRow) => ({ ...value })),
    save: jest.fn(async (value: OwnerRow) => {
      if (!value.id) {
        value.id = `owner-${owners.length + 1}`;
        owners.push(value);
      }
      return value;
    }),
    delete: jest.fn(async ({ id, userId }: any) => {
      const index = owners.findIndex((o) => o.id === id && o.userId === userId);
      if (index >= 0) owners.splice(index, 1);
      return { affected: index >= 0 ? 1 : 0 };
    }),
  };
  const linkRepo = {
    find: jest.fn(async ({ where }: any) => {
      const ownerIds: string[] | undefined = where?.ownerId?.value ?? (where?.ownerId ? [where.ownerId] : undefined);
      const addressIds: string[] | undefined = where?.addressId?.value;
      return links
        .filter((l) => (!ownerIds || ownerIds.includes(l.ownerId)) && (!addressIds || addressIds.includes(l.addressId)))
        .map((l) => ({ ...l, address: addresses.find((a) => a.id === l.addressId) }));
    }),
    create: jest.fn((value: OwnerRow) => ({ ...value })),
    save: jest.fn(async (value: OwnerRow | OwnerRow[]) => {
      for (const row of Array.isArray(value) ? value : [value]) links.push({ id: `link-${links.length + 1}`, ...row });
      return value;
    }),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
  const addressRepo = {
    find: jest.fn(async ({ where }: any) => {
      const wanted: string[] = where[0].id.value;
      return addresses.filter(
        (a) => wanted.includes(a.id) && a.ativo && (a.user?.id === HOST || a.list?.user?.id === HOST),
      );
    }),
  };
  const reportRepo = { find: jest.fn(async () => []) };
  const service = new PropertyOwnersService(ownerRepo as any, linkRepo as any, addressRepo as any, reportRepo as any);
  return { service, owners, links, ownerRepo, linkRepo, addressRepo };
}

const validDto = (overrides: Record<string, unknown> = {}) => ({
  name: 'Maria Souza',
  email: 'maria@example.com',
  propertyIds: ['addr-1'],
  consentAccepted: true,
  consentVersion: OWNER_CONSENT_VERSION,
  ...overrides,
});

describe('PropertyOwnersService: cadastro com consentimento registrado', () => {
  it('cria o proprietário gravando versão do texto, data e IP real, e vincula os imóveis', async () => {
    const { service, owners, links } = makeService();
    const created = await service.create(HOST, validDto({ propertyIds: ['addr-1', 'addr-2'] }) as any, '203.0.113.7');
    expect(owners).toHaveLength(1);
    expect(owners[0]).toMatchObject({
      userId: HOST,
      email: 'maria@example.com',
      consentVersion: OWNER_CONSENT_VERSION,
      consentIp: '203.0.113.7',
      monthlyReportEnabled: true,
      unsubscribedAt: null,
    });
    expect(owners[0].consentAcceptedAt).toBeInstanceOf(Date);
    expect(owners[0].unsubscribeRef).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(links.map((l) => l.addressId)).toEqual(['addr-1', 'addr-2']);
    expect(created.properties.map((p) => p.id).sort()).toEqual(['addr-1', 'addr-2']);
    // A resposta não expõe token nem referência de descadastro.
    expect(JSON.stringify(created)).not.toContain(owners[0].unsubscribeRef);
  });

  it('exige a declaração marcada e na versão vigente', async () => {
    const { service, owners } = makeService();
    await expect(service.create(HOST, validDto({ consentAccepted: false }) as any, '1.1.1.1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(HOST, validDto({ consentAccepted: undefined }) as any, '1.1.1.1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(HOST, validDto({ consentVersion: 'versao-antiga' }) as any, '1.1.1.1')).rejects.toThrow(/atualizado/);
    expect(owners).toHaveLength(0);
  });

  it('IP ausente fica null; IP gigante é truncado em 64', async () => {
    const { service, owners } = makeService();
    await service.create(HOST, validDto() as any, undefined);
    expect(owners[0].consentIp).toBeNull();
    const second = makeService();
    await second.service.create(HOST, validDto() as any, 'x'.repeat(200));
    expect(second.owners[0].consentIp).toHaveLength(64);
  });

  it('não repete e-mail do mesmo anfitrião', async () => {
    const { service } = makeService();
    await service.create(HOST, validDto() as any, '1.1.1.1');
    await expect(service.create(HOST, validDto({ propertyIds: ['addr-2'] }) as any, '1.1.1.1')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PropertyOwnersService: autorização (anfitrião só vê e edita o que é dele)', () => {
  it('imóvel de outro anfitrião responde como inexistente (404) e nada é gravado', async () => {
    const { service, owners, links } = makeService();
    await expect(service.create(HOST, validDto({ propertyIds: ['addr-x'] }) as any, '1.1.1.1')).rejects.toBeInstanceOf(NotFoundException);
    // Mistura de imóvel próprio e alheio também falha inteira.
    await expect(service.create(HOST, validDto({ propertyIds: ['addr-1', 'addr-x'] }) as any, '1.1.1.1')).rejects.toBeInstanceOf(NotFoundException);
    expect(owners).toHaveLength(0);
    expect(links).toHaveLength(0);
  });

  it('imóvel inexistente também é 404', async () => {
    const { service } = makeService();
    await expect(service.create(HOST, validDto({ propertyIds: ['nao-existe'] }) as any, '1.1.1.1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('um imóvel só pode ter um proprietário', async () => {
    const { service } = makeService({
      owners: [{ id: 'owner-9', userId: HOST, email: 'outro@example.com', name: 'Outro', consentVersion: 'v', consentAcceptedAt: new Date(), unsubscribeRef: 'r'.repeat(22) }],
      links: [{ id: 'l1', ownerId: 'owner-9', addressId: 'addr-1' }],
    });
    await expect(service.create(HOST, validDto() as any, '1.1.1.1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('proprietário de outro anfitrião: editar, remover e achar dão 404', async () => {
    const foreign = { id: 'owner-f', userId: OTHER_HOST, email: 'f@example.com', name: 'F', consentVersion: 'v', consentAcceptedAt: new Date(), unsubscribeRef: 'f'.repeat(22) };
    const { service, owners } = makeService({ owners: [foreign] });
    await expect(service.findOwned(HOST, 'owner-f')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(HOST, 'owner-f', { name: 'Hack' }, '1.1.1.1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(HOST, 'owner-f')).rejects.toBeInstanceOf(NotFoundException);
    expect(owners).toHaveLength(1);
    expect(owners[0].name).toBe('F');
  });

  it('a listagem só traz proprietários do anfitrião autenticado', async () => {
    const mine = { id: 'owner-m', userId: HOST, email: 'm@example.com', name: 'Minha', consentVersion: 'v', consentAcceptedAt: new Date('2026-10-01T00:00:00Z'), unsubscribeRef: 'm'.repeat(22), monthlyReportEnabled: true, unsubscribedAt: null };
    const foreign = { ...mine, id: 'owner-f', userId: OTHER_HOST, name: 'Alheia', email: 'f@example.com' };
    const { service } = makeService({ owners: [mine, foreign] });
    const list = await service.listForHost(HOST);
    expect(list.map((o) => o.name)).toEqual(['Minha']);
  });
});

describe('PropertyOwnersService: edição', () => {
  const owner = () => ({
    id: 'owner-1',
    userId: HOST,
    email: 'maria@example.com',
    name: 'Maria',
    monthlyReportEnabled: true,
    consentVersion: OWNER_CONSENT_VERSION,
    consentAcceptedAt: new Date('2026-10-01T00:00:00Z'),
    consentIp: '1.1.1.1',
    unsubscribedAt: new Date('2026-10-10T00:00:00Z'),
    unsubscribeRef: 'a'.repeat(22),
  });

  it('trocar o e-mail exige nova declaração e zera descadastro e referência (outro destinatário)', async () => {
    const { service, owners } = makeService({ owners: [owner()] });
    await expect(service.update(HOST, 'owner-1', { email: 'novo@example.com' }, '9.9.9.9')).rejects.toBeInstanceOf(BadRequestException);
    expect(owners[0].email).toBe('maria@example.com');

    await service.update(HOST, 'owner-1', { email: 'novo@example.com', consentAccepted: true, consentVersion: OWNER_CONSENT_VERSION }, '9.9.9.9');
    expect(owners[0]).toMatchObject({ email: 'novo@example.com', consentIp: '9.9.9.9', unsubscribedAt: null });
    expect(owners[0].unsubscribeRef).not.toBe('a'.repeat(22));
  });

  it('mudar nome ou preferência NÃO exige nova declaração e NÃO desfaz o descadastro do proprietário', async () => {
    const { service, owners } = makeService({ owners: [owner()] });
    await service.update(HOST, 'owner-1', { name: 'Maria S.', monthlyReportEnabled: true }, '9.9.9.9');
    expect(owners[0].name).toBe('Maria S.');
    expect(owners[0].unsubscribedAt).toBeInstanceOf(Date);
    expect(owners[0].consentIp).toBe('1.1.1.1');
  });

  it('trocar imóveis também valida que são do anfitrião', async () => {
    const { service } = makeService({ owners: [owner()] });
    await expect(service.update(HOST, 'owner-1', { propertyIds: ['addr-x'] }, '1.1.1.1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
