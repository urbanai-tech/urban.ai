import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Address } from '../entities/addresses.entity';
import { Event as EventEntity } from '../entities/events.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import { AdaptivePricingStrategy } from '../knn-engine/strategies/adaptive-pricing.strategy';
import { MapsService } from '../maps/maps.service';

/**
 * AdminPricingOpsService — operação do motor de pricing pelo admin: status do
 * modelo, painel/reprocessamento do usuário alpha e métricas do dataset.
 */
@Injectable()
export class AdminPricingOpsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(EventEntity)
    private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(AnalisePreco)
    private readonly analiseRepo: Repository<AnalisePreco>,
    @InjectRepository(PriceSnapshot)
    private readonly snapshotRepo: Repository<PriceSnapshot>,
    private readonly adaptiveStrategy: AdaptivePricingStrategy,
    private readonly mapsService: MapsService,
  ) {}

  private requireAlphaEmail(email?: string): string {
    const normalized = String(email ?? '')
      .trim()
      .toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      throw new BadRequestException('e-mail do usuário alpha é obrigatório');
    }
    return normalized;
  }

  /**
   * Detalhe da estratégia ativa de pricing — útil para o painel de IA.
   */
  async pricingStatus() {
    const decision = await this.adaptiveStrategy.describeCurrentTier();
    return {
      activeStrategy: decision.strategy.name,
      tier: decision.tier,
      reason: decision.reason,
      datasetSize: decision.datasetSize,
      strategyEnvDefault: process.env.PRICING_STRATEGY || 'adaptive',
      bootstrapOnBoot: process.env.PRICING_BOOTSTRAP_ON_BOOT !== 'false',
    };
  }

  async alphaDashboard(email?: string) {
    const targetEmail = this.requireAlphaEmail(email);
    const user = await this.userRepo.findOne({ where: { email: targetEmail } });
    if (!user) {
      throw new NotFoundException('Usuário alpha não encontrado');
    }

    const [addresses, analyses, eventsTotal, upcomingEvents, eventsLast24h] = await Promise.all([
      this.addressRepo.find({
        where: { user: { id: user.id }, ativo: true },
        relations: ['list'],
      }),
      this.analiseRepo.find({
        where: { usuarioProprietario: { id: user.id } },
        relations: ['endereco', 'endereco.list', 'evento'],
        order: { criadoEm: 'DESC' },
      }),
      this.eventRepo.count(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.ativo = :ativo', { ativo: true })
        .andWhere('e.dataInicio >= :now', { now: new Date() })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.createdAt >= :cutoff', {
          cutoff: new Date(Date.now() - 24 * 60 * 60 * 1000),
        })
        .getCount(),
    ]);

    const lists = addresses.map((address) => address.list).filter(Boolean);
    const uniqueListIds = new Set(lists.map((list) => list.id));
    const completed = addresses.filter((address) => address.analisado === 'completed').length;
    const withManualPrice = lists.filter((list) => Number(list.manualDailyPrice) > 0).length;
    const withRevenue = lists.filter((list) => Number(list.averageMonthlyRevenue) > 0).length;
    const totalMonthlyRevenue = lists.reduce((sum, list) => sum + (Number(list.averageMonthlyRevenue) || 0), 0);
    const accepted = analyses.filter((analysis) => analysis.aceito).length;
    const applied = analyses.filter((analysis) => Number(analysis.precoAplicado) > 0).length;
    const feedbackCaptured = analyses.filter((analysis) => analysis.resultadoRegistradoEm || analysis.reservaStatus).length;
    const booked = analyses.filter((analysis) => analysis.reservaStatus === 'booked').length;
    const realRevenue = analyses.reduce((sum, analysis) => sum + (Number(analysis.receitaReal) || 0), 0);
    const potentialDailyLift = analyses.reduce((sum, analysis) => {
      const suggested = Number(analysis.precoSugerido);
      const current = Number(analysis.seuPrecoAtual);
      return Number.isFinite(suggested) && Number.isFinite(current) ? sum + Math.max(0, suggested - current) : sum;
    }, 0);

    const qualityFlags = analyses.reduce<Record<string, number>>((acc, analysis) => {
      for (const flag of this.eventQualityFlags(analysis.evento)) {
        acc[flag] = (acc[flag] ?? 0) + 1;
      }
      return acc;
    }, {});

    return {
      generatedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        ativo: user.ativo,
        role: user.role,
      },
      properties: {
        total: uniqueListIds.size,
        activeAddresses: addresses.length,
        completed,
        withManualPrice,
        withAverageMonthlyRevenue: withRevenue,
        totalAverageMonthlyRevenue: totalMonthlyRevenue,
      },
      recommendations: {
        total: analyses.length,
        accepted,
        applied,
        feedbackCaptured,
        booked,
        realRevenue,
        potentialDailyLift,
        distinctProperties: new Set(analyses.map((analysis) => analysis.endereco?.list?.id).filter(Boolean)).size,
        distinctEvents: new Set(analyses.map((analysis) => analysis.evento?.id).filter(Boolean)).size,
      },
      events: {
        total: eventsTotal,
        upcoming: upcomingEvents,
        createdLast24h: eventsLast24h,
        qualityFlags,
      },
      recentRecommendations: this.formatAlphaRecommendations(analyses.slice(0, 20)),
    };
  }

  async alphaRecommendations(email?: string, limit = 250) {
    const take = Math.max(1, Math.min(1000, Number(limit) || 250));
    const targetEmail = this.requireAlphaEmail(email);
    const user = await this.userRepo.findOne({ where: { email: targetEmail } });
    if (!user) {
      throw new NotFoundException('Usuário alpha não encontrado');
    }
    const analyses = await this.analiseRepo.find({
      where: { usuarioProprietario: { id: user.id } },
      relations: ['endereco', 'endereco.list', 'evento'],
      order: { criadoEm: 'DESC' },
      take,
    });
    return {
      generatedAt: new Date().toISOString(),
      user: { id: user.id, email: user.email, username: user.username },
      total: analyses.length,
      rows: this.formatAlphaRecommendations(analyses),
    };
  }

  async runAlphaReprocess(email?: string) {
    return this.mapsService.reprocessAlphaPricing(this.requireAlphaEmail(email));
  }

  /**
   * Métricas do dataset proprietário com breakdown por origem.
   */
  async datasetMetrics() {
    const [byOrigin, daysCovered, topListings] = await Promise.all([
      this.snapshotRepo
        .createQueryBuilder('s')
        .select('s.origin', 'origin')
        .addSelect('COUNT(*)', 'count')
        .groupBy('s.origin')
        .getRawMany(),
      this.snapshotRepo.createQueryBuilder('s').select('COUNT(DISTINCT s.snapshotDate)', 'days').getRawOne(),
      this.snapshotRepo
        .createQueryBuilder('s')
        .select('s.externalListingId', 'listingId')
        .addSelect('COUNT(*)', 'snapshots')
        .where('s.externalListingId IS NOT NULL')
        .groupBy('s.externalListingId')
        .orderBy('snapshots', 'DESC')
        .limit(10)
        .getRawMany(),
    ]);

    return {
      byOrigin: byOrigin.map((r: any) => ({
        origin: r.origin,
        count: Number(r.count),
      })),
      daysCovered: Number(daysCovered?.days ?? 0),
      topListings: topListings.map((r: any) => ({
        listingId: r.listingId,
        snapshots: Number(r.snapshots),
      })),
    };
  }

  private formatAlphaRecommendations(analyses: AnalisePreco[]) {
    return analyses.map((analysis) => {
      const current = Number(analysis.seuPrecoAtual);
      const suggested = Number(analysis.precoSugerido);
      return {
        id: analysis.id,
        createdAt: analysis.criadoEm?.toISOString?.() ?? analysis.criadoEm,
        property: {
          listId: analysis.endereco?.list?.id ?? null,
          addressId: analysis.endereco?.id ?? null,
          title: analysis.endereco?.list?.titulo ?? null,
          manualDailyPrice: analysis.endereco?.list?.manualDailyPrice ?? null,
          averageMonthlyRevenue: analysis.endereco?.list?.averageMonthlyRevenue ?? null,
        },
        event: {
          id: analysis.evento?.id ?? null,
          name: analysis.evento?.nome ?? null,
          city: analysis.evento?.cidade ?? null,
          state: analysis.evento?.estado ?? null,
          startsAt: analysis.evento?.dataInicio?.toISOString?.() ?? analysis.evento?.dataInicio ?? null,
          source: analysis.evento?.source ?? null,
          relevance: analysis.evento?.relevancia ?? null,
          expectedAttendance: analysis.evento?.expectedAttendance ?? analysis.evento?.capacidadeEstimada ?? null,
        },
        pricing: {
          current,
          suggested,
          lift: Number.isFinite(current) && Number.isFinite(suggested) ? suggested - current : null,
          liftPercent: analysis.diferencaPercentual,
          recommendation: analysis.recomendacao,
          reason: analysis.motivo_ia,
          distanceKm: analysis.distanciaSuaPropriedade,
        },
        lifecycle: {
          accepted: analysis.aceito,
          status: analysis.status,
          appliedPrice: analysis.precoAplicado,
          appliedAt: analysis.aplicadoEm?.toISOString?.() ?? analysis.aplicadoEm,
          applicationOrigin: analysis.origemAplicacao,
        },
        outcome: {
          reservationStatus: analysis.reservaStatus,
          realRevenue: analysis.receitaReal,
          bookedNights: analysis.noitesReservadas,
          capturedAt: analysis.resultadoRegistradoEm?.toISOString?.() ?? analysis.resultadoRegistradoEm,
          note: analysis.feedbackObservacao,
        },
        qualityFlags: this.eventQualityFlags(analysis.evento),
      };
    });
  }

  private eventQualityFlags(evento: EventEntity | null | undefined): string[] {
    const flags: string[] = [];
    if (!evento) return ['missing_event'];
    if (evento.ativo === false) flags.push('inactive');
    if (evento.outOfScope === true) flags.push('out_of_scope');
    if (evento.pendingGeocode === true) flags.push('pending_geocode');
    if (!evento.dataInicio || new Date(evento.dataInicio) < new Date()) flags.push('past_or_missing_date');
    if (!evento.latitude || !evento.longitude) flags.push('missing_coordinates');

    const sourceText =
      `${evento.source ?? ''} ${evento.categoria ?? ''} ${evento.venueType ?? ''} ${evento.nome ?? ''}`.toLowerCase();
    if (sourceText.includes('online') || sourceText.includes('virtual') || sourceText.includes('webinar')) {
      flags.push('online_event');
    }

    const relevance = Number(evento.relevancia);
    const radius = Number(evento.raioImpactoKm);
    if (Number.isFinite(relevance) && relevance <= 0 && Number.isFinite(radius) && radius <= 0) {
      flags.push('zero_impact');
    }
    return flags;
  }
}
