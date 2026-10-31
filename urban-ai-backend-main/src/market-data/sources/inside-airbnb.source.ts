import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalListing } from '../../entities/external-listing.entity';
import { MarketListingObservation } from '../../entities/market-listing-observation.entity';
import { MARKET_SOURCE_LABELS } from '../market-data.types';
import { ExternalListingMarketSource } from './external-listing.source';

/** Valor de `external_listing.source` gravado pelo `InsideAirbnbImportService`. */
export const INSIDE_AIRBNB_SOURCE = 'inside-airbnb';

/**
 * Fonte `inside_airbnb`: o mesmo `external_listing` que o importador existente
 * (`InsideAirbnbImportService`) já alimentava para treino, agora também lido como mercado.
 * Dado público CC BY 4.0 (exibição permitida com atribuição); a ocupação é um proxy
 * (1 − availability365/365) e é rotulada como estimativa. Snapshots antigos caem no limite
 * de idade (`MARKET_EXTERNAL_MAX_AGE_DAYS`).
 */
@Injectable()
export class InsideAirbnbMarketSource extends ExternalListingMarketSource {
  readonly id = 'inside_airbnb' as const;
  readonly label = MARKET_SOURCE_LABELS.inside_airbnb;
  readonly precedence = 2;

  constructor(
    @InjectRepository(ExternalListing) listingRepo: Repository<ExternalListing>,
    @InjectRepository(MarketListingObservation) observationRepo: Repository<MarketListingObservation>,
  ) {
    super(listingRepo, observationRepo);
  }

  protected sourceFilter() {
    return { clause: 'l.source = :source', params: { source: INSIDE_AIRBNB_SOURCE } };
  }
}
