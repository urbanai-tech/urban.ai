import { mockQueryBuilder, whereClauses } from '../__fixtures__/query-builder-spec';
import { MarketSourceQuery } from '../market-data.types';
import { CustomersMarketSource } from './customers.source';
import { InsideAirbnbMarketSource } from './inside-airbnb.source';
import { LicensedDatasetMarketSource } from './licensed-dataset.source';
import { OwnScrapingMarketSource, MarketSourceDisabledError, SCRAPING_BLOCKED_REASON } from './own-scraping.source';

const query: MarketSourceQuery = {
  latitude: -23.5612,
  longitude: -46.6821,
  city: 'São Paulo',
  state: 'SP',
  radiusKm: 3,
  from: '2026-10-02',
  to: '2026-10-31',
  historyFrom: '2025-10-31',
  excludeUserId: 'me',
  excludeAddressId: 'addr-target',
  withObservations: true,
};

const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.MARKET_SOURCES;
  delete process.env.MARKET_SCRAPING_ENABLED;
});
afterAll(() => {
  process.env = originalEnv;
});

describe('CustomersMarketSource', () => {
  function address(id: string, owner: string, extra: any = {}) {
    return {
      id,
      latitude: -23.5615,
      longitude: -46.6825,
      bairro: 'Pinheiros',
      cidade: 'São Paulo',
      estado: 'SP',
      ativo: true,
      user: { id: owner },
      list: {
        id: `list-${id}`,
        id_do_anuncio: extra.airbnbId ?? '',
        dailyPrice: extra.price ?? 300,
        quartos: 2,
        hospedes: 4,
        propertyType: 'Apartment',
        user: { id: owner },
      },
      ...extra.address,
    };
  }

  function make(addresses: any[], snapshots: any[] = [], occupancy: any[] = []) {
    const addressQb = mockQueryBuilder(addresses);
    const snapshotQb = mockQueryBuilder(snapshots);
    const occupancyQb = mockQueryBuilder(occupancy);
    const source = new CustomersMarketSource(
      { createQueryBuilder: jest.fn().mockReturnValue(addressQb) } as any,
      { createQueryBuilder: jest.fn().mockReturnValue(snapshotQb) } as any,
      { createQueryBuilder: jest.fn().mockReturnValue(occupancyQb) } as any,
    );
    return { source, addressQb, snapshotQb };
  }

  it('só imóveis ativos de OUTROS clientes, dentro do raio, com filtro de região no SQL', async () => {
    const far = address('far', 'o-far', { address: { latitude: -23.7 } });
    const mine = address('mine', 'me');
    const ok = address('ok', 'o-1');
    const { source, addressQb } = make([far, mine, ok]);

    const result = await source.fetch(query);

    expect(result.records.map((r) => r.sourceListingId)).toEqual(['list-ok']);
    const clauses = whereClauses(addressQb);
    expect(clauses).toContain('address.latitude BETWEEN');
    expect(clauses).toContain('address.longitude BETWEEN');
    expect(addressQb.take).toHaveBeenCalledWith(5000);
  });

  it('normaliza o registro: origem, licença própria, dono, tipologia e dedupKey pelo id do Airbnb', async () => {
    const { source } = make([address('a', 'o-1', { airbnbId: '4242' }), address('b', 'o-2')]);
    const [withId, withoutId] = (await source.fetch(query)).records;
    expect(withId).toMatchObject({
      source: 'customers',
      license: 'first_party',
      ownerKey: 'o-1',
      dedupKey: 'abnb:4242',
      bedrooms: 2,
      capacity: 4,
      listingType: 'entire_home',
      neighborhood: 'Pinheiros',
      adr: 300,
    });
    expect(withoutId.dedupKey).toBe('customers:list-b');
  });

  it('usa snapshots de preço (mediana da janela e série) e a ocupação real do período', async () => {
    const snapshots = [
      { list: { id: 'list-a' }, snapshotDate: '2026-10-10', priceCents: 40000 },
      { list: { id: 'list-a' }, snapshotDate: '2026-10-11', priceCents: 50000 },
      { list: { id: 'list-a' }, snapshotDate: '2026-10-12', priceCents: 60000 },
      { list: { id: 'list-a' }, snapshotDate: '2026-01-01', priceCents: 10000 }, // fora da janela: só histórico
    ];
    const occupancy = [
      { list: { id: 'list-a' }, date: '2026-10-10', status: 'booked' },
      { list: { id: 'list-a' }, date: '2026-10-11', status: 'available' },
      { list: { id: 'list-a' }, date: '2026-10-12', status: 'blocked' },
    ];
    const { source } = make([address('a', 'o-1')], snapshots, occupancy);
    const [record] = (await source.fetch(query)).records;
    expect(record.adr).toBe(500);
    expect(record.occupancy).toBe(0.5);
    expect(record.observations).toHaveLength(4);
    expect(record.collectedAt).toBe('2026-10-12');
  });

  it('sem coordenadas no alvo cai para cidade+UF; sem nada, vazio', async () => {
    const { source, addressQb } = make([address('a', 'o-1')]);
    await source.fetch({ ...query, latitude: null, longitude: null });
    expect(whereClauses(addressQb)).toContain('LOWER(address.cidade)');
    const empty = await source.fetch({ ...query, latitude: null, longitude: null, city: null, state: null });
    expect(empty.records).toEqual([]);
  });

  it('modo leve (cobertura) não devolve séries', async () => {
    const { source } = make([address('a', 'o-1')], [{ list: { id: 'list-a' }, snapshotDate: '2026-10-10', priceCents: 40000 }]);
    const [record] = (await source.fetch({ ...query, withObservations: false })).records;
    expect(record.observations).toBeUndefined();
  });
});

