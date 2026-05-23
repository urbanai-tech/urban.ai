import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AirbnbService } from 'src/airbnb/airbnb.service';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { PriceUpdate } from 'src/entities/price-update.entity';
import { DatasetCollectorService } from 'src/knn-engine/dataset-collector.service';
import { Repository } from 'typeorm';

type AppliedPriceInput = {
  precoAplicado: number;
  origem: 'manual_dashboard' | 'manual_off_platform' | 'stays_auto' | 'stays_user_accepted';
  reservaStatus?: 'unknown' | 'booked' | 'not_booked' | 'blocked' | null;
  receitaReal?: number | null;
  noitesReservadas?: number | null;
  feedbackObservacao?: string | null;
};

export type SuggestionPublicResponse = {
  id: string;
  createdAt: string | Date;
  property: {
    addressId: string | null;
    listId: string | null;
    title: string | null;
    manualDailyPrice: number | null;
    averageMonthlyRevenue: number | null;
  };
  event: {
    id: string | null;
    name: string | null;
    city: string | null;
    state: string | null;
    startsAt: string | Date | null;
    source: string | null;
    relevance: number | null;
  };
  pricing: {
    current: number;
    suggested: number;
    lift: number | null;
    liftPercent: number;
    recommendation: string;
    reason: string | null;
    distanceKm: number;
  };
  lifecycle: {
    accepted: boolean;
    status: string;
    acceptedAt: string | Date | null;
    rejectedAt: string | Date | null;
    appliedPrice: number | null;
    appliedAt: string | Date | null;
    applicationOrigin: string | null;
  };
  outcome: {
    reservationStatus: string | null;
    realRevenue: number | null;
    bookedNights: number | null;
    capturedAt: string | Date | null;
    note: string | null;
  };
  verification: {
    status: string | null;
    checkedAt: string | Date | null;
    verifiedAppliedAt: string | Date | null;
    observedPrice: number | null;
    source: string | null;
    error: string | null;
  };
};

export type SuggestionVerificationHealth = {
  pending: number;
  verified: number;
  failed: number;
  mismatch: number;
  acceptedWithoutApplication: number;
};

export type SuggestionVerificationBatchResult = {
  scanned: number;
  verified: number;
  failed: number;
  mismatch: number;
  skipped: number;
  results: SuggestionPublicResponse[];
};

@Injectable()
export class SugestionService {
  private readonly logger = new Logger(SugestionService.name);

  constructor(
    @InjectRepository(AnalisePreco)
    private readonly analisePrecoRepository: Repository<AnalisePreco>,
    private readonly datasetCollector: DatasetCollectorService,
    @Optional()
    @InjectRepository(PriceUpdate)
    private readonly priceUpdateRepository?: Repository<PriceUpdate>,
    @Optional()
    private readonly airbnbService?: AirbnbService,
  ) {}

  async alterarAceito(id: string, userId: string, aceito: boolean): Promise<SuggestionPublicResponse> {
    const registro = await this.analisePrecoRepository.findOne({
      where: { id },
      relations: ['usuarioProprietario', 'endereco', 'endereco.list', 'evento'],
    });
    if (!registro) {
      throw new NotFoundException('Registro não encontrado');
    }
    this.assertOwnedByUser(registro, userId);
    if (aceito) this.assertReadyForAcceptance(registro);

    registro.aceito = aceito;
    registro.status = aceito ? 'accepted' : 'rejected';
    registro.aceitoEm = aceito ? new Date() : null;
    registro.rejeitadoEm = aceito ? null : new Date();
    this.markVerificationPendingOrNotRequired(registro, aceito);
    const saved = await this.analisePrecoRepository.save(registro);
    return this.toPublicResponse(saved);
  }

