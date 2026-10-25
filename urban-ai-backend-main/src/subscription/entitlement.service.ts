import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import {
  EntitlementDecision,
  PaymentLike,
  evaluateEntitlement,
  resolveAlphaQuota,
  resolveGraceDays,
} from './entitlement';

/** Só decisões POSITIVAS são cacheadas: quem acabou de pagar libera na hora. */
const POSITIVE_CACHE_TTL_MS = 30_000;

/**
 * Fonte única de "este usuário pode usar o produto pago?". Usada pelo
 * SubscriptionGuard (HTTP), pelos crons (batch) e pelo reconciliador de cota.
 */
@Injectable()
export class EntitlementService {
  private readonly positiveCache = new Map<string, { decision: EntitlementDecision; expiresAt: number }>();

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Payment) private readonly paymentRepository: Repository<Payment>,
  ) {}

  invalidate(userId?: string): void {
    if (userId) this.positiveCache.delete(userId);
    else this.positiveCache.clear();
  }

  async getEntitlement(
    userId: string,
    opts: { fresh?: boolean; now?: Date } = {},
  ): Promise<EntitlementDecision> {
    const now = opts.now ?? new Date();
    if (!opts.fresh) {
      const cached = this.positiveCache.get(userId);
      if (cached && cached.expiresAt > now.getTime()) return cached.decision;
    }

    const [user, payments] = await Promise.all([
      this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'email', 'role', 'ativo'],
      }),
      this.paymentRepository.find({ where: { user: { id: userId } } }),
    ]);

    const decision = this.decide(user, payments ?? [], now);
    if (decision.entitled) {
      this.positiveCache.set(userId, { decision, expiresAt: now.getTime() + POSITIVE_CACHE_TTL_MS });
    } else {
      this.positiveCache.delete(userId);
    }
    return decision;
  }

  async isEntitled(userId: string, opts: { fresh?: boolean; now?: Date } = {}): Promise<boolean> {
    if (!userId) return false;
    return (await this.getEntitlement(userId, opts)).entitled;
  }

  /**
   * Versão em lote para crons: 2 queries para N usuários (sem cache), devolve o
   * subconjunto com direito de uso. Ids desconhecidos ficam de fora.
   */
  async filterEntitledUserIds(userIds: string[], opts: { now?: Date } = {}): Promise<Set<string>> {
    const decisions = await this.getEntitlements(userIds, opts);
    const entitled = new Set<string>();
    for (const [id, decision] of decisions) {
      if (decision.entitled) entitled.add(id);
    }
    return entitled;
  }

  async getEntitlements(
    userIds: string[],
    opts: { now?: Date } = {},
  ): Promise<Map<string, EntitlementDecision>> {
    const ids = [...new Set((userIds ?? []).filter(Boolean))];
    const result = new Map<string, EntitlementDecision>();
    if (ids.length === 0) return result;

    const now = opts.now ?? new Date();
    const [users, payments] = await Promise.all([
      this.userRepository.find({ where: { id: In(ids) }, select: ['id', 'email', 'role', 'ativo'] }),
      this.paymentRepository.find({ where: { user: { id: In(ids) } }, relations: ['user'] }),
    ]);

    const paymentsByUser = new Map<string, PaymentLike[]>();
    for (const payment of payments ?? []) {
      const owner = payment.user?.id;
      if (!owner) continue;
      const list = paymentsByUser.get(owner) ?? [];
      list.push(payment);
      paymentsByUser.set(owner, list);
    }

    for (const user of users ?? []) {
      result.set(user.id, this.decide(user, paymentsByUser.get(user.id) ?? [], now));
    }
    return result;
  }

  private decide(user: User | null | undefined, payments: PaymentLike[], now: Date): EntitlementDecision {
    if (!user) {
      return {
        entitled: false,
        reason: 'user_inactive',
        source: 'none',
        quota: 0,
        hasBillingHistory: payments.length > 0,
      };
    }
    return evaluateEntitlement({
      role: user.role,
      ativo: user.ativo,
      alphaQuota: resolveAlphaQuota(process.env.ALPHA_USER_QUOTAS, user.id, user.email),
      payments,
      now,
      graceDays: resolveGraceDays(),
    });
  }
}
