/**
 * Camada de fontes de dados de mercado (ADR 0028).
 *
 * Cada fonte devolve registros normalizados (`MarketListingRecord`) no mesmo
 * formato; o comp set, a deduplicação, a regra de privacidade e as métricas
 * trabalham só sobre esse formato e não sabem de onde o dado veio.
 */

export type MarketSourceId = 'customers' | 'licensed_dataset' | 'inside_airbnb' | 'own_scraping';

/** Todas as fontes, em ordem de precedência (a primeira vence uma duplicata). */
export const MARKET_SOURCE_ORDER: readonly MarketSourceId[] = [
  'customers',
  'licensed_dataset',
  'inside_airbnb',
  'own_scraping',
];

/** Rótulos curtos mostrados ao anfitrião ("de onde vem este dado"). */
export const MARKET_SOURCE_LABELS: Record<MarketSourceId, string> = {
  customers: 'Clientes My Urban',
  licensed_dataset: 'Dataset licenciado',
  inside_airbnb: 'Inside Airbnb',
  own_scraping: 'Coleta própria',
};

/**
 * Licença do dado. Define o uso permitido:
 *  - `first_party`: dado dos clientes do My Urban (agregado, com mínimo de anfitriões);
 *  - `cc_by_4`: Inside Airbnb (CC BY 4.0) — exibição permitida com atribuição;
 *  - `licensed_display_aggregate`: dataset pago cujo contrato permite exibir agregados ao cliente;
 *  - `licensed_internal_only`: dataset pago só para uso interno (motor, admin), nunca exibido;
 *  - `unknown`: sem licença registrada — nunca entra em nenhum cálculo.
 */
export type MarketLicense =
  | 'first_party'
  | 'cc_by_4'
  | 'licensed_display_aggregate'
  | 'licensed_internal_only'
  | 'unknown';

export const MARKET_LICENSES: readonly MarketLicense[] = [
  'first_party',
  'cc_by_4',
  'licensed_display_aggregate',
  'licensed_internal_only',
  'unknown',
];

/** Licenças que o admin pode atribuir a um upload (`first_party` e `unknown` não se escolhem). */
export const UPLOADABLE_LICENSES: readonly MarketLicense[] = [
  'cc_by_4',
  'licensed_display_aggregate',
  'licensed_internal_only',
];

export type MarketListingType = 'entire_home' | 'private_room' | 'shared_room' | 'hotel_room' | 'other';

export const MARKET_LISTING_TYPES: readonly MarketListingType[] = [
  'entire_home',
  'private_room',
  'shared_room',
  'hotel_room',
  'other',
];

/** Para quê o resultado será usado: `display` (tela do cliente) ou `internal` (motor/admin). */
export type MarketUse = 'display' | 'internal';

export interface MarketObservation {
  /** YYYY-MM-DD */
  date: string;
  /** Diária em reais (null quando a observação só tem ocupação). */
  adr: number | null;
  /** 0..1 */
  occupancy: number | null;
}

export interface MarketListingRecord {
  source: MarketSourceId;
  /** Id do anúncio na própria fonte. */
  sourceListingId: string;
  /**
   * Chave de deduplicação entre fontes: `abnb:<id do Airbnb>` quando a fonte informa o id
   * do anúncio; senão `<fonte>:<id na fonte>` (não deduplica por id, só pelo casamento
   * conservador de `mergeAcrossSources`).
   */
  dedupKey: string;
  latitude: number;
  longitude: number;
  neighborhood: string | null;
  city: string | null;
  /** Diária representativa em reais. */
  adr: number | null;
  /** 0..1 */
  occupancy: number | null;
  /** true quando a ocupação é uma estimativa (ex.: 1 − availability365/365 do Inside Airbnb). */
  occupancyIsProxy: boolean;
  bedrooms: number | null;
  listingType: MarketListingType | null;
  capacity: number | null;
  /** Data de coleta do dado (YYYY-MM-DD). */
  collectedAt: string | null;
  license: MarketLicense;
  /** Só `customers`: dono do imóvel (a regra de privacidade conta anfitriões distintos). */
  ownerKey?: string | null;
  observations?: MarketObservation[];
  /** Campos preenchidos a partir de fontes de menor precedência na deduplicação. */
  filledFrom?: MarketSourceId[];
}

export interface MarketSourceQuery {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  radiusKm: number;
  /** Janela de análise (YYYY-MM-DD). */
  from: string;
  to: string;
  /** Início do histórico de observações (sazonalidade e tendência). */
  historyFrom: string;
  /** Imóveis deste usuário nunca entram como comparável. */
  excludeUserId: string;
  /** Imóvel alvo (nunca entra como comparável de si mesmo). */
  excludeAddressId: string;
  /** false = só os registros, sem séries (cobertura no admin). */
  withObservations: boolean;
}

export interface MarketSourceResult {
  records: MarketListingRecord[];
  /** Preenchido quando a fonte está desligada ou não pôde responder. */
  disabledReason?: string;
  /** true quando o limite de candidatos cortou a lista. */
  truncated?: boolean;
}

export interface MarketSourceStatus {
  enabled: boolean;
  reason?: string;
}

export interface MarketDataSource {
  readonly id: MarketSourceId;
  readonly label: string;
  /** Menor número vence a duplicata. */
  readonly precedence: number;
  status(): MarketSourceStatus;
  fetch(query: MarketSourceQuery): Promise<MarketSourceResult>;
}

/** Faixa de capacidade (hóspedes). */
export type MarketCapacityBand = '1-2' | '3-4' | '5-6' | '7+';
export const MARKET_CAPACITY_BANDS: readonly MarketCapacityBand[] = ['1-2', '3-4', '5-6', '7+'];

/** Tipologia pedida na tela: tudo opcional; ausente = sem filtro. */
export interface MarketTypology {
  /** Nº de quartos; `4` significa "4 ou mais". */
  rooms?: number | null;
  listingType?: MarketListingType | null;
  capacity?: MarketCapacityBand | null;
}

export interface MarketTarget {
  addressId: string;
  userId: string;
  latitude: number | null;
  longitude: number | null;
  /** Id do anúncio no Airbnb (para nunca contar o próprio imóvel vindo de uma fonte externa). */
  airbnbListingId: string | null;
  bedrooms: number | null;
  listingType: MarketListingType | null;
  capacity: number | null;
  ownAdr: number;
}