  /**
   * F6.1 Tier 3 — registra o preço REAL que o anfitrião aplicou após a sugestão.
   *
   * Este é o **ground truth do MAPE**: sem ele, não temos como validar se
   * a promessa "+30% receita" se cumpre. Pode ser chamado:
   *  - Pelo dashboard do anfitrião (origem='manual_dashboard') quando ele
   *    confirma "Sim, apliquei R$ X" após a sugestão
   *  - Automaticamente pelo Stays push (origem='stays_auto')
   *  - Por backfill admin (origem='manual_off_platform') quando o
   *    anfitrião declara em entrevista qual valor de fato aplicou
   *
   * Idempotente — múltiplas chamadas atualizam os campos para o último valor.
   */
  async registrarPrecoAplicado(
    id: string,
    userId: string,
    input: AppliedPriceInput,
  ): Promise<SuggestionPublicResponse> {
    const registro = await this.analisePrecoRepository.findOne({
      where: { id },
      relations: ['usuarioProprietario', 'endereco', 'endereco.list', 'evento'],
    });
    if (!registro) {
      throw new NotFoundException('Registro não encontrado');
    }
    this.assertOwnedByUser(registro, userId);
    this.assertReadyForAcceptance(registro);

    registro.aceito = true;
    registro.precoAplicado = input.precoAplicado;
    registro.aplicadoEm = new Date();
    registro.origemAplicacao = input.origem;
    registro.status = input.origem.startsWith('stays') ? 'applied_stays' : 'applied_manual';
    registro.aceitoEm = registro.aceitoEm ?? new Date();
    registro.rejeitadoEm = null;
    registro.expiradoEm = null;
    this.markVerificationPendingOrNotRequired(registro, true);
    this.applyOutcomeFeedback(registro, input);
    const saved = await this.analisePrecoRepository.save(registro);
    await this.tryRecordAppliedPriceSnapshot(saved, input.precoAplicado);
    return this.toPublicResponse(saved);
  }

  async registrarResultado(
    id: string,
    userId: string,
    input: Omit<AppliedPriceInput, 'origem' | 'precoAplicado'> & { precoAplicado?: number | null },
  ): Promise<SuggestionPublicResponse> {
    const registro = await this.analisePrecoRepository.findOne({
      where: { id },
      relations: ['usuarioProprietario', 'endereco', 'endereco.list', 'evento'],
    });
    if (!registro) {
      throw new NotFoundException('Registro nÃ£o encontrado');
    }
    this.assertOwnedByUser(registro, userId);

    if (input.precoAplicado !== undefined && input.precoAplicado !== null) {
      this.assertReadyForAcceptance(registro);
      const precoAplicado = Number(input.precoAplicado);
      if (Number.isFinite(precoAplicado) && precoAplicado > 0) {
        registro.precoAplicado = precoAplicado;
        registro.aplicadoEm = registro.aplicadoEm ?? new Date();
        registro.origemAplicacao = registro.origemAplicacao ?? 'manual_dashboard';
        registro.aceito = true;
        registro.aceitoEm = registro.aceitoEm ?? new Date();
        registro.status = 'applied_manual';
        this.markVerificationPendingOrNotRequired(registro, true);
      }
    }

    this.applyOutcomeFeedback(registro, input);
    const saved = await this.analisePrecoRepository.save(registro);
    if (saved.precoAplicado) {
      await this.tryRecordAppliedPriceSnapshot(saved, Number(saved.precoAplicado));
    }
    return this.toPublicResponse(saved);
  }

  async expirarAntigas(daysValid = 30): Promise<{ expired: number }> {
    const cutoff = new Date(Date.now() - daysValid * 24 * 60 * 60 * 1000);
    const result = await this.analisePrecoRepository
      .createQueryBuilder()
      .update(AnalisePreco)
      .set({
        status: 'expired',
        expiradoEm: new Date(),
      })
      .where('criado_em < :cutoff', { cutoff })
      .andWhere('aceito = :aceito', { aceito: false })
      .andWhere("(status IS NULL OR status IN ('suggested', 'rejected'))")
      .execute();
    return { expired: result.affected ?? 0 };
  }

