import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { randomBytes } from 'crypto';
import { Waitlist } from '../entities/waitlist.entity';
import { MailerService } from '../mailer/mailer.service';

/**
 * WaitlistService — F8.2 pré-lançamento.
 *
 * Lógica de inscrição:
 *  - email é unique → ConflictException se já existe
 *  - referralCode próprio gerado aleatório (8 chars URL-safe)
 *  - se `referredBy` veio na request, valida que existe e incrementa
 *    `referralsCount` da entry referenciada
 *
 * Lógica de convite (admin):
 *  - gera token único + expiração 7 dias
 *  - manda email com magic link
 *  - status muda 'pending' → 'invited'
 *
 * Lógica de aceite (público):
 *  - valida token + expiração
 *  - cria User real (delegado pra AuthService via callback)
 *  - status muda 'invited' → 'converted'
 */
@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectRepository(Waitlist)
    private readonly repo: Repository<Waitlist>,
    private readonly mailer: MailerService,
  ) {}

  // ================== Inscrição pública ==================

  async signup(input: {
    email: string;
    name?: string;
    phone?: string;
    source?: string;
    referredBy?: string;
    signupIp?: string;
    userAgent?: string;
  }): Promise<{
    position: number;
    referralCode: string;
    aheadOfYou: number;
    totalSignups: number;
  }> {
    const email = input.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('E-mail inválido');
    }

    const exists = await this.repo.findOne({ where: { email } });
    if (exists) {
      // Idempotente: retorna a posição atual em vez de erro. Mais amigável
      // pro usuário que se cadastrou duas vezes (não vai imaginar que estava
      // na lista).
      const totalSignups = await this.repo.count();
      return {
        position: exists.position,
        referralCode: exists.referralCode,
        aheadOfYou: Math.max(0, exists.position - 1),
        totalSignups,
      };
    }

    let referredEntry: Waitlist | null = null;
    if (input.referredBy) {
      referredEntry = await this.repo.findOne({
        where: { referralCode: input.referredBy },
      });
      // Se o code não bate, NÃO bloqueia o signup — só ignora silenciosamente.
      // Code malformado ou expirado não deve frustrar a inscrição.
    }

    const referralCode = await this.generateUniqueReferralCode();

    const entry = this.repo.create({
      email,
      name: input.name?.trim() || null,
      phone: input.phone?.trim() || null,
      source: input.source?.slice(0, 64) || 'unknown',
      referralCode,
      referredBy: referredEntry ? referredEntry.referralCode : null,
      signupIp: input.signupIp ?? null,
      userAgent: input.userAgent?.slice(0, 255) ?? null,
      status: 'pending',
    });

    const saved = await this.repo.save(entry);

    if (referredEntry) {
      await this.repo.increment({ id: referredEntry.id }, 'referralsCount', 1);
    }

    const totalSignups = await this.repo.count();

    return {
      position: saved.position,
      referralCode: saved.referralCode,
      aheadOfYou: Math.max(0, saved.position - 1),
      totalSignups,
    };
  }

  /** Lookup público leve — só usado pra exibir "você é o #N" sem precisar logar. */
  async getStatusByCode(referralCode: string): Promise<{
    position: number;
    aheadOfYou: number;
    totalSignups: number;
    referralsCount: number;
    status: string;
  } | null> {
    const entry = await this.repo.findOne({ where: { referralCode } });
    if (!entry) return null;
    const totalSignups = await this.repo.count();
    return {
      position: entry.position,
      aheadOfYou: Math.max(0, entry.position - 1),
      totalSignups,
      referralsCount: entry.referralsCount,
      status: entry.status,
    };
  }

  // ================== Admin ==================

  async list(input: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));

    const qb = this.repo
      .createQueryBuilder('w')
      .orderBy('w.position', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (input.status) {
      qb.andWhere('w.status = :status', { status: input.status });
    }
    if (input.search) {
      const like = `%${input.search.toLowerCase()}%`;
      qb.andWhere('(LOWER(w.email) LIKE :like OR LOWER(COALESCE(w.name, "")) LIKE :like)', {
        like,
      });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      page,
      limit,
      total,
      items: items.map((e) => ({
        id: e.id,
        position: e.position,
        email: e.email,
        name: e.name,
        phone: e.phone,
        source: e.source,
        referralCode: e.referralCode,
        referredBy: e.referredBy,
        referralsCount: e.referralsCount,
        status: e.status,
        invitedAt: e.invitedAt,
        convertedAt: e.convertedAt,
        notes: e.notes,
        createdAt: e.createdAt,
      })),
    };
  }

  async stats() {
    const total = await this.repo.count();
    const byStatus = await this.repo
      .createQueryBuilder('w')
      .select('w.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('w.status')
      .getRawMany();
    const bySource = await this.repo
      .createQueryBuilder('w')
      .select('w.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .groupBy('w.source')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();
    const topReferrers = await this.repo.find({
      where: { referralsCount: Not(0) },
      order: { referralsCount: 'DESC' },
      take: 10,
      select: ['email', 'referralCode', 'referralsCount', 'position'],
    });

    return {
      total,
      byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
      bySource: bySource.map((r) => ({ source: r.source, count: Number(r.count) })),
      topReferrers,
    };
  }

  async invite(id: string, frontUrl: string): Promise<{ ok: true; inviteUrl: string }> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Entry não encontrada');
    if (entry.status === 'converted') {
      throw new ConflictException('Esta entrada já virou usuário real');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    entry.inviteToken = token;
    entry.inviteTokenExpiresAt = expiresAt;
    entry.status = 'invited';
    entry.invitedAt = new Date();
    await this.repo.save(entry);

    const inviteUrl = `${frontUrl.replace(/\/$/, '')}/waitlist/aceitar?token=${token}`;

    try {
      await this.mailer.sendHtmlEmail(
        { email: entry.email, name: entry.name ?? '' },
        'Seu convite para a Urban AI chegou!',
        this.buildInviteEmail({
          name: entry.name,
          inviteUrl,
          position: entry.position,
        }),
      );
    } catch (err) {
      this.logger.error(`Falha ao enviar convite ${entry.email}`, err);
      // Não desfaz o token — admin pode tentar reenviar.
    }

    return { ok: true, inviteUrl };
  }

  async lookupByInviteToken(token: string): Promise<Waitlist | null> {
    if (!token) return null;
    const entry = await this.repo.findOne({ where: { inviteToken: token } });
    if (!entry) return null;
    if (!entry.inviteTokenExpiresAt || entry.inviteTokenExpiresAt < new Date()) {
      return null;
    }
    return entry;
  }

  async markConverted(id: string): Promise<void> {
    await this.repo.update(
      { id },
      {
        status: 'converted',
        convertedAt: new Date(),
        inviteToken: null,
        inviteTokenExpiresAt: null,
      },
    );
  }

  async updateNotes(id: string, notes: string | null) {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Entry não encontrada');
    entry.notes = notes ?? null;
    return this.repo.save(entry);
  }

  async remove(id: string) {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Entry não encontrada');
    await this.repo.remove(entry);
    return { ok: true };
  }

  // ================== Helpers ==================

  private async generateUniqueReferralCode(): Promise<string> {
    // 8 chars URL-safe, alfabeto sem ambiguidades (sem 0/O/I/l).
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = randomBytes(8);
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += alphabet[bytes[i] % alphabet.length];
      }
      const exists = await this.repo.findOne({ where: { referralCode: code } });
      if (!exists) return code;
    }
    // Fallback extremamente improvável: 5 colisões em sequência.
    return randomBytes(8).toString('hex').slice(0, 8);
  }

  private buildInviteEmail(input: {
    name: string | null;
    inviteUrl: string;
    position: number;
  }): string {
    const firstName = input.name?.split(' ')[0] ?? 'pessoal';
    return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#374151;max-width:600px;margin:0 auto;padding:32px;">
      <div style="text-align:center;margin-bottom:32px;">
        <img src="https://app.myurbanai.com/urban-logo.png" alt="Urban AI" style="height:40px;" />
      </div>
      <h2 style="color:#0ea5e9;text-align:center;">Seu acesso antecipado chegou, ${firstName}! 🎉</h2>
      <p>Você estava na posição <strong>#${input.position}</strong> da nossa lista de espera, e agora liberamos seu acesso à plataforma.</p>
      <p>Crie sua senha e conheça o sistema clicando no link abaixo. <strong>O link expira em 7 dias.</strong></p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${input.inviteUrl}" style="display:inline-block;padding:14px 32px;background:#0ea5e9;color:#fff;border-radius:8px;font-weight:bold;text-decoration:none;">
          Ativar minha conta
        </a>
      </div>
      <p style="font-size:14px;">Se o botão não funcionar, copie e cole no navegador:</p>
      <p style="font-size:13px;word-break:break-all;color:#2563eb;">${input.inviteUrl}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;" />
      <p style="font-size:12px;color:#9ca3af;text-align:center;">
        © ${new Date().getFullYear()} Urban AI · E-mail automático.
      </p>
    </body></html>`;
  }
}
