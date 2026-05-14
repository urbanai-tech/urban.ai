import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContactSubmission,
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

    const submission = this.repo.create({
      name,
      email,
      subject,
      message,
      source: input.source?.trim().slice(0, 80) || 'public-contact',
      status: 'new',
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

    const qb = this.repo
      .createQueryBuilder('c')
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (input.status && input.status !== 'all') {
      qb.andWhere('c.status = :status', { status: input.status });
    }

    const search = input.search?.trim().toLowerCase();
    if (search) {
      const like = `%${search}%`;
      qb.andWhere(
        `(LOWER(c.name) LIKE :like OR LOWER(c.email) LIKE :like OR LOWER(c.subject) LIKE :like OR LOWER(c.message) LIKE :like)`,
        { like },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { page, limit, total, items };
  }

  async update(id: string, input: UpdateContactSubmissionDto) {
    const submission = await this.repo.findOne({ where: { id } });
    if (!submission) {
      throw new NotFoundException('Contato nao encontrado');
    }

    if (input.status) {
      submission.status = input.status;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'notes')) {
      submission.notes = input.notes?.trim() || null;
    }

    return this.repo.save(submission);
  }
}
