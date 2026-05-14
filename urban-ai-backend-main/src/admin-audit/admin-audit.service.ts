import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';

export type AdminAuditInput = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown | null;
  after?: unknown | null;
  metadata?: unknown | null;
};

export type AdminAuditListInput = {
  page?: number;
  limit?: number;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
};

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly repo: Repository<AdminAuditLog>,
  ) {}

  async record(input: AdminAuditInput): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          actorUserId: input.actorUserId ?? null,
          action: input.action.slice(0, 96),
          entityType: input.entityType.slice(0, 64),
          entityId: input.entityId?.slice(0, 128) ?? null,
          before: this.safeJson(input.before ?? null),
          after: this.safeJson(input.after ?? null),
          metadata: this.safeJson(input.metadata ?? null),
        }),
      );
    } catch (error: any) {
      this.logger.warn(`Falha ao registrar auditoria admin: ${error?.message ?? error}`);
    }
  }

  async list(input: AdminAuditListInput = {}) {
    const page = Math.max(1, Number.isFinite(input.page ?? NaN) ? Number(input.page) : 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.isFinite(input.limit ?? NaN) ? Number(input.limit) : 25),
    );

    const qb = this.repo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (input.actorUserId?.trim()) {
      qb.andWhere('log.actorUserId = :actorUserId', { actorUserId: input.actorUserId.trim() });
    }
    if (input.action?.trim()) {
      qb.andWhere('log.action = :action', { action: input.action.trim() });
    }
    if (input.entityType?.trim()) {
      qb.andWhere('log.entityType = :entityType', { entityType: input.entityType.trim() });
    }
    if (input.entityId?.trim()) {
      qb.andWhere('log.entityId = :entityId', { entityId: input.entityId.trim() });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  private safeJson(value: unknown): unknown {
    if (value == null) return null;
    return JSON.parse(JSON.stringify(value));
  }
}
