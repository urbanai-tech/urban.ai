import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository, IsNull, Not } from 'typeorm';
import { GeocodingClient } from '../maps/geocoding-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Address } from '../entities/addresses.entity';
import { List } from '../entities/list.entity';
import { SP_METRO_STATIONS, MetroStation } from './data/sp-metro-stations';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';

// ============================================================================
// Funções puras (testáveis isoladamente, sem I/O)
// ============================================================================

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // raio da Terra em km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Distância (km) à estação mais próxima do conjunto. null se lista vazia. */
export function nearestStationKm(
  lat: number,
  lng: number,
  stations: MetroStation[] = SP_METRO_STATIONS,
): number | null {
  let min: number | null = null;
  for (const s of stations) {
    const d = haversineKm(lat, lng, s.lat, s.lng);
    if (min === null || d < min) min = d;
  }
  return min === null ? null : Math.round(min * 1000) / 1000;
}

/**
 * Heurística de categoria do imóvel a partir da diária base (reais) e da
 * contagem de amenidades. Alinhada ao roadmap F6.1:
 *   Premium  se diária > 350 E amenities >= 6
 *   Economico se diária < 150 OU amenities <= 2
 *   Standard caso contrário
 */
export function deriveCategory(
  basePrice: number | null | undefined,
  amenitiesCount: number | null | undefined,
): 'Premium' | 'Standard' | 'Economico' {
  // Atenção: Number(null) === 0, então null/undefined precisam ser tratados
  // como "ausente" ANTES da conversão (senão viram 0 e caem em Economico).
  const hasPrice =
    basePrice !== null && basePrice !== undefined && Number.isFinite(Number(basePrice));
  const hasAmen =
    amenitiesCount !== null && amenitiesCount !== undefined && Number.isFinite(Number(amenitiesCount));
  const price = Number(basePrice);
  const amen = Number(amenitiesCount);

  if (hasPrice && hasAmen && price > 350 && amen >= 6) return 'Premium';
  if ((hasPrice && price < 150) || (hasAmen && amen <= 2)) return 'Economico';
  return 'Standard';
}

/** Bounding box da Grande São Paulo — descarta geocoding fora de escopo. */
export function isInGreaterSp(lat: number, lng: number): boolean {
  return lat <= -23.2 && lat >= -24.1 && lng <= -46.2 && lng >= -47.1;
}

// ============================================================================
// Serviço
// ============================================================================

/**
 * F6.1 Tier 1 — Feature engineering.
 *
 * Enriquece imóveis com as features que o motor de pricing espera mas que hoje
 * vêm vazias para a maioria:
 *   1. lat/lng            — geocoding via Google Maps (geocodePending)
 *   2. metroDistance      — estação de metrô/CPTM mais próxima (computeMetroDistancePending)
 *   3. amenitiesCount + category — Gemini sobre o título + heurística (estimateAmenitiesPending)
 *
 * Cada método é idempotente: processa só quem ainda não tem a feature.
 * `runFullPipeline` roda diariamente às 04:00 BRT (após o snapshot das 03:30).
 *
 * Clients externos (Google Maps, Gemini) são lazy a partir de env — em ambientes
 * sem chave, os métodos apenas logam e retornam 0 (não quebram o boot).
 */
@Injectable()
export class FeatureEngineeringService {
  private readonly logger = new Logger(FeatureEngineeringService.name);
  private mapsClient: GeocodingClient | null = null;
  private genAI: GoogleGenerativeAI | null = null;

  constructor(
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(List) private readonly listRepo: Repository<List>,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

  private getMapsClient(): GeocodingClient | null {
    if (!process.env.GOOGLE_MAPS_API_KEY?.trim()) return null;
    if (!this.mapsClient) this.mapsClient = new GeocodingClient();
    return this.mapsClient;
  }

  private getGenAI(): GoogleGenerativeAI | null {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) return null;
    if (!this.genAI) this.genAI = new GoogleGenerativeAI(key);
    return this.genAI;
  }

