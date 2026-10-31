import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Not, Repository } from 'typeorm';
import { Address } from '../entities/addresses.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { OccupancyHistory } from '../entities/occupancy-history.entity';
import { OwnerReportLink, OwnerReportLinkOrigin } from '../entities/owner-report-link.entity';
import { OwnerReport } from '../entities/owner-report.entity';
import { PropertyOwnerProperty } from '../entities/property-owner-property.entity';
import { PropertyOwner } from '../entities/property-owner.entity';
import { User } from '../entities/user.entity';
import { addDaysToDateKey } from '../common/sp-date';
import {
  buildOwnerReport,
  OwnerReportAnalysisRow,
  OwnerReportOccupancyRow,
  OwnerReportPayload,
  OwnerReportPropertyInput,
  OWNER_REPORT_PAYLOAD_VERSION,
} from './owner-report.builder';
import { OWNER_NOTICE_TEXT } from './owner-report.constants';
import {
  evaluateLinkState,
  issueOwnerToken,
  isOwnerTokenSecretConfigured,
  linkExpiryFrom,
  LinkState,
  resolveLinkTtlDays,
  verifyOwnerToken,
} from './owner-report-token';
import { currentPeriodKey, isValidPeriodKey, periodBounds, shiftPeriodKey } from './report-period';
import { PropertyOwnersService } from './property-owners.service';

export type OwnerReportLinkView = {
  id: string;
  origin: OwnerReportLinkOrigin;
  state: LinkState;
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  createdAt: string;
};

export type OwnerReportListItem = {
  period: string;
  generatedAt: string;
  emailStatus: string;
  emailSentAt: string | null;
  links: OwnerReportLinkView[];
};

export type PublicOwnerReport = {
  report: OwnerReportPayload;
  meta: { period: string; generatedAt: string; expiresAt: string; notice: string };
};

export function ownerFrontUrl(): string {
  return (process.env.FRONT_URL || process.env.FRONT_BASE_URL || 'https://app.myurbanai.com').replace(/\/$/, '');
}

export function ownerReportFeatureEnabled(): boolean {
  return process.env.OWNER_REPORT_ENABLED !== 'false';
}

@Injectable()
export class OwnerReportsService {
  private readonly logger = new Logger(OwnerReportsService.name);

  constructor(
    @InjectRepository(PropertyOwner) private readonly ownerRepo: Repository<PropertyOwner>,
    @InjectRepository(PropertyOwnerProperty) private readonly ownerPropertyRepo: Repository<PropertyOwnerProperty>,
    @InjectRepository(OwnerReport) private readonly reportRepo: Repository<OwnerReport>,
    @InjectRepository(OwnerReportLink) private readonly linkRepo: Repository<OwnerReportLink>,
    @InjectRepository(AnalisePreco) private readonly analiseRepo: Repository<AnalisePreco>,
    @InjectRepository(OccupancyHistory) private readonly occupancyRepo: Repository<OccupancyHistory>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly owners: PropertyOwnersService,
  ) {}

  // ---------------------------------------------------------------- host

  /** Pré-visualização para o anfitrião: calcula na hora, não grava nada e não conta como visualização. */
  async previewForHost(hostUserId: string, ownerId: string, period: string, now = new Date()) {
    this.assertEnabled();
    const periodKey = this.assertPeriod(period, now);
    const owner = await this.owners.findOwned(hostUserId, ownerId);
    return this.buildPayload(owner, periodKey, now);
  }

  async listReportsForHost(hostUserId: string, ownerId: string, now = new Date()): Promise<OwnerReportListItem[]> {
    await this.owners.findOwned(hostUserId, ownerId);
    const reports = await this.reportRepo.find({ where: { ownerId }, order: { period: 'DESC' }, take: 24 });
    if (!reports.length) return [];
    const links = await this.linkRepo.find({
      where: { reportId: In(reports.map((report) => report.id)) },
      order: { createdAt: 'DESC' },
    });
    return reports.map((report) => ({
      period: report.period,
      generatedAt: new Date(report.generatedAt).toISOString(),
      emailStatus: report.emailStatus,
      emailSentAt: report.emailSentAt ? new Date(report.emailSentAt).toISOString() : null,
      links: links.filter((link) => link.reportId === report.id).map((link) => this.toLinkView(link, now)),
    }));
  }

