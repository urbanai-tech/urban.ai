import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaysService } from './stays.service';
import { StaysListing } from '../entities/stays-listing.entity';
import { AnalisePreco } from '../entities/AnalisePreco';

/**
 * Cron do **modo autônomo**: aplica sugestões de preço aceitas pela IA
 * diretamente via Stays, sem confirmação humana.
 *
 * Regras de execução:
 *  1. Só processa imóveis cujo `effectiveOperationMode === 'auto'`
 *     (listing.operationMode = 'auto' OU
 *      listing.operationMode = 'inherit' && user.operationMode = 'auto')
 *  2. Só considera AnalisePreco com sugestão emitida nas últimas 24h que
 *     ainda não foi pushada (sem PriceUpdate correspondente).
 *  3. Chama StaysService.pushPrice com origin='ai_auto' — guardrails de
 *     variação e idempotência ficam no service.
 *
 * Frequência: hora em hora, 5 min após a hora cheia para dar tempo do
 * enrichment de eventos completar (`events-enrichment.service.ts` roda em
 * `0 * * * *`).
 */
@Injectable()
export class StaysAutoApplyService {
  private readonly logger = new Logger(StaysAutoApplyService.name);
  private isProcessing = false;

  constructor(
    @InjectRepository(StaysListing) private readonly listingRepo: Repository<StaysListing>,
    @InjectRepository(AnalisePreco) private readonly analiseRepo: Repository<AnalisePreco>,
    private readonly staysService: StaysService,
  ) {}

  @Cron('5 * * * *', { name: 'stays-auto-apply', timeZone: 'America/Sao_Paulo' })
  async handleCron() {
    if (this.isProcessing) {
      this.logger.debug('Stays auto-apply ainda em execução; pulando este tick.');
      return;
    }
    this.isProcessing = true;
    try {
      await this.processBatch();
    } catch (err) {
      this.logger.error('Erro geral no stays-auto-apply', err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Em vez de um único SELECT complexo, fazemos 2 queries bem indexadas:
   *  (a) pega todos os listings em modo auto-efetivo
   *  (b) para cada um, pega a última AnalisePreco não aplicada
   *
   * Isso mantém o código testável e o volume é pequeno (anfitrião típico
   * tem 1–10 imóveis; o modo auto será minoria no início).
   */
  async processBatch(): Promise<{ processed: number; applied: number; errors: number }> {
    const autoListings = await this.findAutoModeListings();
    let applied = 0;
    let errors = 0;

    for (const listing of autoListings) {
      const analise = await this.findPendingAnalise(listing);
      if (!analise) continue;

      try {
        const previousPriceCents = this.toCents(analise.seuPrecoAtual ?? listing.basePriceCents ?? 0);
        const newPriceCents = this.toCents(analise.precoSugerido);
        if (newPriceCents <= 0 || previousPriceCents <= 0) {
          this.logger.warn(`Preços inválidos na AnalisePreco ${analise.id}; pulando.`);
          continue;
        }

        // A data-alvo é o dia do evento que originou a recomendação.
        // Se o evento tiver múltiplos dias, usamos o dataInicio.
        const targetDate = this.toDateStr(analise.evento?.dataInicio ?? new Date());

        await this.staysService.pushPrice(listing.account.user.id, {
          listingId: listing.id,
          targetDate,
          newPriceCents,
          previousPriceCents,
          currency: 'BRL',
          origin: 'ai_auto',
          analisePrecoId: analise.id,
        });
        applied++;
      } catch (err) {
        errors++;
        this.logger.warn(
          `Falha no auto-apply listing=${listing.id} analise=${analise.id}: ${(err as Error).message}`,
        );
      }
    }

    if (applied > 0 || errors > 0) {
      this.logger.log(
        `Stays auto-apply: processados=${autoListings.length} aplicados=${applied} erros=${errors}`,
      );
    }
    return { processed: autoListings.length, applied, errors };
  }

  private async findAutoModeListings(): Promise<StaysListing[]> {
    // Pega listings cujo operationMode seja auto OU inherit (e então filtra por user).
    const all = await this.listingRepo.find({
      where: { active: true },
      relations: ['account', 'account.user', 'propriedade'],
    });
    return all.filter((l) => {
      if (l.account?.status !== 'active') return false;
      if (l.operationMode === 'auto') return true;
      if (l.operationMode === 'inherit') {
        return (l.account as any)?.user?.operationMode === 'auto';
      }
      return false;
    });
  }

  private async findPendingAnalise(listing: StaysListing): Promise<AnalisePreco | null> {
    if (!listing.propriedade) return null;
    // Busca a análise mais recente (<=24h) sem push correspondente.
    // AnalisePreco é ligada a `endereco` (Address), que por sua vez referencia
    // List. Filtramos pela propriedade (list_id) via join no address.
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const candidate = await this.analiseRepo
      .createQueryBuilder('ap')
      .leftJoinAndSelect('ap.evento', 'evento')
      .leftJoin('ap.endereco', 'addr')
      .leftJoin(
        'price_updates',
        'pu',
        'pu.analise_preco_id = ap.id AND pu.status = :success',
        { success: 'success' },
      )
      .where('addr.list_id = :listId', { listId: listing.propriedade.id })
      .andWhere('ap.criado_em >= :cutoff', { cutoff })
      .andWhere('ap.aceito = :aceito', { aceito: true })
      .andWhere('pu.id IS NULL')
      .orderBy('ap.criado_em', 'DESC')
      .limit(1)
      .getOne();
    return candidate || null;
  }

  private toCents(valueReais: number | string | null): number {
    const num = typeof valueReais === 'string' ? Number(valueReais) : valueReais ?? 0;
    return Math.round(Number(num) * 100);
  }

  private toDateStr(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toISOString().slice(0, 10);
  }
}