  async rejeitar(id: string, userId: string): Promise<SuggestionPublicResponse> {
    return this.alterarAceito(id, userId, false);
  }

  async aceitar(id: string, userId: string): Promise<SuggestionPublicResponse> {
    return this.alterarAceito(id, userId, true);
  }

  async verificationHealth(): Promise<SuggestionVerificationHealth> {
    const raw = await this.analisePrecoRepository
      .createQueryBuilder('analise')
      .select(`
        SUM(CASE WHEN analise.aceito = 1 AND COALESCE(analise.verificationStatus, 'pending') = 'pending' THEN 1 ELSE 0 END)
      `, 'pending')
      .addSelect(`
        SUM(CASE WHEN analise.aceito = 1 AND analise.verificationStatus = 'verified' THEN 1 ELSE 0 END)
      `, 'verified')
      .addSelect(`
        SUM(CASE WHEN analise.aceito = 1 AND analise.verificationStatus = 'failed' THEN 1 ELSE 0 END)
      `, 'failed')
      .addSelect(`
        SUM(CASE WHEN analise.aceito = 1 AND analise.verificationStatus = 'mismatch' THEN 1 ELSE 0 END)
      `, 'mismatch')
      .addSelect(`
        SUM(CASE WHEN analise.aceito = 1 AND analise.precoAplicado IS NULL THEN 1 ELSE 0 END)
      `, 'acceptedWithoutApplication')
      .getRawOne();

    return {
      pending: Number(raw?.pending ?? 0),
      verified: Number(raw?.verified ?? 0),
      failed: Number(raw?.failed ?? 0),
      mismatch: Number(raw?.mismatch ?? 0),
      acceptedWithoutApplication: Number(raw?.acceptedWithoutApplication ?? 0),
    };
  }

  async listarAceitasPendentesVerificacao(limit = 50): Promise<SuggestionPublicResponse[]> {
    const registros = await this.pendingVerificationQuery()
      .take(this.normalizeLimit(limit))
      .getMany();
    return registros.map((registro) => this.toPublicResponse(registro));
  }

  async verificarAnalisesAceitasPendentes(limit = 25): Promise<SuggestionVerificationBatchResult> {
    const registros = await this.pendingVerificationQuery()
      .andWhere('analise.precoAplicado IS NOT NULL')
      .take(this.normalizeLimit(limit, 100))
      .getMany();

    const results: SuggestionPublicResponse[] = [];
    let verified = 0;
    let failed = 0;
    let mismatch = 0;
    let skipped = 0;

    for (const registro of registros) {
      const result = await this.verificarAplicacao(registro.id);
      results.push(result);
      if (result.verification.status === 'verified') verified++;
      else if (result.verification.status === 'failed') failed++;
      else if (result.verification.status === 'mismatch') mismatch++;
      else skipped++;
    }

    return {
      scanned: registros.length,
      verified,
      failed,
      mismatch,
      skipped,
      results,
    };
  }

