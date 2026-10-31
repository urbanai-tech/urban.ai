import { HostPanelsService } from './host-panels.service';
import { MarketIntelService } from '../market-data/market-intel.service';
import { CustomersMarketSource } from '../market-data/sources/customers.source';
import { PortfolioActionTargetResolverService } from './portfolio-action-target-resolver.service';

/**
 * Market Intel: dados de imóveis de OUTROS clientes só podem sair agregados,
 * e apenas para grupos com N >= MARKET_INTEL_MIN_GROUP_SIZE anfitriões distintos.
 */
describe('HostPanelsService.marketIntel (privacidade)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MARKET_INTEL_MIN_GROUP_SIZE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function address(id: string, ownerId: string, price: number, lat = -23.55, lng = -46.63, rooms?: number) {
    return {
      id,
      latitude: lat,
      longitude: lng,
      bairro: 'Pinheiros',
      cidade: 'São Paulo',
      estado: 'SP',
      ativo: true,
      user: { id: ownerId },
      list: { id: `list-${id}`, dailyPrice: price, quartos: rooms, user: { id: ownerId } },
    };
  }

  function makeService(candidates: any[], extraSources: any[] = []) {
    const qb: any = {};
    for (const m of ['innerJoinAndSelect', 'leftJoinAndSelect', 'where', 'andWhere', 'take']) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.getMany = jest.fn().mockResolvedValue(candidates);
    const addressRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const snapshotQb: any = {};
    for (const m of ['leftJoinAndSelect', 'where', 'andWhere']) {
      snapshotQb[m] = jest.fn().mockReturnValue(snapshotQb);
    }
    snapshotQb.getMany = jest.fn().mockResolvedValue([]);
    const snapshotRepo = { find: jest.fn().mockResolvedValue([]), createQueryBuilder: jest.fn().mockReturnValue(snapshotQb) };
    const occupancyQb: any = {};
    for (const m of ['leftJoinAndSelect', 'where', 'andWhere']) {
      occupancyQb[m] = jest.fn().mockReturnValue(occupancyQb);
    }
    occupancyQb.getMany = jest.fn().mockResolvedValue([]);
    const occupancyRepo = { createQueryBuilder: jest.fn().mockReturnValue(occupancyQb) };
    const analiseRepo = { find: jest.fn().mockResolvedValue([]) };
    const eventQb: any = {};
    for (const m of ['where', 'andWhere', 'take']) eventQb[m] = jest.fn().mockReturnValue(eventQb);
    eventQb.getMany = jest.fn().mockResolvedValue([]);
    const eventRepo = { createQueryBuilder: jest.fn().mockReturnValue(eventQb) };
    const marketIntel = new MarketIntelService([
      new CustomersMarketSource(addressRepo as any, snapshotRepo as any, occupancyRepo as any),
      ...extraSources,
    ]);

    const service = new HostPanelsService(
      addressRepo as any,
      {} as any,
      {} as any,
      eventRepo as any,
      analiseRepo as any,
      snapshotRepo as any,
      occupancyRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      new PortfolioActionTargetResolverService(),
      marketIntel,
    );
    const own = address('own', 'me', 300);
    jest.spyOn(service as any, 'getOwnedAddress').mockResolvedValue(own);
    return { service, qb, addressRepo };
  }

  const from = '2026-10-01';
  const to = '2026-10-30';

  it('com 4 anfitriões diferentes devolve estado "dados insuficientes" sem nenhum dado de terceiros', async () => {
    const others = [1, 2, 3, 4].map((i) => address(`c${i}`, `owner-${i}`, 200 + i));
    const { service } = makeService(others);

    const result: any = await service.marketIntel('me', 'own', { from, to });

    expect(result.insufficientData).toBe(true);
    expect(result.aggregatedOnly).toBe(true);
    expect(result.comparables).toEqual([]);
    expect(result.comparablesCount).toBe(0);
    expect(result.medianAdr).toBe(0);
    expect(result.adrPercentiles).toBeNull();
    expect(result.daily).toEqual([]);
    expect(result.message).toMatch(/insuficientes/i);
    expect(result.minGroupSize).toBe(5);
  });

  it('muitos imóveis do MESMO anfitrião não contam como grupo (N conta anfitriões distintos)', async () => {
    const others = [1, 2, 3, 4, 5, 6].map((i) => address(`c${i}`, 'same-owner', 200 + i));
    const { service } = makeService(others);

    const result: any = await service.marketIntel('me', 'own', { from, to });

    expect(result.insufficientData).toBe(true);
  });

  it('com 5+ anfitriões devolve só agregados e nunca a lista por imóvel', async () => {
    const others = [1, 2, 3, 4, 5].map((i) => address(`c${i}`, `owner-${i}`, 100 * i));
    const { service } = makeService(others);

    const result: any = await service.marketIntel('me', 'own', { from, to });

    expect(result.insufficientData).toBe(false);
    expect(result.aggregatedOnly).toBe(true);
    expect(result.comparables).toEqual([]);
    expect(result.comparablesCount).toBe(5);
    expect(result.medianAdr).toBe(300);
    expect(result.adrPercentiles).toEqual({ p25: 200, p50: 300, p75: 400 });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('distanceKm');
    expect(serialized).not.toContain('anonymousId');
    expect(serialized).not.toContain('similarityScore');
    expect(serialized).not.toContain('owner-');
  });

  it('respeita MARKET_INTEL_MIN_GROUP_SIZE e aplica piso de 3', async () => {
    process.env.MARKET_INTEL_MIN_GROUP_SIZE = '3';
    const three = [1, 2, 3].map((i) => address(`c${i}`, `owner-${i}`, 100 * i));
    const ok: any = await makeService(three).service.marketIntel('me', 'own', { from, to });
    expect(ok.insufficientData).toBe(false);
    expect(ok.minGroupSize).toBe(3);

    process.env.MARKET_INTEL_MIN_GROUP_SIZE = '1';
    const floored: any = await makeService(three.slice(0, 2)).service.marketIntel('me', 'own', { from, to });
    expect(floored.insufficientData).toBe(true);
    expect(floored.minGroupSize).toBe(3);
  });

  it('exclui os próprios imóveis do anfitrião e candidatos fora do raio', async () => {
    const far = address('far', 'owner-far', 100, -23.7, -46.63); // ~16 km
    const mine = address('mine', 'me', 100);
    const others = [1, 2, 3, 4, 5].map((i) => address(`c${i}`, `owner-${i}`, 100 * i));
    const { service } = makeService([far, mine, ...others]);

    const result: any = await service.marketIntel('me', 'own', { from, to });

    expect(result.comparablesCount).toBe(5);
  });

  it('filtra por região no SQL (bounding box) e não varre a base inteira', async () => {
    const { service, qb } = makeService([]);

    await service.marketIntel('me', 'own', { from, to });

    const clauses = qb.andWhere.mock.calls.map((call: any[]) => call[0]).join(' | ');
    expect(clauses).toContain('address.latitude BETWEEN');
    expect(clauses).toContain('address.longitude BETWEEN');
    expect(qb.take).toHaveBeenCalledWith(5000);
  });

  describe('mercado multifonte (ADR 0028)', () => {
    function externalSource(records: any[]) {
      return {
        id: 'licensed_dataset',
        label: 'Dataset licenciado',
        precedence: 1,
        status: () => ({ enabled: true }),
        fetch: async () => ({ records }),
      };
    }
    function externalRecord(i: number, extra: any = {}) {
      return {
        source: 'licensed_dataset',
        sourceListingId: `syn-${i}`,
        dedupKey: `abnb:900${i}`,
        latitude: -23.5505 + 0.0003 * i,
        longitude: -46.6333,
        neighborhood: 'Pinheiros',
        city: 'sao-paulo',
        adr: 250 + 10 * i,
        occupancy: 0.6,
        occupancyIsProxy: false,
        bedrooms: 1,
        listingType: 'entire_home',
        capacity: 2,
        collectedAt: new Date().toISOString().slice(0, 10),
        license: 'licensed_display_aggregate',
        ...extra,
      };
    }

    it('mantém os campos antigos e acrescenta os novos (contrato compatível)', async () => {
      const others = [1, 2, 3, 4, 5].map((i) => address(`c${i}`, `owner-${i}`, 100 * i));
      const result: any = await makeService(others).service.marketIntel('me', 'own', { from, to });

      for (const key of [
        'percentile',
        'percentileTrend30d',
        'comparablesCount',
        'medianAdr',
        'medianOccupancy',
        'yourAdr',
        'yourOccupancy',
        'eventReactivity',
        'daily',
        'comparables',
        'aggregatedOnly',
        'insufficientData',
        'minGroupSize',
        'radiusKm',
        'adrPercentiles',
        'occupancyPercentiles',
        'updatedAt',
      ]) {
        expect(result).toHaveProperty(key);
      }
      expect(result.percentileTrend30d).toBe(0); // sem histórico a tendência fica indisponível, não inventada
      expect(result.trend30d.available).toBe(false);
      expect(result.schemaVersion).toBe(2);
      expect(result.occupancyAvailable).toBe(false); // sem registro de ocupação: indisponível, não 0%
      expect(result.dataSources).toEqual([
        expect.objectContaining({ id: 'customers', label: 'Clientes My Urban', listings: 5, licenses: ['first_party'] }),
      ]);
      expect(result.radius).toEqual({ km: 3, min: 1, max: 5 });
    });

    it('raio configurável de 1 a 5 km: respeita o pedido e limita os extremos', async () => {
      const at2km = (i: number) => address(`c${i}`, `owner-${i}`, 100 * i, -23.55 - 2 / 111.32, -46.63);
      const others = [1, 2, 3, 4, 5].map(at2km);
      const run = (input: any) => makeService(others).service.marketIntel('me', 'own', { from, to, ...input }) as Promise<any>;

      const narrow = await run({ radiusKm: 1 });
      expect(narrow.radiusKm).toBe(1);
      expect(narrow.insufficientData).toBe(true);

      const wide = await run({ radiusKm: '4' });
      expect(wide.radiusKm).toBe(4);
      expect(wide.insufficientData).toBe(false);

      expect((await run({ radiusKm: 99 })).radiusKm).toBe(5);
      expect((await run({ radiusKm: 0 })).radiusKm).toBe(1);
      expect((await run({})).radiusKm).toBe(3);
    });

    it('tipologia (quartos) reduz o comp set e o estado insuficiente explica o que falta', async () => {
      const twoRooms = [1, 2, 3, 4, 5].map((i) => address(`t${i}`, `owner-t${i}`, 300, -23.55, -46.63, 2));
      const oneRoom = [1, 2].map((i) => address(`o${i}`, `owner-o${i}`, 200, -23.55, -46.63, 1));

      const all: any = await makeService([...twoRooms, ...oneRoom]).service.marketIntel('me', 'own', { from, to });
      expect(all.comparablesCount).toBe(7);

      const onlyOneRoom: any = await makeService([...twoRooms, ...oneRoom]).service.marketIntel('me', 'own', {
        from,
        to,
        typology: { rooms: 1 },
      });
      expect(onlyOneRoom.insufficientData).toBe(true);
      expect(onlyOneRoom.typology.applied).toEqual({ rooms: 1, listingType: null, capacity: null });
      expect(onlyOneRoom.insufficiency.reasons.join(' ')).toContain('2 anfitriões distintos');
      expect(onlyOneRoom.insufficiency.hints.join(' ')).toMatch(/Afrouxe a tipologia/);
      expect(onlyOneRoom.message).toMatch(/insuficientes/i);
    });

    it('fontes externas completam o comp set (mínimo por anúncios distintos) e mostram origem e licença', async () => {
      const external = Array.from({ length: 8 }, (_, i) => externalRecord(i));
      const result: any = await makeService([], [externalSource(external)]).service.marketIntel('me', 'own', { from, to });

      expect(result.insufficientData).toBe(false);
      expect(result.comparablesCount).toBe(8);
      expect(result.dataSources).toEqual([
        expect.objectContaining({ id: 'licensed_dataset', listings: 8, licenses: ['licensed_display_aggregate'] }),
      ]);
      expect(result.minExternalListings).toBe(8);
      expect(result.attribution).toEqual([]);
    });

    it('7 anúncios externos não bastam (o mínimo é 8 distintos)', async () => {
      const external = Array.from({ length: 7 }, (_, i) => externalRecord(i));
      const result: any = await makeService([], [externalSource(external)]).service.marketIntel('me', 'own', { from, to });
      expect(result.insufficientData).toBe(true);
      expect(result.insufficiency.external).toMatchObject({ distinct: 7, required: 8, qualified: false });
    });

    it('dataset de uso interno NUNCA aparece na tela do cliente', async () => {
      const external = Array.from({ length: 9 }, (_, i) => externalRecord(i, { license: 'licensed_internal_only' }));
      const result: any = await makeService([], [externalSource(external)]).service.marketIntel('me', 'own', { from, to });
      expect(result.insufficientData).toBe(true);
      expect(JSON.stringify(result)).not.toContain('syn-');
      expect(result.dataSources).toEqual([]);
    });

    it('Inside Airbnb pede atribuição CC BY e a resposta nunca traz identificadores de anúncios', async () => {
      const external = Array.from({ length: 8 }, (_, i) =>
        externalRecord(i, { source: 'inside_airbnb', license: 'cc_by_4', occupancyIsProxy: true }),
      );
      const source = { ...externalSource(external), id: 'inside_airbnb' };
      const result: any = await makeService([], [source]).service.marketIntel('me', 'own', { from, to });
      expect(result.attribution).toEqual(['Inside Airbnb (insideairbnb.com), licença CC BY 4.0']);
      expect(result.occupancyIsProxy).toBe(true);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('syn-');
      expect(serialized).not.toContain('abnb:');
      expect(serialized).not.toContain('latitude');
    });

    it('anúncio que é cliente E aparece no dataset conta uma vez só', async () => {
      const customersList = [1, 2, 3, 4, 5].map((i) => {
        const a: any = address(`c${i}`, `owner-${i}`, 300);
        a.list.id_do_anuncio = `900${i}`;
        return a;
      });
      const external = Array.from({ length: 8 }, (_, i) => externalRecord(i));
      const result: any = await makeService(customersList, [externalSource(external)]).service.marketIntel('me', 'own', {
        from,
        to,
      });
      // dataset 9001..9005 já são clientes: 5 clientes + (8 externos − 5 duplicados) = 8 só se o externo
      // restante (3) ficar abaixo do mínimo e sair; os 5 clientes bastam.
      expect(result.comparablesCount).toBe(5);
      expect(result.dataSources.map((s: any) => s.id)).toEqual(['customers']);
    });
  });
});
