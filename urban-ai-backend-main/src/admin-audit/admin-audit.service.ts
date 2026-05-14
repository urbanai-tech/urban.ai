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

  private safeJson(value: unknown): unknown {
    if (value == null) return null;
    return JSON.parse(JSON.stringify(value));
  }
}