describe('fontes sobre external_listing (dataset licenciado e Inside Airbnb)', () => {
  function row(extra: any = {}) {
    return {
      id: 'uuid-1',
      externalId: '777',
      source: 'inside-airbnb',
      city: 'sao-paulo',
      snapshotDate: new Date('2026-09-01T00:00:00Z'),
      collectedAt: new Date('2026-09-01T00:00:00Z'),
      latitude: -23.5615,
      longitude: -46.6825,
      priceCents: 35000,
      roomType: 'Entire home/apt',
      listingType: null,
      neighborhood: 'Pinheiros',
      bedrooms: 2,
      accommodates: 4,
      availability365: 100,
      occupancyRate: null,
      airbnbListingId: '777',
      license: 'cc_by_4',
      ...extra,
    };
  }

  function make(Source: any, rows: any[], observations: any[] = []) {
    const listingQb = mockQueryBuilder(rows);
    const obsQb = mockQueryBuilder(observations);
    const source = new Source(
      { createQueryBuilder: jest.fn().mockReturnValue(listingQb) } as any,
      { createQueryBuilder: jest.fn().mockReturnValue(obsQb) } as any,
    );
    return { source, listingQb, obsQb };
  }

  it('Inside Airbnb: filtra a fonte no SQL, mapeia licença CC BY, data de coleta e ocupação PROXY', async () => {
    const { source, listingQb } = make(InsideAirbnbMarketSource, [row()]);
    const [record] = (await source.fetch(query)).records;

    expect(whereClauses(listingQb)).toContain('l.source = :source');
    expect(listingQb.where).toHaveBeenCalledWith('l.source = :source', { source: 'inside-airbnb' });
    expect(record).toMatchObject({
      source: 'inside_airbnb',
      license: 'cc_by_4',
      collectedAt: '2026-09-01',
      adr: 350,
      dedupKey: 'abnb:777',
      listingType: 'entire_home',
      occupancyIsProxy: true,
    });
    expect(record.occupancy).toBeCloseTo(1 - 100 / 365, 4);
  });

  it('dataset licenciado: prefixo licensed:, licença do lote e ocupação observada (não proxy)', async () => {
    const { source, listingQb } = make(LicensedDatasetMarketSource, [
      row({ source: 'licensed:airroi', licence: undefined, license: 'licensed_internal_only', occupancyRate: 0.64, airbnbListingId: null, externalId: 'syn-1' }),
    ]);
    const [record] = (await source.fetch(query)).records;
    expect(listingQb.where).toHaveBeenCalledWith('l.source LIKE :source', { source: 'licensed:%' });
    expect(record).toMatchObject({
      source: 'licensed_dataset',
      license: 'licensed_internal_only',
      occupancy: 0.64,
      occupancyIsProxy: false,
      dedupKey: 'licensed_dataset:syn-1',
    });
  });

  it('licença ausente ou desconhecida vira unknown (nunca entra no comp set)', async () => {
    const { source } = make(LicensedDatasetMarketSource, [row({ license: null }), row({ license: 'qualquer-coisa', externalId: '2' })]);
    expect((await source.fetch(query)).records.map((r) => r.license)).toEqual(['unknown', 'unknown']);
  });

  it('carrega a série histórica de observações por anúncio', async () => {
    const { source, obsQb } = make(InsideAirbnbMarketSource, [row()], [
      { externalListingId: 'uuid-1', observedOn: '2026-08-15', priceCents: 30000, occupancyRate: 0.7 },
      { externalListingId: 'uuid-1', observedOn: '2026-09-15', priceCents: 33000, occupancyRate: null },
    ]);
    const [record] = (await source.fetch(query)).records;
    expect(record.observations).toEqual([
      { date: '2026-08-15', adr: 300, occupancy: 0.7 },
      { date: '2026-09-15', adr: 330, occupancy: null },
    ]);
    expect(whereClauses(obsQb)).toContain('o.observedOn BETWEEN');
  });

  it('descarta o que está fora do raio exato e não consulta sem coordenadas', async () => {
    const { source } = make(InsideAirbnbMarketSource, [row(), row({ externalId: '2', latitude: -23.7 })]);
    expect((await source.fetch(query)).records).toHaveLength(1);
    const noCoords = await source.fetch({ ...query, latitude: null, longitude: null });
    expect(noCoords.records).toEqual([]);
    expect(noCoords.disabledReason).toMatch(/coordenadas/);
  });

  it('fonte desligada por MARKET_SOURCES devolve vazio com o motivo, sem consultar o banco', async () => {
    process.env.MARKET_SOURCES = 'customers';
    const { source, listingQb } = make(LicensedDatasetMarketSource, [row()]);
    const result = await source.fetch(query);
    expect(result.records).toEqual([]);
    expect(result.disabledReason).toMatch(/MARKET_SOURCES/);
    expect(listingQb.getMany).not.toHaveBeenCalled();
    expect(source.status().enabled).toBe(false);
  });
});

