import { BadRequestException } from '@nestjs/common';
import { mockQueryBuilder } from './__fixtures__/query-builder-spec';
import { AdminMarketController } from './admin-market.controller';
import { MarketHealthService } from './market-health.service';
import { parseMarketTypologyQuery } from './market-typology';

function makeHealth(opts: { addresses?: any[]; sufficientFor?: (addressId: string) => boolean } = {}) {
  const externalQb = mockQueryBuilder([], [
    { source: 'licensed:airroi', city: 'sao-paulo', neighborhood: 'Pinheiros', listings: '120', lastCollectedAt: '2026-10-01' },
    { source: 'inside-airbnb', city: 'rio-de-janeiro', neighborhood: null, listings: '300', lastCollectedAt: new Date('2024-01-01T00:00:00Z') },
  ]);
  const customersQb = mockQueryBuilder([], [
    { city: 'São Paulo', neighborhood: 'Pinheiros', listings: '14', hosts: '9' },
  ]);
  const addressQb = mockQueryBuilder(opts.addresses ?? []);
  const addressRepo: any = {
    count: jest.fn().mockResolvedValue(42),
    createQueryBuilder: jest.fn((alias: string) => {
      // a consulta de cobertura usa innerJoinAndSelect; a de volume por bairro usa select agregado
      return alias === 'a' ? { ...customersQb, ...addressQbProxy(addressQb, customersQb) } : addressQb;
    }),
  };
  function addressQbProxy(coverage: any, volume: any) {
    const chain: any = {};
    for (const method of Object.keys(volume)) chain[method] = volume[method];
    chain.innerJoinAndSelect = jest.fn().mockReturnValue(coverage);
    chain.innerJoin = jest.fn().mockReturnValue(volume);
    return chain;
  }
  const logRepo: any = {
    find: jest.fn().mockResolvedValue([
      {
        id: 'log-1',
        source: 'licensed:airroi',
        city: 'sao-paulo',
        license: 'licensed_internal_only',
        collectedAt: new Date('2026-10-01T00:00:00Z'),
        fileName: 'a.csv',
        rowsImported: 120,
        rowsSkipped: 2,
        observationsImported: 240,
        createdAt: new Date('2026-10-02T10:00:00Z'),
      },
    ]),
  };
  const intel: any = {
    sourceStatuses: () => [
      { id: 'customers', label: 'Clientes My Urban', enabled: true },
      { id: 'licensed_dataset', label: 'Dataset licenciado', enabled: true },
      { id: 'inside_airbnb', label: 'Inside Airbnb', enabled: true },
      { id: 'own_scraping', label: 'Coleta própria', enabled: false, reason: 'aguardando parecer jurídico' },
    ],
    build: jest.fn(async ({ target }: any) => {
      const ok = opts.sufficientFor ? opts.sufficientFor(target.addressId) : false;
      return {
        compSet: {
          insufficient: !ok,
          sources: ok ? [{ source: 'customers' }, { source: 'licensed_dataset' }] : [],
        },
      };
    }),
  };
  const listingRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(externalQb) };
  return { service: new MarketHealthService(listingRepo, logRepo, addressRepo, intel), intel, addressQb };
}