  async verificarAplicacao(id: string): Promise<SuggestionPublicResponse> {
    const registro = await this.analisePrecoRepository.findOne({
      where: { id },
      relations: ['usuarioProprietario', 'endereco', 'endereco.list', 'evento'],
    });
    if (!registro) {
      throw new NotFoundException('Registro nao encontrado');
    }

    if (!registro.aceito) {
      registro.verificationStatus = 'not_required';
      registro.verificationCheckedAt = new Date();
      registro.verificationError = null;
      return this.toPublicResponse(await this.analisePrecoRepository.save(registro));
    }

    if (!registro.precoAplicado) {
      registro.verificationStatus = 'pending';
      registro.verificationCheckedAt = new Date();
      registro.verificationError = 'Sugestao aceita sem preco aplicado registrado.';
      return this.toPublicResponse(await this.analisePrecoRepository.save(registro));
    }

    try {
      const observed = await this.observeAppliedPrice(registro);
      const expected = this.nullableNumber(registro.precoAplicado) ?? this.nullableNumber(registro.precoSugerido);
      const status = this.pricesMatch(expected, observed.price) ? 'verified' : 'mismatch';

      registro.verificationStatus = status;
      registro.verificationCheckedAt = new Date();
      registro.verifiedAppliedAt = observed.appliedAt;
      registro.observedPrice = Number(observed.price.toFixed(2));
      registro.verificationSource = observed.source;
      registro.verificationError = status === 'mismatch'
        ? `Preco observado ${observed.price.toFixed(2)} difere do preco esperado ${expected?.toFixed(2) ?? 'n/a'}.`
        : null;

      return this.toPublicResponse(await this.analisePrecoRepository.save(registro));
    } catch (error) {
      registro.verificationStatus = 'failed';
      registro.verificationCheckedAt = new Date();
      registro.verificationError = this.truncateError(error);
      return this.toPublicResponse(await this.analisePrecoRepository.save(registro));
    }
  }

  private assertOwnedByUser(registro: AnalisePreco, userId: string): void {
    if (!registro.usuarioProprietario?.id) {
      throw new NotFoundException('Registro sem usuario proprietario associado');
    }
    if (registro.usuarioProprietario.id !== userId) {
      throw new ForbiddenException('Registro nao pertence ao usuario autenticado');
    }
    if (registro.usuarioProprietario.ativo === false) {
      throw new ForbiddenException('Usuario inativo nao pode alterar sugestoes');
    }
  }

  private assertReadyForAcceptance(registro: AnalisePreco): void {
    if (!registro.endereco?.id) {
      throw new BadRequestException('Sugestao sem endereco associado nao pode ser aceita');
    }
    if (!registro.endereco?.list?.id) {
      throw new BadRequestException('Sugestao sem imovel associado nao pode ser aceita');
    }
    const listingId = registro.endereco.list.id_do_anuncio;
    if (typeof listingId !== 'string' || listingId.trim().length === 0) {
      throw new BadRequestException('Sugestao sem anuncio Airbnb associado nao pode ser aceita');
    }
    if (!registro.evento?.id) {
      throw new BadRequestException('Sugestao sem evento associado nao pode ser aceita');
    }
  }

  private toPublicResponse(registro: AnalisePreco): SuggestionPublicResponse {
    const current = Number(registro.seuPrecoAtual);
    const suggested = Number(registro.precoSugerido);
    return {
      id: registro.id,
      createdAt: registro.criadoEm?.toISOString?.() ?? registro.criadoEm,
      property: {
        addressId: registro.endereco?.id ?? null,
        listId: registro.endereco?.list?.id ?? null,
        title: registro.endereco?.list?.titulo ?? null,
        manualDailyPrice: this.nullableNumber(registro.endereco?.list?.manualDailyPrice),
        averageMonthlyRevenue: this.nullableNumber(registro.endereco?.list?.averageMonthlyRevenue),
      },
      event: {
        id: registro.evento?.id ?? null,
        name: registro.evento?.nome ?? null,
        city: registro.evento?.cidade ?? null,
        state: registro.evento?.estado ?? null,
        startsAt: registro.evento?.dataInicio?.toISOString?.() ?? registro.evento?.dataInicio ?? null,
        source: registro.evento?.source ?? null,
        relevance: this.nullableNumber(registro.evento?.relevancia),
      },
      pricing: {
        current,
        suggested,
        lift: Number.isFinite(current) && Number.isFinite(suggested) ? suggested - current : null,
        liftPercent: Number(registro.diferencaPercentual),
        recommendation: registro.recomendacao,
        reason: registro.motivo_ia ?? null,
        distanceKm: Number(registro.distanciaSuaPropriedade),
      },
      lifecycle: {
        accepted: registro.aceito,
        status: registro.status,
        acceptedAt: registro.aceitoEm?.toISOString?.() ?? registro.aceitoEm ?? null,
        rejectedAt: registro.rejeitadoEm?.toISOString?.() ?? registro.rejeitadoEm ?? null,
        appliedPrice: this.nullableNumber(registro.precoAplicado),
        appliedAt: registro.aplicadoEm?.toISOString?.() ?? registro.aplicadoEm ?? null,
        applicationOrigin: registro.origemAplicacao ?? null,
      },
      outcome: {
        reservationStatus: registro.reservaStatus ?? null,
        realRevenue: this.nullableNumber(registro.receitaReal),
        bookedNights: registro.noitesReservadas ?? null,
        capturedAt: registro.resultadoRegistradoEm?.toISOString?.() ?? registro.resultadoRegistradoEm ?? null,
        note: registro.feedbackObservacao ?? null,
      },
      verification: {
        status: registro.verificationStatus ?? null,
        checkedAt: registro.verificationCheckedAt?.toISOString?.() ?? registro.verificationCheckedAt ?? null,
        verifiedAppliedAt: registro.verifiedAppliedAt?.toISOString?.() ?? registro.verifiedAppliedAt ?? null,
        observedPrice: this.nullableNumber(registro.observedPrice),
        source: registro.verificationSource ?? null,
        error: registro.verificationError ?? null,
      },
    };
  }

