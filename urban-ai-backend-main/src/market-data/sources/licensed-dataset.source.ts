import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalListing } from '../../entities/external-listing.entity';
import { MarketListingObservation } from '../../entities/market-listing-observation.entity';
import { MARKET_SOURCE_LABELS } from '../market-data.types';
import { ExternalListingMarketSource } from './external-listing.source';

/** Prefixo de `external_listing.source` dos datasets licenciados (`licensed:<fornecedor>`). */
export const LICENSED_SOURCE_PREFIX = 'licensed:';

/**
 * Fonte `licensed_dataset`: anúncios de um dataset comprado (AirROI, Base dos Dados, AirDNA…)
 * importado pelo admin. Cada lote carrega a licença contratada; `licensed_internal_only` nunca
 * chega à tela do cliente (o comp set filtra por uso). Fornecedor ainda não contratado: sem
 * importação, a fonte devolve vazio e o mercado segue com as demais.
 */
@Injectable()
export class LicensedDatasetMarketSource extends ExternalListingMarketSource {
  readonly id = 'licensed_dataset' as const;
  readonly label = MARKET_SOURCE_LABELS.licensed_dataset;
  readonly precedence = 1;

  constructor(
    @InjectRepository(ExternalListing) listingRepo: Repository<ExternalListing>,
    @InjectRepository(MarketListingObservation) observationRepo: Repository<MarketListingObservation>,
  ) {
    super(listingRepo, observationRepo);
  }

  protected sourceFilter() {
    return { clause: 'l.source LIKE :source', params: { source: `${LICENSED_SOURCE_PREFIX}%` } };
  }
}
