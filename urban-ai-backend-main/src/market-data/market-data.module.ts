import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../entities/addresses.entity';
import { ExternalListing } from '../entities/external-listing.entity';
import { MarketIngestLog } from '../entities/market-ingest-log.entity';
import { MarketListingObservation } from '../entities/market-listing-observation.entity';
import { OccupancyHistory } from '../entities/occupancy-history.entity';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import { AdminMarketController } from './admin-market.controller';
import { LicensedDatasetImportService } from './licensed-dataset-import.service';
import { MarketHealthService } from './market-health.service';
import { MARKET_DATA_SOURCES, MarketIntelService } from './market-intel.service';
import { MarketSignalService } from './market-signal.service';
import { CustomersMarketSource } from './sources/customers.source';
import { InsideAirbnbMarketSource } from './sources/inside-airbnb.source';
import { LicensedDatasetMarketSource } from './sources/licensed-dataset.source';
import { OwnScrapingMarketSource } from './sources/own-scraping.source';

/**
 * Camada de fontes de mercado por bairro (ADR 0028): adaptadores (clientes, dataset licenciado,
 * Inside Airbnb, coleta própria DESLIGADA), comp set, métricas, saúde e upload do dataset.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Address,
      ExternalListing,
      MarketIngestLog,
      MarketListingObservation,
      OccupancyHistory,
      PriceSnapshot,
    ]),
  ],
  controllers: [AdminMarketController],
  providers: [
    CustomersMarketSource,
    LicensedDatasetMarketSource,
    InsideAirbnbMarketSource,
    OwnScrapingMarketSource,
    {
      provide: MARKET_DATA_SOURCES,
      useFactory: (
        customers: CustomersMarketSource,
        licensed: LicensedDatasetMarketSource,
        insideAirbnb: InsideAirbnbMarketSource,
        scraping: OwnScrapingMarketSource,
      ) => [customers, licensed, insideAirbnb, scraping],
      inject: [CustomersMarketSource, LicensedDatasetMarketSource, InsideAirbnbMarketSource, OwnScrapingMarketSource],
    },
    MarketIntelService,
    MarketSignalService,
    MarketHealthService,
    LicensedDatasetImportService,
  ],
  exports: [MarketIntelService, MarketSignalService],
})
export class MarketDataModule {}
