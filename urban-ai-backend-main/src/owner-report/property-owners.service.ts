import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, Repository } from 'typeorm';
import { Address } from '../entities/addresses.entity';
import { OwnerReport } from '../entities/owner-report.entity';
import { PropertyOwnerProperty } from '../entities/property-owner-property.entity';
import { PropertyOwner } from '../entities/property-owner.entity';
import { OWNER_CONSENT_TEXT, OWNER_CONSENT_VERSION } from './owner-report.constants';
import { CreatePropertyOwnerDto, UpdatePropertyOwnerDto } from './property-owner.dto';

export type PropertyOwnerView = {
  id: string;
  name: string;
  email: string;
  monthlyReportEnabled: boolean;
  /** O proprietário pediu para não receber (o anfitrião não desfaz). */
  unsubscribed: boolean;
  consent: { version: string; acceptedAt: string };
  properties: Array<{ id: string; title: string; location: string | null }>;
  lastReport: { period: string; emailStatus: string; emailSentAt: string | null } | null;
};

/**
 * Cadastro de proprietários do anfitrião (ADR 0027). Toda consulta e mutação é escopada ao
 * anfitrião autenticado: um proprietário ou imóvel de outro anfitrião é indistinguível de
 * "não existe" (404), nunca 403.
 */
@Injectable()
export class PropertyOwnersService {
  constructor(
    @InjectRepository(PropertyOwner) private readonly ownerRepo: Repository<PropertyOwner>,
    @InjectRepository(PropertyOwnerProperty) private readonly linkRepo: Repository<PropertyOwnerProperty>,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(OwnerReport) private readonly reportRepo: Repository<OwnerReport>,
  ) {}

  getConsentInfo() {
    return { version: OWNER_CONSENT_VERSION, text: OWNER_CONSENT_TEXT };
  }

  async listForHost(hostUserId: string): Promise<PropertyOwnerView[]> {
    const owners = await this.ownerRepo.find({ where: { userId: hostUserId }, order: { name: 'ASC' }, take: 500 });
    if (!owners.length) return [];
    const ownerIds = owners.map((owner) => owner.id);
    const links = await this.linkRepo.find({
      where: { ownerId: In(ownerIds) },
      relations: ['address', 'address.list'],
    });
    const reports = await this.reportRepo.find({ where: { ownerId: In(ownerIds) }, order: { period: 'DESC' }, take: 2000 });
    const lastByOwner = new Map<string, OwnerReport>();
    for (const report of reports) {
      if (!lastByOwner.has(report.ownerId)) lastByOwner.set(report.ownerId, report);
    }
    return owners.map((owner) => this.toView(owner, links.filter((link) => link.ownerId === owner.id), lastByOwner.get(owner.id)));
  }

  async create(hostUserId: string, dto: CreatePropertyOwnerDto, ip: string | null | undefined): Promise<PropertyOwnerView> {
    this.assertConsent(dto.consentAccepted, dto.consentVersion);
    const propertyIds = this.uniqueIds(dto.propertyIds);
    const addresses = await this.resolveOwnedAddresses(hostUserId, propertyIds);
    await this.assertNotLinkedElsewhere(propertyIds, null);

    const existing = await this.ownerRepo.findOne({ where: { userId: hostUserId, email: dto.email } });
    if (existing) throw new ConflictException('Já existe um proprietário cadastrado com este e-mail.');

    const owner = await this.ownerRepo.save(
      this.ownerRepo.create({
        userId: hostUserId,
        name: dto.name,
        email: dto.email,
        monthlyReportEnabled: dto.monthlyReportEnabled ?? true,
        consentVersion: dto.consentVersion,
        consentAcceptedAt: new Date(),
        consentIp: ip ? String(ip).slice(0, 64) : null,
        unsubscribedAt: null,
        unsubscribeRef: this.newUnsubscribeRef(),
      }),
    );
    try {
      await this.linkRepo.save(addresses.map((address) => this.linkRepo.create({ ownerId: owner.id, addressId: address.id })));
    } catch (error) {
      await this.ownerRepo.delete({ id: owner.id, userId: hostUserId });
      throw error;
    }
    return this.viewOf(owner.id, hostUserId);
  }

