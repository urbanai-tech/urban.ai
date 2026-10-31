import { BadRequestException, GoneException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { OwnerReportsService } from './owner-reports.service';
import { issueOwnerToken, signOwnerToken } from './owner-report-token';

const HOST = 'host-1';
const NOW = new Date('2026-11-03T12:00:00Z');

type Row = Record<string, any>;

function makeService(seed: { links?: Row[]; reports?: Row[]; owners?: Row[] } = {}) {
  const links: Row[] = seed.links ?? [];
  const reports: Row[] = seed.reports ?? [];
  const owners: Row[] = seed.owners ?? [];

  const ownerRepo = {
    findOne: jest.fn(async ({ where }: any) => owners.find((o) => o.unsubscribeRef === where.unsubscribeRef) ?? null),
    save: jest.fn(async (value: Row) => value),
  };
  const reportRepo = {
    findOne: jest.fn(async ({ where }: any) => reports.find((r) => r.ownerId === where.ownerId && r.period === where.period) ?? null),
    find: jest.fn(async ({ where }: any) => reports.filter((r) => !where?.ownerId || r.ownerId === where.ownerId)),
    create: jest.fn((v: Row) => ({ id: `report-${reports.length + 1}`, ...v })),
    save: jest.fn(async (v: Row) => {
      if (!reports.includes(v)) reports.push(v);
      return v;
    }),
  };
  const linkRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const row = links.find((l) => (where.tokenHash ? l.tokenHash === where.tokenHash : l.id === where.id));
      return row ? { ...row, report: reports.find((r) => r.id === row.reportId) } : null;
    }),
    find: jest.fn(async () => links),
    create: jest.fn((v: Row) => ({ id: `link-${links.length + 1}`, createdAt: NOW, ...v })),
    save: jest.fn(async (v: Row) => {
      const index = links.findIndex((l) => l.id === v.id);
      if (index >= 0) links[index] = { ...links[index], ...v };
      else links.push(v);
      return v;
    }),
    update: jest.fn(async (criteria: any, patch: Row) => {
      let affected = 0;
      for (const link of links) {
        const matches = Object.entries(criteria).every(([key, value]) =>
          (value as any)?._type === 'isNull' ? link[key] == null : (value as any)?._type === 'in' ? (value as any).value.includes(link[key]) : link[key] === value,
        );
        if (matches) {
          Object.assign(link, patch);
          affected += 1;
        }
      }
      return { affected };
    }),
    increment: jest.fn(async ({ id }: any, field: string, by: number) => {
      const link = links.find((l) => l.id === id);
      if (link) link[field] = (link[field] ?? 0) + by;
    }),
  };
  const owners$ = {
    findOwned: jest.fn(async (hostUserId: string, ownerId: string) => {
      const owner = owners.find((o) => o.id === ownerId && o.userId === hostUserId);
      if (!owner) throw new NotFoundException('Proprietário não encontrado');
      return owner;
    }),
  };
  const service = new OwnerReportsService(
    ownerRepo as any,
    { find: jest.fn(async () => []) } as any,
    reportRepo as any,
    linkRepo as any,
    { find: jest.fn(async () => []) } as any,
    { createQueryBuilder: jest.fn() } as any,
    { findOne: jest.fn(async () => ({ username: 'Ana Host' })) } as any,
    owners$ as any,
  );
  return { service, links, reports, owners, linkRepo, reportRepo, ownerRepo, owners$ };
}

const payload = { version: 1, owner: { name: 'Maria' }, summary: { propertyCount: 1 }, properties: [] };

function seedLink(overrides: Row = {}) {
  const issued = issueOwnerToken('link')!;
  const link = {
    id: 'link-1',
    reportId: 'report-1',
    tokenHash: issued.hash,
    origin: 'email',
    expiresAt: new Date('2026-12-01T12:00:00Z'),
    revokedAt: null,
    viewCount: 0,
    firstViewedAt: null,
    lastViewedAt: null,
    createdAt: NOW,
    ...overrides,
  };
  const report = { id: 'report-1', ownerId: 'owner-1', period: '2026-10', generatedAt: new Date('2026-11-02T12:00:00Z'), payloadJson: JSON.stringify(payload), emailStatus: 'sent' };
  return { issued, link, report };
}

