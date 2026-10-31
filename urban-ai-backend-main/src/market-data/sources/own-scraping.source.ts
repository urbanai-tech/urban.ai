import { Injectable } from '@nestjs/common';
import { resolveMarketConfig } from '../market-config';
import {
  MARKET_SOURCE_LABELS,
  MarketDataSource,
  MarketListingRecord,
  MarketSourceQuery,
  MarketSourceResult,
  MarketSourceStatus,
} from '../market-data.types';

export const SCRAPING_BLOCKED_REASON = 'aguardando parecer jurídico';

export class MarketSourceDisabledError extends Error {
  constructor(public readonly reason: string) {
    super(`fonte own_scraping desligada: ${reason}`);
    this.name = 'MarketSourceDisabledError';
  }
}

/**
 * Ponto de extensão para um futuro coletor próprio de anúncios/calendários de terceiros.
 * NÃO existe implementação: nenhuma coleta contra Airbnb/Booking é feita por este código.
 * Só entra quando houver parecer jurídico (ADR 0028 e ADR 0010).
 */
export interface MarketScrapingCollector {
  collect(query: MarketSourceQuery): Promise<MarketListingRecord[]>;
}

/**
 * Fonte `own_scraping`: apenas a interface e o adaptador DESLIGADO.
 *
 * - `MARKET_SCRAPING_ENABLED` (padrão `false`) desliga; mesmo ligada, sem um `MarketScrapingCollector`
 *   registrado ela continua devolvendo vazio. Nunca lança no caminho da tela (devolve vazio com motivo);
 *   `assertEnabled()` lança `MarketSourceDisabledError` para jobs de coleta que a chamem por engano.
 */
@Injectable()
export class OwnScrapingMarketSource implements MarketDataSource {
  readonly id = 'own_scraping' as const;
  readonly label = MARKET_SOURCE_LABELS.own_scraping;
  readonly precedence = 3;

  /** Sem coletor registrado por padrão (e nenhum é fornecido neste repositório). */
  private collector: MarketScrapingCollector | null = null;

  registerCollector(collector: MarketScrapingCollector | null) {
    this.collector = collector;
  }

  status(): MarketSourceStatus {
    if (!resolveMarketConfig().scrapingEnabled) {
      return { enabled: false, reason: SCRAPING_BLOCKED_REASON };
    }
    if (!this.collector) {
      return { enabled: false, reason: `${SCRAPING_BLOCKED_REASON} (nenhum coletor implementado)` };
    }
    return { enabled: true };
  }

  assertEnabled(): void {
    const status = this.status();
    if (!status.enabled) throw new MarketSourceDisabledError(status.reason ?? SCRAPING_BLOCKED_REASON);
  }

  async fetch(query: MarketSourceQuery): Promise<MarketSourceResult> {
    const status = this.status();
    if (!status.enabled || !this.collector) return { records: [], disabledReason: status.reason };
    return { records: await this.collector.collect(query) };
  }
}