  async update(
    hostUserId: string,
    ownerId: string,
    dto: UpdatePropertyOwnerDto,
    ip: string | null | undefined,
  ): Promise<PropertyOwnerView> {
    const owner = await this.findOwned(hostUserId, ownerId);

    if (dto.email !== undefined && dto.email !== owner.email) {
      // Outro destinatário = nova declaração de base legal, descadastro e referência zerados.
      this.assertConsent(dto.consentAccepted, dto.consentVersion);
      const clash = await this.ownerRepo.findOne({ where: { userId: hostUserId, email: dto.email } });
      if (clash && clash.id !== owner.id) throw new ConflictException('Já existe um proprietário cadastrado com este e-mail.');
      owner.email = dto.email;
      owner.consentVersion = dto.consentVersion as string;
      owner.consentAcceptedAt = new Date();
      owner.consentIp = ip ? String(ip).slice(0, 64) : null;
      owner.unsubscribedAt = null;
      owner.unsubscribeRef = this.newUnsubscribeRef();
    }
    if (dto.name !== undefined) owner.name = dto.name;
    if (dto.monthlyReportEnabled !== undefined) owner.monthlyReportEnabled = dto.monthlyReportEnabled;

    if (dto.propertyIds !== undefined) {
      const propertyIds = this.uniqueIds(dto.propertyIds);
      const addresses = await this.resolveOwnedAddresses(hostUserId, propertyIds);
      await this.assertNotLinkedElsewhere(propertyIds, owner.id);
      const current = await this.linkRepo.find({ where: { ownerId: owner.id } });
      const keep = new Set(propertyIds);
      const stale = current.filter((link) => !keep.has(link.addressId));
      const present = new Set(current.map((link) => link.addressId));
      if (stale.length) await this.linkRepo.delete({ id: In(stale.map((link) => link.id)) });
      const fresh = addresses.filter((address) => !present.has(address.id));
      if (fresh.length) {
        await this.linkRepo.save(fresh.map((address) => this.linkRepo.create({ ownerId: owner.id, addressId: address.id })));
      }
    }

    await this.ownerRepo.save(owner);
    return this.viewOf(owner.id, hostUserId);
  }

  async remove(hostUserId: string, ownerId: string): Promise<{ ok: true }> {
    const owner = await this.findOwned(hostUserId, ownerId);
    // Relatórios e links caem em cascata (FK ON DELETE CASCADE).
    await this.ownerRepo.delete({ id: owner.id, userId: hostUserId });
    return { ok: true };
  }

  /** 404 para proprietário inexistente OU de outro anfitrião. */
  async findOwned(hostUserId: string, ownerId: string): Promise<PropertyOwner> {
    const owner = await this.ownerRepo.findOne({ where: { id: ownerId, userId: hostUserId } });
    if (!owner) throw new NotFoundException('Proprietário não encontrado');
    return owner;
  }

  /** Imóveis ativos do anfitrião (dele ou de um anúncio dele), exigindo que TODOS os pedidos existam. */
  async resolveOwnedAddresses(hostUserId: string, propertyIds: string[]): Promise<Address[]> {
    if (!propertyIds.length) throw new BadRequestException('Informe ao menos um imóvel.');
    const rows = await this.addressRepo.find({
      where: [
        { id: In(propertyIds), ativo: true, user: { id: hostUserId } } as any,
        { id: In(propertyIds), ativo: true, list: { user: { id: hostUserId } } } as any,
      ],
      relations: ['list', 'user', 'list.user'],
      take: 1000,
    });
    const byId = new Map<string, Address>();
    for (const row of rows) if (row?.id) byId.set(row.id, row);
    if (propertyIds.some((id) => !byId.has(id))) throw new NotFoundException('Imóvel não encontrado');
    return propertyIds.map((id) => byId.get(id) as Address);
  }

  private async assertNotLinkedElsewhere(propertyIds: string[], ownerId: string | null) {
    const links = await this.linkRepo.find({ where: { addressId: In(propertyIds) } });
    const taken = links.find((link) => link.ownerId !== ownerId);
    if (taken) throw new ConflictException('Um dos imóveis já está vinculado a outro proprietário.');
  }

  private assertConsent(accepted: unknown, version: unknown) {
    if (accepted !== true) {
      throw new BadRequestException('É necessário declarar que há base legal para compartilhar os dados com o proprietário.');
    }
    if (version !== OWNER_CONSENT_VERSION) {
      throw new BadRequestException('O texto da declaração foi atualizado. Recarregue a página e confirme novamente.');
    }
  }

  private uniqueIds(ids: string[]): string[] {
    return Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
  }

  private newUnsubscribeRef(): string {
    return randomBytes(16).toString('base64url');
  }

  private async viewOf(ownerId: string, hostUserId: string): Promise<PropertyOwnerView> {
    const owner = await this.findOwned(hostUserId, ownerId);
    const links = await this.linkRepo.find({ where: { ownerId }, relations: ['address', 'address.list'] });
    const [last] = await this.reportRepo.find({ where: { ownerId }, order: { period: 'DESC' }, take: 1 });
    return this.toView(owner, links, last);
  }

  private toView(owner: PropertyOwner, links: PropertyOwnerProperty[], last?: OwnerReport): PropertyOwnerView {
    return {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      monthlyReportEnabled: owner.monthlyReportEnabled,
      unsubscribed: Boolean(owner.unsubscribedAt),
      consent: { version: owner.consentVersion, acceptedAt: new Date(owner.consentAcceptedAt).toISOString() },
      properties: links
        .filter((link) => link.address)
        .map((link) => ({
          id: link.address.id,
          title: link.address.list?.titulo || link.address.logradouro || 'Imóvel',
          location: [link.address.bairro, link.address.cidade].filter(Boolean).join(', ') || null,
        })),
      lastReport: last
        ? {
            period: last.period,
            emailStatus: last.emailStatus,
            emailSentAt: last.emailSentAt ? new Date(last.emailSentAt).toISOString() : null,
          }
        : null,
    };
  }
}
