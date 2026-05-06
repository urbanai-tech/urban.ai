import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CoverageService } from './coverage.service';
import { CoverageRegion } from '../entities/coverage-region.entity';
import { Address } from '../entities/addresses.entity';

describe('CoverageService', () => {
  let service: CoverageService;
  let regionRepo: { find: jest.Mock };
  let addressRepo: { createQueryBuilder: jest.Mock };

  const mockQB = (rows: any[]) => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  });

  beforeEach(async () => {
    regionRepo = { find: jest.fn().mockResolvedValue([]) };
    addressRepo = { createQueryBuilder: jest.fn(() => mockQB([])) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoverageService,
        { provide: getRepositoryToken(CoverageRegion), useValue: regionRepo },
        { provide: getRepositoryToken(Address), useValue: addressRepo },
      ],
    }).compile();
    service = module.get(CoverageService);
  });

  describe('haversineKm', () => {
    it('calcula distância plausível entre Sé e Allianz Parque (~4-6km)', () => {
      const d = service.haversineKm(-23.5505, -46.6333, -23.5275, -46.6783);
      expect(d).toBeGreaterThan(3);
      expect(d).toBeLessThan(6);
    });

    it('retorna 0 para mesmos pontos', () => {
      const d = service.haversineKm(-23.5, -46.6, -23.5, -46.6);
      expect(d).toBeCloseTo(0, 5);
    });

    it('SP–Rio dá ~360km', () => {
      const d = service.haversineKm(-23.55, -46.63, -22.9, -43.2);
      expect(d).toBeGreaterThan(330);
      expect(d).toBeLessThan(390);
    });
  });

  describe('isWithinCoverage com regions centro+raio', () => {
    it('aceita ponto dentro do raio de Grande SP (80km da Sé)', async () => {
      regionRepo.find.mockResolvedValue([
        {
          status: 'active',
          centerLat: -23.5505,
          centerLng: -46.6333,
          radiusKm: 80,
          minLat: null,
          maxLat: null,
          minLng: null,
          maxLng: null,
        },
      ]);
      service.invalidateCache();
      // Allianz Parque
      const ok = await service.isWithinCoverage(-23.5275, -46.6783);
      expect(ok).toBe(true);
    });

    it('rejeita Rio (~360km da Sé) com region 80km', async () => {
      regionRepo.find.mockResolvedValue([
        {
          status: 'active',
          centerLat: -23.5505,
          centerLng: -46.6333,
          radiusKm: 80,
          minLat: null,
          maxLat: null,
          minLng: null,
          maxLng: null,
        },
      ]);
      service.invalidateCache();
      const ok = await service.isWithinCoverage(-22.9, -43.2);
      expect(ok).toBe(false);
    });
  });

  describe('isWithinCoverage com bounding box', () => {
    it('aceita ponto dentro do bbox', async () => {
      regionRepo.find.mockResolvedValue([
        {
          status: 'active',
          centerLat: null,
          centerLng: null,
          radiusKm: null,
          minLat: -24,
          maxLat: -23,
          minLng: -47,
          maxLng: -46,
        },
      ]);
      service.invalidateCache();
      const ok = await service.isWithinCoverage(-23.5, -46.5);
      expect(ok).toBe(true);
    });

    it('rejeita ponto fora do bbox', async () => {
      regionRepo.find.mockResolvedValue([
        {
          status: 'active',
          centerLat: null,
          centerLng: null,
          radiusKm: null,
          minLat: -24,
          maxLat: -23,
          minLng: -47,
          maxLng: -46,
        },
      ]);
      service.invalidateCache();
      const ok = await service.isWithinCoverage(-22.0, -43.0);
      expect(ok).toBe(false);
    });
  });

  describe('isWithinCoverage por imóveis (data-driven)', () => {
    it('aceita ponto a <80km de imóvel cadastrado mesmo sem region', async () => {
      regionRepo.find.mockResolvedValue([]);
      addressRepo.createQueryBuilder.mockReturnValue(
        mockQB([{ latitude: -22.9, longitude: -43.2 }]), // imóvel no Rio
      );
      service.invalidateCache();
      // Ponto a poucos km do imóvel no Rio
      const ok = await service.isWithinCoverage(-22.95, -43.25);
      expect(ok).toBe(true);
    });

    it('rejeita ponto longe de imóvel e sem regions', async () => {
      regionRepo.find.mockResolvedValue([]);
      addressRepo.createQueryBuilder.mockReturnValue(
        mockQB([{ latitude: -23.5, longitude: -46.6 }]),
      );
      service.invalidateCache();
      // Ponto em Recife (~2400km)
      const ok = await service.isWithinCoverage(-8.05, -34.9);
      expect(ok).toBe(false);
    });

    it('aceita modelo Híbrido — imóvel novo no Rio liga cobertura automaticamente', async () => {
      regionRepo.find.mockResolvedValue([
        {
          status: 'active',
          centerLat: -23.5505,
          centerLng: -46.6333,
          radiusKm: 80,
          minLat: null,
          maxLat: null,
          minLng: null,
          maxLng: null,
        },
      ]);
      addressRepo.createQueryBuilder.mockReturnValue(
        mockQB([{ latitude: -22.9, longitude: -43.2 }]),
      );
      service.invalidateCache();
      // Allianz (SP) — region cobre
      expect(await service.isWithinCoverage(-23.5275, -46.6783)).toBe(true);
      // Maracanã (RJ) — region não cobre, mas imóvel cadastrado a <5km cobre
      expect(await service.isWithinCoverage(-22.91, -43.23)).toBe(true);
    });
  });

  describe('cache 5 min', () => {
    it('reusa regions cache em chamadas consecutivas dentro de 5min', async () => {
      regionRepo.find.mockResolvedValue([]);
      addressRepo.createQueryBuilder.mockReturnValue(mockQB([]));
      await service.isWithinCoverage(-23.5, -46.6);
      await service.isWithinCoverage(-23.5, -46.6);
      await service.isWithinCoverage(-23.5, -46.6);
      // Apenas 1 fetch dos regions (cache absorve as próximas 2)
      expect(regionRepo.find).toHaveBeenCalledTimes(1);
    });

    it('invalidateCache força refetch', async () => {
      regionRepo.find.mockResolvedValue([]);
      addressRepo.createQueryBuilder.mockReturnValue(mockQB([]));
      await service.isWithinCoverage(-23.5, -46.6);
      service.invalidateCache();
      await service.isWithinCoverage(-23.5, -46.6);
      expect(regionRepo.find).toHaveBeenCalledTimes(2);
    });
  });

  describe('isWithinCoverage com input inválido', () => {
    it('retorna false para NaN', async () => {
      const ok = await service.isWithinCoverage(NaN, NaN);
      expect(ok).toBe(false);
    });
  });
});
