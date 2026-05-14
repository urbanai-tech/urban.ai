import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThanOrEqual, Repository } from 'typeorm';
import { AnalisePreco } from '../entities/AnalisePreco';
import { Address } from '../entities/addresses.entity';
import { Payment } from '../entities/payment.entity';
import { Plan } from '../entities/plan.entity';
import { User } from '../entities/user.entity';

type Confidence = 'high' | 'medium' | 'low';

type RoiAnalise = {
  id: string;
  propertyId: string | null;
  propertyName: string;
  currentPriceCents: number;
  suggestedPriceCents: number;
  appliedPriceCents: number | null;
  deltaCents: number;
  nights: number;
  status: string;
  reservationStatus: string | null;
  confirmedIncrementalCents: number;
  projectedIncrementalCents: number;
  potentialLostCents: number;
  createdAt: Date;
};

export type RoiSummary = {
  windowDays: number;
  generatedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  subscription: {
    monthlyCostCents: number;
    activePayments: number;
  };
  money: {
    confirmedIncrementalCents: number;
    projectedIncrementalCents: number;
    totalAttributedCents: number;
    potentialLostCents: number;
    netValueCents: number;
    roiPercent: number | null;
    roiMultiple: number | null;
  };
  activity: {
    recommendations: number;
    accepted: number;
    applied: number;
    booked: number;
    rejected: number;
    impactedNights: number;
    acceptanceRatePercent: number;
    applicationRatePercent: number;
  };
  dataQuality: {
    confidence: Confidence;
    label: string;
    explanation: string;
  };
  perProperty: Array<{
    propertyId: string | null;
    propertyName: string;
    recommendations: number;
    accepted: number;
    applied: number;
    booked: number;
    impactedNights: number;
    confirmedIncrementalCents: number;
    projectedIncrementalCents: number;
    totalAttributedCents: number;
    potentialLostCents: number;
  }>;
  recentWins: Array<{
    id: string;
    propertyName: string;
    currentPriceCents: number;
    appliedPriceCents: number;
    deltaCents: number;
    nights: number;
    incrementalCents: number;
    status: string;
    createdAt: Date;
  }>;
};

export type AdminRoiOverview = {
  windowDays: number;
  generatedAt: string;
  totals: {
    users: number;
    usersWithPositiveRoi: number;
    activePayments: number;
    confirmedIncrementalCents: number;
    projectedIncrementalCents: number;
    totalAttributedCents: number;
    subscriptionCostCents: number;
    netValueCents: number;
    roiPercent: number | null;
    roiMultiple: number | null;
    potentialLostCents: number;
    impactedNights: number;
  };
  leaderboard: Array<RoiSummary & { activeListings: number }>;
};

@Injectable()
export class RoiService {
  constructor(
    @InjectRepository(AnalisePreco) private readonly analiseRepo: Repository<AnalisePreco>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
  ) {}

  async getUserRoi(userId: string, input?: { windowDays?: number; propertyId?: string }) {
    const windowDays = this.safeWindowDays(input?.windowDays);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('Usuario nao encontrado');
    }

    const [analises, payments, plans] = await Promise.all([
      this.findAnalisesForUser(userId, windowDays, input?.propertyId),
      this.paymentRepo.find({
        where: {
          user: { id: userId },
          status: In(['active', 'trialing']),
        },
        relations: ['user'],
      }),
      this.planRepo.find(),
    ]);

