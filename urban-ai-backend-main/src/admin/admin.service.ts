import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Address } from '../entities/addresses.entity';
import { List } from '../entities/list.entity';
import { Event as EventEntity } from '../entities/events.entity';
import { Payment } from '../entities/payment.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import { OccupancyHistory } from '../entities/occupancy-history.entity';
import { AdaptivePricingStrategy } from '../knn-engine/strategies/adaptive-pricing.strategy';
import { DatasetCollectorService } from '../knn-engine/dataset-collector.service';

/**
 * AdminService — agrega métricas de gestão Urban AI para o painel admin.
 *
 * Não expõe PII sensível (senha, token), apenas contagens, status e
 * indicadores. Usado pelos endpoints `/admin/*` que exigem `role='admin'`
 * via RolesGuard.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(List) private readonly listRepo: Repository<List>,
    @InjectRepository(EventEntity) private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(AnalisePreco) private readonly analiseRepo: Repository<AnalisePreco>,
    @InjectRepository(PriceSnapshot) private readonly snapshotRepo: Repository<PriceSnapshot>,
    @InjectRepository(OccupancyHistory) private readonly occupancyRepo: Repository<OccupancyHistory>,
    private readonly adaptiveStrategy: AdaptivePricingStrategy,
    private readonly collector: DatasetCollectorService,
  ) {}

  /**
   * Visão geral do painel admin: contagens essenciais + estado da IA.
   * Roda em < 200ms mesmo com dataset grande (queries todas indexadas).
   */
  async overview() {
    const [
      totalUsers,
      activeUsers,
      adminUsers,
      totalProperties,
      totalEvents,
      eventsLast7d,
      totalAnalyses,
      analysesAccepted,
      activePayments,
      datasetSize,
      currentTier,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { ativo: true } }),
      this.userRepo.count({ where: { role: 'admin' } }),
      this.listRepo.count(),
      this.eventRepo.count(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio >= :cutoff', { cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) })
        .getCount(),
      this.analiseRepo.count(),
      this.analiseRepo.count({ where: { aceito: true } }),
      this.paymentRepo
        .createQueryBuilder('p')
        .where('p.status IN (:...statuses)', { statuses: ['active', 'trialing'] })
        .getCount(),
      this.collector.datasetSize(),
      this.adaptiveStrategy.describeCurrentTier(),
    ]);

    const acceptanceRate =
      totalAnalyses > 0 ? Math.round((analysesAccepted / totalAnalyses) * 1000) / 10 : 0;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        admins: adminUsers,
      },
      product: {
        propertiesRegistered: totalProperties,
        eventsTotal: totalEvents,
        eventsLast7d,
        analysesTotal: totalAnalyses,
        analysesAccepted,
        acceptanceRatePercent: acceptanceRate,
      },
      revenue: {
        activeSubscriptions: activePayments,
      },
      ai: {
        currentTier: currentTier.tier,
        currentStrategy: currentTier.strategy.name,
        reason: currentTier.reason,
        dataset: {
          totalSnapshots: datasetSize.total,
          distinctListings: datasetSize.distinctListings,
          distinctDays: datasetSize.distinctDays,
          trainingReady: datasetSize.trainingReady,
        },
      },
    };
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
      this.snapshotRepo
        .createQueryBuilder('s')
        .select('COUNT(DISTINCT s.snapshotDate)', 'days')
        .getRawOne(),
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
      byOrigin: byOrigin.map((r: any) => ({ origin: r.origin, count: Number(r.count) })),
      daysCovered: Number(daysCovered?.days ?? 0),
      topListings: topListings.map((r: any) => ({
        listingId: r.listingId,
        snapshots: Number(r.snapshots),
      })),
    };
  }

  /**
   * Lista paginada de usuários para o painel admin.
   * Não expõe campo password.
   */
  async listUsers(page = 1, limit = 20) {
    const [data, total] = await this.userRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      select: [
        'id', 'username', 'email', 'role', 'ativo', 'createdAt',
        'phone', 'company', 'pricingStrategy', 'operationMode', 'airbnbHostId',
      ],
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async setUserRole(userId: string, role: 'host' | 'admin' | 'support'): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('Usuário não encontrado');
    user.role = role;
    return this.userRepo.save(user);
  }

  async setUserActive(userId: string, ativo: boolean): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('Usuário não encontrado');
    user.ativo = ativo;
    return this.userRepo.save(user);
  }
}
