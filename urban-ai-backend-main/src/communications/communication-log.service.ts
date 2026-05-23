import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CommunicationChannel,
  CommunicationEvent,
  CommunicationStatus,
} from '../entities/communication-event.entity';

type RecordCommunicationInput = {
  userId?: string | null;
  channel: CommunicationChannel;
  status: CommunicationStatus;
  kind?: string | null;
  templateName?: string | null;
  recipientEmail?: string | null;
  recipientDeviceId?: string | null;
  subject?: string | null;
  title?: string | null;
  provider?: string | null;
  providerMessageId?: string | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown> | null;
  correlationId?: string | null;
};

@Injectable()
export class CommunicationLogService {
  private readonly logger = new Logger(CommunicationLogService.name);

  constructor(
    @InjectRepository(CommunicationEvent)
    private readonly repo: Repository<CommunicationEvent>,
  ) {}

  async record(input: RecordCommunicationInput): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          userId: input.userId ?? null,
          channel: input.channel,
          status: input.status,
          kind: this.truncate(input.kind, 96),
          templateName: this.truncate(input.templateName, 120),
          recipientEmail: this.truncate(input.recipientEmail, 254),
          recipientDeviceId: this.truncate(input.recipientDeviceId, 64),
          subject: this.truncate(input.subject, 220),
          title: this.truncate(input.title, 220),
          provider: this.truncate(input.provider, 64),
          providerMessageId: this.truncate(input.providerMessageId, 160),
          failureReason: input.failureReason?.slice(0, 2000) ?? null,
          metadataJson: input.metadata ? this.safeJson(input.metadata) : null,
          correlationId: this.truncate(input.correlationId, 120),
        }),
      );
    } catch (error) {
      this.logger.warn(
        `communication log skipped: ${(error as Error)?.message ?? String(error)}`,
      );
    }
  }

  async list(input: {
    page?: number;
    limit?: number;
    channel?: CommunicationChannel | 'all';
    status?: CommunicationStatus | 'all';
    kind?: string;
    search?: string;
  }) {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.limit ?? 30));
    const qb = this.repo
      .createQueryBuilder('event')
      .orderBy('event.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (input.channel && input.channel !== 'all') {
      qb.andWhere('event.channel = :channel', { channel: input.channel });
    }
    if (input.status && input.status !== 'all') {
      qb.andWhere('event.status = :status', { status: input.status });
    }
    if (input.kind?.trim()) {
      qb.andWhere('event.kind = :kind', { kind: input.kind.trim() });
    }
    if (input.search?.trim()) {
      const like = `%${input.search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(COALESCE(event.recipientEmail, '')) LIKE :like
          OR LOWER(COALESCE(event.subject, '')) LIKE :like
          OR LOWER(COALESCE(event.title, '')) LIKE :like
          OR LOWER(COALESCE(event.kind, '')) LIKE :like
          OR LOWER(COALESCE(event.failureReason, '')) LIKE :like)`,
        { like },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    const [byChannel, byStatus] = await Promise.all([
      this.groupedCount('channel'),
      this.groupedCount('status'),
    ]);

    return {
      page,
      limit,
      total,
      byChannel,
      byStatus,
      items: items.map((item) => this.toPublicEvent(item)),
    };
  }

  async summary() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await this.repo
      .createQueryBuilder('event')
      .select('event.channel', 'channel')
      .addSelect('event.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('event.createdAt >= :since', { since })
      .groupBy('event.channel')
      .addGroupBy('event.status')
      .getRawMany();

    const recentFailures = await this.repo.find({
      where: { status: 'failed' },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      windowHours: 24,
      totals: rows.map((row) => ({
        channel: row.channel as CommunicationChannel,
        status: row.status as CommunicationStatus,
        count: Number(row.count ?? 0),
      })),
      recentFailures: recentFailures.map((item) => this.toPublicEvent(item)),
    };
  }

  private async groupedCount(field: 'channel' | 'status') {
    const rows = await this.repo
      .createQueryBuilder('event')
      .select(`event.${field}`, field)
      .addSelect('COUNT(*)', 'count')
      .groupBy(`event.${field}`)
      .getRawMany();
    return rows.map((row) => ({
      [field]: row[field],
      count: Number(row.count ?? 0),
    }));
  }

  private truncate(value: string | null | undefined, max: number): string | null {
    if (!value) return null;
    return String(value).slice(0, max);
  }

  private safeJson(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return JSON.stringify({ unserializable: true });
    }
  }

  private safeParse(value?: string | null): Record<string, unknown> | null {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private toPublicEvent(item: CommunicationEvent) {
    return {
      ...item,
      recipientEmail: this.maskEmail(item.recipientEmail),
      recipientDeviceId: this.maskToken(item.recipientDeviceId),
      providerMessageId: this.maskToken(item.providerMessageId),
      failureReason: this.redactSensitiveText(item.failureReason),
      metadataJson: null,
      metadata: this.sanitizeMetadata(this.safeParse(item.metadataJson)),
    };
  }

  private maskEmail(value?: string | null): string | null {
    if (!value || !value.includes('@')) return value ?? null;
    const [local, domain] = value.split('@');
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
  }

  private maskToken(value?: string | null): string | null {
    if (!value) return null;
    if (value.length <= 8) return `${value.slice(0, 2)}***`;
    return `${value.slice(0, 6)}***${value.slice(-4)}`;
  }

  private redactSensitiveText(value?: string | null): string | null {
    if (!value) return null;
    return String(value)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
      .replace(/(api[-_ ]?key|token|secret|password)=([^&\s]+)/gi, '$1=[redacted]')
      .slice(0, 2000);
  }

  private sanitizeMetadata(value: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!value) return null;
    const safe: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
      if (/(email|recipient|device|token|secret|password|authorization|apiKey|api_key)/i.test(key)) {
        safe[key] = '[redacted]';
      } else if (typeof raw === 'string') {
        safe[key] = this.redactSensitiveText(raw);
      } else {
        safe[key] = raw;
      }
    }
    return safe;
  }
}
