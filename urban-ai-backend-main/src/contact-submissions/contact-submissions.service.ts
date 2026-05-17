import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContactSubmission,
  ContactSubmissionCategory,
  ContactSubmissionSeverity,
  ContactSubmissionStatus,
} from '../entities/contact-submission.entity';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
import { UpdateContactSubmissionDto } from './dto/update-contact-submission.dto';

@Injectable()
export class ContactSubmissionsService {
  constructor(
    @InjectRepository(ContactSubmission)
    private readonly repo: Repository<ContactSubmission>,
  ) {}

  async create(
    input: CreateContactSubmissionDto,
    meta: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const email = input.email?.trim().toLowerCase();
    const name = input.name?.trim();
    const subject = input.subject?.trim();
    const message = input.message?.trim();

    if (!name || !email || !subject || !message) {
      throw new BadRequestException('Campos obrigatorios ausentes');
    }

    const triage = this.classify({
      source: input.source,
      subject,
      message,
    });

    const submission = this.repo.create({
      name,
      email,
      subject,
      message,
      source: input.source?.trim().slice(0, 80) || 'public-contact',
      status: 'new',
      category: triage.category,
      severity: triage.severity,
      dueAt: triage.dueAt,
      resolvedAt: null,
      assignedOwner: null,
      notes: null,
      ipAddress: meta.ipAddress?.slice(0, 80) ?? null,
      userAgent: meta.userAgent ?? null,
    });

    return this.repo.save(submission);
  }

  async list(input: {
    page?: number;
    limit?: number;
    status?: ContactSubmissionStatus | 'all';
    search?: string;
  }) {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.limit ?? 30));

    const search = input.search?.trim().toLowerCase();

    const qb = this.repo
      .createQueryBuilder('c')
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (input.status && input.status !== 'all') {
      qb.andWhere('c.status = :status', { status: input.status });
    }

    this.applySearch(qb, search);

    const statusQb = this.repo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.status');
    this.applySearch(statusQb, search);

    const [items, total] = await qb.getManyAndCount();
    const rawStatusCounts = await statusQb.getRawMany();
    const [rawCategoryCounts, rawSeverityCounts] = await Promise.all([
      this.countGroupedBy('category', search),
      this.countGroupedBy('severity', search),
    ]);

    return {
      page,
      limit,
      total,
      byStatus: rawStatusCounts.map((row: any) => ({
        status: row.status as ContactSubmissionStatus,
        count: Number(row.count ?? 0),
      })),
      byCategory: rawCategoryCounts.map((row: any) => ({
        category: row.category as ContactSubmissionCategory,
        count: Number(row.count ?? 0),
      })),
      bySeverity: rawSeverityCounts.map((row: any) => ({
        severity: row.severity as ContactSubmissionSeverity,
        count: Number(row.count ?? 0),
      })),
      items,
    };
  }

  async update(id: string, input: UpdateContactSubmissionDto) {
    const submission = await this.repo.findOne({ where: { id } });
    if (!submission) {
      throw new NotFoundException('Contato nao encontrado');
    }

    if (input.status) {
      submission.status = input.status;
      submission.resolvedAt =
        input.status === 'resolved' || input.status === 'archived'
          ? submission.resolvedAt ?? new Date()
          : null;
    }

    if (input.category) {
      submission.category = input.category;
      submission.dueAt = this.resolveDueAt(input.category, input.severity ?? submission.severity);
    }

    if (input.severity) {
      submission.severity = input.severity;
      submission.dueAt = this.resolveDueAt(input.category ?? submission.category, input.severity);
    }

    if (Object.prototype.hasOwnProperty.call(input, 'assignedOwner')) {
      submission.assignedOwner = input.assignedOwner?.trim() || null;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'notes')) {
      submission.notes = input.notes?.trim() || null;
    }

    return this.repo.save(submission);
  }

  private applySearch(qb: any, search?: string) {
    if (!search) return;
    const like = `%${search}%`;
    qb.andWhere(
      `(LOWER(c.name) LIKE :like OR LOWER(c.email) LIKE :like OR LOWER(c.subject) LIKE :like OR LOWER(c.message) LIKE :like)`,
      { like },
    );
  }

  private async countGroupedBy(field: 'category' | 'severity', search?: string) {
    const qb = this.repo
      .createQueryBuilder('c')
      .select(`c.${field}`, field)
      .addSelect('COUNT(*)', 'count')
      .groupBy(`c.${field}`);
    this.applySearch(qb, search);
    return qb.getRawMany();
  }

  private classify(input: {
    source?: string | null;
    subject?: string | null;
    message?: string | null;
  }): {
    category: ContactSubmissionCategory;
    severity: ContactSubmissionSeverity;
    dueAt: Date;
  } {
    const text = this.normalize(`${input.source ?? ''} ${input.subject ?? ''} ${input.message ?? ''}`);
    const has = (terms: string[]) => terms.some((term) => text.includes(term));

    let category: ContactSubmissionCategory = 'support';
    if (has(['lgpd', 'privacidade', 'dados pessoais', 'exclusao', 'excluir meus dados', 'portabilidade', 'revogar consentimento'])) {
      category = 'privacy_lgpd';
    } else if (has(['stripe', 'pagamento', 'cobranca', 'checkout', 'assinatura', 'cancelamento', 'reembolso', 'fatura'])) {
      category = 'billing';
    } else if (has(['stays', 'automatico', 'integracao', 'rollback', 'push de preco'])) {
      category = 'stays';
    } else if (has(['vazamento', 'dado exposto', 'login indisponivel', 'fora do ar', 'push indevido', 'cobrou errado'])) {
      category = 'incident';
    } else if (has(['parceria', 'partner', 'stays', 'pmc', 'administradora'])) {
      category = 'partnership';
    } else if (has(['demo', 'beta', 'preco', 'precos', 'contratar', 'comercial', 'quero testar'])) {
      category = 'sales';
    }

    const severity = this.resolveSeverity(category, text);
    return {
      category,
      severity,
      dueAt: this.resolveDueAt(category, severity),
    };
  }

  private resolveSeverity(
    category: ContactSubmissionCategory,
    text: string,
  ): ContactSubmissionSeverity {
    if (
      category === 'incident' ||
      text.includes('vazamento') ||
      text.includes('push indevido') ||
      text.includes('cobrou errado')
    ) {
      return 'P0';
    }
    if (category === 'billing' || category === 'privacy_lgpd' || category === 'stays') {
      return 'P1';
    }
    if (category === 'sales' || category === 'partnership') {
      return 'P3';
    }
    return 'P2';
  }

  private resolveDueAt(
    category: ContactSubmissionCategory,
    severity: ContactSubmissionSeverity,
  ): Date {
    const now = new Date();
    const addMs = (ms: number) => new Date(now.getTime() + ms);
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    if (category === 'privacy_lgpd') return addMs(15 * day);
    if (severity === 'P0') return addMs(2 * hour);
    if (severity === 'P1') return addMs(day);
    if (severity === 'P2') return addMs(2 * day);
    return addMs(7 * day);
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