  /** Gera (ou atualiza) o snapshot do mês e emite um link novo; o token só existe nesta resposta. */
  async createLinkForHost(
    hostUserId: string,
    ownerId: string,
    period: string,
    ttlDays: number | undefined,
    now = new Date(),
  ) {
    this.assertEnabled();
    const periodKey = this.assertPeriod(period, now);
    const owner = await this.owners.findOwned(hostUserId, ownerId);
    const report = await this.generate(owner, periodKey, now);
    const issued = await this.createLink(report, 'host', ttlDays, now);
    return { url: issued.url, expiresAt: issued.link.expiresAt.toISOString(), period: periodKey };
  }

  async revokeLink(hostUserId: string, ownerId: string, linkId: string, now = new Date()) {
    await this.owners.findOwned(hostUserId, ownerId);
    const link = await this.linkRepo.findOne({ where: { id: linkId }, relations: ['report'] });
    // Link de outro proprietário/anfitrião é indistinguível de inexistente.
    if (!link || link.report?.ownerId !== ownerId) throw new NotFoundException('Link não encontrado');
    if (!link.revokedAt) {
      link.revokedAt = now;
      await this.linkRepo.save(link);
    }
    return { ok: true as const };
  }

  /** Revoga todos os links ativos do proprietário (opcionalmente de um mês). */
  async revokeAllLinks(hostUserId: string, ownerId: string, period?: string, now = new Date()) {
    await this.owners.findOwned(hostUserId, ownerId);
    const reports = await this.reportRepo.find({
      where: period ? { ownerId, period } : { ownerId },
      take: 100,
    });
    if (!reports.length) return { revoked: 0 };
    const result = await this.linkRepo.update(
      { reportId: In(reports.map((report) => report.id)), revokedAt: IsNull() },
      { revokedAt: now },
    );
    return { revoked: result?.affected ?? 0 };
  }

  // ------------------------------------------------------------- geração

  async generate(
    owner: PropertyOwner,
    periodKey: string,
    now = new Date(),
    options: { preserveSent?: boolean } = {},
  ): Promise<OwnerReport> {
    const existing = await this.reportRepo.findOne({ where: { ownerId: owner.id, period: periodKey } });
    if (existing && options.preserveSent && existing.emailStatus === 'sent') return existing;

    const payload = await this.buildPayload(owner, periodKey, now);
    const payloadJson = JSON.stringify(payload);
    if (existing) {
      existing.payloadJson = payloadJson;
      existing.payloadVersion = OWNER_REPORT_PAYLOAD_VERSION;
      existing.generatedAt = now;
      return this.reportRepo.save(existing);
    }
    try {
      return await this.reportRepo.save(
        this.reportRepo.create({
          ownerId: owner.id,
          period: periodKey,
          payloadJson,
          payloadVersion: OWNER_REPORT_PAYLOAD_VERSION,
          generatedAt: now,
          emailStatus: 'pending',
          emailAttempts: 0,
          emailSentAt: null,
          emailFailureReason: null,
        }),
      );
    } catch (error) {
      // Corrida com outra geração do mesmo mês (UNIQUE owner+period): usa a que ganhou.
      const winner = await this.reportRepo.findOne({ where: { ownerId: owner.id, period: periodKey } });
      if (winner) return winner;
      throw error;
    }
  }

