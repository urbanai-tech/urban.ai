import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { PropertyEventAnalysesService } from './property-event-analyses.service';
import { PropertyPricingAnalysisService } from './property-pricing-analysis.service';
import { PropertyScrapingService } from './property-scraping.service';

export class CreateAlertDto {
    @ApiProperty({ example: 12.9713964, description: 'Latitude do imóvel' })
    latitude: number;

    @ApiProperty({ example: 77.5979991, description: 'Longitude do imóvel' })
    longitude: number;

    @ApiProperty({ example: 2, description: 'Número de quartos' })
    bedrooms: number;

    @ApiProperty({ example: 2, description: 'Número de banheiros' })
    bathrooms: number;

    @ApiProperty({ example: 4, description: 'Número de hóspedes que acomoda' })
    accommodates: number;
}

/**
 * PropriedadeService — fachada fina mantida para os módulos que já consomem o
 * PropriedadeModule (airbnb, connect, cron, dashboard, maps). Não contém
 * regra de negócio: cada método delega ao serviço coeso responsável.
 *
 * - PropertyPortfolioService: CRUD do portfólio, inputs de pricing, ocupação
 * - PropertyScrapingService: anúncios do anfitrião e scraping do Airbnb
 * - PropertyListingQuoteService: cotações/diária de um anúncio
 * - PropertyPricingAnalysisService: pipeline de análise de preço + digest
 * - PropertyEventAnalysesService: leitura das análises por evento
 *
 * Código novo deve injetar o serviço específico, não esta fachada.
 */
@Injectable()
export class PropriedadeService {
    constructor(
        private readonly scraping: PropertyScrapingService,
        private readonly pricingAnalysis: PropertyPricingAnalysisService,
        private readonly eventAnalyses: PropertyEventAnalysesService,
    ) { }

    /** Usado pelo ConnectService no onboarding. */
    scrapeHostListings(userId: string) {
        return this.scraping.scrapeHostListings(userId);
    }

    /** Usado pelo ConnectService no onboarding. */
    scrapeAirbnbListing(roomId: string) {
        return this.scraping.scrapeAirbnbListing(roomId);
    }

    /** Usado pelo CronService (refresh diário de metadados). */
    refreshAllPropertyMetadata(options?: Parameters<PropertyScrapingService['refreshAllPropertyMetadata']>[0]) {
        return this.scraping.refreshAllPropertyMetadata(options);
    }

    /** Usado pelo AirbnbService. */
    getPropertyDetails(propertyId: string) {
        return this.scraping.getPropertyDetails(propertyId);
    }

    /** Usado pelo MapsService (pipeline de análise de preço por imóvel). */
    buscarAddress(listId: string) {
        return this.pricingAnalysis.buscarAddress(listId);
    }

    /** Usado pelo DashboardService. */
    getQuantidadeEventosByUsuario(usuarioId: string, propertyId: string | null): Promise<number> {
        return this.eventAnalyses.getQuantidadeEventosByUsuario(usuarioId, propertyId);
    }
}