  private nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async tryRecordAppliedPriceSnapshot(
    registro: AnalisePreco,
    precoAplicado: number,
  ): Promise<void> {
    const targetDate = registro.evento?.dataInicio
      ? new Date(registro.evento.dataInicio).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const list = registro.endereco?.list;
    const listingId = list?.id_do_anuncio || (list?.id ? `urban-list:${list.id}` : null);

    if (!listingId) {
      this.logger.warn(`Nao foi possivel gravar PriceSnapshot: AnalisePreco ${registro.id} sem listing associado.`);
      return;
    }

    const appliedPriceCents = Math.round(Number(precoAplicado) * 100);
    if (!Number.isFinite(appliedPriceCents) || appliedPriceCents <= 0) {
      this.logger.warn(`Preco aplicado invalido para AnalisePreco ${registro.id}: ${precoAplicado}`);
      return;
    }

    try {
      await this.datasetCollector.recordAppliedPrice({
        listingId,
        targetDate,
        appliedPriceCents,
        listInternalId: list?.id,
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao persistir PriceSnapshot aplicado para AnalisePreco ${registro.id}: ${(error as Error).message}`,
      );
    }
  }

  private applyOutcomeFeedback(
    registro: AnalisePreco,
    input: {
      reservaStatus?: 'unknown' | 'booked' | 'not_booked' | 'blocked' | null;
      receitaReal?: number | null;
      noitesReservadas?: number | null;
      feedbackObservacao?: string | null;
    },
  ) {
    let touched = false;

    if (input.reservaStatus !== undefined) {
      registro.reservaStatus = input.reservaStatus ?? null;
      touched = true;
    }
    if (input.receitaReal !== undefined) {
      const receita = input.receitaReal === null ? null : Number(input.receitaReal);
      registro.receitaReal = Number.isFinite(receita as number) ? (receita as number) : null;
      touched = true;
    }
    if (input.noitesReservadas !== undefined) {
      const noites = input.noitesReservadas === null ? null : Math.max(0, Math.floor(Number(input.noitesReservadas)));
      registro.noitesReservadas = Number.isFinite(noites as number) ? (noites as number) : null;
      touched = true;
    }
    if (input.feedbackObservacao !== undefined) {
      registro.feedbackObservacao = input.feedbackObservacao?.trim() || null;
      touched = true;
    }

    if (touched) {
      registro.resultadoRegistradoEm = new Date();
    }
  }

  private markVerificationPendingOrNotRequired(registro: AnalisePreco, accepted: boolean): void {
    registro.verificationStatus = accepted ? 'pending' : 'not_required';
    registro.verificationCheckedAt = null;
    registro.verifiedAppliedAt = null;
    registro.observedPrice = null;
    registro.verificationSource = null;
    registro.verificationError = null;
  }

  private pendingVerificationQuery() {
    return this.analisePrecoRepository
      .createQueryBuilder('analise')
      .leftJoinAndSelect('analise.usuarioProprietario', 'usuarioProprietario')
      .leftJoinAndSelect('analise.endereco', 'endereco')
      .leftJoinAndSelect('endereco.list', 'list')
      .leftJoinAndSelect('analise.evento', 'evento')
      .where('analise.aceito = :aceito', { aceito: true })
      .andWhere("(analise.verificationStatus IS NULL OR analise.verificationStatus IN ('pending', 'failed', 'mismatch'))")
      .orderBy('analise.aceitoEm', 'ASC')
      .addOrderBy('analise.criadoEm', 'ASC');
  }

  private normalizeLimit(limit: number, max = 200): number {
    const parsed = Math.floor(Number(limit));
    if (!Number.isFinite(parsed) || parsed <= 0) return 50;
    return Math.min(parsed, max);
  }

  private async observeAppliedPrice(registro: AnalisePreco): Promise<{
    price: number;
    source: string;
    appliedAt: Date;
  }> {
    const staysObservation = await this.observeFromSuccessfulPriceUpdate(registro.id);
    if (staysObservation) return staysObservation;
    return this.observeFromAirbnb(registro);
  }

  private async observeFromSuccessfulPriceUpdate(analiseId: string): Promise<{
    price: number;
    source: string;
    appliedAt: Date;
  } | null> {
    if (!this.priceUpdateRepository) return null;

    const update = await this.priceUpdateRepository.findOne({
      where: {
        analise: { id: analiseId },
        status: 'success',
      } as any,
      order: { createdAt: 'DESC' },
    });
    if (!update) return null;

    return {
      price: update.newPriceCents / 100,
      source: 'stays_price_update',
      appliedAt: update.createdAt ?? new Date(),
    };
  }

  private async observeFromAirbnb(registro: AnalisePreco): Promise<{
    price: number;
    source: string;
    appliedAt: Date;
  }> {
    if (!this.airbnbService) {
      throw new Error('AirbnbService indisponivel para verificacao.');
    }

    const listingId = registro.endereco?.list?.id_do_anuncio?.trim();
    if (!listingId) {
      throw new Error('Sugestao sem anuncio Airbnb associado para verificacao.');
    }

    const checkIn = this.resolveTargetDate(registro);
    const checkOut = this.addDays(checkIn, 1);
    const quote = await this.airbnbService.getPriceForDateWindow(listingId, checkIn, checkOut);
    const total = this.nullableNumber(quote.price?.data?.accommodationCost);
    const nights = Math.max(1, Number(quote.nights ?? 1));
    if (!total || total <= 0) {
      throw new Error('Airbnb nao retornou preco observado valido.');
    }

    return {
      price: total / nights,
      source: quote.source ?? 'airbnb',
      appliedAt: new Date(),
    };
  }

  private resolveTargetDate(registro: AnalisePreco): string {
    const date = registro.evento?.dataInicio ?? registro.aplicadoEm ?? registro.aceitoEm ?? new Date();
    return new Date(date).toISOString().slice(0, 10);
  }

  private addDays(date: string, days: number): string {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    parsed.setUTCDate(parsed.getUTCDate() + days);
    return parsed.toISOString().slice(0, 10);
  }

  private pricesMatch(expected: number | null, observed: number): boolean {
    if (!expected || !Number.isFinite(expected) || !Number.isFinite(observed)) return false;
    return Math.abs(expected - observed) <= 1;
  }

  private truncateError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, 2000);
  }
}
