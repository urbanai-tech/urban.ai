import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CoverageRegion } from '../entities/coverage-region.entity';
import { Address } from '../entities/addresses.entity';

/**
 * CoverageService — Híbrido data-driven + admin override.
 *
 * Decide se um par (lat, lng) está na "área de cobertura ativa" do motor.
 * Eventos fora ficam `outOfScope=true` no DB (preservados, não enriquecidos).
 *
 * Cobertura = união de:
 *   1. Raio (default 80km) ao redor de cada Address ativo (data-driven —
 *      auto-escala quando entra cidade nova)
 *   2. Regiões em `coverage_regions` com status `active` ou `bootstrap`
 *      (admin override — cobre estratégia)
 *
 * Performance:
 *   - Cache em memória das regiões (5 min TTL)
 *   - Cache em memória das coordenadas de imóveis (5 min TTL)
 *   - Match simples Haversine — N^2 mas com N pequeno (<1000 imóveis pra
 *     muito tempo de pista). Quando isso virar gargalo, vira
 *     spatial index ou PostGIS.
 */
@Injectable()
export class CoverageService {
  private readonly logger = new Logger(CoverageService.name);

  /** Raio default em km ao redor de cada Address. */
  private readonly DEFAULT_ADDRESS_RADIUS_KM = 80;

  /** TTL do cache em ms. */
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  private regionsCache: { ts: number; regions: CoverageRegion[] } | null = null;
  private addressesCache: { ts: number; coords: Array<{ lat: number; lng: number }> } | null = null;

  constructor(
    @InjectRepository(CoverageRegion)
    private readonly regionRepo: Repository<CoverageRegion>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
  ) {}

  /**
   * Verifica se um ponto está dentro de qualquer região ativa OU bootstrap,
   * OU dentro do raio de qualquer imóvel cadastrado.
   */
  async isWithinCoverage(lat: number, lng: number): Promise<boolean> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

    // 1) Match contra regions admin
    const regions = await this.getActiveRegions();
    for (const r of regions) {
      if (this.pointInRegion(lat, lng, r)) return true;
    }

    // 2) Match contra raio de imóveis cadastrados
    const addresses = await this.getAddressCoords();
    for (const a of addresses) {
      const d = this.haversineKm(lat, lng, a.lat, a.lng);
      if (d <= this.DEFAULT_ADDRESS_RADIUS_KM) return true;
    }

    return false;
  }

  /** Invalida cache (útil em testes ou após CRUD). */
  invalidateCache(): void {
    this.regionsCache = null;
    this.addressesCache = null;
  }

  /** Stats pra painel admin: quantas regiões ativas/bootstrap, quantos addresses. */
  async stats() {
    const regions = await this.getActiveRegions();
    const addresses = await this.getAddressCoords();
    return {
      activeRegions: regions.filter((r) => r.status === 'active').length,
      bootstrapRegions: regions.filter((r) => r.status === 'bootstrap').length,
      addresses: addresses.length,
      addressRadiusKm: this.DEFAULT_ADDRESS_RADIUS_KM,
    };
  }

  // ============== Internals ==============

  private async getActiveRegions(): Promise<CoverageRegion[]> {
    const now = Date.now();
    if (this.regionsCache && now - this.regionsCache.ts < this.CACHE_TTL_MS) {
      return this.regionsCache.regions;
    }
    const regions = await this.regionRepo.find({
      where: { status: In(['active', 'bootstrap']) },
    });
    this.regionsCache = { ts: now, regions };
    return regions;
  }

  private async getAddressCoords(): Promise<Array<{ lat: number; lng: number }>> {
    const now = Date.now();
    if (this.addressesCache && now - this.addressesCache.ts < this.CACHE_TTL_MS) {
      return this.addressesCache.coords;
    }

    // Pega lat/lng de Address (ou da relação interna). Tolerante: se Address
    // não tem lat/lng diretamente exposto, retorna vazio (cobertura cai no
    // modo "só por regions").
    let coords: Array<{ lat: number; lng: number }> = [];
    try {
      const rows = await this.addressRepo
        .createQueryBuilder('a')
        .select(['a.latitude AS latitude', 'a.longitude AS longitude'])
        .where('a.latitude IS NOT NULL AND a.longitude IS NOT NULL')
        .getRawMany();
      coords = rows
        .map((r: any) => ({ lat: Number(r.latitude), lng: Number(r.longitude) }))
        .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng));
    } catch (err) {
      this.logger.warn(
        `Address não tem latitude/longitude diretamente — caindo só nas regions. ${err}`,
      );
      coords = [];
    }

    this.addressesCache = { ts: now, coords };
    return coords;
  }

  /** True se (lat, lng) está dentro da geometria de `r` (centro+raio OU bbox). */
  private pointInRegion(lat: number, lng: number, r: CoverageRegion): boolean {
    // Modo bounding box tem precedência se totalmente preenchido
    if (
      r.minLat !== null && r.maxLat !== null &&
      r.minLng !== null && r.maxLng !== null
    ) {
      const minLat = Number(r.minLat);
      const maxLat = Number(r.maxLat);
      const minLng = Number(r.minLng);
      const maxLng = Number(r.maxLng);
      if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
        return true;
      }
      return false;
    }

    // Modo centro + raio
    if (r.centerLat !== null && r.centerLng !== null && r.radiusKm !== null) {
      const cLat = Number(r.centerLat);
      const cLng = Number(r.centerLng);
      const rKm = Number(r.radiusKm);
      const d = this.haversineKm(lat, lng, cLat, cLng);
      return d <= rKm;
    }

    return false;
  }

  /**
   * Distância haversine em km entre dois pontos.
   * Aproximação Earth radius = 6371km. Suficiente pra escala urbana/regional.
   */
  haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
