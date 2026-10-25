import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { StaysAccount } from '../entities/stays-account.entity';
import { StaysListing } from '../entities/stays-listing.entity';
import { PriceUpdate } from '../entities/price-update.entity';
import { User } from '../entities/user.entity';
import { PricingDecisionSnapshot } from '../entities/pricing-decision-snapshot.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { List } from '../entities/list.entity';
import { Address } from '../entities/addresses.entity';
import { PricingCalculateService } from '../propriedades/pricing-calculate.service';
import { toSaoPauloDateKey } from '../common/sp-date';
import {
  StaysConnector,
  StaysConnectorError,
  StaysCredentials,
  isStaysAuthError,
  resolveStaysApiBaseUrl,
  sanitizeStaysAccountSlug,
} from './stays-connector';

export interface ConnectInput {
  /** Identificador da conta Stays (subdomínio). Nunca uma URL. */
  accountSlug?: string;
  clientId: string;
  accessToken: string;
  consentAccepted?: boolean;
  consentVersion?: string;
  ip?: string;
  userAgent?: string | string[];
}

export interface PushPriceInput {
  /** Identificador da decisão (UUID do front, ou chave interna do cron/rollback). */
  requestId?: string;
  listingId: string;
  targetDate: string;     // YYYY-MM-DD
  newPriceCents: number;
  previousPriceCents: number;
  currency?: string;
  origin: 'ai_auto' | 'user_accepted' | 'user_manual' | 'rollback';
  analisePrecoId?: string;
  /** Rollback: liga o registro ao original já na criação (inclusive se falhar). */
  rollbackOfId?: string;
  ip?: string;
  userAgent?: string;
}

export interface PreviewPriceInput {
  requestId?: string;
  listingId: string;
  targetDate: string;     // YYYY-MM-DD
  newPriceCents: number;
  previousPriceCents?: number | null;
  currency?: string;
  analisePrecoId?: string;
}

export interface PricePreviewIssue {
  code: string;
  message: string;
}

export type PreviousPriceSource = 'stays_calendar' | 'input' | 'unavailable';

export interface PricePreviewResult {
  listingId: string;
  staysListingId: string;
  title: string | null;
  targetDate: string;
  previousPriceCents: number;
  previousPriceSource: PreviousPriceSource;
  newPriceCents: number;
  currency: string;
  diffCents: number;
  diffPercent: number | null;
  maxIncreasePercent: number;
  maxDecreasePercent: number;
  withinGuardrails: boolean;
  readyForPush: boolean;
  priceWritesEnabled: boolean;
  blockers: PricePreviewIssue[];
  warnings: PricePreviewIssue[];
  existingPriceUpdateId: string | null;
  idempotentReplay: boolean;
}

export interface StaysCapabilities {
  priceWritesEnabled: boolean;
  autoApplyEnabled: boolean;
  autoApplyDryRun: boolean;
}

export interface StaysMatchSuggestion {
  listingId: string;
  propriedadeId: string;
  propriedadeTitulo: string;
  score: number;
  reason: 'name_address_similarity';
}

export interface StaysRecommendation {
  analisePrecoId: string;
  targetDate: string;
  recommendedPriceCents: number;
  eventName: string | null;
}

export interface AutoApplyOperationState {
  /** Já existe push ai_auto com sucesso ainda não revertido. */
  activeSuccess: boolean;
  /** Quantos pushes desta análise já foram revertidos com sucesso. */
  rollbackGeneration: number;
  lastRollbackAt: Date | null;
  /** Tentativas falhas (rejected/error) desde o último rollback. */
  failedAttempts: number;
  lastFailureAt: Date | null;
}

const MAX_ROLLBACK_ATTEMPTS = 5;
const STALE_PENDING_MS = 10 * 60_000;

@Injectable()
export class StaysService {
  private readonly logger = new Logger(StaysService.name);

  constructor(
    @InjectRepository(StaysAccount) private readonly accountRepo: Repository<StaysAccount>,
    @InjectRepository(StaysListing) private readonly listingRepo: Repository<StaysListing>,
    @InjectRepository(PriceUpdate) private readonly priceUpdateRepo: Repository<PriceUpdate>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly connector: StaysConnector,
    @Optional()
    @InjectRepository(PricingDecisionSnapshot)
    private readonly pricingDecisionSnapshotRepo?: Repository<PricingDecisionSnapshot>,
    @Optional()
    @InjectRepository(AnalisePreco)
    private readonly analiseRepo?: Repository<AnalisePreco>,
    @Optional()
    private readonly pricingCalculateService?: PricingCalculateService,
    @Optional()
    @InjectRepository(List)
    private readonly listRepo?: Repository<List>,
    @Optional()
    @InjectRepository(Address)
    private readonly addressRepo?: Repository<Address>,
  ) {}

  // =========== Capabilities ===========

  getCapabilities(): StaysCapabilities {
    const flag = (name: string) => ['true', '1', 'yes', 'on'].includes(process.env[name]?.trim().toLowerCase() ?? '');
    return {
      priceWritesEnabled: StaysConnector.writesEnabled(),
      autoApplyEnabled: flag('STAYS_AUTO_APPLY_ENABLED'),
      autoApplyDryRun: flag('STAYS_AUTO_APPLY_DRY_RUN') || !StaysConnector.writesEnabled(),
    };
  }

