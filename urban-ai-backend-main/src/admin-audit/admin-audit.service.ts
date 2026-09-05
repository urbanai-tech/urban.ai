import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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
  private static readonly WRITE_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_MS = 25;
  private static readonly SENSITIVE_KEY =
    /(authorization|cookie|password|secret|token|api[-_]?key|access[-_]?token|refresh[-_]?token)/i;

  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly repo: Repository<AdminAuditLog>,
  ) {}

  async record(input: AdminAuditInput): Promise<void> {
    const entry = this.repo.create({
      actorUserId: input.actorUserId?.slice(0, 36) ?? null,
      action: this.requiredText(input.action, 96, 'action'),
      entityType: this.requiredText(input.entityType, 64, 'entityType'),
      entityId: input.entityId?.slice(0, 128) ?? null,
      before: this.safeJson(input.before ?? null),
      after: this.safeJson(input.after ?? null),
      metadata: this.safeJson(input.metadata ?? null),
    });

    for (let attempt = 1; attempt <= AdminAuditService.WRITE_ATTEMPTS; attempt += 1) {
      try {
        await this.repo.save(entry);
        return;
      } catch (error: any) {
        if (attempt < AdminAuditService.WRITE_ATTEMPTS) {
          this.logger.warn(
            `Falha transitória ao registrar auditoria admin; retry=${attempt}/${AdminAuditService.WRITE_ATTEMPTS - 1}; code=${this.errorCode(error)}`,
          );
          await this.wait(AdminAuditService.RETRY_DELAY_MS * attempt);
          continue;
        }

        this.logger.error(
          `Auditoria admin indisponível após ${AdminAuditService.WRITE_ATTEMPTS} tentativas; action=${entry.action}; entityType=${entry.entityType}; code=${this.errorCode(error)}`,
        );
        throw new ServiceUnavailableException(
          'Não foi possível confirmar o registro da auditoria administrativa. Não repita a operação automaticamente; confirme o estado antes de tentar novamente.',
        );
      }
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
    const seen = new WeakSet<object>();
    return JSON.parse(
      JSON.stringify(value, (key, nestedValue) => {
        if (AdminAuditService.SENSITIVE_KEY.test(key)) return '[REDACTED]';
        if (typeof nestedValue === 'bigint') return nestedValue.toString();
        if (nestedValue && typeof nestedValue === 'object') {
          if (seen.has(nestedValue)) return '[Circular]';
          seen.add(nestedValue);
        }
        return nestedValue;
      }),
    );
  }

  private requiredText(value: string, maxLength: number, field: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new TypeError(`Admin audit ${field} is required`);
    }
    return normalized.slice(0, maxLength);
  }

  private errorCode(error: any): string {
    const candidate = error?.code ?? error?.name ?? 'unknown';
    return String(candidate).replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 64) || 'unknown';
  }

  private async wait(milliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
