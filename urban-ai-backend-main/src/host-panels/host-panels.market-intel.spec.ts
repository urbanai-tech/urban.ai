import { HostPanelsService } from './host-panels.service';
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

  function address(id: string, ownerId: string, price: number, lat = -23.55, lng = -46.63) {
    return {
      id,
      latitude: lat,
      longitude: lng,
      bairro: 'Pinheiros',
      cidade: 'São Paulo',
      estado: 'SP',
      ativo: true,
      user: { id: ownerId },
      list: { id: `list-${id}`, dailyPrice: price, user: { id: ownerId } },
    };
  }

  function makeService(candidates: any[]) {
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

    const service = new HostPanelsService(
      addressRepo as any,
      {} as any,
      {} as any,
      {} as any,
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
});
