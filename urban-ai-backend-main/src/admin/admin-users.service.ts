import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Address } from '../entities/addresses.entity';
import { Payment } from '../entities/payment.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { AuthService } from '../auth/auth.service';

/**
 * AdminUsersService — gestão de usuários no painel admin (listagem, detalhe,
 * imóveis, assinatura, papel e ativação). Não expõe password nem tokens.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(AnalisePreco)
    private readonly analiseRepo: Repository<AnalisePreco>,
    private readonly authService: AuthService,
  ) {}

  /**
   * Lista paginada de usuários para o painel admin.
   * Não expõe campo password.
   */
  async listUsers(page = 1, limit = 20) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const [data, total] = await this.userRepo.findAndCount({
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'username',
        'email',
        'role',
        'ativo',
        'createdAt',
        'phone',
        'company',
        'pricingStrategy',
        'operationMode',
        'airbnbHostId',
      ],
    });
    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: [
        'id',
        'username',
        'email',
        'role',
        'ativo',
        'createdAt',
        'phone',
        'company',
        'pricingStrategy',
        'operationMode',
        'airbnbHostId',
        'onboardingDripLastDay',
        'onboardingDripLastSentAt',
      ],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async getUserProperties(userId: string) {
    await this.getUserDetail(userId);
    const addresses = await this.addressRepo.find({
      where: [{ ativo: true, user: { id: userId } } as any, { ativo: true, list: { user: { id: userId } } } as any],
      relations: ['list', 'user', 'list.user'],
      take: 1000,
    });

    const byId = new Map<string, Address>();
    for (const address of addresses) {
      if (address?.id && address.list?.id) byId.set(address.id, address);
    }

    const rows = Array.from(byId.values()).map((address) => this.toAdminUserPropertyRow(address));
    const aggregates = await this.loadAdminPropertyAggregates(rows.map((row) => row.id));
    const items = rows.map((row) => ({
      ...row,
      ...(aggregates.get(row.id) ?? {
        lastAnalysisAt: null,
        futureRecommendationsCount: 0,
        appliedRecommendationsCount: 0,
      }),
    }));

    return {
      generatedAt: new Date().toISOString(),
      total: items.length,
      items,
    };
  }

  async getUserSubscription(userId: string) {
    await this.getUserDetail(userId);
    const payment = await this.paymentRepo
      .createQueryBuilder('payment')
      .leftJoin('payment.user', 'user')
      .where('user.id = :userId', { userId })
      .orderBy("CASE WHEN payment.status IN ('active', 'trialing') THEN 0 ELSE 1 END", 'ASC')
      .addOrderBy('payment.updatedAt', 'DESC')
      .getOne();

    if (!payment) return null;

    const ativos = await this.addressRepo.count({
      where: [{ ativo: true, user: { id: userId } } as any, { ativo: true, list: { user: { id: userId } } } as any],
    });

    return {
      id: payment.id,
      planName: payment.planName ?? null,
      billingCycle: payment.billingCycle ?? payment.mode ?? null,
      status: payment.status,
      contratados: payment.listingsContratados ?? null,
      ativos,
      nextBillingDate: this.toIso(payment.expireDate),
      startDate: this.toIso(payment.startDate),
      customerId: payment.customerId ?? null,
      subscriptionId: payment.subscriptionId ?? null,
      updatedAt: this.toIso(payment.updatedAt),
    };
  }

  private toAdminUserPropertyRow(address: Address) {
    const list = address.list;
    const owner = address.user ?? list?.user;
    return {
      id: address.id,
      addressId: address.id,
      listId: list?.id ?? null,
      propertyName: list?.titulo ?? '(sem nome)',
      userId: owner?.id ?? null,
      userEmail: owner?.email ?? null,
      city: address.cidade ?? null,
      state: address.estado ?? null,
      latitude: this.toNumberOrNull(address.latitude),
      longitude: this.toNumberOrNull(address.longitude),
      manualDailyPrice: this.toNumberOrNull(list?.manualDailyPrice ?? list?.dailyPrice),
      averageMonthlyRevenue: this.toNumberOrNull(list?.averageMonthlyRevenue),
      active: Boolean(address.ativo && (list?.ativo ?? true)),
    };
  }

  private async loadAdminPropertyAggregates(addressIds: string[]) {
    const aggregates = new Map<
      string,
      {
        addressId: string;
        lastAnalysisAt: string | null;
        futureRecommendationsCount: number;
        appliedRecommendationsCount: number;
      }
    >();
    if (addressIds.length === 0) return aggregates;

    const rows = await this.analiseRepo
      .createQueryBuilder('analysis')
      .innerJoin('analysis.endereco', 'endereco')
      .leftJoin('analysis.evento', 'evento')
      .select('endereco.id', 'addressId')
      .addSelect('MAX(analysis.criadoEm)', 'lastAnalysisAt')
      .addSelect('SUM(CASE WHEN evento.dataInicio >= :now THEN 1 ELSE 0 END)', 'futureRecommendationsCount')
      .addSelect('SUM(CASE WHEN analysis.precoAplicado IS NOT NULL THEN 1 ELSE 0 END)', 'appliedRecommendationsCount')
      .where('endereco.id IN (:...addressIds)', { addressIds })
      .setParameter('now', new Date())
      .groupBy('endereco.id')
      .getRawMany();

    for (const row of rows) {
      aggregates.set(row.addressId, {
        addressId: row.addressId,
        lastAnalysisAt: this.toIso(row.lastAnalysisAt),
        futureRecommendationsCount: Number(row.futureRecommendationsCount ?? 0),
        appliedRecommendationsCount: Number(row.appliedRecommendationsCount ?? 0),
      });
    }

    return aggregates;
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toIso(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  async setUserRole(userId: string, role: 'host' | 'admin' | 'support', actorUserId?: string | null): Promise<User> {
    if (!['host', 'admin', 'support'].includes(role)) {
      throw new BadRequestException('role inválido');
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (actorUserId && actorUserId === userId && role !== 'admin') {
      throw new ForbiddenException('Você não pode remover seu próprio acesso admin.');
    }
    if (user.role === 'admin' && role !== 'admin') {
      const activeAdmins = await this.userRepo.count({
        where: { role: 'admin', ativo: true },
      });
      if (activeAdmins <= 1 && user.ativo) {
        throw new ForbiddenException('Não é possível remover o último admin ativo.');
      }
    }
    user.role = role;
    return this.userRepo.save(user);
  }

  async setUserActive(userId: string, ativo: boolean, actorUserId?: string | null): Promise<User> {
    if (typeof ativo !== 'boolean') {
      throw new BadRequestException('ativo deve ser booleano');
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (actorUserId && actorUserId === userId && ativo === false) {
      throw new ForbiddenException('Você não pode desativar seu próprio usuário.');
    }
    if (user.role === 'admin' && ativo === false) {
      const activeAdmins = await this.userRepo.count({
        where: { role: 'admin', ativo: true },
      });
      if (activeAdmins <= 1 && user.ativo) {
        throw new ForbiddenException('Não é possível desativar o último admin ativo.');
      }
    }
    user.ativo = ativo;
    const saved = await this.userRepo.save(user);
    if (ativo === false) {
      await this.authService.revokeAllRefreshTokensForUser(user.id);
    }
    return saved;
  }
}
