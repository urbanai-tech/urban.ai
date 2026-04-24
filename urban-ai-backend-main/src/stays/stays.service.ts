import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { StaysAccount } from '../entities/stays-account.entity';
import { StaysListing } from '../entities/stays-listing.entity';
import { PriceUpdate } from '../entities/price-update.entity';
import { User } from '../entities/user.entity';
import { StaysConnector } from './stays-connector';

export interface ConnectInput {
  clientId: string;
  accessToken: string;
}

export interface PushPriceInput {
  listingId: string;
  targetDate: string;     // YYYY-MM-DD
  newPriceCents: number;
  previousPriceCents: number;
  currency?: string;
  origin: 'ai_auto' | 'user_accepted' | 'user_manual' | 'rollback';
  analisePrecoId?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class StaysService {
  private readonly logger = new Logger(StaysService.name);

  constructor(
    @InjectRepository(StaysAccount) private readonly accountRepo: Repository<StaysAccount>,
    @InjectRepository(StaysListing) private readonly listingRepo: Repository<StaysListing>,
    @InjectRepository(PriceUpdate) private readonly priceUpdateRepo: Repository<PriceUpdate>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly connector: StaysConnector,
  ) {}

  // =========== Connect / disconnect ===========

  async connectAccount(userId: string, input: ConnectInput): Promise<StaysAccount> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // Valida o token antes de persistir — previne guardar credencial quebrada.
    const ok = await this.connector.ping(input.accessToken);
    if (!ok) {
      throw new BadRequestException(
        'Não foi possível autenticar com a Stays usando as credenciais fornecidas.',
      );
    }

    let account = await this.accountRepo.findOne({ where: { user: { id: userId } } });
    if (account) {
      account.clientId = input.clientId;
      account.accessToken = input.accessToken;
      account.status = 'active';
      account.lastErrorAt = null;
      account.lastErrorMessage = null;
    } else {
      account = this.accountRepo.create({
        user,
        clientId: input.clientId,
        accessToken: input.accessToken,
        status: 'active',
      });
    }
    account = await this.accountRepo.save(account);
    this.logger.log(`Stays account connected for user=${userId}`);
    return account;
  }

  async disconnectAccount(userId: string): Promise<void> {
    const account = await this.accountRepo.findOne({ where: { user: { id: userId } } });
    if (!account) return;
    account.status = 'disconnected';
    account.accessToken = ''; // zera credencial ao desconectar
    await this.accountRepo.save(account);
    this.logger.log(`Stays account disconnected for user=${userId}`);
  }

  async getAccount(userId: string): Promise<StaysAccount | null> {
    return this.accountRepo.findOne({ where: { user: { id: userId } } });
  }

  // =========== Listings ===========

  async syncListings(userId: string): Promise<StaysListing[]> {
    const account = await this.accountRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!account || account.status !== 'active') {
      throw new BadRequestException('Conta Stays não conectada.');
    }

    const remote = await this.connector.listListings(account.accessToken);
    account.lastSyncAt = new Date();
    await this.accountRepo.save(account);

    const existing = await this.listingRepo.find({
      where: { account: { id: account.id } },
      relations: ['account', 'propriedade'],
    });
    const byStaysId = new Map(existing.map((l) => [l.staysListingId, l]));

