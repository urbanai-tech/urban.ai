import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Address } from '../entities/addresses.entity';
import { TravelTimeEngine } from './isochrone';

/**
 * F6.1 Tier 1 — Feature engineering.
 *
 * Pega imóveis cadastrados e enriquece com features que o motor de pricing
 * espera mas que **hoje** vêm vazias para a maioria dos imóveis:
 *
 *  1. **lat/lng** — geocoding via Google Maps API (já temos a key)
 *  2. **metroDistance** — distância à estação de metrô mais próxima
 *  3. **amenitiesCount** — estimativa via title + Gemini (placeholder)
 *
 * Cada método é idempotente: pula imóveis que já têm a feature preenchida.
 *
 * Pode ser invocado on-demand (admin endpoint) ou via cron diário. Por
 * enquanto deixamos como service standalone — o caller decide o quando.
 *
 * IMPORTANTE: este é um **skeleton** com pontos de extensão claros. As
 * implementações reais (Google Geocoding, cost-matrix metro, Gemini para
 * amenities) ficam para o sprint S6 quando forem habilitadas em produção.
 */
@Injectable()
export class FeatureEngineeringService {
  private readonly logger = new Logger(FeatureEngineeringService.name);

  constructor(
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    private readonly travelEngine: TravelTimeEngine,
  ) {}

  /**
   * Resolve lat/lng para imóveis sem coordenada. Usa o endereço completo
   * (logradouro + bairro + cidade) com a Google Geocoding API.
   *
   * Skeleton: hoje só conta os imóveis pendentes. Implementação real
   * adiciona uma chamada a `@googlemaps/google-maps-services-js` que já
   * está no `package.json` do backend.
   */
  async geocodePending(limit = 50): Promise<{ pendentes: number; resolvidos: number }> {
    const rows = await this.addressRepo.find({
      where: [{ latitude: IsNull() as any }, { longitude: IsNull() as any }],
      take: limit,
    });

    if (rows.length === 0) {
      this.logger.log('Nenhum imóvel pendente de geocoding.');
      return { pendentes: 0, resolvidos: 0 };
    }

    this.logger.log(
      `Encontrados ${rows.length} imóveis sem lat/lng. Implementação completa virá com F6.1 Tier 1.`,
    );
    // TODO (F6.1 Tier 1): chamar Google Geocoding API por endereço completo,
    //                      validar bbox de SP, persistir lat/lng.
    return { pendentes: rows.length, resolvidos: 0 };
  }

  /**
   * Calcula distância (km) entre cada imóvel e a estação de metrô SP mais
   * próxima. Persistir em `address.metro_distance_km` (coluna a criar).
   *
   * Skeleton — quando habilitar, usar cost-matrix com a lista de estações
   * (CSV público de SP).
   */
  async computeMetroDistancePending(): Promise<{ count: number }> {
    // TODO (F6.1 Tier 1):
    //   1. Carregar lista de estações (cidade-de-sao-paulo.opendata)
    //   2. Para cada imóvel com lat/lng, achar a estação mais próxima
    //      (haversine simples, depois travelEngine se quiser tempo real)
    //   3. Persistir
    return { count: 0 };
  }

  /**
   * Estima `amenitiesCount` (número aproximado de comodidades anunciadas)
   * a partir do título do anúncio Airbnb usando Gemini (mesmo client que
   * `events-enrichment.service.ts`).
   *
   * Skeleton — quando habilitar:
   *   "Conte quantas comodidades estão implícitas neste título Airbnb: <title>.
   *    Responda só com um número entre 0 e 30."
   */
  async estimateAmenitiesPending(): Promise<{ count: number }> {
    return { count: 0 };
  }

  /**
   * Roda os 3 passos em sequência. Útil para cron diário ou admin endpoint.
   */
  async runFullPipeline(): Promise<{
    geocoded: number;
    metroDistance: number;
    amenities: number;
  }> {
    const geo = await this.geocodePending();
    const metro = await this.computeMetroDistancePending();
    const amen = await this.estimateAmenitiesPending();
    return {
      geocoded: geo.resolvidos,
      metroDistance: metro.count,
      amenities: amen.count,
    };
  }
}