    const monthlyCostCents = this.monthlySubscriptionCostCents(payments, plans);
    return this.buildSummary(user, analises, monthlyCostCents, payments.length, windowDays);
  }

  async getAdminRoi(input?: { windowDays?: number; limit?: number }): Promise<AdminRoiOverview> {
    const windowDays = this.safeWindowDays(input?.windowDays);
    const limit = Math.max(1, Math.min(100, Number(input?.limit) || 25));
    const cutoff = this.cutoffDate(windowDays);

    const [analises, payments, plans, activeListingsRows] = await Promise.all([
      this.analiseRepo.find({
        where: { criadoEm: MoreThanOrEqual(cutoff) },
        relations: ['usuarioProprietario', 'endereco', 'endereco.list'],
        order: { criadoEm: 'DESC' },
      }),
      this.paymentRepo.find({
        where: { status: In(['active', 'trialing']) },
        relations: ['user'],
      }),
      this.planRepo.find(),
      this.addressRepo
        .createQueryBuilder('a')
        .innerJoin('a.user', 'u')
        .select('u.id', 'userId')
        .addSelect('COUNT(*)', 'count')
        .where('a.ativo = true')
        .groupBy('u.id')
        .getRawMany(),
    ]);

    const activeListingsByUser = new Map<string, number>();
    activeListingsRows.forEach((row: any) => {
      activeListingsByUser.set(String(row.userId), Number(row.count ?? 0));
    });

    const paymentsByUser = new Map<string, Payment[]>();
    payments.forEach((payment) => {
      const userId = payment.user?.id;
      if (!userId) return;
      paymentsByUser.set(userId, [...(paymentsByUser.get(userId) ?? []), payment]);
    });

    const analisesByUser = new Map<string, AnalisePreco[]>();
    analises.forEach((analise) => {
      const userId = analise.usuarioProprietario?.id;
      if (!userId) return;
      analisesByUser.set(userId, [...(analisesByUser.get(userId) ?? []), analise]);
    });

    const usersById = new Map<string, User>();
    analises.forEach((analise) => {
      if (analise.usuarioProprietario) usersById.set(analise.usuarioProprietario.id, analise.usuarioProprietario);
    });
    payments.forEach((payment) => {
      if (payment.user) usersById.set(payment.user.id, payment.user);
    });

    const summaries = Array.from(usersById.values())
      .map((user) => {
        const userPayments = paymentsByUser.get(user.id) ?? [];
        const monthlyCostCents = this.monthlySubscriptionCostCents(userPayments, plans);
        return {
          ...this.buildSummary(
            user,
            analisesByUser.get(user.id) ?? [],
            monthlyCostCents,
            userPayments.length,
            windowDays,
          ),
          activeListings: activeListingsByUser.get(user.id) ?? 0,
        };
      })
      .sort((a, b) => b.money.totalAttributedCents - a.money.totalAttributedCents);

    const totals = summaries.reduce(
      (acc, item) => {
        acc.confirmedIncrementalCents += item.money.confirmedIncrementalCents;
        acc.projectedIncrementalCents += item.money.projectedIncrementalCents;
        acc.totalAttributedCents += item.money.totalAttributedCents;
        acc.subscriptionCostCents += item.subscription.monthlyCostCents;
        acc.netValueCents += item.money.netValueCents;
        acc.potentialLostCents += item.money.potentialLostCents;
        acc.impactedNights += item.activity.impactedNights;
        acc.activePayments += item.subscription.activePayments;
        if ((item.money.roiMultiple ?? 0) >= 1) acc.usersWithPositiveRoi += 1;
        return acc;
      },
      {
        users: summaries.length,
        usersWithPositiveRoi: 0,
        activePayments: 0,
        confirmedIncrementalCents: 0,
        projectedIncrementalCents: 0,
        totalAttributedCents: 0,
        subscriptionCostCents: 0,
        netValueCents: 0,
        roiPercent: null as number | null,
        roiMultiple: null as number | null,
        potentialLostCents: 0,
        impactedNights: 0,
      },
    );

    totals.roiMultiple =
      totals.subscriptionCostCents > 0
        ? this.round2(totals.totalAttributedCents / totals.subscriptionCostCents)
        : null;
    totals.roiPercent =
      totals.subscriptionCostCents > 0
        ? this.round2((totals.netValueCents / totals.subscriptionCostCents) * 100)
        : null;

    return {
      windowDays,
      generatedAt: new Date().toISOString(),
      totals,
      leaderboard: summaries.slice(0, limit),
    };
  }

  private async findAnalisesForUser(userId: string, windowDays: number, propertyId?: string) {
    const where: any = {
      usuarioProprietario: { id: userId },
      criadoEm: Between(this.cutoffDate(windowDays), new Date()),
    };
    if (propertyId) {
      where.endereco = { id: propertyId };
    }
    return this.analiseRepo.find({
      where,
      relations: ['usuarioProprietario', 'endereco', 'endereco.list'],
      order: { criadoEm: 'DESC' },
    });
  }

  private buildSummary(
    user: User,
    analises: AnalisePreco[],
    monthlyCostCents: number,
    activePayments: number,
    windowDays: number,
  ): RoiSummary {
    const normalized = analises.map((analise) => this.normalizeAnalise(analise));

    const confirmedIncrementalCents = normalized.reduce(
      (sum, item) => sum + item.confirmedIncrementalCents,
      0,
    );
    const projectedIncrementalCents = normalized.reduce(
      (sum, item) => sum + item.projectedIncrementalCents,
      0,
    );
    const potentialLostCents = normalized.reduce((sum, item) => sum + item.potentialLostCents, 0);
    const totalAttributedCents = confirmedIncrementalCents + projectedIncrementalCents;
    const netValueCents = totalAttributedCents - monthlyCostCents;

    const accepted = normalized.filter((item) => ['accepted', 'applied_manual', 'applied_stays'].includes(item.status) || item.appliedPriceCents != null).length;
    const applied = normalized.filter((item) => item.appliedPriceCents != null || ['applied_manual', 'applied_stays'].includes(item.status)).length;
    const booked = normalized.filter((item) => item.reservationStatus === 'booked').length;
    const rejected = normalized.filter((item) => item.status === 'rejected').length;
    const impactedNights = normalized.reduce(
      (sum, item) =>
        sum +
        (item.confirmedIncrementalCents > 0 || item.projectedIncrementalCents > 0
          ? item.nights
          : 0),
      0,
    );

    const perProperty = this.buildPerProperty(normalized);
    const recentWins = normalized
      .filter((item) => item.confirmedIncrementalCents > 0 || item.projectedIncrementalCents > 0)
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        propertyName: item.propertyName,
        currentPriceCents: item.currentPriceCents,
        appliedPriceCents: item.appliedPriceCents ?? item.suggestedPriceCents,
        deltaCents: item.deltaCents,
        nights: item.nights,
        incrementalCents: item.confirmedIncrementalCents + item.projectedIncrementalCents,
        status: item.status,
        createdAt: item.createdAt,
      }));

    return {
      windowDays,
      generatedAt: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      subscription: {
        monthlyCostCents,
        activePayments,
      },
      money: {
        confirmedIncrementalCents,
        projectedIncrementalCents,
        totalAttributedCents,
        potentialLostCents,
        netValueCents,
        roiPercent:
          monthlyCostCents > 0 ? this.round2((netValueCents / monthlyCostCents) * 100) : null,
        roiMultiple:
          monthlyCostCents > 0 ? this.round2(totalAttributedCents / monthlyCostCents) : null,
      },
      activity: {
        recommendations: normalized.length,
        accepted,
        applied,
        booked,
        rejected,
        impactedNights,
        acceptanceRatePercent:
          normalized.length > 0 ? this.round2((accepted / normalized.length) * 100) : 0,
        applicationRatePercent: accepted > 0 ? this.round2((applied / accepted) * 100) : 0,
      },
      dataQuality: this.dataQuality(booked, applied, normalized.length),
      perProperty,
      recentWins,
    };
  }

  private normalizeAnalise(analise: AnalisePreco): RoiAnalise {
    const currentPriceCents = this.moneyToCents(analise.seuPrecoAtual);
    const suggestedPriceCents = this.moneyToCents(analise.precoSugerido);
    const appliedPriceCents =
      analise.precoAplicado != null
        ? this.moneyToCents(analise.precoAplicado)
        : analise.aceito || ['accepted', 'applied_manual', 'applied_stays'].includes(analise.status)
          ? suggestedPriceCents
          : null;
    const deltaCents = Math.max(0, (appliedPriceCents ?? suggestedPriceCents) - currentPriceCents);
    const nights = Math.max(1, Number(analise.noitesReservadas ?? 1) || 1);
    const isBooked = analise.reservaStatus === 'booked' || Number(analise.receitaReal ?? 0) > 0;
    const isApplied =
      appliedPriceCents != null || ['applied_manual', 'applied_stays'].includes(analise.status);
    const isAccepted = analise.aceito || ['accepted', 'applied_manual', 'applied_stays'].includes(analise.status);
    const positiveSuggestedDelta = Math.max(0, suggestedPriceCents - currentPriceCents);

    return {
      id: analise.id,
      propertyId: analise.endereco?.id ?? null,
      propertyName: this.propertyName(analise),
      currentPriceCents,
      suggestedPriceCents,
      appliedPriceCents,
      deltaCents,
      nights,
      status: analise.status,
      reservationStatus: analise.reservaStatus,
      confirmedIncrementalCents: isBooked && isApplied ? deltaCents * nights : 0,
      projectedIncrementalCents: !isBooked && isApplied ? deltaCents * nights : 0,
      potentialLostCents: !isAccepted ? positiveSuggestedDelta : 0,
      createdAt: analise.criadoEm,
    };
  }

  private buildPerProperty(items: RoiAnalise[]): RoiSummary['perProperty'] {
    const map = new Map<string, RoiSummary['perProperty'][number]>();
    items.forEach((item) => {
      const key = item.propertyId ?? item.propertyName;
      const current = map.get(key) ?? {
        propertyId: item.propertyId,
        propertyName: item.propertyName,
        recommendations: 0,
        accepted: 0,
        applied: 0,
        booked: 0,
        impactedNights: 0,
        confirmedIncrementalCents: 0,
        projectedIncrementalCents: 0,
        totalAttributedCents: 0,
        potentialLostCents: 0,
      };
      current.recommendations += 1;
      if (['accepted', 'applied_manual', 'applied_stays'].includes(item.status) || item.appliedPriceCents != null) current.accepted += 1;
      if (item.appliedPriceCents != null || ['applied_manual', 'applied_stays'].includes(item.status)) current.applied += 1;
      if (item.reservationStatus === 'booked') current.booked += 1;
      if (item.confirmedIncrementalCents > 0 || item.projectedIncrementalCents > 0) {
        current.impactedNights += item.nights;
      }
      current.confirmedIncrementalCents += item.confirmedIncrementalCents;
      current.projectedIncrementalCents += item.projectedIncrementalCents;
      current.totalAttributedCents += item.confirmedIncrementalCents + item.projectedIncrementalCents;
      current.potentialLostCents += item.potentialLostCents;
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => b.totalAttributedCents - a.totalAttributedCents);
  }

  private dataQuality(booked: number, applied: number, recommendations: number) {
    if (booked > 0) {
      return {
        confidence: 'high' as Confidence,
        label: 'Alta confianca',
        explanation: 'Ha reservas ou receita real vinculada a recomendacoes aplicadas.',
      };
    }
    if (applied > 0) {
      return {
        confidence: 'medium' as Confidence,
        label: 'Estimativa acompanhada',
        explanation: 'Ha precos aplicados, mas ainda falta confirmar reserva/receita real.',
      };
    }
    return {
      confidence: 'low' as Confidence,
      label: recommendations > 0 ? 'Potencial mapeado' : 'Sem dados suficientes',
      explanation:
        recommendations > 0
          ? 'Existem recomendacoes, mas ainda faltam aplicacoes confirmadas.'
          : 'Cadastre imoveis e aplique recomendacoes para medir ROI.',
    };
  }

  private monthlySubscriptionCostCents(payments: Payment[], plans: Plan[]) {
    const plansByName = new Map(plans.map((plan) => [plan.name, plan]));
    return payments.reduce((sum, payment) => {
      const plan = plansByName.get(payment.planName ?? '') ?? plansByName.get('profissional');
      if (!plan) return sum;
      const cycle = String(payment.billingCycle ?? payment.mode ?? 'monthly').toLowerCase();
      const raw =
        cycle === 'annual' || cycle === 'year'
          ? plan.priceAnnualNew ?? plan.priceAnnual ?? plan.price ?? '0'
          : cycle === 'quarterly'
            ? plan.priceQuarterly ?? plan.priceMonthly ?? plan.price ?? '0'
            : cycle === 'semestral'
              ? plan.priceSemestral ?? plan.priceMonthly ?? plan.price ?? '0'
              : plan.priceMonthly ?? plan.price ?? '0';
      return sum + this.moneyToCents(raw) * Math.max(1, payment.listingsContratados ?? 1);
    }, 0);
  }

  private moneyToCents(value: unknown) {
    if (value == null) return 0;
    if (typeof value === 'number') return Math.round(value * 100);
    const normalized = String(value)
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }

  private propertyName(analise: AnalisePreco) {
    const address = analise.endereco;
    const title = address?.list?.titulo;
    if (title) return title;
    const parts = [address?.logradouro, address?.numero, address?.bairro, address?.cidade].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Imovel monitorado';
  }

  private cutoffDate(windowDays: number) {
    return new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  }

  private safeWindowDays(input?: number) {
    return Math.max(7, Math.min(365, Number(input) || 30));
  }

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }
}