  /**
   * Resolve lat/lng de endereços sem coordenada via Google Geocoding.
   * Valida bbox da Grande SP antes de persistir.
   */
  async geocodePending(limit = 50): Promise<{ pendentes: number; resolvidos: number }> {
    const rows = await this.addressRepo.find({
      where: [{ latitude: IsNull() as any }, { longitude: IsNull() as any }],
      take: limit,
    });
    if (rows.length === 0) return { pendentes: 0, resolvidos: 0 };

    const client = this.getMapsClient();
    if (!client) {
      this.logger.warn('GOOGLE_MAPS_API_KEY ausente — geocoding pulado.');
      return { pendentes: rows.length, resolvidos: 0 };
    }

    let resolvidos = 0;
    for (const addr of rows) {
      const endereco = addr.getEnderecoCompleto?.() ?? '';
      if (!endereco.trim()) continue;
      try {
        const resp = await client.geocode({
          params: { address: `${endereco}, São Paulo, SP, Brasil`, key: process.env.GOOGLE_MAPS_API_KEY! },
        });
        const first = resp.data.results[0];
        if (!first) continue;
        const { lat, lng } = first.geometry.location;
        if (!isInGreaterSp(lat, lng)) {
          this.logger.warn(`Geocoding de ${addr.id} caiu fora da Grande SP (${lat},${lng}) — ignorado.`);
          continue;
        }
        addr.latitude = lat;
        addr.longitude = lng;
        await this.addressRepo.save(addr);
        resolvidos++;
      } catch (err: any) {
        this.logger.error(`Geocoding falhou para ${addr.id}: ${err?.message ?? err}`);
      }
      await new Promise((r) => setTimeout(r, 200)); // respeita rate limit
    }
    return { pendentes: rows.length, resolvidos };
  }

  /**
   * Calcula metroDistance (km) para endereços com lat/lng mas sem a feature.
   */
  async computeMetroDistancePending(limit = 500): Promise<{ count: number }> {
    const rows = await this.addressRepo.find({
      where: { latitude: Not(IsNull()) as any, longitude: Not(IsNull()) as any, metroDistance: IsNull() as any },
      take: limit,
    });
    let count = 0;
    for (const addr of rows) {
      const lat = Number(addr.latitude);
      const lng = Number(addr.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const dist = nearestStationKm(lat, lng);
      if (dist === null) continue;
      addr.metroDistance = dist;
      await this.addressRepo.save(addr);
      count++;
    }
    return { count };
  }

  /**
   * Estima amenitiesCount via Gemini (sobre o título do anúncio) e deriva a
   * categoria. Processa imóveis sem category definida.
   */
  async estimateAmenitiesPending(limit = 50): Promise<{ count: number }> {
    const rows = await this.listRepo.find({
      where: { category: IsNull() as any },
      take: limit,
    });
    if (rows.length === 0) return { count: 0 };

    const genAI = this.getGenAI();
    const model = genAI?.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let count = 0;
    for (const list of rows) {
      try {
        let amenities = list.amenitiesCount;
        if ((amenities === null || amenities === undefined) && model && list.titulo) {
          const prompt =
            `Conte quantas comodidades estão implícitas neste título de anúncio Airbnb: "${list.titulo}". ` +
            `Se o título sugerir menos de 3 comodidades, responda um número baixo. ` +
            `Responda SOMENTE com um número inteiro entre 0 e 30.`;
          const result = await model.generateContent(prompt);
          const parsed = parseInt((result.response.text() ?? '').replace(/[^\d]/g, ''), 10);
          if (Number.isFinite(parsed)) amenities = Math.min(30, Math.max(0, parsed));
        }
        const basePrice = list.manualDailyPrice ?? list.dailyPrice ?? list.raw ?? null;
        list.amenitiesCount = amenities ?? list.amenitiesCount;
        list.category = deriveCategory(basePrice, list.amenitiesCount);
        await this.listRepo.save(list);
        count++;
      } catch (err: any) {
        this.logger.error(`Amenities/category falhou para list ${list.id}: ${err?.message ?? err}`);
      }
    }
    return { count };
  }

  /** Roda os 3 passos em sequência. Cron diário 04:00 BRT (após snapshot 03:30). */
  @Cron('0 4 * * *', {
    name: 'feature-engineering',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async runFullPipeline(): Promise<{ geocoded: number; metroDistance: number; amenities: number }> {
    return runScheduledJob(this.scheduledJobRunner, 'feature-engineering', async () => {
      const geo = await this.geocodePending();
      const metro = await this.computeMetroDistancePending();
      const amen = await this.estimateAmenitiesPending();
      const summary = { geocoded: geo.resolvidos, metroDistance: metro.count, amenities: amen.count };
      this.logger.log(`FeatureEngineering pipeline: ${JSON.stringify(summary)}`);
      return summary;
    });
  }
}
