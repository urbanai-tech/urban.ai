import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import { Address } from '../entities/addresses.entity';
import { List } from '../entities/list.entity';

/**
 * F6.1 — Coletor passivo do dataset proprietário Urban AI.
 *
 * Estratégia de captura em 3 frentes complementares:
 *
 *  1. **Cron diário 03:30 BRT** (`recordOwnedListingsSnapshot`):
 *     varre todos os imóveis cadastrados (entity List) e grava `PriceSnapshot`
 *     com o preço base atual. Não depende de evento próximo. Independente
 *     de o anfitrião ter reserva ou não. **Constrói a série temporal limpa.**
 *
 *  2. **Captura de comps na análise** (`recordCompsFromAnalysis`):
 *     toda vez que `PropriedadeService.analiseDePreco` roda, ele extrai
 *     `alerts.comps` (imóveis parecidos da vizinhança via Airbnb GraphQL).
 *     Hoje esses comps são usados só para treinar KNN ad-hoc e descartados.
 *     Esta service persiste o snapshot de cada comp para enriquecer o
 *     dataset proprietário **gratuitamente** — uma análise = N pontos novos.
 *
 *  3. **Captura do preço aplicado** (`recordAppliedPrice`):
 *     quando uma sugestão é aceita E (eventualmente, F6.4) pushada via
 *     Stays, gravamos o preço REAL que o anfitrião aplicou. Esse é o
 *     ground truth para medir MAPE.
 *
 * Idempotência: índice composto (snapshotDate, externalListingId) impede
 * duplicação de snapshots no mesmo dia para o mesmo imóvel.
 */
@Injectable()
export class DatasetCollectorService {
  private readonly logger = new Logger(DatasetCollectorService.name);
  private isRunning = false;

  constructor(
    @InjectRepository(PriceSnapshot) private readonly snapshotRepo: Repository<PriceSnapshot>,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(List) private readonly listRepo: Repository<List>,
  ) {}

  // ============ Frente 1: snapshot diário dos imóveis cadastrados ============