  async buildPayload(owner: PropertyOwner, periodKey: string, now: Date): Promise<OwnerReportPayload> {
    const period = periodBounds(periodKey);
    const previous = periodBounds(shiftPeriodKey(periodKey, -1));
    const links = await this.ownerPropertyRepo.find({
      where: { ownerId: owner.id },
      relations: ['address', 'address.list', 'address.user', 'address.list.user'],
    });
    // Defesa em profundidade: só entram imóveis que AINDA são do anfitrião dono do proprietário.
    const addresses = links
      .map((link) => link.address)
      .filter(
        (address): address is Address =>
          Boolean(address) && (address.user?.id === owner.userId || address.list?.user?.id === owner.userId),
      );
    const host = await this.userRepo.findOne({ where: { id: owner.userId } });

    const addressIds = addresses.map((address) => address.id);
    const listIds = addresses.map((address) => address.list?.id).filter((id): id is string => Boolean(id));
    const from = previous.start;
    const to = period.endExclusive;
    const analyses = await this.loadAnalyses(owner.userId, addressIds, from, to);
    const occupancy = await this.loadOccupancy(listIds, previous.startKey, addDaysToDateKey(period.endKeyExclusive, -1));

    const analysesByAddress = new Map<string, OwnerReportAnalysisRow[]>();
    for (const row of analyses) {
      const id = row.endereco?.id;
      if (!id) continue;
      analysesByAddress.set(id, [...(analysesByAddress.get(id) ?? []), row as unknown as OwnerReportAnalysisRow]);
    }

    const properties: OwnerReportPropertyInput[] = addresses.map((address) => ({
      title: address.list?.titulo || address.logradouro || 'Imóvel',
      location: [address.bairro, address.cidade].filter(Boolean).join(', ') || null,
      analyses: analysesByAddress.get(address.id) ?? [],
      occupancy: address.list?.id ? occupancy.get(address.list.id) ?? [] : [],
    }));

    return buildOwnerReport({
      ownerName: owner.name,
      preparedBy: host?.username ?? null,
      periodKey,
      now,
      properties,
    });
  }

  /**
   * Recomendações do anfitrião que tocam a janela (mês anterior + mês do relatório): criadas,
   * aceitas, aplicadas, com resultado registrado, evento no período, ou aplicadas e sem resultado
   * (lembrete). O builder refiltra por janela em JS, então a consulta pode ser larga.
   */
  protected async loadAnalyses(hostUserId: string, addressIds: string[], from: Date, to: Date): Promise<AnalisePreco[]> {
    if (!addressIds.length) return [];
    const base = { usuarioProprietario: { id: hostUserId }, endereco: { id: In(addressIds) } };
    const range = Between(from, new Date(to.getTime() - 1));
    const rows = await this.analiseRepo.find({
      where: [
        { ...base, criadoEm: range },
        { ...base, aceitoEm: range },
        { ...base, aplicadoEm: range },
        { ...base, resultadoRegistradoEm: range },
        { ...base, evento: { dataInicio: range } },
        { ...base, aplicadoEm: Not(IsNull()), resultadoRegistradoEm: IsNull() },
      ],
      relations: ['endereco', 'evento'],
      order: { criadoEm: 'DESC' },
      take: 3000,
    });
    return rows ?? [];
  }

  protected async loadOccupancy(
    listIds: string[],
    fromKey: string,
    toKey: string,
  ): Promise<Map<string, OwnerReportOccupancyRow[]>> {
    const byList = new Map<string, OwnerReportOccupancyRow[]>();
    if (!listIds.length) return byList;
    const rows = await this.occupancyRepo
      .createQueryBuilder('occupancy')
      .leftJoinAndSelect('occupancy.list', 'list')
      .where('list.id IN (:...listIds)', { listIds })
      .andWhere('occupancy.date BETWEEN :from AND :to', { from: fromKey, to: toKey })
      .getMany();
    for (const row of rows) {
      const listId = row.list?.id;
      if (!listId) continue;
      byList.set(listId, [
        ...(byList.get(listId) ?? []),
        { date: String(row.date).slice(0, 10), status: row.status, revenueCents: row.revenueCents, origin: row.origin },
      ]);
    }
    return byList;
  }

  // --------------------------------------------------------------- links

  async createLink(
    report: OwnerReport,
    origin: OwnerReportLinkOrigin,
    requestedTtlDays?: number | null,
    now = new Date(),
  ): Promise<{ link: OwnerReportLink; url: string }> {
    const issued = issueOwnerToken('link');
    if (!issued) {
      this.logger.warn('OWNER_REPORT_TOKEN_SECRET/JWT_SECRET ausente: link do relatório não emitido.');
      throw new ServiceUnavailableException({
        code: 'OWNER_REPORT_DISABLED',
        message: 'Link do relatório indisponível: segredo de assinatura não configurado.',
      });
    }
    const ttlDays = resolveLinkTtlDays(requestedTtlDays);
    const link = await this.linkRepo.save(
      this.linkRepo.create({
        reportId: report.id,
        tokenHash: issued.hash,
        origin,
        expiresAt: linkExpiryFrom(now, ttlDays),
        revokedAt: null,
        viewCount: 0,
        firstViewedAt: null,
        lastViewedAt: null,
      }),
    );
    return { link, url: `${ownerFrontUrl()}/relatorio/${issued.token}` };
  }

