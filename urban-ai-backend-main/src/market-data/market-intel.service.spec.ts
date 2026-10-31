import { customers, externals, TARGET, TEST_CONFIG } from './__fixtures__/market-fixtures-spec';
import { MarketConfig } from './market-config';
import { MarketIntelBuildInput, MarketIntelService } from './market-intel.service';
import { dateKeyAddDays } from './market-math';
import { MarketDataSource, MarketListingRecord, MarketSourceId } from './market-data.types';
import { toMarketSignalV2 } from './market-signal';
import { MarketSignalService } from './market-signal.service';

const config: MarketConfig = {
  ...TEST_CONFIG,
  enabledSources: new Set<MarketSourceId>(['customers', 'licensed_dataset', 'inside_airbnb']),
  scrapingEnabled: false,
  defaultRadiusKm: 3,
  minRadiusKm: 1,
  maxRadiusKm: 5,
  engineSignalEnabled: false,
};

function fakeSource(
  id: MarketSourceId,
  precedence: number,
  records: MarketListingRecord[],
  status: { enabled: boolean; reason?: string } = { enabled: true },
  fail = false,
): MarketDataSource & { fetch: jest.Mock } {
  return {
    id,
    label: id,
    precedence,
    status: () => status,
    fetch: jest.fn(async () => {
      if (fail) throw new Error('banco fora');
      return { records };
    }),
  };
}

const dates = Array.from({ length: 30 }, (_, i) => dateKeyAddDays('2026-10-02', i));
const input: MarketIntelBuildInput = {
  target: TARGET,
  city: 'São Paulo',
  state: 'SP',
  from: '2026-10-02',
  to: '2026-10-31',
  dates,
  radiusKm: 3,
  use: 'display',
  ownOccupancy: 0.5,
  ownDaily: new Map(),
  eventDays: new Set(),
  config,
  today: '2026-10-31',
};

describe('MarketIntelService.build', () => {
  it('combina as fontes ligadas, mostra a origem de cada uma e calcula as métricas', async () => {
    const service = new MarketIntelService([
      fakeSource('customers', 0, customers(5)),
      fakeSource('licensed_dataset', 1, externals(8)),
      fakeSource('inside_airbnb', 2, externals(8, 'inside_airbnb')),
      fakeSource('own_scraping', 3, [], { enabled: false, reason: 'aguardando parecer jurídico' }),
    ]);

    const build = await service.build(input);

    expect(build.metrics?.comparablesCount).toBe(21);
    expect(build.compSet.sources.map((s) => s.source)).toEqual(['customers', 'licensed_dataset', 'inside_airbnb']);
    expect(build.insufficiency).toBeNull();
    const scraping = build.sources.find((s) => s.id === 'own_scraping');
    expect(scraping).toMatchObject({ enabled: false, reason: 'aguardando parecer jurídico', candidates: 0 });
  });

  it('fonte desligada nunca é consultada', async () => {
    const off = fakeSource('own_scraping', 3, customers(9), { enabled: false, reason: 'aguardando parecer jurídico' });
    const service = new MarketIntelService([fakeSource('customers', 0, customers(5)), off]);
    await service.build(input);
    expect(off.fetch).not.toHaveBeenCalled();
  });

  it('uma fonte que falha não derruba as outras: o relatório marca o erro e o mercado segue', async () => {
    const service = new MarketIntelService([
      fakeSource('customers', 0, customers(5)),
      fakeSource('licensed_dataset', 1, [], { enabled: true }, true),
    ]);
    const build = await service.build(input);
    expect(build.metrics?.comparablesCount).toBe(5);
    expect(build.sources.find((s) => s.id === 'licensed_dataset')).toMatchObject({ error: true, reason: 'falha ao consultar a fonte' });
  });

  it('amostra insuficiente: não calcula métricas e explica o que falta, com dicas de raio e tipologia', async () => {
    const service = new MarketIntelService([
      fakeSource('customers', 0, customers(2)),
      fakeSource('licensed_dataset', 1, externals(3)),
    ]);
    const build = await service.build({ ...input, radiusKm: 2, typology: { rooms: 1 } });

    expect(build.metrics).toBeNull();
    expect(build.compSet.insufficient).toBe(true);
    expect(build.insufficiency?.reasons.join(' | ')).toContain('2 anfitriões distintos');
    expect(build.insufficiency?.reasons.join(' | ')).toContain('mínimo 5');
    expect(build.insufficiency?.reasons.join(' | ')).toContain('3 anúncios distintos');
    expect(build.insufficiency?.reasons.join(' | ')).toContain('mínimo 8');
    expect(build.insufficiency?.hints.join(' ')).toMatch(/Aumente o raio/);
    expect(build.insufficiency?.hints.join(' ')).toMatch(/Afrouxe a tipologia/);
  });

  it('sem fonte externa ligada, diz isso em vez de culpar a região', async () => {
    const service = new MarketIntelService([
      fakeSource('customers', 0, customers(2)),
      fakeSource('licensed_dataset', 1, [], { enabled: false, reason: 'fonte desligada' }),
    ]);
    const build = await service.build({ ...input, radiusKm: 5 });
    expect(build.insufficiency?.reasons.join(' ')).toMatch(/Nenhuma fonte externa/);
    expect(build.insufficiency?.hints).toEqual([]); // raio já no máximo e sem tipologia
  });

  it('uso interno inclui dataset internal-only; uso de exibição não', async () => {
    const internal = externals(8).map((r) => ({ ...r, license: 'licensed_internal_only' as const }));
    const service = new MarketIntelService([fakeSource('licensed_dataset', 1, internal)]);
    expect((await service.build({ ...input, use: 'display' })).metrics).toBeNull();
    expect((await service.build({ ...input, use: 'internal' })).metrics?.comparablesCount).toBe(8);
  });

  it('repassa raio, janela e exclusões do usuário às fontes', async () => {
    const source = fakeSource('customers', 0, customers(5));
    await new MarketIntelService([source]).build({ ...input, radiusKm: 4 });
    expect(source.fetch).toHaveBeenCalledWith(
      expect.objectContaining({ radiusKm: 4, excludeUserId: 'user-target', excludeAddressId: 'addr-target', historyFrom: '2025-10-31' }),
    );
  });

  it('modo leve (cobertura) pede registros sem séries', async () => {
    const source = fakeSource('customers', 0, customers(5));
    await new MarketIntelService([source]).build({ ...input, light: true });
    expect(source.fetch).toHaveBeenCalledWith(expect.objectContaining({ withObservations: false }));
  });

  it('lista o estado das fontes (para a saúde no admin)', () => {
    const service = new MarketIntelService([
      fakeSource('own_scraping', 3, [], { enabled: false, reason: 'aguardando parecer jurídico' }),
      fakeSource('customers', 0, []),
    ]);
    expect(service.sourceStatuses().map((s) => [s.id, s.enabled])).toEqual([
      ['customers', true],
      ['own_scraping', false],
    ]);
  });
});