  // =========== Connect / disconnect ===========

  async connectAccount(userId: string, input: ConnectInput): Promise<StaysAccount> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const consentVersion = input.consentVersion?.trim();
    if (input.consentAccepted !== true || !consentVersion) {
      throw new BadRequestException('Consentimento Stays obrigatorio para conectar a conta.');
    }
    const accountSlug = this.normalizeSlugInput(input.accountSlug);
    this.assertStaysReadiness({ accountSlug });

    let account = await this.accountRepo.findOne({ where: { user: { id: userId } } });
    if (account) {
      // Reconexão não pode trocar silenciosamente de conta Stays: os vínculos e o
      // histórico pertencem ao destino anterior. Valor salvo malformado não gera 500.
      const previousTarget = this.targetFor(account.apiAccountSlug ?? null);
      const nextTarget = this.targetFor(accountSlug);
      if (previousTarget && nextTarget && previousTarget !== nextTarget) {
        throw new BadRequestException(
          'A troca de conta Stays exige migrar os vínculos dos imóveis e o histórico da integração. Reconecte usando a conta já cadastrada.',
        );
      }
      if (!previousTarget && account.apiAccountSlug) {
        this.logger.warn(`Stays account ${account.id} tinha identificador inválido salvo; substituindo na reconexão.`);
      }
    }

    // Valida a credencial antes de persistir — previne guardar credencial quebrada.
    const ok = await this.connector.ping({ clientId: input.clientId, clientSecret: input.accessToken, accountSlug });
    if (!ok) {
      throw new BadRequestException(
        'Não foi possível autenticar com a Stays usando as credenciais fornecidas.',
      );
    }

