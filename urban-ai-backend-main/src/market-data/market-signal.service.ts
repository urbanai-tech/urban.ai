import { Injectable, Logger } from '@nestjs/common';
import { todaySaoPauloDateKey } from '../common/sp-date';
import { Address } from '../entities/addresses.entity';
import { resolveMarketConfig } from './market-config';
import { MarketIntelService } from './market-intel.service';
import { dateKeyAddDays } from './market-math';
import { MarketSignalV2, toMarketSignalV2 } from './market-signal';
import { marketTargetFromAddress } from './market-target';

/**
 * Expõe as métricas de mercado ao motor v2 em sombra (ADR 0028). Desligado por padrão
 * (`MARKET_ENGINE_SIGNAL_ENABLED=false`); qualquer falha devolve null — o motor nunca depende dela
 * e o v1 nem a consulta.
 */
@Injectable()
export class MarketSignalService {
  private readonly logger = new Logger(MarketSignalService.name);

  constructor(private readonly intel: MarketIntelService) {}

  isEnabled(): boolean {
    return resolveMarketConfig().engineSignalEnabled;
  }

  async forAddress(address: Address, now: Date = new Date()): Promise<MarketSignalV2 | null> {
    if (!this.isEnabled()) return null;
    try {
      const userId = address.user?.id ?? address.list?.user?.id ?? `address:${address.id}`;
      const target = marketTargetFromAddress(address, userId);
      if (target.latitude == null || target.longitude == null || !(target.ownAdr > 0)) return null;
      const config = resolveMarketConfig();
      const to = todaySaoPauloDateKey(now);
      const from = dateKeyAddDays(to, -29);
      const dates = Array.from({ length: 30 }, (_, i) => dateKeyAddDays(from, i));
      const build = await this.intel.build({
        target,
        city: address.cidade ?? null,
        state: address.estado ?? null,
        from,
        to,
        dates,
        radiusKm: config.defaultRadiusKm,
        use: 'internal', // uso interno: inclui datasets `licensed_internal_only`
        ownOccupancy: null,
        ownDaily: new Map(),
        eventDays: new Set(),
        config,
        today: to,
      });
      return toMarketSignalV2(build, target.ownAdr, now);
    } catch (err) {
      this.logger.warn(`Sinal de mercado indisponível para address=${address?.id}: ${(err as Error).message}`);
      return null;
    }
  }
}
