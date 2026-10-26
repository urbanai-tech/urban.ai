import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, IsNull, Not } from 'typeorm';
import { User } from '../entities/user.entity';
import { Address } from '../entities/addresses.entity';
import { List } from '../entities/list.entity';
import { Payment } from '../entities/payment.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { OccupancyHistory } from '../entities/occupancy-history.entity';
import { calculateBacktest } from '../knn-engine/backtesting';
import { AdminStaysHealthService } from './admin-stays-health.service';

/**
 * AdminOperationsService — operação do produto: saúde Stays, funil, qualidade
 * das sugestões e cobertura/registro manual de ocupação.
 */
@Injectable()
export class AdminOperationsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(List) private readonly listRepo: Repository<List>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(AnalisePreco)
    private readonly analiseRepo: Repository<AnalisePreco>,
    @InjectRepository(OccupancyHistory)
    private readonly occupancyRepo: Repository<OccupancyHistory>,
    private readonly staysHealthService: AdminStaysHealthService,
  ) {}

  // =========================================================================
  // Operação — Stays + push history + funnel + ocupação
  // =========================================================================

  /**
   * Saúde da integração Stays:
   *  - contas conectadas (active/error/disconnected)
   *  - listings sincronizados
   *  - PriceUpdates dos últimos 30 dias por status (success/rejected/error)
   *  - últimos 10 pushes para diagnóstico
   */
  async staysHealth() {
    return this.staysHealthService.getHealth();
  }

  /**
   * Funnel de produto:
   *  - Cadastros últimos 30d
   *  - Onboarding (com airbnbHostId)
   *  - Imóveis cadastrados
   *  - Análises geradas
   *  - Sugestões aceitas
   *  - Preço aplicado registrado (ground truth do MAPE)
   *  - Pagantes ativos
   */
  async productFunnel() {
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      signupsLast30d,
      withAirbnbId,
      _withListingsCount,
      analysesLast30d,
      acceptedLast30d,
      appliedLast30d,
      activeSubscriptions,
      autoModeUsers,
    ] = await Promise.all([
      this.userRepo.count({ where: { createdAt: MoreThanOrEqual(cutoff30d) } }),
      this.userRepo.count({ where: { airbnbHostId: Not(IsNull()) } }),
      this.userRepo
        .createQueryBuilder('u')
        .innerJoin('u.notifications', 'n')
        .select('COUNT(DISTINCT u.id)', 'c')
        .getRawOne()
        .then((r: any) => Number(r?.c ?? 0))
        .catch(() => 0),
      this.analiseRepo.createQueryBuilder('a').where('a.criadoEm >= :cutoff', { cutoff: cutoff30d }).getCount(),
      this.analiseRepo
        .createQueryBuilder('a')
        .where('a.criadoEm >= :cutoff', { cutoff: cutoff30d })
        .andWhere('a.aceito = true')
        .getCount(),
      this.analiseRepo
        .createQueryBuilder('a')
        .where('a.criadoEm >= :cutoff', { cutoff: cutoff30d })
        .andWhere('a.precoAplicado IS NOT NULL')
        .getCount(),
      this.paymentRepo
        .createQueryBuilder('p')
        .where('p.status IN (:...statuses)', {
          statuses: ['active', 'trialing'],
        })
        .getCount(),
      this.userRepo.count({ where: { operationMode: 'auto' } }),
    ]);

    const acceptanceRate = analysesLast30d > 0 ? Math.round((acceptedLast30d / analysesLast30d) * 1000) / 10 : 0;
    const applicationRate = acceptedLast30d > 0 ? Math.round((appliedLast30d / acceptedLast30d) * 1000) / 10 : 0;

    return {
      windowDays: 30,
      stages: {
        signups: signupsLast30d,
        onboardedWithAirbnbId: withAirbnbId,
        analysesGenerated: analysesLast30d,
        suggestionsAccepted: acceptedLast30d,
        appliedPriceCaptured: appliedLast30d,
        activeSubscriptions,
        operationModeAuto: autoModeUsers,
      },
      rates: {
        acceptanceRatePercent: acceptanceRate, // aceitos / análises geradas
        applicationRatePercent: applicationRate, // preço aplicado / aceitos
      },
    };
  }

  /**
   * Backtest do motor: agrupa AnalisePreco com precoAplicado preenchido
   * e calcula MAPE atual.
   */
  async pricingQuality() {
    const rows = await this.analiseRepo
      .createQueryBuilder('a')
      .select('a.precoSugerido', 'predicted')
      .addSelect('a.precoAplicado', 'actual')
      .where('a.precoAplicado IS NOT NULL')
      .andWhere('a.criadoEm >= :cutoff', {
        cutoff: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      })
      .getRawMany();

    const pairs = rows.map((r) => ({
      predicted: Number(r.predicted),
      actual: Number(r.actual),
    }));

    const result = calculateBacktest(pairs);
    return {
      windowDays: 90,
      sampleSize: result.sampleSize,
      discarded: result.discarded,
      mapePercent: Number.isFinite(result.mapePercent) ? Math.round(result.mapePercent * 100) / 100 : null,
      rmse: Number.isFinite(result.rmse) ? Math.round(result.rmse * 100) / 100 : null,
      medianAbsoluteError: Number.isFinite(result.medianAbsoluteError)
        ? Math.round(result.medianAbsoluteError * 100) / 100
        : null,
      qualityGate: {
        threshold: 15,
        passes: Number.isFinite(result.mapePercent) && result.mapePercent <= 15 && result.sampleSize >= 30,
        meetsMinSample: result.sampleSize >= 30,
      },
    };
  }

  /**
   * Cobertura de ocupação (resolve gap de "não temos histórico de demanda").
   */
  async occupancyCoverage() {
    const [byStatus, byOrigin, distinctListings] = await Promise.all([
      this.occupancyRepo
        .createQueryBuilder('o')
        .select('o.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('o.status')
        .getRawMany(),
      this.occupancyRepo
        .createQueryBuilder('o')
        .select('o.origin', 'origin')
        .addSelect('COUNT(*)', 'count')
        .groupBy('o.origin')
        .getRawMany(),
      this.occupancyRepo
        .createQueryBuilder('o')
        .select('COUNT(DISTINCT o.list)', 'c')
        .getRawOne()
        .then((r: any) => Number(r?.c ?? 0)),
    ]);

    return {
      byStatus: byStatus.map((r: any) => ({
        status: r.status,
        count: Number(r.count),
      })),
      byOrigin: byOrigin.map((r: any) => ({
        origin: r.origin,
        count: Number(r.count),
      })),
      distinctListings,
    };
  }

  async occupancyProperties() {
    const addresses = await this.addressRepo.find({
      where: { ativo: true },
      relations: ['list', 'user'],
      take: 5000,
    });

    return addresses
      .filter((address) => !!address.list?.id)
      .map((address) => ({
        addressId: address.id,
        listId: address.list.id,
        title: address.list.titulo,
        airbnbListingId: address.list.id_do_anuncio,
        userId: address.user?.id ?? address.list.user?.id ?? null,
        userEmail: address.user?.email ?? address.list.user?.email ?? null,
        neighborhood: address.bairro ?? address.list.neighborhood ?? null,
        city: address.cidade ?? null,
        state: address.estado ?? null,
        manualDailyPrice: address.list.manualDailyPrice ?? null,
        dailyPrice: address.list.dailyPrice ?? null,
        averageMonthlyRevenue: address.list.averageMonthlyRevenue ?? null,
      }))
      .sort((a, b) => {
        const userCompare = String(a.userEmail ?? '').localeCompare(String(b.userEmail ?? ''));
        if (userCompare !== 0) return userCompare;
        return String(a.title ?? '').localeCompare(String(b.title ?? ''));
      });
  }

  async upsertManualOccupancy(input: {
    listId?: string;
    airbnbListingId?: string;
    date: string;
    status: 'booked' | 'available' | 'blocked' | 'unknown';
    revenueCents?: number | null;
    listedPriceCents?: number | null;
    currency?: string;
  }) {
    if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new BadRequestException('date deve estar no formato YYYY-MM-DD');
    }
    if (!['booked', 'available', 'blocked', 'unknown'].includes(input.status)) {
      throw new BadRequestException('status inválido');
    }

    const list = await this.listRepo.findOne({
      where: input.listId ? { id: input.listId } : { id_do_anuncio: input.airbnbListingId ?? '' },
      relations: ['user'],
    });
    if (!list) {
      throw new NotFoundException('Imóvel não encontrado');
    }

    const address = await this.addressRepo.findOne({
      where: { list: { id: list.id } } as any,
      relations: ['list'],
    });
    const existing = await this.occupancyRepo.findOne({
      where: { list: { id: list.id }, date: input.date } as any,
      relations: ['list', 'user', 'address'],
    });
    const record = existing ?? this.occupancyRepo.create();
    record.list = list;
    record.user = list.user;
    record.address = address ?? null;
    record.date = input.date;
    record.status = input.status;
    record.origin = 'manual';
    record.revenueCents = input.revenueCents ?? null;
    record.listedPriceCents = input.listedPriceCents ?? null;
    record.currency = input.currency ?? 'BRL';
    record.trainingReady = input.status === 'booked' || input.status === 'available';
    record.nightsBooked = input.status === 'booked' ? 1 : null;

    return this.occupancyRepo.save(record);
  }
}