    if (account) {
      account.clientId = input.clientId;
      account.apiAccountSlug = accountSlug;
      account.accessToken = input.accessToken;
      account.consentAcceptedAt = new Date();
      account.consentVersion = consentVersion;
      account.consentIp = input.ip?.slice(0, 64) ?? null;
      account.consentUserAgent = this.normalizeUserAgent(input.userAgent);
      account.status = 'active';
      account.lastErrorAt = null;
      account.lastErrorMessage = null;
      account.consecutiveFailures = 0;
    } else {
      account = this.accountRepo.create({
        user,
        clientId: input.clientId,
        apiAccountSlug: accountSlug,
        accessToken: input.accessToken,
        consentAcceptedAt: new Date(),
        consentVersion,
        consentIp: input.ip?.slice(0, 64) ?? null,
        consentUserAgent: this.normalizeUserAgent(input.userAgent),
        status: 'active',
        consecutiveFailures: 0,
      });
    }
    account = await this.accountRepo.save(account);
    this.connector.invalidateInventory?.(this.accountCredentials(account));
    this.logger.log(`Stays account connected for user=${userId}`);
    return account;
  }

  async disconnectAccount(userId: string): Promise<void> {
    const account = await this.accountRepo.findOne({ where: { user: { id: userId } } });
    if (!account) return;
    this.connector.invalidateInventory?.(this.accountCredentials(account));
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
    this.assertStaysReadiness({ requireEncryptionKey: false, accountSlug: account.apiAccountSlug });

    let remote;
    try {
      remote = await this.connector.listListings(this.accountCredentials(account));
    } catch (err) {
      await this.registerProviderFailure(account, err);
      throw this.toHttpError(err);
    }

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
          providerMetadata: item.providerMetadata,
        });
      } else {
        row.title = item.title;
        row.shortAddress = item.address;
        row.basePriceCents = item.basePriceCents;
        row.active = item.active;
        row.providerMetadata = item.providerMetadata;
      }
      updated.push(await this.listingRepo.save(row));
    }
    // Inventário completo bem-sucedido é a fonte da verdade. Preserva histórico e
    // vínculo, mas tira listings removidos da elegibilidade de preço automático.
    const remoteIds = new Set(remote.map((item) => item.listingId));
    for (const row of existing) {
      if (row.active && !remoteIds.has(row.staysListingId)) {
        row.active = false;
        await this.listingRepo.save(row);
      }
    }
    account.lastSyncAt = new Date();
    account.consecutiveFailures = 0;
    await this.accountRepo.save(account);
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

  // =========== Vínculo listing Stays ↔ imóvel Urban ===========

  /**
   * Liga (ou desliga, com `propriedadeId=null`) um listing Stays a um imóvel
   * Urban. Ambos precisam ser do usuário autenticado; um imóvel só pode estar
   * ligado a um listing da conta.
   */
  async linkListingToProperty(userId: string, listingId: string, propriedadeId: string | null): Promise<StaysListing> {
    const account = await this.accountRepo.findOne({ where: { user: { id: userId } } });
    if (!account) throw new NotFoundException('Conta Stays não encontrada.');
    const listing = await this.listingRepo.findOne({
      where: { id: listingId, account: { id: account.id } },
      relations: ['propriedade'],
    });
    if (!listing) throw new NotFoundException('Listing Stays não encontrado para este usuário.');

    if (propriedadeId === null) {
      listing.propriedade = null;
      return this.listingRepo.save(listing);
    }

    if (!this.listRepo) throw new ServiceUnavailableException('Imóveis indisponíveis neste ambiente.');
    const property = await this.listRepo.findOne({ where: { id: propriedadeId, user: { id: userId } } });
    if (!property) throw new NotFoundException('Imóvel não encontrado para este usuário.');

    const taken = await this.listingRepo.findOne({
      where: { account: { id: account.id }, propriedade: { id: propriedadeId } },
    });
    if (taken && taken.id !== listing.id) {
      throw new ConflictException('Este imóvel já está vinculado a outro listing Stays. Desvincule-o antes.');
    }
    listing.propriedade = property;
    return this.listingRepo.save(listing);
  }

  /** Imóveis Urban (List) do usuário que podem receber vínculo. */
  async listLinkableProperties(userId: string): Promise<Array<{ id: string; titulo: string; internalNickname: string | null }>> {
    if (!this.listRepo) return [];
    const properties = await this.listRepo.find({ where: { user: { id: userId }, ativo: true } });
    return properties.map((p) => ({ id: p.id, titulo: p.titulo, internalNickname: p.internalNickname ?? null }));
  }

  /**
   * Sugestões de vínculo para listings ainda sem imóvel, por similaridade de
   * nome/endereço. O contrato público da Stays mapeado aqui não expõe o ID do
   * anúncio Airbnb; quando expuser, entra como critério prioritário. O usuário
   * sempre confirma (nada é ligado automaticamente).
   */
  async suggestListingMatches(userId: string): Promise<StaysMatchSuggestion[]> {
    const account = await this.accountRepo.findOne({ where: { user: { id: userId } } });
    if (!account || !this.listRepo) return [];
    const listings = await this.listingRepo.find({
      where: { account: { id: account.id } },
      relations: ['propriedade'],
    });
    const properties = await this.listRepo.find({ where: { user: { id: userId } } });
    if (!properties.length) return [];
    const addresses = this.addressRepo && properties.length
      ? await this.addressRepo.find({ where: { list: { id: In(properties.map((p) => p.id)) } } })
      : [];
    const addressText = new Map<string, string>();
    for (const addr of addresses) {
      const listId = (addr as any).list?.id;
      if (!listId) continue;
      addressText.set(listId, [addr.logradouro, addr.numero, addr.bairro, addr.cidade].filter(Boolean).join(' '));
    }

    const linked = new Set(listings.map((l) => l.propriedade?.id).filter(Boolean) as string[]);
    const available = properties.filter((p) => !linked.has(p.id));
    const suggestions: StaysMatchSuggestion[] = [];
    for (const listing of listings) {
      if (listing.propriedade) continue;
      const listingTokens = this.tokens(`${listing.title ?? ''} ${listing.shortAddress ?? ''}`);
      let best: { property: List; score: number } | null = null;
      for (const property of available) {
        const propertyTokens = this.tokens(
          `${property.titulo ?? ''} ${property.internalNickname ?? ''} ${addressText.get(property.id) ?? ''}`,
        );
        const score = this.jaccard(listingTokens, propertyTokens);
        if (!best || score > best.score) best = { property, score };
      }
      if (best && best.score >= 0.2) {
        suggestions.push({
          listingId: listing.id,
          propriedadeId: best.property.id,
          propriedadeTitulo: best.property.titulo,
          score: Number(best.score.toFixed(2)),
          reason: 'name_address_similarity',
        });
      }
    }
    return suggestions;
  }

  /** Recomendação mais recente (evento futuro) do imóvel vinculado ao listing. */
  async getRecommendationForListing(userId: string, listingId: string): Promise<StaysRecommendation | null> {
    const account = await this.accountRepo.findOne({ where: { user: { id: userId } } });
    if (!account) throw new NotFoundException('Conta Stays não encontrada.');
    const listing = await this.listingRepo.findOne({
      where: { id: listingId, account: { id: account.id } },
      relations: ['propriedade'],
    });
    if (!listing) throw new NotFoundException('Listing Stays não encontrado para este usuário.');
    if (!listing.propriedade || !this.analiseRepo) return null;

    const today = toSaoPauloDateKey(new Date());
    const candidates = await this.analiseRepo
      .createQueryBuilder('ap')
      .leftJoinAndSelect('ap.evento', 'evento')
      .leftJoin('ap.endereco', 'addr')
      .leftJoin('ap.usuarioProprietario', 'owner')
      .where('addr.list_id = :listId', { listId: listing.propriedade.id })
      .andWhere('owner.id = :userId', { userId })
      .andWhere('ap.preco_sugerido > 0')
      .orderBy('ap.criado_em', 'DESC')
      .limit(20)
      .getMany();
    for (const analise of candidates) {
      const start = analise.evento?.dataInicio;
      if (!start) continue;
      const targetDate = toSaoPauloDateKey(new Date(start as any));
      if (targetDate < today) continue;
      const cents = Math.round(Number(analise.precoSugerido) * 100);
      if (!Number.isSafeInteger(cents) || cents <= 0) continue;
      return {
        analisePrecoId: analise.id,
        targetDate,
        recommendedPriceCents: cents,
        eventName: (analise.evento as any)?.nome ?? null,
      };
    }
    return null;
  }

  async listPriceUpdates(userId: string, listingId?: string, limit = 20): Promise<PriceUpdate[]> {
    const where: any = { user: { id: userId } };
    if (listingId) where.listing = { id: listingId };
    return this.priceUpdateRepo.find({
      where,
      relations: ['listing', 'rollbackOf'],
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  // =========== Preço vigente (baseline real) ===========

  /**
   * Lê do calendário Stays o preço vigente da data. Usado como baseline do
   * push (o conector exige igualdade com o calendário ao vivo). Falha de
   * autenticação marca a conta; falha transitória não.
   */
  async readCurrentPriceCents(
    userId: string,
    listingId: string,
    targetDate: string,
    currency = 'BRL',
  ): Promise<number | null> {
    const account = await this.accountRepo.findOne({ where: { user: { id: userId } } });
    if (!account || account.status !== 'active') return null;
    const listing = await this.listingRepo.findOne({ where: { id: listingId, account: { id: account.id } } });
    if (!listing) throw new NotFoundException('Listing Stays não encontrado para este usuário.');
    try {
      return await this.connector.readCurrentPriceCents(
        this.accountCredentials(account), listing.staysListingId, targetDate, currency,
      );
    } catch (err) {
      await this.registerProviderFailure(account, err);
      throw err;
    }
  }

  // =========== Push price (core do modo autônomo) ===========

  async previewPrice(userId: string, input: PreviewPriceInput): Promise<PricePreviewResult> {
    const currency = input.currency || 'BRL';
    const blockers: PricePreviewIssue[] = [];
    const warnings: PricePreviewIssue[] = [];

    const account = await this.accountRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!account) throw new NotFoundException('Conta Stays não encontrada.');
    if (account.status !== 'active') {
      blockers.push({
        code: 'account_not_active',
        message: 'Conta Stays não está ativa. Reconecte antes de aplicar preços.',
      });
    }

    if (!account.consentAcceptedAt || !account.consentVersion?.trim()) {
      blockers.push({
        code: 'consent_missing',
        message: 'Consentimento Stays versionado e obrigatorio antes de aplicar precos.',
      });
    }

    const listing = await this.listingRepo.findOne({
      where: { id: input.listingId, account: { id: account.id } },
      relations: ['propriedade'],
    });
    if (!listing) throw new NotFoundException('Listing Stays não encontrado para este usuário.');
    await this.assertAnalysisOwnership(userId, listing, input.analisePrecoId);
    if (!listing.active) {
      blockers.push({
        code: 'listing_inactive',
        message: 'Listing Stays está inativo.',
      });
    }

    const validDate = this.isValidTargetDate(input.targetDate);
    if (!validDate) {
      blockers.push({
        code: 'invalid_target_date',
        message: 'targetDate deve estar no formato YYYY-MM-DD.',
      });
    }

    if (!Number.isInteger(input.newPriceCents) || input.newPriceCents <= 0) {
      blockers.push({
        code: 'invalid_new_price',
        message: 'newPriceCents deve ser um inteiro positivo.',
      });
    }

    // Baseline: preço vigente no calendário Stays (o push exige igualdade com ele).
    let previousPriceCents = 0;
    let previousPriceSource: PreviousPriceSource = 'unavailable';
    if (input.previousPriceCents !== undefined && input.previousPriceCents !== null) {
      previousPriceCents = input.previousPriceCents;
      previousPriceSource = 'input';
    } else if (validDate && account.status === 'active' && this.targetFor(account.apiAccountSlug ?? null)) {
      try {
        const live = await this.connector.readCurrentPriceCents(
          this.accountCredentials(account), listing.staysListingId, input.targetDate, currency,
        );
        if (live && live > 0) {
          previousPriceCents = live;
          previousPriceSource = 'stays_calendar';
        } else {
          warnings.push({
            code: 'calendar_requires_pricing_mapping',
            message: 'A data não tem uma tarifa única no calendário Stays; o push exige mapeamento manual.',
          });
        }
      } catch (err) {
        await this.registerProviderFailure(account, err);
        warnings.push({
          code: 'live_price_unavailable',
          message: 'Não foi possível ler o preço atual na Stays agora. Tente novamente em instantes.',
        });
      }
    }
    if (previousPriceCents <= 0) {
      blockers.push({ code: 'missing_previous_price', message: 'Sem preço atual confiável da Stays para esta data.' });
    } else if (previousPriceCents === input.newPriceCents) {
      warnings.push({ code: 'price_already_at_target', message: 'A Stays já está com este preço nesta data.' });
    }

    const variation = this.evaluateVariationCaps(previousPriceCents, input.newPriceCents, account);
    blockers.push(...variation.blockers);

    const configured = Boolean(this.targetFor(account.apiAccountSlug ?? null));
    if (!configured) {
      warnings.push({
        code: 'stays_api_base_url_missing',
        message: 'Conta Stays sem identificador e STAYS_API_BASE_URL ausente; preview liberado, push real bloqueado.',
      });
    }

    const priceWritesEnabled = StaysConnector.writesEnabled();
    if (!priceWritesEnabled) {
      blockers.push({
        code: 'stays_price_writes_disabled',
        message: 'Escrita desligada neste ambiente; prévia disponível.',
      });
    }

    let existing: PriceUpdate | null = null;
    if (
      validDate &&
      Number.isInteger(input.newPriceCents) &&
      input.newPriceCents > 0
    ) {
      const idempotencyKey = this.buildIdempotencyKey(
        listing.id,
        input.targetDate,
        input.newPriceCents,
        input.requestId ? { id: input.requestId, accountId: account.id, origin: 'user_accepted' } : undefined,
      );
      existing = await this.priceUpdateRepo.findOne({ where: { idempotencyKey } });
    }

    const guardrailBlockers = new Set(['increase_cap_exceeded', 'decrease_cap_exceeded']);
    const withinGuardrails = !blockers.some((issue) => guardrailBlockers.has(issue.code));

    return {
      listingId: listing.id,
      staysListingId: listing.staysListingId,
      title: listing.title ?? null,
      targetDate: input.targetDate,
      previousPriceCents,
      previousPriceSource,
      newPriceCents: input.newPriceCents,
      currency,
      diffCents: variation.diffCents,
      diffPercent: variation.diffPercent,
      maxIncreasePercent: account.maxIncreasePercent,
      maxDecreasePercent: account.maxDecreasePercent,
      withinGuardrails,
      readyForPush: blockers.length === 0 && configured,
      priceWritesEnabled,
      blockers,
      warnings,
      existingPriceUpdateId: existing?.id ?? null,
      idempotentReplay: Boolean(existing),
    };
  }

  /**
   * Aplica as regras de guardrail antes de chamar a API:
   *  - teto de variação % (evita IA aplicando +300% por bug)
   *  - imóvel ativo
   *  - conta em status=active
   *  - escrita habilitada no ambiente (STAYS_PRICE_WRITES_ENABLED)
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
    if (!account.consentAcceptedAt || !account.consentVersion?.trim()) {
      throw new BadRequestException(
        'Consentimento Stays versionado e obrigatorio antes de aplicar precos.',
      );
    }
    this.assertStaysReadiness({ requireEncryptionKey: false, accountSlug: account.apiAccountSlug });

    if (!StaysConnector.writesEnabled()) {
      throw new BadRequestException('Publicação Stays desabilitada neste ambiente (escrita desligada).');
    }

    const listing = await this.listingRepo.findOne({
      where: { id: input.listingId, account: { id: account.id } },
      relations: ['propriedade'],
    });
    if (!listing) throw new NotFoundException('Listing Stays não encontrado para este usuário.');
    await this.assertAnalysisOwnership(userId, listing, input.analisePrecoId);
    if (!listing.active) {
      throw new BadRequestException('Listing Stays está inativo.');
    }

    // Guardrails de variação: bloqueia pushes fora do teto.
    this.assertValidPushInput(input);
    this.enforceVariationCaps(input.previousPriceCents, input.newPriceCents, account);

    const idempotencyKey = this.buildIdempotencyKey(listing.id, input.targetDate, input.newPriceCents,
      input.requestId ? { id: input.requestId, accountId: account.id, origin: input.origin } : undefined);

    const existing = await this.priceUpdateRepo.findOne({
      where: { idempotencyKey },
      relations: ['analise', 'listing'],
    });
    if (existing) {
      this.assertSameOperation(existing, listing, input, currency);
      this.logger.log(
        `pushPrice idempotente listing=${listing.staysListingId} date=${input.targetDate} — reaproveitando update=${existing.id}`,
      );
      await this.recordPricingDecisionOutcome(existing);
      return existing;
    }

    const record = this.priceUpdateRepo.create({
      user: account.user,
      listing,
      analise: input.analisePrecoId ? ({ id: input.analisePrecoId } as any) : null,
      rollbackOf: input.rollbackOfId ? ({ id: input.rollbackOfId } as any) : null,
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
    try {
      await this.priceUpdateRepo.save(record);
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) throw error;
      const concurrent = await this.priceUpdateRepo.findOne({
        where: { idempotencyKey },
        relations: ['analise', 'listing'],
      });
      if (!concurrent) throw error;
      this.assertSameOperation(concurrent, listing, input, currency);
      this.logger.log(
        `pushPrice concorrente deduplicado listing=${listing.staysListingId} ` +
          `date=${input.targetDate} update=${concurrent.id}`,
      );
      await this.recordPricingDecisionOutcome(concurrent);
      return concurrent;
    }
    await this.recordPricingDecisionOutcome(record, {
      acceptedAt: record.createdAt ?? new Date(),
    });

    try {
      const result = await this.connector.pushPrice(this.accountCredentials(account), {
        listingId: listing.staysListingId,
        date: input.targetDate,
        priceCents: input.newPriceCents,
        previousPriceCents: input.previousPriceCents,
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
      await this.recordPricingDecisionOutcome(record, {
        appliedAt: result.ok ? new Date() : undefined,
        rejectedAt: result.ok ? undefined : new Date(),
      });
      await this.registerProviderSuccess(account);
      return record;
    } catch (err) {
      record.status = 'error';
      record.errorMessage = (err as Error).message?.slice(0, 255) ?? 'unknown error';
      await this.priceUpdateRepo.save(record);
      await this.recordPricingDecisionOutcome(record);
      await this.registerProviderFailure(account, err);
      throw this.toHttpError(err);
    }
  }

  /**
   * Desfaz um push: cria um novo PriceUpdate com origin='rollback' que
   * retorna o preço ao `previousPriceCents`.
   *
   * Cada tentativa tem requestId próprio (`rollback:<original>:<n>`): um
   * rollback que falhou pode ser repetido (nova tentativa), um que deu certo
   * é devolvido (idempotente) e um em andamento bloqueia uma segunda corrida.
   */
  async rollback(userId: string, priceUpdateId: string, meta?: { ip?: string; userAgent?: string }): Promise<PriceUpdate> {
    const original = await this.priceUpdateRepo.findOne({
      where: { id: priceUpdateId, user: { id: userId } },
      relations: ['listing', 'listing.account'],
    });
    if (!original) throw new NotFoundException('PriceUpdate não encontrado');
    if (original.status !== 'success' || original.origin === 'rollback') {
      throw new BadRequestException('Só é possível fazer rollback de pushes que foram aplicados com sucesso.');
    }

    const attempts = (await this.priceUpdateRepo.find({
      where: { rollbackOf: { id: original.id }, user: { id: userId } },
      order: { createdAt: 'ASC' },
    })) ?? [];
    const succeeded = attempts.find((attempt) => attempt.status === 'success');
    if (succeeded) return succeeded;
    const now = Date.now();
    const inFlight = attempts.find((attempt) =>
      attempt.status === 'pending' &&
      now - new Date(attempt.createdAt ?? now).getTime() < STALE_PENDING_MS);
    if (inFlight) {
      throw new ConflictException('Já existe um rollback em andamento para este preço.');
    }
    if (attempts.length >= MAX_ROLLBACK_ATTEMPTS) {
      throw new ConflictException('Limite de tentativas de rollback atingido; revise o calendário na Stays.');
    }

    return this.pushPrice(userId, {
      requestId: `rollback:${original.id}:${attempts.length + 1}`,
      rollbackOfId: original.id,
      listingId: original.listing.id,
      targetDate: original.targetDate,
      newPriceCents: original.previousPriceCents,
      previousPriceCents: original.newPriceCents,
      currency: original.currency,
      origin: 'rollback',
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }

  /**
   * Estado das operações automáticas de uma análise — base do requestId com
   * geração de rollback e contador de tentativas no auto-apply.
   */
  async getAutoApplyState(analiseId: string): Promise<AutoApplyOperationState> {
    const originals = (await this.priceUpdateRepo.find({
      where: { analise: { id: analiseId }, origin: 'ai_auto' },
      order: { createdAt: 'ASC' },
    })) ?? [];
    const successIds = originals.filter((pu) => pu.status === 'success').map((pu) => pu.id);
    const rollbacks = successIds.length
      ? ((await this.priceUpdateRepo.find({
          where: { rollbackOf: { id: In(successIds) }, status: 'success' },
          relations: ['rollbackOf'],
        })) ?? [])
      : [];
    const rolledBack = new Set(rollbacks.map((rb) => rb.rollbackOf?.id).filter(Boolean) as string[]);
    const lastRollbackAt = rollbacks.reduce<Date | null>((acc, rb) => {
      const at = rb.createdAt ? new Date(rb.createdAt) : null;
      return at && (!acc || at > acc) ? at : acc;
    }, null);
    const failures = originals.filter((pu) =>
      (pu.status === 'error' || pu.status === 'rejected') &&
      (!lastRollbackAt || (pu.createdAt && new Date(pu.createdAt) > lastRollbackAt)));
    const lastFailureAt = failures.reduce<Date | null>((acc, pu) => {
      const at = pu.createdAt ? new Date(pu.createdAt) : null;
      return at && (!acc || at > acc) ? at : acc;
    }, null);
    return {
      activeSuccess: successIds.some((id) => !rolledBack.has(id)),
      rollbackGeneration: rolledBack.size,
      lastRollbackAt,
      failedAttempts: failures.length,
      lastFailureAt,
    };
  }

  // =========== Helpers ===========

  private async recordPricingDecisionOutcome(
    priceUpdate: PriceUpdate,
    timestamps: { acceptedAt?: Date; appliedAt?: Date; rejectedAt?: Date } = {},
  ): Promise<void> {
    if (!this.pricingDecisionSnapshotRepo || !this.pricingCalculateService) return;

    const analiseId = this.entityId(priceUpdate.analise);
    if (!analiseId) return;

    try {
      const candidates = await this.pricingDecisionSnapshotRepo.find({
        where: { analisePreco: { id: analiseId } } as any,
        relations: ['analisePreco', 'priceUpdate'],
        order: { createdAt: 'DESC' },
        take: 25,
      });
      const snapshot =
        candidates.find((candidate) => candidate.targetDate === priceUpdate.targetDate) ??
        candidates[0] ??
        null;
      if (!snapshot) return;

      const analisePreco = (await this.loadAnaliseForOutcome(analiseId)) ?? snapshot.analisePreco;
      const recordedAt = new Date();
      const patch = this.pricingCalculateService.criarPatchOutcomeSnapshotDecisao({
        snapshot,
        priceUpdate: { ...priceUpdate, analise: analisePreco ?? priceUpdate.analise } as PriceUpdate,
        analisePreco: analisePreco ?? priceUpdate.analise,
        acceptedAt: timestamps.acceptedAt ?? priceUpdate.createdAt ?? recordedAt,
        appliedAt: timestamps.appliedAt,
        rejectedAt: timestamps.rejectedAt,
        recordedAt,
        source: 'price_update',
        sourceDetail: priceUpdate.origin,
      });

      Object.assign(snapshot, patch);
      await this.pricingDecisionSnapshotRepo.save(snapshot);
    } catch (error) {
      this.logger.warn(
        `Falha ao registrar outcome em PricingDecisionSnapshot para PriceUpdate ${priceUpdate.id}: ${(error as Error).message}`,
      );
    }
  }

  private async loadAnaliseForOutcome(analiseId: string): Promise<AnalisePreco | null> {
    if (!this.analiseRepo) return null;
    return this.analiseRepo.findOne({
      where: { id: analiseId },
      relations: ['endereco', 'endereco.list', 'evento', 'usuarioProprietario'],
    });
  }

  private entityId(entity?: { id?: string | null } | null): string | null {
    return entity?.id ?? null;
  }

  private accountCredentials(account: StaysAccount): StaysCredentials {
    return { clientId: account.clientId, clientSecret: account.accessToken, accountSlug: account.apiAccountSlug ?? null };
  }

  /** Destino resolvido (base URL) ou null se não configurado/malformado. Nunca lança. */
  private targetFor(accountSlug: string | null): string | null {
    try {
      return resolveStaysApiBaseUrl(accountSlug);
    } catch {
      return null;
    }
  }

  private normalizeSlugInput(raw?: string | null): string | null {
    const value = raw?.trim().toLowerCase();
    if (!value) return null;
    try {
      return sanitizeStaysAccountSlug(value);
    } catch {
      throw new BadRequestException(
        'Identificador da conta Stays inválido. Use só o nome da conta (ex.: "minhaconta" de minhaconta.stays.net).',
      );
    }
  }

  private failureThreshold(): number {
    const raw = Number(process.env.STAYS_ACCOUNT_ERROR_THRESHOLD);
    return Number.isInteger(raw) && raw >= 1 && raw <= 50 ? raw : 3;
  }

  /**
   * Só derruba a conta (status=error) em falha de autenticação (401/403) ou em
   * falhas duras repetidas. Timeout/5xx/429 mantêm a conta ativa: a operação é
   * repetida depois (auto-apply com backoff; manual pelo usuário).
   */
  private async registerProviderFailure(account: StaysAccount, err: unknown): Promise<void> {
    const message = err instanceof StaysConnectorError ? err.message : 'Stays operation failed';
    account.lastErrorAt = new Date();
    account.lastErrorMessage = message.slice(0, 255);
    if (isStaysAuthError(err)) {
      account.status = 'error';
    } else if (err instanceof StaysConnectorError && (err.kind === 'contract' || err.kind === 'config')) {
      account.consecutiveFailures = (account.consecutiveFailures ?? 0) + 1;
      if (account.consecutiveFailures >= this.failureThreshold()) account.status = 'error';
    }
    try {
      await this.accountRepo.save(account);
    } catch (saveErr) {
      this.logger.warn(`Falha ao registrar erro da conta Stays ${account.id}: ${(saveErr as Error).message}`);
    }
  }

  private async registerProviderSuccess(account: StaysAccount): Promise<void> {
    if (!account.consecutiveFailures) return;
    account.consecutiveFailures = 0;
    await this.accountRepo.save(account);
  }

  private toHttpError(err: unknown): unknown {
    if (!(err instanceof StaysConnectorError)) return err;
    if (err.kind === 'auth') {
      return new BadRequestException('A Stays recusou as credenciais. Reconecte a conta.');
    }
    if (err.kind === 'transient') {
      return new ServiceUnavailableException('A Stays não respondeu agora. Tente novamente em instantes.');
    }
    return new BadGatewayException(err.message);
  }

  private async assertAnalysisOwnership(userId: string, listing: StaysListing, analysisId?: string): Promise<void> {
    if (!analysisId) return;
    const propertyId = listing.propriedade?.id;
    if (!propertyId || !this.analiseRepo) {
      throw new BadRequestException('Vincule o imóvel Urban antes de aplicar uma análise de preço.');
    }
    const analysis = await this.analiseRepo.findOne({
      where: { id: analysisId, usuarioProprietario: { id: userId }, endereco: { list: { id: propertyId } } },
      relations: ['usuarioProprietario', 'endereco', 'endereco.list'],
    });
    if (!analysis || analysis.usuarioProprietario?.id !== userId || analysis.endereco?.list?.id !== propertyId) {
      throw new NotFoundException('Análise não encontrada para este usuário e imóvel.');
    }
  }

  private assertStaysReadiness(options: { requireEncryptionKey?: boolean; accountSlug?: string | null } = {}) {
    const requireEncryptionKey = options.requireEncryptionKey ?? true;
    const missing = [
      !options.accountSlug && !process.env.STAYS_API_BASE_URL ? 'STAYS_API_BASE_URL' : '',
      requireEncryptionKey && !process.env.STAYS_TOKEN_ENCRYPTION_KEY
        ? 'STAYS_TOKEN_ENCRYPTION_KEY'
        : '',
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new BadRequestException(
        `Integração Stays em beta privado bloqueada. Configure ${missing.join(', ')} antes de conectar ou enviar dados reais.`,
      );
    }
  }

  private normalizeUserAgent(userAgent?: string | string[]): string | null {
    const raw = Array.isArray(userAgent) ? userAgent.join(' ') : userAgent;
    return raw?.slice(0, 255) ?? null;
  }

  private buildIdempotencyKey(listingId: string, date: string, priceCents: number,
    operation?: { id: string; accountId: string; origin: string }): string {
    // Clientes legados mantêm replay do recibo. Decisões novas mandam requestId.
    // UUID interno do listing e namespace da conta evitam colisão entre contas.
    const raw = operation ? `${operation.accountId}|${operation.origin}|${operation.id}` : `${listingId}|${date}|${priceCents}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 48);
  }

  private assertSameOperation(record: PriceUpdate, listing: StaysListing, input: PushPriceInput, currency: string): void {
    if (!input.requestId) return;
    if (record.listing?.id !== listing.id || record.targetDate !== input.targetDate ||
        record.newPriceCents !== input.newPriceCents || record.previousPriceCents !== input.previousPriceCents ||
        record.currency !== currency || record.origin !== input.origin ||
        (record.analise?.id ?? null) !== (input.analisePrecoId ?? null)) {
      throw new ConflictException('requestId já utilizado para uma operação diferente.');
    }
  }

  private assertValidPushInput(input: PushPriceInput): void {
    if (!this.isValidTargetDate(input.targetDate)) {
      throw new BadRequestException('targetDate deve estar no formato YYYY-MM-DD.');
    }
    if (!Number.isInteger(input.newPriceCents) || input.newPriceCents <= 0) {
      throw new BadRequestException('newPriceCents deve ser um inteiro positivo.');
    }
    if (!Number.isInteger(input.previousPriceCents) || input.previousPriceCents <= 0) {
      throw new BadRequestException('previousPriceCents deve ser um inteiro positivo.');
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    const candidate = error as { code?: string; errno?: number; message?: string };
    return (
      candidate?.code === 'ER_DUP_ENTRY' ||
      candidate?.errno === 1062 ||
      /duplicate entry|unique constraint/i.test(candidate?.message ?? '')
    );
  }

  private isValidTargetDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }

  private tokens(text: string): Set<string> {
    const stop = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'apto', 'apartamento', 'casa', 'rua', 'av', 'avenida']);
    return new Set(
      text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 2 && !stop.has(token)),
    );
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (!a.size || !b.size) return 0;
    let shared = 0;
    for (const token of a) if (b.has(token)) shared++;
    return shared / (a.size + b.size - shared);
  }

  private evaluateVariationCaps(
    previousCents: number,
    newCents: number,
    account: StaysAccount,
  ): { diffCents: number; diffPercent: number | null; blockers: PricePreviewIssue[] } {
    const diffCents = newCents - previousCents;
    if (previousCents <= 0) {
      return { diffCents, diffPercent: null, blockers: [] };
    }

    const diffPercent = (diffCents / previousCents) * 100;
    const blockers: PricePreviewIssue[] = [];

    if (diffPercent > account.maxIncreasePercent) {
      blockers.push({
        code: 'increase_cap_exceeded',
        message: `Variação de +${diffPercent.toFixed(1)}% excede o teto de +${account.maxIncreasePercent}% configurado para a conta.`,
      });
    }

    if (diffPercent < -account.maxDecreasePercent) {
      blockers.push({
        code: 'decrease_cap_exceeded',
        message: `Variação de ${diffPercent.toFixed(1)}% excede o teto de -${account.maxDecreasePercent}% configurado para a conta.`,
      });
    }

    return { diffCents, diffPercent, blockers };
  }

  private enforceVariationCaps(
    previousCents: number,
    newCents: number,
    account: StaysAccount,
  ): void {
    const variation = this.evaluateVariationCaps(previousCents, newCents, account);
    const blocker = variation.blockers[0];
    if (blocker) throw new BadRequestException(blocker.message);
  }
}