  /**
   * Cron diário 03:30 BRT. Roda antes do scraping de eventos (04h) e
   * antes da análise (08h). Constrói série temporal independente de evento.
   */
  @Cron('30 3 * * *', { name: 'dataset-daily-snapshot', timeZone: 'America/Sao_Paulo' })
  async handleDailySnapshot() {
    if (this.isRunning) {
      this.logger.debug('Daily snapshot já em execução; pulando este tick.');
      return;
    }
    this.isRunning = true;
    try {
      const result = await this.recordOwnedListingsSnapshot();
      this.logger.log(
        `Daily snapshot: capturados=${result.captured} pulados=${result.skipped} duplicados=${result.duplicates}`,
      );
    } catch (err) {
      this.logger.error(`Daily snapshot falhou: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Para cada imóvel cadastrado com preço base atual disponível, grava 1
   * `PriceSnapshot` do dia. Idempotente via índice (snapshotDate, externalListingId).
   *
   * O preço base "atual" hoje vem do que estiver populado em campos do
   * imóvel — quando F6.4 Stays estiver ativo, será o preço real do listing
   * Stays. Por enquanto o método aceita ser chamado manualmente passando
   * `priceCentsResolver` (ex.: integrações Airbnb GraphQL).
   */
  async recordOwnedListingsSnapshot(
    priceCentsResolver?: (list: List) => Promise<number | null>,
  ): Promise<{ captured: number; skipped: number; duplicates: number }> {
    const today = new Date().toISOString().slice(0, 10);

    const lists = await this.listRepo.find({ take: 5000 }); // soft cap p/ batch
    let captured = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const list of lists) {
      let priceCents: number | null = null;
      if (priceCentsResolver) {
        priceCents = await priceCentsResolver(list).catch(() => null);
      }

      // Sem preço resolvido → pulamos (mas logamos no aggregate).
      if (!priceCents || priceCents <= 0) {
        skipped++;
        continue;
      }

      const externalListingId = (list as any).id_do_anuncio || null;

      // Dedup — usa o índice composto. Se já existe snapshot hoje, pula.
      const existing = await this.snapshotRepo.findOne({
        where: {
          snapshotDate: today,
          externalListingId,
        },
      });
      if (existing) {
        duplicates++;
        continue;
      }

      const address = await this.addressRepo.findOne({ where: { list: { id: list.id } } as any });

      await this.snapshotRepo.save(
        this.snapshotRepo.create({
          snapshotDate: today,
          list,
          address: address ?? null,
          externalListingId,
          priceCents,
          currency: 'BRL',
          origin: 'self_cron',
          bedrooms: (list as any).quartos ?? null,
          bathrooms: (list as any).banheiros ?? null,
          bairro: address?.bairro ?? null,
          trainingReady: !!address?.latitude && !!address?.longitude,
        }),
      );
      captured++;
    }

    return { captured, skipped, duplicates };
  }

  // ============ Frente 2: persistência dos comps que vêm de cada análise ============

  /**
   * Recebe a lista de comps (imóveis parecidos da vizinhança) extraída
   * durante uma análise de preço e grava cada um como snapshot.
   *
   * Volume típico: 5–30 comps por análise × ~N análises/dia = milhares de
   * pontos novos por dia praticamente "de graça".
   */
  async recordCompsFromAnalysis(
    comps: Array<{
      listingID: string;
      latitude?: number;
      longitude?: number;
      bedrooms?: number;
      bathrooms?: number;
      avg_booked_daily_rate_ltm?: number;
      similarity_score?: number;
      bairro?: string;
    }>,
  ): Promise<{ saved: number; duplicates: number }> {
    const today = new Date().toISOString().slice(0, 10);
    let saved = 0;
    let duplicates = 0;

    for (const c of comps) {
      if (!c.listingID || !c.avg_booked_daily_rate_ltm) continue;
      const priceCents = Math.round(Number(c.avg_booked_daily_rate_ltm) * 100);
      if (!Number.isFinite(priceCents) || priceCents <= 0) continue;

      const existing = await this.snapshotRepo.findOne({
        where: { snapshotDate: today, externalListingId: c.listingID },
      });
      if (existing) {
        duplicates++;
        continue;
      }

      await this.snapshotRepo.save(
        this.snapshotRepo.create({
          snapshotDate: today,
          externalListingId: c.listingID,
          priceCents,
          currency: 'BRL',
          origin: 'comp_extraction',
          bedrooms: c.bedrooms ?? null,
          bathrooms: c.bathrooms ?? null,
          bairro: c.bairro ?? null,
          similarityScore: c.similarity_score ?? null,
          trainingReady: !!(c.latitude && c.longitude),
        }),
      );
      saved++;
    }

    return { saved, duplicates };
  }

  // ============ Frente 3: preço REAL que o anfitrião aplicou ============

  /**
   * Quando o anfitrião aceita uma sugestão e o preço é (manual ou auto)
   * aplicado no canal de distribuição, gravar o ground truth para alimentar
   * cálculo de MAPE e treino futuro de XGBoost com erro real.
   */
  async recordAppliedPrice(input: {
    listingId: string;
    targetDate: string; // YYYY-MM-DD
    appliedPriceCents: number;
    listInternalId?: string;
  }): Promise<PriceSnapshot> {
    const existing = await this.snapshotRepo.findOne({
      where: { snapshotDate: input.targetDate, externalListingId: input.listingId },
    });

    if (existing) {
      existing.appliedPriceCents = input.appliedPriceCents;
      return this.snapshotRepo.save(existing);
    }

    return this.snapshotRepo.save(
      this.snapshotRepo.create({
        snapshotDate: input.targetDate,
        externalListingId: input.listingId,
        priceCents: input.appliedPriceCents,
        appliedPriceCents: input.appliedPriceCents,
        currency: 'BRL',
        origin: 'self_cron',
        trainingReady: false,
      }),
    );
  }

  // ============ Helpers de diagnóstico ============

  async datasetSize(): Promise<{
    total: number;
    distinctListings: number;
    distinctDays: number;
    trainingReady: number;
  }> {
    const total = await this.snapshotRepo.count();
    const trainingReady = await this.snapshotRepo.count({ where: { trainingReady: true } });

    const distinctListings = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.externalListingId)', 'c')
      .getRawOne()
      .then((r: any) => Number(r.c));

    const distinctDays = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.snapshotDate)', 'c')
      .getRawOne()
      .then((r: any) => Number(r.c));

    return { total, distinctListings, distinctDays, trainingReady };
  }
}