    const updated: StaysListing[] = [];
    for (const item of remote) {
      let row = byStaysId.get(item.listingId);
      if (!row) {
        row = this.listingRepo.create({
          account,
          staysListingId: item.listingId,
          title: item.title,
          shortAddress: item.address,
          basePriceCents: item.basePriceCents,
          active: item.active,
        });
      } else {
        row.title = item.title;
        row.shortAddress = item.address;
        row.basePriceCents = item.basePriceCents;
        row.active = item.active;
      }
      updated.push(await this.listingRepo.save(row));
    }
    return updated;
  }

  async listListingsForUser(userId: string): Promise<StaysListing[]> {
    const account = await this.accountRepo.findOne({ where: { user: { id: userId } } });
    if (!account) return [];
    return this.listingRepo.find({
      where: { account: { id: account.id } },
      relations: ['propriedade'],
    });
  }

  // =========== Push price (core do modo autônomo) ===========

  /**
   * Aplica as regras de guardrail antes de chamar a API:
   *  - teto de variação % (evita IA aplicando +300% por bug)
   *  - imóvel ativo
   *  - conta em status=active
   *
   * Resolve idempotência: se já existe PriceUpdate com a mesma chave, retorna
   * o registro anterior — não chama Stays de novo.
   */
  async pushPrice(userId: string, input: PushPriceInput): Promise<PriceUpdate> {
    const currency = input.currency || 'BRL';

    const account = await this.accountRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!account) throw new NotFoundException('Conta Stays não encontrada.');
    if (account.status !== 'active') {
      throw new BadRequestException('Conta Stays não está ativa — reconecte.');
    }

    const listing = await this.listingRepo.findOne({
      where: { id: input.listingId, account: { id: account.id } },
    });
    if (!listing) throw new NotFoundException('Listing Stays não encontrado para este usuário.');
    if (!listing.active) {
      throw new BadRequestException('Listing Stays está inativo.');
    }

    // Guardrails de variação: bloqueia pushes fora do teto.
    this.enforceVariationCaps(input.previousPriceCents, input.newPriceCents, account);

    const idempotencyKey = this.buildIdempotencyKey(listing.staysListingId, input.targetDate, input.newPriceCents);

    const existing = await this.priceUpdateRepo.findOne({ where: { idempotencyKey } });
    if (existing) {
      this.logger.log(
        `pushPrice idempotente listing=${listing.staysListingId} date=${input.targetDate} — reaproveitando update=${existing.id}`,
      );
      return existing;
    }

    const record = this.priceUpdateRepo.create({
      user: account.user,
      listing,
      analise: input.analisePrecoId ? ({ id: input.analisePrecoId } as any) : null,
      targetDate: input.targetDate,
      previousPriceCents: input.previousPriceCents,
      newPriceCents: input.newPriceCents,
      currency,
      origin: input.origin,
      status: 'pending',
      idempotencyKey,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
    await this.priceUpdateRepo.save(record);

    try {
      const result = await this.connector.pushPrice(account.accessToken, {
        listingId: listing.staysListingId,
        date: input.targetDate,
        priceCents: input.newPriceCents,
        currency,
        idempotencyKey,
      });

      if (result.ok) {
        record.status = 'success';
      } else {
        record.status = 'rejected';
        record.errorMessage = result.rejectedReason ?? null;
      }
      await this.priceUpdateRepo.save(record);
      return record;
    } catch (err) {
      record.status = 'error';
      record.errorMessage = (err as Error).message?.slice(0, 255) ?? 'unknown error';
      await this.priceUpdateRepo.save(record);

      // Se a falha foi de autenticação, marca a conta como error.
      account.status = 'error';
      account.lastErrorAt = new Date();
      account.lastErrorMessage = record.errorMessage;
      await this.accountRepo.save(account);

      throw err;
    }
  }

  /**
   * Desfaz um push: cria um novo PriceUpdate com origin='rollback' que
   * retorna o preço ao `previousPriceCents`.
   */
  async rollback(userId: string, priceUpdateId: string, meta?: { ip?: string; userAgent?: string }): Promise<PriceUpdate> {
    const original = await this.priceUpdateRepo.findOne({
      where: { id: priceUpdateId, user: { id: userId } },
      relations: ['listing', 'listing.account'],
    });
    if (!original) throw new NotFoundException('PriceUpdate não encontrado');
    if (original.status !== 'success') {
      throw new BadRequestException('Só é possível fazer rollback de pushes que foram aplicados com sucesso.');
    }

    const rollback = await this.pushPrice(userId, {
      listingId: original.listing.id,
      targetDate: original.targetDate,
      newPriceCents: original.previousPriceCents,
      previousPriceCents: original.newPriceCents,
      currency: original.currency,
      origin: 'rollback',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    rollback.rollbackOf = original;
    return this.priceUpdateRepo.save(rollback);
  }

  // =========== Helpers ===========

  private buildIdempotencyKey(listingId: string, date: string, priceCents: number): string {
    const raw = `${listingId}|${date}|${priceCents}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 48);
  }

  private enforceVariationCaps(
    previousCents: number,
    newCents: number,
    account: StaysAccount,
  ): void {
    if (previousCents <= 0) return; // imóvel sem preço anterior → sem teto
    const diffPct = ((newCents - previousCents) / previousCents) * 100;

    if (diffPct > account.maxIncreasePercent) {
      throw new BadRequestException(
        `Variação de +${diffPct.toFixed(1)}% excede o teto de +${account.maxIncreasePercent}% configurado para a conta.`,
      );
    }
    if (diffPct < -account.maxDecreasePercent) {
      throw new BadRequestException(
        `Variação de ${diffPct.toFixed(1)}% excede o teto de -${account.maxDecreasePercent}% configurado para a conta.`,
      );
    }
  }
}