  // ------------------------------------------------------------- público

  /**
   * Resolve um token público. Forma/assinatura inválidas e hash desconhecido => 404 genérico
   * (nada indica se o token "quase" existe); link conhecido porém vencido/revogado => 410.
   */
  async resolvePublic(token: string, now = new Date()): Promise<PublicOwnerReport> {
    if (!ownerReportFeatureEnabled()) throw new NotFoundException('Relatório indisponível');
    const verified = verifyOwnerToken('link', token);
    if (!verified) throw new NotFoundException('Link inválido');
    const link = await this.linkRepo.findOne({ where: { tokenHash: verified.hash }, relations: ['report'] });
    if (!link || !link.report) throw new NotFoundException('Link inválido');

    const state = evaluateLinkState(link, now);
    if (state === 'revoked') {
      throw new GoneException({ code: 'LINK_REVOKED', message: 'Este link foi revogado por quem o enviou.' });
    }
    if (state === 'expired') {
      throw new GoneException({ code: 'LINK_EXPIRED', message: 'Este link expirou. Peça um novo ao responsável pelo seu imóvel.' });
    }

    await this.recordView(link, now);
    return {
      report: JSON.parse(link.report.payloadJson) as OwnerReportPayload,
      meta: {
        period: link.report.period,
        generatedAt: new Date(link.report.generatedAt).toISOString(),
        expiresAt: new Date(link.expiresAt).toISOString(),
        notice: OWNER_NOTICE_TEXT,
      },
    };
  }

  private async recordView(link: OwnerReportLink, now: Date) {
    try {
      await this.linkRepo.increment({ id: link.id }, 'viewCount', 1);
      await this.linkRepo.update({ id: link.id }, { lastViewedAt: now });
      if (!link.firstViewedAt) await this.linkRepo.update({ id: link.id, firstViewedAt: IsNull() }, { firstViewedAt: now });
    } catch (error) {
      // Contagem é métrica: nunca derruba a visualização.
      this.logger.warn(`falha ao registrar visualização: ${(error as Error)?.message}`);
    }
  }

  // --------------------------------------------------------- descadastro

  async unsubscribeOwner(token: string, now = new Date()): Promise<boolean> {
    const owner = await this.findOwnerByUnsubscribeToken(token);
    if (!owner) return false;
    if (!owner.unsubscribedAt) {
      owner.unsubscribedAt = now;
      owner.monthlyReportEnabled = false;
      await this.ownerRepo.save(owner);
    }
    return true;
  }

  async isUnsubscribeTokenValid(token: string): Promise<boolean> {
    return Boolean(await this.findOwnerByUnsubscribeToken(token));
  }

  private async findOwnerByUnsubscribeToken(token: string): Promise<PropertyOwner | null> {
    const verified = verifyOwnerToken('unsub', token);
    if (!verified) return null;
    return this.ownerRepo.findOne({ where: { unsubscribeRef: verified.random } });
  }

  // -------------------------------------------------------------- helpers

  toLinkView(link: OwnerReportLink, now: Date): OwnerReportLinkView {
    return {
      id: link.id,
      origin: link.origin,
      state: evaluateLinkState(link, now),
      expiresAt: new Date(link.expiresAt).toISOString(),
      revokedAt: link.revokedAt ? new Date(link.revokedAt).toISOString() : null,
      viewCount: link.viewCount ?? 0,
      firstViewedAt: link.firstViewedAt ? new Date(link.firstViewedAt).toISOString() : null,
      lastViewedAt: link.lastViewedAt ? new Date(link.lastViewedAt).toISOString() : null,
      createdAt: new Date(link.createdAt).toISOString(),
    };
  }

  private assertEnabled() {
    if (!ownerReportFeatureEnabled() || !isOwnerTokenSecretConfigured()) {
      throw new ServiceUnavailableException({
        code: 'OWNER_REPORT_DISABLED',
        message: 'Relatório do proprietário indisponível neste ambiente.',
      });
    }
  }

  private assertPeriod(period: string, now: Date): string {
    if (!isValidPeriodKey(period)) throw new BadRequestException('Período inválido (use AAAA-MM).');
    if (period > currentPeriodKey(now)) throw new BadRequestException('O período ainda não começou.');
    return period;
  }
}