describe('OwnerReportsService: link público (token, expiração, revogação)', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, OWNER_REPORT_TOKEN_SECRET: 'segredo-de-teste' };
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it('token válido devolve SÓ o relatório e metadados mínimos; conta a visualização', async () => {
    const { issued, link, report } = seedLink();
    const { service, links } = makeService({ links: [link], reports: [report] });
    const result = await service.resolvePublic(issued.token, NOW);
    expect(result.report).toEqual(payload);
    expect(Object.keys(result.meta).sort()).toEqual(['expiresAt', 'generatedAt', 'notice', 'period']);
    expect(links[0].viewCount).toBe(1);
    expect(links[0].firstViewedAt).toEqual(NOW);
    expect(links[0].lastViewedAt).toEqual(NOW);
    // Nada de ID interno na resposta.
    expect(JSON.stringify(result)).not.toMatch(/owner-1|report-1|link-1/);
  });

  it('token adulterado ou lixo: 404 genérico, sem sequer consultar o banco', async () => {
    const { issued, link, report } = seedLink();
    const { service, linkRepo } = makeService({ links: [link], reports: [report] });
    const [random, signature] = issued.token.split('.');
    for (const bad of [`${random}.${signature.slice(0, -1)}A`, `X${random.slice(1)}.${signature}`, 'lixo', '', 'a'.repeat(300)]) {
      await expect(service.resolvePublic(bad, NOW)).rejects.toBeInstanceOf(NotFoundException);
    }
    expect(linkRepo.findOne).not.toHaveBeenCalled();
  });

  it('token com assinatura válida mas desconhecido (ex.: já apagado pela retenção): 404', async () => {
    const { service } = makeService();
    await expect(service.resolvePublic(issueOwnerToken('link')!.token, NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('link expirado: 410 LINK_EXPIRED, sem dados e sem contar visualização', async () => {
    const { issued, link, report } = seedLink({ expiresAt: new Date('2026-11-03T11:59:59Z') });
    const { service, links } = makeService({ links: [link], reports: [report] });
    const error: GoneException = await service.resolvePublic(issued.token, NOW).catch((e) => e);
    expect(error).toBeInstanceOf(GoneException);
    expect((error.getResponse() as any).code).toBe('LINK_EXPIRED');
    expect(JSON.stringify(error.getResponse())).not.toContain('Maria');
    expect(links[0].viewCount).toBe(0);
  });

  it('link revogado: 410 LINK_REVOKED mesmo dentro do prazo', async () => {
    const { issued, link, report } = seedLink({ revokedAt: new Date('2026-11-02T00:00:00Z') });
    const { service } = makeService({ links: [link], reports: [report] });
    const error: GoneException = await service.resolvePublic(issued.token, NOW).catch((e) => e);
    expect(error).toBeInstanceOf(GoneException);
    expect((error.getResponse() as any).code).toBe('LINK_REVOKED');
  });

  it('desligado por env (OWNER_REPORT_ENABLED=false) o link responde 404', async () => {
    process.env.OWNER_REPORT_ENABLED = 'false';
    const { issued, link, report } = seedLink();
    const { service } = makeService({ links: [link], reports: [report] });
    await expect(service.resolvePublic(issued.token, NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('erro ao contar visualização não derruba a leitura', async () => {
    const { issued, link, report } = seedLink();
    const { service, linkRepo } = makeService({ links: [link], reports: [report] });
    linkRepo.increment.mockRejectedValueOnce(new Error('db fora'));
    await expect(service.resolvePublic(issued.token, NOW)).resolves.toMatchObject({ report: payload });
  });
});

describe('OwnerReportsService: emissão e revogação pelo anfitrião', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, OWNER_REPORT_TOKEN_SECRET: 'segredo-de-teste', FRONT_URL: 'https://app.exemplo.com/' };
    delete process.env.OWNER_REPORT_LINK_TTL_DAYS;
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it('createLink grava só o hash, expira em 30 dias por padrão e devolve a URL com o token', async () => {
    const { service, links } = makeService();
    const { link, url } = await service.createLink({ id: 'report-1' } as any, 'host', undefined, NOW);
    expect(url).toMatch(/^https:\/\/app\.exemplo\.com\/relatorio\/[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{22}$/);
    const token = url.split('/relatorio/')[1];
    expect(JSON.stringify(links)).not.toContain(token.split('.')[0]);
    expect(link.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(link.expiresAt.toISOString()).toBe('2026-12-03T12:00:00.000Z');
  });

  it('TTL configurável por pedido, limitado a 90 dias', async () => {
    const { service } = makeService();
    const week = await service.createLink({ id: 'r' } as any, 'host', 7, NOW);
    expect(week.link.expiresAt.toISOString()).toBe('2026-11-10T12:00:00.000Z');
    const huge = await service.createLink({ id: 'r' } as any, 'host', 999, NOW);
    expect(huge.link.expiresAt.toISOString()).toBe('2027-02-01T12:00:00.000Z');
  });

  it('sem segredo configurado: 503 explicando, sem emitir link', async () => {
    delete process.env.OWNER_REPORT_TOKEN_SECRET;
    delete process.env.JWT_SECRET;
    const { service, links } = makeService();
    await expect(service.createLink({ id: 'r' } as any, 'host', undefined, NOW)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(links).toHaveLength(0);
  });

  it('revogar um link o torna inválido imediatamente na rota pública', async () => {
    const { issued, link, report } = seedLink();
    const owner = { id: 'owner-1', userId: HOST };
    const { service, links } = makeService({ links: [link], reports: [report], owners: [owner] });
    await service.revokeLink(HOST, 'owner-1', 'link-1', NOW);
    expect(links[0].revokedAt).toEqual(NOW);
    await expect(service.resolvePublic(issued.token, NOW)).rejects.toBeInstanceOf(GoneException);
    // Idempotente: revogar de novo não muda a data.
    await service.revokeLink(HOST, 'owner-1', 'link-1', new Date('2026-11-04T00:00:00Z'));
    expect(links[0].revokedAt).toEqual(NOW);
  });

  it('anfitrião não revoga link de outro proprietário/anfitrião (404)', async () => {
    const { link, report } = seedLink();
    const { service, links } = makeService({
      links: [link],
      reports: [report],
      owners: [
        { id: 'owner-1', userId: 'host-outro' },
        { id: 'owner-meu', userId: HOST },
      ],
    });
    // Proprietário alheio.
    await expect(service.revokeLink(HOST, 'owner-1', 'link-1', NOW)).rejects.toBeInstanceOf(NotFoundException);
    // Proprietário meu, mas o link pertence ao relatório de outro proprietário.
    await expect(service.revokeLink(HOST, 'owner-meu', 'link-1', NOW)).rejects.toBeInstanceOf(NotFoundException);
    expect(links[0].revokedAt).toBeNull();
  });

  it('preview e geração só aceitam período válido e já iniciado', async () => {
    const { service } = makeService({ owners: [{ id: 'owner-1', userId: HOST }] });
    await expect(service.previewForHost(HOST, 'owner-1', '2026-13', NOW)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.previewForHost(HOST, 'owner-1', '2027-01', NOW)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.previewForHost('outro-host', 'owner-1', '2026-10', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OwnerReportsService: descadastro do proprietário', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, OWNER_REPORT_TOKEN_SECRET: 'segredo-de-teste' };
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  const ref = 'r'.repeat(22);

  it('token assinado desliga o envio e é idempotente', async () => {
    const owner: Row = { id: 'owner-1', unsubscribeRef: ref, unsubscribedAt: null, monthlyReportEnabled: true };
    const { service, ownerRepo } = makeService({ owners: [owner] });
    const token = signOwnerToken('unsub', ref)!;
    expect(await service.isUnsubscribeTokenValid(token)).toBe(true);
    expect(await service.unsubscribeOwner(token, NOW)).toBe(true);
    expect(owner.unsubscribedAt).toEqual(NOW);
    expect(owner.monthlyReportEnabled).toBe(false);
    expect(await service.unsubscribeOwner(token, new Date('2026-12-01T00:00:00Z'))).toBe(true);
    expect(owner.unsubscribedAt).toEqual(NOW);
    expect(ownerRepo.save).toHaveBeenCalledTimes(1);
  });

  it('token adulterado, de link ou de outro proprietário não descadastra ninguém', async () => {
    const owner: Row = { id: 'owner-1', unsubscribeRef: ref, unsubscribedAt: null, monthlyReportEnabled: true };
    const { service } = makeService({ owners: [owner] });
    const token = signOwnerToken('unsub', ref)!;
    expect(await service.unsubscribeOwner(`${token}x`, NOW)).toBe(false);
    expect(await service.unsubscribeOwner(issueOwnerToken('link')!.token, NOW)).toBe(false);
    expect(await service.unsubscribeOwner(signOwnerToken('unsub', 'z'.repeat(22))!, NOW)).toBe(false);
    expect(await service.isUnsubscribeTokenValid('lixo')).toBe(false);
    expect(owner.unsubscribedAt).toBeNull();
  });
});