describe('insumo do motor v2 em sombra', () => {
  it('toMarketSignalV2: só agregados, origem e posição do preço; null quando insuficiente', async () => {
    const service = new MarketIntelService([fakeSource('customers', 0, customers(5)), fakeSource('licensed_dataset', 1, externals(8))]);
    const build = await service.build({ ...input, use: 'internal' });
    const signal = toMarketSignalV2(build, 300, new Date('2026-10-31T12:00:00Z'));
    expect(signal).toMatchObject({
      version: 1,
      sampleSize: 13,
      radiusKm: 3,
      priceVsMedian: expect.any(Number),
      generatedAt: '2026-10-31T12:00:00.000Z',
    });
    expect(signal?.sources.map((s) => s.source)).toEqual(['customers', 'licensed_dataset']);
    const serialized = JSON.stringify(signal);
    expect(serialized).not.toContain('owner-');
    expect(serialized).not.toContain('latitude');

    const insufficient = await new MarketIntelService([fakeSource('customers', 0, customers(2))]).build(input);
    expect(toMarketSignalV2(insufficient, 300)).toBeNull();
  });

  it('MarketSignalService fica desligado por padrão e nem consulta as fontes', async () => {
    const source = fakeSource('customers', 0, customers(5));
    const signals = new MarketSignalService(new MarketIntelService([source]));
    const original = process.env.MARKET_ENGINE_SIGNAL_ENABLED;
    delete process.env.MARKET_ENGINE_SIGNAL_ENABLED;
    try {
      expect(await signals.forAddress({ id: 'a', latitude: -23.56, longitude: -46.68, list: { dailyPrice: 300 } } as any)).toBeNull();
      expect(source.fetch).not.toHaveBeenCalled();
    } finally {
      if (original !== undefined) process.env.MARKET_ENGINE_SIGNAL_ENABLED = original;
    }
  });

  it('com a flag ligada devolve o sinal; imóvel sem coordenada ou preço, ou falha interna, devolve null sem lançar', async () => {
    const original = process.env.MARKET_ENGINE_SIGNAL_ENABLED;
    process.env.MARKET_ENGINE_SIGNAL_ENABLED = 'true';
    try {
      const source = fakeSource('customers', 0, customers(5));
      const signals = new MarketSignalService(new MarketIntelService([source]));
      const address = {
        id: 'a',
        latitude: -23.5612,
        longitude: -46.6821,
        cidade: 'São Paulo',
        estado: 'SP',
        user: { id: 'u1' },
        list: { id: 'l1', dailyPrice: 300, quartos: 1, hospedes: 2, propertyType: 'Apartment' },
      };
      const signal = await signals.forAddress(address as any, new Date('2026-10-31T15:00:00Z'));
      expect(signal?.sampleSize).toBe(5);
      expect(source.fetch).toHaveBeenCalledWith(expect.objectContaining({ excludeUserId: 'u1' }));

      expect(await signals.forAddress({ ...address, latitude: null } as any)).toBeNull();
      expect(await signals.forAddress({ ...address, list: { id: 'l1' } } as any)).toBeNull();

      const failing = new MarketSignalService({ build: jest.fn().mockRejectedValue(new Error('x')) } as any);
      expect(await failing.forAddress(address as any)).toBeNull();
    } finally {
      if (original === undefined) delete process.env.MARKET_ENGINE_SIGNAL_ENABLED;
      else process.env.MARKET_ENGINE_SIGNAL_ENABLED = original;
    }
  });
});
