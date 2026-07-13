import {
  FeatureEngineeringService,
  haversineKm,
  nearestStationKm,
  deriveCategory,
  isInGreaterSp,
} from './feature-engineering.service';
import { SP_METRO_STATIONS } from './data/sp-metro-stations';

describe('feature-engineering pure functions', () => {
  describe('haversineKm', () => {
    it('é 0 para o mesmo ponto', () => {
      expect(haversineKm(-23.55, -46.63, -23.55, -46.63)).toBe(0);
    });

    it('mede ~1.5km entre Sé e Luz (aprox)', () => {
      const d = haversineKm(-23.5503, -46.6339, -23.5347, -46.6353);
      expect(d).toBeGreaterThan(1);
      expect(d).toBeLessThan(2.5);
    });

    it('é simétrica', () => {
      const a = haversineKm(-23.55, -46.63, -23.56, -46.69);
      const b = haversineKm(-23.56, -46.69, -23.55, -46.63);
      expect(a).toBeCloseTo(b, 6);
    });
  });

  describe('nearestStationKm', () => {
    it('retorna distância pequena para ponto próximo à Sé', () => {
      const d = nearestStationKm(-23.5503, -46.6339);
      expect(d).not.toBeNull();
      expect(d!).toBeLessThan(0.5);
    });

    it('usa a estação mais próxima de um conjunto custom', () => {
      const stations = [
        { name: 'perto', lat: -23.5, lng: -46.6 },
        { name: 'longe', lat: -20.0, lng: -40.0 },
      ];
      const d = nearestStationKm(-23.5, -46.6, stations);
      expect(d).toBe(0);
    });

    it('retorna null para conjunto vazio', () => {
      expect(nearestStationKm(-23.5, -46.6, [])).toBeNull();
    });
  });

  describe('SP_METRO_STATIONS (dataset real OSM)', () => {
    it('tem cobertura completa (≥ 90 estações Metrô+CPTM)', () => {
      expect(SP_METRO_STATIONS.length).toBeGreaterThanOrEqual(90);
    });

    it('todas as estações estão dentro do bbox da Grande SP', () => {
      for (const s of SP_METRO_STATIONS) {
        expect(s.lat).toBeGreaterThan(-24.1);
        expect(s.lat).toBeLessThan(-23.2);
        expect(s.lng).toBeGreaterThan(-47.0);
        expect(s.lng).toBeLessThan(-46.2);
      }
    });

    it('não tem nomes duplicados', () => {
      const names = SP_METRO_STATIONS.map((s) => s.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
    });

    it('ponto na Av. Paulista fica a < 0.5km de uma estação real', () => {
      // Trianon-Masp / Brigadeiro / Paulista ficam sobre a Paulista.
      const d = nearestStationKm(-23.5614, -46.6564);
      expect(d).not.toBeNull();
      expect(d!).toBeLessThan(0.5);
    });
  });

  describe('deriveCategory', () => {
    it('Premium quando diária alta e muitas amenidades', () => {
      expect(deriveCategory(400, 8)).toBe('Premium');
    });
    it('Economico quando diária baixa', () => {
      expect(deriveCategory(120, 10)).toBe('Economico');
    });
    it('Economico quando poucas amenidades', () => {
      expect(deriveCategory(300, 1)).toBe('Economico');
    });
    it('Standard no caso intermediário', () => {
      expect(deriveCategory(250, 4)).toBe('Standard');
    });
    it('Standard quando faltam dados', () => {
      expect(deriveCategory(null, null)).toBe('Standard');
    });
  });

  describe('isInGreaterSp', () => {
    it('aceita um ponto em SP', () => {
      expect(isInGreaterSp(-23.55, -46.63)).toBe(true);
    });
    it('rejeita um ponto no Rio', () => {
      expect(isInGreaterSp(-22.9, -43.2)).toBe(false);
    });
  });
});

describe('FeatureEngineeringService.computeMetroDistancePending', () => {
  it('calcula e salva metroDistance para endereços com lat/lng', async () => {
    const addr: any = { id: 'a1', latitude: -23.5503, longitude: -46.6339, metroDistance: null };
    const addressRepo: any = {
      find: jest.fn().mockResolvedValue([addr]),
      save: jest.fn().mockImplementation(async (x) => x),
    };
    const listRepo: any = { find: jest.fn(), save: jest.fn() };
    const service = new FeatureEngineeringService(addressRepo, listRepo);

    const result = await service.computeMetroDistancePending();

    expect(result.count).toBe(1);
    expect(addressRepo.save).toHaveBeenCalledTimes(1);
    expect(typeof addr.metroDistance).toBe('number');
    expect(addr.metroDistance).toBeLessThan(0.5);
  });
});

describe('FeatureEngineeringService.estimateAmenitiesPending', () => {
  it('deriva category a partir de amenitiesCount existente sem chamar Gemini', async () => {
    const list: any = { id: 'l1', titulo: 'Studio', amenitiesCount: 8, manualDailyPrice: 400, category: null };
    const addressRepo: any = { find: jest.fn(), save: jest.fn() };
    const listRepo: any = {
      find: jest.fn().mockResolvedValue([list]),
      save: jest.fn().mockImplementation(async (x) => x),
    };
    const service = new FeatureEngineeringService(addressRepo, listRepo);

    // Sem GEMINI_API_KEY, não chama modelo; usa amenitiesCount existente.
    delete process.env.GEMINI_API_KEY;
    const result = await service.estimateAmenitiesPending();

    expect(result.count).toBe(1);
    expect(list.category).toBe('Premium');
    expect(listRepo.save).toHaveBeenCalledTimes(1);
  });
});
