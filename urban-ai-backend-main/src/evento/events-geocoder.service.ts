import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/events.entity';
import { MapsService } from '../maps/maps.service';
import { CoverageService } from './coverage.service';

/**
 * EventsGeocoderService — F6.2 Plus.
 *
 * Resolve a "fila de geocoding pendente" gerada pelos coletores que
 * mandam eventos sem lat/lng (`pendingGeocode=true`, `ativo=false`).
 *
 * Funcionamento:
 *  - Cron a cada 30 min pega até 30 eventos pendentes
 *  - Pra cada um, chama MapsService.updateLatLngByEventId(id)
 *  - Se geocode OK: marca pendingGeocode=false, ativo=true
 *  - Se falhou: mantém pendingGeocode=true (retry no próximo run)
 *  - Limita a 30/run pra não estourar Google Maps (free tier 28.5k/mês)
 *
 * Endpoint manual admin: `POST /events/geocoder/run` dispara imediatamente.
 */
@Injectable()
export class EventsGeocoderService {
  private readonly logger = new Logger(EventsGeocoderService.name);
  private running = false;

  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    private readonly mapsService: MapsService,
    private readonly coverage: CoverageService,
  ) {}

  /**
   * Cron a cada 30 minutos. Anti-overlap: se um run anterior ainda está
   * processando, o próximo é skipado (running flag em memória).
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async cronTick() {
    if (this.running) {
      this.logger.warn('Geocoder run já em andamento — skipando este tick');
      return;
    }
    this.running = true;
    try {
      await this.runOnce(30);
    } finally {
      this.running = false;
    }
  }

  /**
   * Roda um batch de geocoding agora. Retorna estatísticas para o caller.
   *
   * @param limit Quantos eventos pendentes processar nesse run.
   */
  async runOnce(limit = 30): Promise<{
    attempted: number;
    succeeded: number;
    failed: number;
    failures: Array<{ id: string; reason: string }>;
  }> {
    const pending = await this.eventRepo.find({
      where: { pendingGeocode: true },
      order: { createdAt: 'ASC' },
      take: Math.max(1, Math.min(100, limit)),
    });

    if (pending.length === 0) {
      return { attempted: 0, succeeded: 0, failed: 0, failures: [] };
    }

    let succeeded = 0;
    const failures: Array<{ id: string; reason: string }> = [];

    for (const ev of pending) {
      try {
        const result = await this.mapsService.updateLatLngByEventId(ev.id);
        if (result?.ok && Number.isFinite(result.lat) && Number.isFinite(result.lng)) {
          // Geocode bem-sucedido — agora valida cobertura
          const inCoverage = await this.coverage.isWithinCoverage(
            Number(result.lat),
            Number(result.lng),
          );
          await this.eventRepo.update(
            { id: ev.id },
            {
              pendingGeocode: false,
              outOfScope: !inCoverage,
              // Só ativa se tá dentro da cobertura — fora vira out-of-scope
              ativo: inCoverage,
            },
          );
          succeeded++;
        } else {
          failures.push({ id: ev.id, reason: result?.message ?? 'unknown' });
          // Mantém pendingGeocode=true → retry no próximo cron tick
        }
      } catch (err: any) {
        failures.push({ id: ev.id, reason: err?.message ?? 'exception' });
      }
    }

    this.logger.log(
      `Geocoder run: attempted=${pending.length}, succeeded=${succeeded}, failed=${failures.length}`,
    );

    return {
      attempted: pending.length,
      succeeded,
      failed: failures.length,
      failures,
    };
  }

  /** Conta quantos eventos estão pendentes — útil pro painel admin. */
  async pendingCount(): Promise<number> {
    return this.eventRepo.count({ where: { pendingGeocode: true } });
  }
}