describe('OwnScrapingMarketSource — desligada até parecer jurídico', () => {
  it('por padrão está desligada e devolve vazio com o motivo "aguardando parecer jurídico"', async () => {
    const source = new OwnScrapingMarketSource();
    expect(source.status()).toEqual({ enabled: false, reason: SCRAPING_BLOCKED_REASON });
    const result = await source.fetch(query);
    expect(result.records).toEqual([]);
    expect(result.disabledReason).toBe('aguardando parecer jurídico');
  });

  it('assertEnabled lança MarketSourceDisabledError (para jobs de coleta chamados por engano)', () => {
    const source = new OwnScrapingMarketSource();
    expect(() => source.assertEnabled()).toThrow(MarketSourceDisabledError);
    expect(() => source.assertEnabled()).toThrow(/aguardando parecer jurídico/);
  });

  it('mesmo com MARKET_SCRAPING_ENABLED=true continua vazia: não existe coletor implementado', async () => {
    process.env.MARKET_SCRAPING_ENABLED = 'true';
    process.env.MARKET_SOURCES = 'customers,own_scraping';
    const source = new OwnScrapingMarketSource();
    const status = source.status();
    expect(status.enabled).toBe(false);
    expect(status.reason).toMatch(/nenhum coletor implementado/);
    expect((await source.fetch(query)).records).toEqual([]);
  });

  it('só devolve algo se um coletor for registrado explicitamente E a flag estiver ligada', async () => {
    process.env.MARKET_SCRAPING_ENABLED = 'true';
    const source = new OwnScrapingMarketSource();
    const collect = jest.fn().mockResolvedValue([{ sourceListingId: 'x' }]);
    source.registerCollector({ collect } as any);
    expect((await source.fetch(query)).records).toHaveLength(1);
    delete process.env.MARKET_SCRAPING_ENABLED;
    collect.mockClear();
    expect((await source.fetch(query)).records).toEqual([]);
    expect(collect).not.toHaveBeenCalled();
  });
});