describe('MarketHealthService', () => {
  it('volume por fonte e bairro, última atualização, defasagem e estado das fontes', async () => {
    const { service } = makeHealth();
    const health = await service.health(new Date('2026-10-31T12:00:00Z'));

    const bySource = Object.fromEntries(health.sources.map((s) => [s.id, s]));
    expect(bySource.licensed_dataset).toMatchObject({ listings: 120, lastCollectedAt: '2026-10-01', stale: false, enabled: true });
    expect(bySource.inside_airbnb).toMatchObject({ listings: 300, lastCollectedAt: '2024-01-01', stale: true });
    expect(bySource.customers).toMatchObject({ listings: 14, stale: false });
    expect(bySource.own_scraping).toMatchObject({ enabled: false, reason: 'aguardando parecer jurídico', listings: 0 });

    expect(health.neighborhoods[0]).toMatchObject({ source: 'inside_airbnb', listings: 300 });
    expect(health.neighborhoods.find((n) => n.source === 'customers')).toMatchObject({ hosts: 9, neighborhood: 'Pinheiros' });
    expect(health.recentImports[0]).toMatchObject({ source: 'licensed:airroi', license: 'licensed_internal_only', rowsImported: 120 });
    expect(health.config).toMatchObject({ minHosts: 5, minExternalListings: 8, scrapingEnabled: false });
    expect(health.coverage.activeProperties).toBe(42);
  });

  it('cobertura: % de imóveis ativos (amostra) com comp set suficiente e quais fontes contribuem', async () => {
    const addresses = ['a1', 'a2', 'a3', 'a4'].map((id) => ({
      id,
      latitude: -23.56,
      longitude: -46.68,
      cidade: 'São Paulo',
      estado: 'SP',
      user: { id: `u-${id}` },
      list: { id: `l-${id}`, dailyPrice: 300 },
    }));
    const { service, intel, addressQb } = makeHealth({ addresses, sufficientFor: (id) => id !== 'a4' });

    const health = await service.health(new Date('2026-10-31T12:00:00Z'));

    expect(health.coverage).toMatchObject({
      sampled: 4,
      withSufficientCompSet: 3,
      ratio: 0.75,
      target: 0.8,
      contributions: { customers: 3, licensed_dataset: 3 },
    });
    // coluna real da entidade Address (a de data é `updated_at`; um nome errado só quebra com banco de verdade)
    expect(addressQb.orderBy).toHaveBeenCalledWith('a.updated_at', 'DESC');
    // a cobertura roda no modo leve e com uso de exibição (o que o cliente de fato veria)
    expect(intel.build).toHaveBeenCalledWith(expect.objectContaining({ light: true, use: 'display' }));
  });

  it('cobertura é cacheada por alguns minutos (uma consulta por imóvel é cara)', async () => {
    const { service, intel } = makeHealth({
      addresses: [{ id: 'a1', latitude: -23.5, longitude: -46.6, user: { id: 'u' }, list: { id: 'l', dailyPrice: 300 } }],
    });
    await service.health(new Date('2026-10-31T12:00:00Z'));
    await service.health(new Date('2026-10-31T12:02:00Z'));
    expect(intel.build).toHaveBeenCalledTimes(1);
    await service.health(new Date('2026-10-31T12:10:00Z'));
    expect(intel.build).toHaveBeenCalledTimes(2);
  });

  it('sem imóveis com coordenadas, a razão é nula (não 0%)', async () => {
    const { service } = makeHealth();
    expect((await service.health()).coverage.ratio).toBeNull();
  });
});

describe('AdminMarketController', () => {
  const importService: any = { importCsv: jest.fn().mockResolvedValue({ imported: 1 }) };
  const controller = new AdminMarketController({ health: jest.fn() } as any, importService);
  const body = { datasetLabel: 'airroi', city: 'sao-paulo', license: 'licensed_internal_only' as const, collectedAt: '2026-10-01' };

  beforeEach(() => importService.importCsv.mockClear());

  it('exige o arquivo', async () => {
    await expect(controller.importLicensedDataset(undefined, body, {})).rejects.toThrow(BadRequestException);
    await expect(controller.importLicensedDataset({ buffer: Buffer.alloc(0), size: 0 }, body, {})).rejects.toThrow(/arquivo CSV/);
  });

  it('mapping inválido vira 400', async () => {
    const file = { buffer: Buffer.from('a,b\n1,2'), originalname: 'x.csv', size: 7 };
    await expect(controller.importLicensedDataset(file, { ...body, mapping: '{nao json' }, {})).rejects.toThrow(BadRequestException);
    expect(importService.importCsv).not.toHaveBeenCalled();
  });

  it('repassa licença, data de coleta, mapeamento, nome do arquivo (sem caminho) e o admin autenticado', async () => {
    const file = { buffer: Buffer.from('a,b\n1,2'), originalname: 'C:\\tmp\\dados.csv', size: 7 };
    await controller.importLicensedDataset(file, { ...body, mapping: '{"adr":"preco"}' }, { user: { userId: 'admin-1' } });
    expect(importService.importCsv).toHaveBeenCalledWith(
      'a,b\n1,2',
      expect.objectContaining({
        datasetLabel: 'airroi',
        license: 'licensed_internal_only',
        collectedAt: '2026-10-01',
        mapping: { adr: 'preco' },
        fileName: 'dados.csv',
        importedByUserId: 'admin-1',
      }),
    );
  });
});

describe('parseMarketTypologyQuery', () => {
  it('vazio ou "todos" = sem filtro', () => {
    expect(parseMarketTypologyQuery({})).toBeNull();
    expect(parseMarketTypologyQuery({ rooms: 'any', listingType: '', capacity: 'todos' })).toBeNull();
  });

  it('converte quartos, tipo e capacidade', () => {
    expect(parseMarketTypologyQuery({ rooms: '2', listingType: 'entire_home', capacity: '3-4' })).toEqual({
      rooms: 2,
      listingType: 'entire_home',
      capacity: '3-4',
    });
  });

  it('valor inválido é 400, não é ignorado', () => {
    expect(() => parseMarketTypologyQuery({ rooms: 'x' })).toThrow(BadRequestException);
    expect(() => parseMarketTypologyQuery({ rooms: '99' })).toThrow(BadRequestException);
    expect(() => parseMarketTypologyQuery({ listingType: 'castelo' })).toThrow(BadRequestException);
    expect(() => parseMarketTypologyQuery({ capacity: '100' })).toThrow(BadRequestException);
  });
});
