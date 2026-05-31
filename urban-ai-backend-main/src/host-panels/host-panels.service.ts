import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Between, DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import { Address } from '../entities/addresses.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { AskUrbanMessage, AskUrbanCitation } from '../entities/ask-urban-message.entity';
import { Event as EventEntity } from '../entities/events.entity';
import { List } from '../entities/list.entity';
import { OccupancyHistory } from '../entities/occupancy-history.entity';
import { PortfolioActionItem, PortfolioActionItemStatus } from '../entities/portfolio-action-item.entity';
import { PortfolioActionRun, PortfolioActionRunSummary } from '../entities/portfolio-action-run.entity';
import { PortfolioDailyPriceOverride } from '../entities/portfolio-daily-price-override.entity';
import {
  PortfolioPricingStrategy,
  PortfolioPropertySetting,
} from '../entities/portfolio-property-setting.entity';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import {
  PricingRuleConfig,
  PricingRuleConfigItem,
  PricingRuleType,
} from '../entities/pricing-rule-config.entity';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';

type DateRange = { from: string; to: string; dates: string[] };

type AskUsageReason =
  | null
  | 'no_active_subscription'
  | 'subscription_expired'
  | 'plan_not_allowed'
  | 'quota_exceeded'
  | 'hard_cap_exceeded';

type AskEntitlement = {
  plan: string;
  planAllowed: boolean;
  reason: Exclude<AskUsageReason, 'quota_exceeded' | 'hard_cap_exceeded'>;
};

type AskUsagePayload = {
  used: number;
  quota: number;
  hardCap: number;
  canUse: boolean;
  plan: string;
  reason: AskUsageReason;
};

type PortfolioBulkActionInput = {
  propertyIds: string[];
  action: string;
  payload?: Record<string, unknown>;
  dates?: string[];
  from?: string;
  to?: string;
};

type PortfolioResolvedTargets = {
  explicit: boolean;
  dates: string[];
  byAddress: Map<string, string[]>;
  keys: Set<string>;
};

type PortfolioActionPreviewItem = {
  propertyId: string;
  propertyName: string;
  date: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  status: 'planned' | PortfolioActionItemStatus;
  estimatedLift: number;
  reason?: string;
};

type PortfolioActionPreview = {
  action: string;
  items: PortfolioActionPreviewItem[];
  summary: PortfolioActionRunSummary;
};

type PortfolioStrategyMetadata = {
  strategy: PortfolioPricingStrategy;
  source: 'request' | 'property_default' | 'user_default' | 'fallback';
  adjustmentPercent: number;
  multiplier: number;
  rule: string;
};

const MS_PER_DAY = 86_400_000;
const ASK_ACCESS_STATUSES = ['active', 'trialing', 'alpha'];
const DEFAULT_ASK_ALLOWED_PLANS = ['profissional', 'escala', 'alpha'];

const PRICING_RULE_TYPES: PricingRuleType[] = [
  'weekend_uplift',
  'weekday_discount',
  'gap_night_filler',
  'last_minute',
  'length_of_stay',
  'min_stay_dynamic',
  'occupancy_floor',
  'event_uplift',
];

const DEFAULT_PRICING_RULES: PricingRuleConfigItem[] = [
  {
    type: 'weekend_uplift',
    enabled: true,
    params: { percent: 15 },
    label: 'Uplift de fim de semana',
    description: 'Aumenta o preço base em sexta e sábado, quando a demanda costuma ser maior.',
  },
  {
    type: 'weekday_discount',
    enabled: true,
    params: { percent: -8 },
    label: 'Desconto em dias úteis lentos',
    description: 'Aplica desconto suave em segunda, terça e quarta para puxar reservas.',
  },
  {
    type: 'gap_night_filler',
    enabled: true,
    params: { percent: -20, maxNights: 2 },
    label: 'Preenchimento de lacunas',
    description: 'Reduz o preço quando há lacunas curtas entre noites reservadas.',
  },
  {
    type: 'last_minute',
    enabled: true,
    params: { percent: -12, daysBefore: 3 },
    label: 'Última hora',
    description: 'Baixa o preço quando a data está muito próxima e ainda sem reserva registrada.',
  },
  {
    type: 'length_of_stay',
    enabled: false,
    params: { percent: -10, minNights: 7 },
    label: 'Desconto para estadia longa',
    description: 'Regra por reserva; não altera o preview diário isolado.',
  },
  {
    type: 'min_stay_dynamic',
    enabled: false,
    params: { baseMinNights: 2, highMinNights: 3, occupancyThreshold: 70 },
    label: 'Estadia mínima dinâmica',
    description: 'Regra operacional de mínimo de noites; não altera preço no preview.',
  },
  {
    type: 'occupancy_floor',
    enabled: true,
    params: { minPrice: 180 },
    label: 'Piso de preço',
    description: 'Impede que regras combinadas baixem o preço abaixo do piso definido.',
  },
  {
    type: 'event_uplift',
    enabled: true,
    params: { percent: 25, radiusKm: 3 },
    label: 'Uplift por evento de alto impacto',
    description: 'Aumenta o preço quando há evento relevante perto do imóvel.',
  },
];

@Injectable()
export class HostPanelsService {
  constructor(
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(List) private readonly listRepo: Repository<List>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(EventEntity) private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(AnalisePreco) private readonly analiseRepo: Repository<AnalisePreco>,
    @InjectRepository(PriceSnapshot) private readonly snapshotRepo: Repository<PriceSnapshot>,
    @InjectRepository(OccupancyHistory) private readonly occupancyRepo: Repository<OccupancyHistory>,
    @InjectRepository(PricingRuleConfig) private readonly pricingRuleRepo: Repository<PricingRuleConfig>,
    @InjectRepository(AskUrbanMessage) private readonly askRepo: Repository<AskUrbanMessage>,
    @InjectRepository(PortfolioPropertySetting) private readonly portfolioSettingRepo: Repository<PortfolioPropertySetting>,
    @InjectRepository(PortfolioDailyPriceOverride) private readonly portfolioOverrideRepo: Repository<PortfolioDailyPriceOverride>,
    @InjectRepository(PortfolioActionRun) private readonly portfolioRunRepo: Repository<PortfolioActionRun>,
    @InjectRepository(PortfolioActionItem) private readonly portfolioItemRepo: Repository<PortfolioActionItem>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async portfolioCalendar(
    userId: string,
    input: { from?: string; to?: string; propertyIds?: string; strategy?: string },
  ) {
    const range = this.resolveRange(input.from, input.to, 60, 360);
    const propertyIds = this.csv(input.propertyIds);
    const addresses = await this.getOwnedAddresses(userId, propertyIds);
    const addressIds = addresses.map((address) => address.id);
    const [settingsByAddress, overridesByAddressDate, user] = await Promise.all([
      this.portfolioSettingsByAddress(addressIds),
      this.portfolioOverridesByAddressDate(userId, addressIds, range),
      this.getUser(userId),
    ]);
    const requestedStrategy = this.normalizeStrategy(String(input.strategy ?? ''));

    const analyses = addressIds.length
      ? await this.analiseRepo
          .createQueryBuilder('analysis')
          .innerJoinAndSelect('analysis.endereco', 'address')
          .leftJoinAndSelect('analysis.evento', 'event')
          .innerJoin('analysis.usuarioProprietario', 'owner')
          .where('owner.id = :userId', { userId })
          .andWhere('address.id IN (:...addressIds)', { addressIds })
          .andWhere('event.dataInicio BETWEEN :from AND :to', {
            from: this.startDate(range.from),
            to: this.endDate(range.to),
          })
          .andWhere('event.duplicateOfEventId IS NULL')
          .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
          .orderBy('analysis.criadoEm', 'DESC')
          .getMany()
      : [];

    const byAddressDate = new Map<string, AnalisePreco>();
    for (const analysis of analyses) {
      const addressId = analysis.endereco?.id;
      const date = this.dateOnly(analysis.evento?.dataInicio);
      if (!addressId || !date) continue;
      const key = `${addressId}:${date}`;
      const current = byAddressDate.get(key);
      if (!current || Number(analysis.precoSugerido) > Number(current.precoSugerido)) {
        byAddressDate.set(key, analysis);
      }
    }

    return {
      range: { from: range.from, to: range.to, days: range.dates.length },
      properties: addresses.map((address) => {
        const basePrice = this.resolveBasePrice(address.list);
        const storedStrategy = settingsByAddress.get(address.id)?.strategy;
        const strategyMeta = this.resolvePortfolioStrategyMetadata(
          requestedStrategy,
          storedStrategy,
          this.normalizeStrategy(String(user.pricingStrategy ?? '')),
        );
        return {
          propertyId: address.id,
          name: address.list?.titulo ?? '(sem nome)',
          thumbnail: address.list?.pictureUrl ?? null,
          strategy: strategyMeta.strategy,
          strategyMetadata: strategyMeta,
          days: range.dates.map((date) => {
            const analysis = byAddressDate.get(`${address.id}:${date}`);
            const override = overridesByAddressDate.get(`${address.id}:${date}`);
            const currentPrice = override ? this.roundMoney(override.price) : basePrice;
            const suggestedPrice = analysis
              ? this.applyPortfolioStrategy(analysis.precoSugerido, strategyMeta.strategy)
              : null;
            const lift = suggestedPrice != null ? Math.max(0, suggestedPrice - currentPrice) : 0;
            return {
              date,
              sugestao: suggestedPrice,
              sugestaoOriginal: analysis ? this.roundMoney(analysis.precoSugerido) : null,
              atual: currentPrice,
              base: basePrice,
              override: override
                ? {
                    id: override.id,
                    price: this.roundMoney(override.price),
                    source: override.source,
                    updatedAt: this.toIso(override.updatedAt),
                  }
                : null,
              strategyApplied: analysis
                ? {
                    ...strategyMeta,
                    originalPrice: this.roundMoney(analysis.precoSugerido),
                    adjustedPrice: suggestedPrice,
                  }
                : strategyMeta,
              lift,
              risk: this.portfolioRisk(currentPrice, suggestedPrice, analysis?.evento),
              confidence: this.portfolioConfidence(analysis?.evento),
              evento: analysis?.evento
                ? {
                    id: analysis.evento.id,
                    nome: analysis.evento.nome,
                    impacto: this.eventImpact(analysis.evento),
                  }
                : null,
            };
          }),
        };
      }),
    };
  }

  async portfolioOpportunities(
    userId: string,
    input: { from?: string; to?: string; propertyIds?: string; strategy?: string },
  ) {
    const calendar = await this.portfolioCalendar(userId, input);
    const opportunities = calendar.properties
      .flatMap((property: any) =>
        property.days
          .filter((day: any) => Number(day.lift ?? 0) > 0)
          .map((day: any) => ({
            id: `${property.propertyId}:${day.date}`,
            propertyId: property.propertyId,
            propertyName: property.name,
            date: day.date,
            currentPrice: day.atual,
            suggestedPrice: day.sugestao,
            lift: day.lift,
            risk: day.risk,
            confidence: day.confidence,
            event: day.evento,
            strategyApplied: day.strategyApplied,
          })),
      )
      .sort((a: any, b: any) => b.lift - a.lift)
      .slice(0, 50);

    const totalLift = opportunities.reduce((sum: number, item: any) => sum + Number(item.lift ?? 0), 0);
    const riskScore = opportunities.reduce((sum: number, item: any) => {
      if (item.risk === 'alta') return sum + 3;
      if (item.risk === 'media') return sum + 2;
      return sum + 1;
    }, 0);

    return {
      range: calendar.range,
      summary: {
        opportunities: opportunities.length,
        estimatedLift: this.roundMoney(totalLift),
        affectedProperties: new Set(opportunities.map((item: any) => item.propertyId)).size,
        averageRisk: opportunities.length ? Number((riskScore / opportunities.length).toFixed(1)) : 0,
        topLift: opportunities[0]?.lift ?? 0,
      },
      opportunities,
    };
  }

  async simulatePortfolioAction(userId: string, input: PortfolioBulkActionInput) {
    const preview = await this.buildPortfolioActionPreview(userId, input);
    return { simulated: true, ...preview };
  }

  async portfolioActionRuns(userId: string, input: { limit?: number; includeItems?: boolean; action?: string }) {
    const limit = Math.max(1, Math.min(50, Number(input.limit ?? 10) || 10));
    const where: any = { user: { id: userId } };
    if (input.action) where.action = input.action;
    const runs = await this.portfolioRunRepo.find({
      where,
      relations: input.includeItems ? ['items', 'items.address'] : [],
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return {
      runs: runs.map((run) => ({
        id: run.id,
        auditLogId: run.id,
        actionRunId: run.id,
        action: run.action,
        status: run.status,
        selectedPropertyIds: run.selectedPropertyIds ?? [],
        targetDates: run.targetDates ?? [],
        payload: run.payload ?? {},
        summary: run.summary,
        applied: Number(run.summary?.applied ?? 0),
        failed: Number(run.summary?.failed ?? 0),
        createdAt: this.toIso(run.createdAt),
        completedAt: this.toIso(run.completedAt),
        items: input.includeItems
          ? (run.items ?? []).map((item) => ({
              id: item.id,
              propertyId: item.propertyId ?? item.address?.id ?? null,
              propertyName: item.address?.list?.titulo ?? null,
              date: item.targetDate,
              action: item.action,
              status: item.status,
              before: item.before,
              after: item.after,
              estimatedLift: this.roundMoney(item.estimatedLift) ?? 0,
              errorMessage: item.errorMessage,
              metadata: item.metadata,
              createdAt: this.toIso(item.createdAt),
            }))
          : undefined,
      })),
    };
  }

  async portfolioBulkAction(userId: string, input: PortfolioBulkActionInput) {
    const requestedIds = Array.from(new Set(input.propertyIds ?? [])).filter(Boolean);
    if (requestedIds.length === 0) {
      throw new BadRequestException('propertyIds e obrigatorio');
    }

    const user = await this.getUser(userId);
    const addresses = await this.getOwnedAddresses(userId, requestedIds);
    const foundIds = new Set(addresses.flatMap((address) => [address.id, address.list?.id].filter(Boolean)));
    const failed = requestedIds
      .filter((id) => !foundIds.has(id))
      .map((propertyId) => ({ propertyId, reason: 'Imóvel não encontrado ou sem permissão' }));
    const preview = await this.buildPortfolioActionPreview(userId, input, addresses);
    const run = await this.portfolioRunRepo.save(
      this.portfolioRunRepo.create({
        user,
        action: input.action,
        status: 'running',
        selectedPropertyIds: requestedIds,
        targetDates: this.previewTargetDates(preview),
        payload: input.payload ?? {},
        summary: preview.summary,
      }),
    );

    if (input.action === 'set-base-price') {
      const price = Number(input.payload?.price ?? input.payload?.basePrice ?? input.payload?.manualDailyPrice);
      if (!Number.isFinite(price) || price <= 0) {
        throw new BadRequestException('payload.price deve ser um número maior que zero');
      }
      let applied = 0;
      for (const address of addresses) {
        if (!address.list) {
          failed.push({ propertyId: address.id, reason: 'Imóvel sem listing associado' });
          continue;
        }
        address.list.manualDailyPrice = price;
        address.list.dailyPrice = price;
        address.list.raw = price;
        address.list.priceText = `R$${price.toFixed(2)}`;
        address.list.pricingInputSource = 'portfolio_bulk_action';
        address.list.pricingInputsUpdatedAt = new Date();
        await this.listRepo.save(address.list);
        applied += 1;
      }
      return this.finishPortfolioRun(run, user, addresses, preview, applied, failed);
    }

    if (input.action === 'apply-strategy') {
      const strategy = String(input.payload?.strategy ?? '').trim();
      const mapped = this.normalizeStrategy(strategy);
      if (!mapped) throw new BadRequestException('payload.strategy inválido');
      const existing = await this.portfolioSettingsByAddress(addresses.map((address) => address.id));
      for (const address of addresses) {
        const setting =
          existing.get(address.id) ??
          this.portfolioSettingRepo.create({
            user,
            address,
          });
        setting.strategy = mapped;
        setting.user = user;
        setting.address = address;
        await this.portfolioSettingRepo.save(setting);
      }
      return this.finishPortfolioRun(run, user, addresses, preview, addresses.length, failed);
    }

    if (input.action === 'set-date-price') {
      const price = Number(input.payload?.price ?? input.payload?.datePrice ?? input.payload?.manualDailyPrice);
      if (!Number.isFinite(price) || price <= 0) {
        throw new BadRequestException('payload.price deve ser um número maior que zero');
      }
      const targets = this.resolveActionTargets(input, addresses);
      const dates = targets.dates;
      if (!dates.length) throw new BadRequestException('dates e obrigatorio para set-date-price');
      let applied = 0;
      const targetAddressIds = Array.from(targets.byAddress.keys());
      const existing = await this.portfolioOverridesByAddressDate(userId, targetAddressIds, {
        from: dates[0],
        to: dates[dates.length - 1],
        dates,
      });
      for (const address of addresses) {
        const addressDates = targets.byAddress.get(address.id) ?? [];
        for (const date of addressDates) {
          const override =
            existing.get(`${address.id}:${date}`) ??
            this.portfolioOverrideRepo.create({
              user,
              address,
              targetDate: date,
            });
          override.price = price;
          override.source = 'portfolio_manual';
          override.actionRun = run;
          override.user = user;
          override.address = address;
          await this.portfolioOverrideRepo.save(override);
          applied += 1;
        }
      }
      return this.finishPortfolioRun(run, user, addresses, preview, applied, failed);
    }

    if (input.action === 'accept-suggestions') {
      const targets = this.resolveActionTargets(input, addresses);
      const addressIds = targets.explicit ? Array.from(targets.byAddress.keys()) : addresses.map((address) => address.id);
      const relevantAddresses = targets.explicit ? addresses.filter((address) => targets.byAddress.has(address.id)) : addresses;
      const dates = targets.dates;
      const rawPending = addressIds.length
        ? await this.analiseRepo
            .createQueryBuilder('analysis')
            .innerJoinAndSelect('analysis.endereco', 'address')
            .leftJoinAndSelect('analysis.evento', 'event')
            .innerJoin('analysis.usuarioProprietario', 'owner')
            .where('owner.id = :userId', { userId })
            .andWhere('address.id IN (:...addressIds)', { addressIds })
            .andWhere('analysis.aceito = :accepted', { accepted: false })
            .andWhere('event.dataInicio >= :now', { now: new Date() })
            .andWhere(dates.length ? 'DATE(event.dataInicio) IN (:...dates)' : '1 = 1', { dates })
            .andWhere('event.duplicateOfEventId IS NULL')
            .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
            .getMany()
        : [];
      const pending = targets.explicit
        ? rawPending.filter((item) => {
            const date = this.dateOnly(item.evento?.dataInicio);
            return Boolean(date && targets.keys.has(`${item.endereco.id}:${date}`));
          })
        : rawPending;
      const settingsByAddress = await this.portfolioSettingsByAddress(addressIds);
      const userStrategy = this.normalizeStrategy(String(user.pricingStrategy ?? ''));
      const changedAddressIds = new Set<string>();
      for (const item of pending) {
        const strategyMeta = this.resolvePortfolioStrategyMetadata(
          null,
          settingsByAddress.get(item.endereco.id)?.strategy,
          userStrategy,
        );
        const appliedPrice =
          this.applyPortfolioStrategy(item.precoSugerido, strategyMeta.strategy) ??
          this.roundMoney(item.precoSugerido) ??
          0;
        item.aceito = true;
        item.status = 'applied_manual';
        item.aceitoEm = new Date();
        item.rejeitadoEm = null;
        item.expiradoEm = null;
        item.precoAplicado = appliedPrice;
        item.aplicadoEm = new Date();
        item.origemAplicacao = 'internal_dashboard';
        changedAddressIds.add(item.endereco.id);
      }
      if (pending.length) await this.analiseRepo.save(pending);
      for (const address of relevantAddresses) {
        if (!changedAddressIds.has(address.id)) {
          failed.push({ propertyId: address.id, reason: 'Sem sugestões futuras pendentes' });
        }
      }
      return this.finishPortfolioRun(run, user, addresses, preview, pending.length, failed);
    }

    throw new BadRequestException('action invalida');
  }

  async pace(userId: string, input: { propertyId?: string; targetDateFrom?: string; targetDateTo?: string }) {
    const range = this.resolveRange(input.targetDateFrom, input.targetDateTo, 60, 180);
    const addresses = input.propertyId
      ? [await this.getOwnedAddress(userId, input.propertyId)]
      : await this.getOwnedAddresses(userId);
    const listIds = addresses.map((address) => address.list?.id).filter(Boolean);
    const records = await this.findOccupancy(listIds, range.from, range.to);
    const history = await this.findOccupancy(
      listIds,
      this.dateOnly(new Date(this.startDate(range.from).getTime() - 90 * MS_PER_DAY)),
      this.dateOnly(new Date(this.startDate(range.from).getTime() - MS_PER_DAY)),
    );
    const expectedByWeekday = this.expectedOccupancyByWeekday(history);
    const eventsByDate = await this.eventsByDateForAddresses(addresses, range.from, range.to);

    return {
      points: range.dates.map((date) => {
        const dayRecords = records.filter((record) => record.date === date);
        const denominator = dayRecords.filter((record) => record.status !== 'unknown').length;
        const booked = denominator
          ? Math.round((dayRecords.filter((record) => record.status === 'booked').length / denominator) * 100)
          : 0;
        const weekday = this.startDate(date).getDay();
        return {
          date,
          booked,
          expected: expectedByWeekday.get(weekday) ?? 0,
          eventLabel: eventsByDate.get(date)?.[0]?.nome ?? null,
        };
      }),
    };
  }

  async getPricingRules(userId: string, propertyId: string) {
    const address = await this.getOwnedAddress(userId, propertyId);
    const config = await this.pricingRuleRepo.findOne({
      where: { address: { id: address.id } },
      relations: ['address'],
    });
    return {
      propertyId: address.id,
      rules: config?.rules?.length ? config.rules : this.cloneDefaultRules(),
      updatedAt: this.toIso(config?.updatedAt),
    };
  }

  async savePricingRules(userId: string, propertyId: string, rules: PricingRuleConfigItem[]) {
    const address = await this.getOwnedAddress(userId, propertyId);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const normalizedRules = this.normalizeRules(rules);
    let config = await this.pricingRuleRepo.findOne({ where: { address: { id: address.id } } });
    if (!config) {
      config = this.pricingRuleRepo.create({ address, user, rules: normalizedRules });
    } else {
      config.rules = normalizedRules;
      config.user = user;
      config.address = address;
    }
    const saved = await this.pricingRuleRepo.save(config);
    return {
      propertyId: address.id,
      rules: saved.rules,
      updatedAt: this.toIso(saved.updatedAt),
    };
  }

  async previewPricingRules(userId: string, propertyId: string, rules: PricingRuleConfigItem[]) {
    const address = await this.getOwnedAddress(userId, propertyId);
    const normalizedRules = this.normalizeRules(rules);
    return { days: await this.buildPricingPreview(address, normalizedRules) };
  }

  async copyPricingRules(userId: string, targetId: string, sourceId: string) {
    const [target, source] = await Promise.all([
      this.getOwnedAddress(userId, targetId),
      this.getOwnedAddress(userId, sourceId),
    ]);
    const sourceConfig = await this.pricingRuleRepo.findOne({ where: { address: { id: source.id } } });
    return this.savePricingRules(userId, target.id, sourceConfig?.rules?.length ? sourceConfig.rules : this.cloneDefaultRules());
  }

  async marketIntel(userId: string, propertyId: string, input: { from?: string; to?: string }) {
    const address = await this.getOwnedAddress(userId, propertyId);
    const range = this.resolveRange(input.from, input.to, 30, 90);
    const ownAdr = this.resolveBasePrice(address.list);
    const comparables = (await this.getComparableAddresses(userId, address)).slice(0, 10);
    const comparableRows = await this.buildComparableRows(address, comparables, range.from, range.to);
    const daily = await this.buildMarketDaily(address, comparables, range);
    const medianAdr = this.median(comparableRows.map((row) => row.medianAdr)) || 0;
    const ownOccupancy = await this.occupancyRate([address.list?.id].filter(Boolean), range.from, range.to);
    const medianOccupancy = this.median(comparableRows.map((row) => row.occupancy)) || 0;
    const percentile = comparableRows.length
      ? Math.round((comparableRows.filter((row) => row.medianAdr <= ownAdr).length / comparableRows.length) * 100)
      : 0;

    return {
      propertyId: address.id,
      neighborhood: address.bairro ?? address.list?.neighborhood ?? address.cidade ?? 'Não informado',
      percentile,
      percentileTrend30d: 0,
      comparablesCount: comparableRows.length,
      medianAdr,
      medianOccupancy,
      yourAdr: ownAdr,
      yourOccupancy: ownOccupancy,
      eventReactivity: await this.eventReactivity(userId, address.id, range.from, range.to),
      daily,
      comparables: comparableRows,
      updatedAt: new Date().toISOString(),
    };
  }

  async askUsage(userId: string) {
    const [used, entitlement] = await Promise.all([
      this.askRepo.count({
        where: {
          user: { id: userId },
          role: 'user',
          createdAt: MoreThanOrEqual(this.startOfToday()),
        },
      }),
      this.resolveAskEntitlement(userId),
    ]);
    return this.askUsagePayload(used, entitlement);
  }

  async askQuestion(userId: string, input: { question?: string; conversationId?: string }) {
    const question = String(input.question ?? '').trim();
    if (!question) throw new BadRequestException('question e obrigatoria');
    const usage = await this.askUsage(userId);
    this.ensureAskCanUse(usage);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const conversationId = input.conversationId || randomUUID();
    await this.askRepo.save(this.askRepo.create({ user, conversationId, role: 'user', content: question }));
    const answer = await this.buildAskAnswer(userId, question);
    const assistant = await this.askRepo.save(
      this.askRepo.create({
        user,
        conversationId,
        role: 'assistant',
        content: answer.content,
        citations: answer.citations,
      }),
    );
    return {
      messageId: assistant.id,
      conversationId,
      content: answer.content,
      citations: answer.citations,
      usage: this.askUsagePayload(usage.used + 1, {
        plan: usage.plan,
        planAllowed: true,
        reason: null,
      }),
    };
  }

  async askFeedback(userId: string, input: { messageId?: string; vote?: 'up' | 'down' }) {
    if (!input.messageId || !['up', 'down'].includes(String(input.vote))) {
      throw new BadRequestException('messageId e vote são obrigatórios');
    }
    const message = await this.askRepo.findOne({
      where: { id: input.messageId, user: { id: userId }, role: 'assistant' },
    });
    if (!message) throw new NotFoundException('Mensagem não encontrada');
    message.feedback = input.vote;
    await this.askRepo.save(message);
    return { ok: true };
  }

  private async buildPortfolioActionPreview(
    userId: string,
    input: PortfolioBulkActionInput,
    ownedAddresses?: Address[],
  ): Promise<PortfolioActionPreview> {
    const requestedIds = Array.from(new Set(input.propertyIds ?? [])).filter(Boolean);
    if (!requestedIds.length) throw new BadRequestException('propertyIds e obrigatorio');
    const addresses = ownedAddresses ?? (await this.getOwnedAddresses(userId, requestedIds));
    const addressIds = addresses.map((address) => address.id);
    const foundIds = new Set(addresses.flatMap((address) => [address.id, address.list?.id].filter(Boolean)));
    const items: PortfolioActionPreviewItem[] = requestedIds
      .filter((id) => !foundIds.has(id))
      .map((propertyId) => ({
        propertyId,
        propertyName: '(sem permissão)',
        date: null,
        before: null,
        after: null,
        status: 'failed',
        estimatedLift: 0,
        reason: 'Imóvel não encontrado ou sem permissão',
      }));

    if (input.action === 'apply-strategy') {
      const mapped = this.normalizeStrategy(String(input.payload?.strategy ?? ''));
      if (!mapped) throw new BadRequestException('payload.strategy inválido');
      const [settings, user] = await Promise.all([
        this.portfolioSettingsByAddress(addressIds),
        this.getUser(userId),
      ]);
      const userStrategy = this.normalizeStrategy(String(user.pricingStrategy ?? ''));
      for (const address of addresses) {
        const before = this.resolvePortfolioStrategyMetadata(null, settings.get(address.id)?.strategy, userStrategy);
        const after = this.resolvePortfolioStrategyMetadata(mapped, null, null);
        items.push({
          propertyId: address.id,
          propertyName: address.list?.titulo ?? '(sem nome)',
          date: null,
          before,
          after,
          status: 'planned',
          estimatedLift: 0,
        });
      }
      return { action: input.action, items, summary: this.portfolioPreviewSummary(items) };
    }

    if (input.action === 'set-base-price') {
      const price = Number(input.payload?.price ?? input.payload?.basePrice ?? input.payload?.manualDailyPrice);
      if (!Number.isFinite(price) || price <= 0) {
        throw new BadRequestException('payload.price deve ser um número maior que zero');
      }
      for (const address of addresses) {
        const beforePrice = this.resolveBasePrice(address.list);
        items.push({
          propertyId: address.id,
          propertyName: address.list?.titulo ?? '(sem nome)',
          date: null,
          before: { price: beforePrice },
          after: { price },
          status: address.list ? 'planned' : 'failed',
          estimatedLift: 0,
          reason: address.list ? undefined : 'Imóvel sem listing associado',
        });
      }
      return { action: input.action, items, summary: this.portfolioPreviewSummary(items) };
    }

    if (input.action === 'set-date-price') {
      const price = Number(input.payload?.price ?? input.payload?.datePrice ?? input.payload?.manualDailyPrice);
      if (!Number.isFinite(price) || price <= 0) {
        throw new BadRequestException('payload.price deve ser um número maior que zero');
      }
      const targets = this.resolveActionTargets(input, addresses);
      const dates = targets.dates;
      if (!dates.length) throw new BadRequestException('dates e obrigatorio para set-date-price');
      const targetAddressIds = Array.from(targets.byAddress.keys());
      const overrides = await this.portfolioOverridesByAddressDate(userId, targetAddressIds, {
        from: dates[0],
        to: dates[dates.length - 1],
        dates,
      });
      for (const address of addresses) {
        const base = this.resolveBasePrice(address.list);
        const addressDates = targets.byAddress.get(address.id) ?? [];
        for (const date of addressDates) {
          const override = overrides.get(`${address.id}:${date}`);
          const current = override?.price ?? base;
          items.push({
            propertyId: address.id,
            propertyName: address.list?.titulo ?? '(sem nome)',
            date,
            before: {
              atual: this.roundMoney(current),
              source: override ? 'date_override' : 'base_price',
              overrideId: override?.id ?? null,
              basePrice: base,
            },
            after: {
              atual: this.roundMoney(price),
              source: 'date_override',
              basePrice: base,
            },
            status: 'planned',
            estimatedLift: Math.round(price - Number(current ?? 0)),
          });
        }
      }
      return { action: input.action, items, summary: this.portfolioPreviewSummary(items) };
    }

    if (input.action === 'accept-suggestions') {
      const targets = this.resolveActionTargets(input, addresses);
      const dates = targets.dates;
      const targetAddressIds = targets.explicit ? Array.from(targets.byAddress.keys()) : addressIds;
      const relevantAddresses = targets.explicit ? addresses.filter((address) => targets.byAddress.has(address.id)) : addresses;
      const rawPending = targetAddressIds.length
        ? await this.analiseRepo
            .createQueryBuilder('analysis')
            .innerJoinAndSelect('analysis.endereco', 'address')
            .leftJoinAndSelect('analysis.evento', 'event')
            .innerJoin('analysis.usuarioProprietario', 'owner')
            .where('owner.id = :userId', { userId })
            .andWhere('address.id IN (:...addressIds)', { addressIds: targetAddressIds })
            .andWhere('analysis.aceito = :accepted', { accepted: false })
            .andWhere('event.dataInicio >= :now', { now: new Date() })
            .andWhere(dates.length ? 'DATE(event.dataInicio) IN (:...dates)' : '1 = 1', { dates })
            .andWhere('event.duplicateOfEventId IS NULL')
            .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
            .getMany()
        : [];
      const pending = targets.explicit
        ? rawPending.filter((analysis) => {
            const date = this.dateOnly(analysis.evento?.dataInicio);
            return Boolean(date && targets.keys.has(`${analysis.endereco?.id}:${date}`));
          })
        : rawPending;
      const [settings, user] = await Promise.all([
        this.portfolioSettingsByAddress(targetAddressIds),
        this.getUser(userId),
      ]);
      const userStrategy = this.normalizeStrategy(String(user.pricingStrategy ?? ''));
      const addressById = new Map(addresses.map((address) => [address.id, address]));
      for (const analysis of pending) {
        const address = addressById.get(analysis.endereco?.id);
        if (!address) continue;
        const date = this.dateOnly(analysis.evento?.dataInicio);
        const strategyMeta = this.resolvePortfolioStrategyMetadata(
          null,
          settings.get(address.id)?.strategy,
          userStrategy,
        );
        const current = this.roundMoney(analysis.seuPrecoAtual ?? this.resolveBasePrice(address.list));
        const suggested = this.applyPortfolioStrategy(analysis.precoSugerido, strategyMeta.strategy);
        items.push({
          propertyId: address.id,
          propertyName: address.list?.titulo ?? '(sem nome)',
          date,
          before: {
            analysisId: analysis.id,
            status: analysis.status,
            accepted: analysis.aceito,
            price: current,
          },
          after: {
            status: 'applied_manual',
            accepted: true,
            price: suggested,
            origin: 'internal_dashboard',
            applicationStatus: 'internal/applied_manual',
            strategyApplied: strategyMeta,
          },
          status: 'planned',
          estimatedLift: suggested != null && current != null ? Math.max(0, suggested - current) : 0,
        });
      }
      for (const address of relevantAddresses) {
        if (!items.some((item) => item.propertyId === address.id)) {
          items.push({
            propertyId: address.id,
            propertyName: address.list?.titulo ?? '(sem nome)',
            date: null,
            before: null,
            after: null,
            status: 'skipped',
            estimatedLift: 0,
            reason: 'Sem sugestões futuras pendentes',
          });
        }
      }
      return { action: input.action, items, summary: this.portfolioPreviewSummary(items) };
    }

    throw new BadRequestException('action invalida');
  }

  private async finishPortfolioRun(
    run: PortfolioActionRun,
    user: User,
    addresses: Address[],
    preview: PortfolioActionPreview,
    applied: number,
    failed: Array<{ propertyId: string; reason: string }>,
  ) {
    const addressById = new Map(addresses.map((address) => [address.id, address]));
    const savedItems = preview.items.map((item) => {
      const address = addressById.get(item.propertyId);
      const actualStatus: PortfolioActionItemStatus =
        item.status === 'planned' ? 'applied' : item.status;
      return this.portfolioItemRepo.create({
        run,
        user,
        address: address ?? null,
        propertyId: item.propertyId,
        targetDate: item.date,
        action: preview.action,
        status: actualStatus,
        before: item.before,
        after: item.after,
        metadata: { propertyName: item.propertyName, reason: item.reason ?? null },
        estimatedLift: item.estimatedLift,
        errorMessage: item.reason ?? null,
      });
    });
    if (savedItems.length) await this.portfolioItemRepo.save(savedItems);

    const skippedOrFailed = preview.items
      .filter((item) => item.status === 'skipped' || item.status === 'failed')
      .map((item) => ({ propertyId: item.propertyId, reason: item.reason ?? 'Não aplicado' }));
    const allFailed = Array.from(
      new Map(
        [...failed, ...skippedOrFailed].map((item) => [`${item.propertyId}:${item.reason}`, item]),
      ).values(),
    );
    const summary = {
      ...preview.summary,
      applied,
      failed: allFailed.length,
    };
    run.summary = summary;
    run.status = allFailed.length > 0 && applied > 0 ? 'partial' : applied > 0 ? 'completed' : 'failed';
    run.completedAt = new Date();
    await this.portfolioRunRepo.save(run);
    return {
      applied,
      failed: allFailed,
      auditLogId: run.id,
      summary,
    };
  }

  private portfolioPreviewSummary(items: PortfolioActionPreviewItem[]): PortfolioActionRunSummary {
    const actionable = items.filter((item) => item.status === 'planned');
    const failed = items.filter((item) => item.status === 'failed');
    const skipped = items.filter((item) => item.status === 'skipped');
    const targetDates = new Set(actionable.map((item) => item.date).filter(Boolean));
    return {
      applied: actionable.length,
      failed: failed.length,
      skipped: skipped.length,
      items: items.length,
      affectedProperties: new Set(actionable.map((item) => item.propertyId)).size,
      affectedDates: targetDates.size,
      estimatedLift: this.roundMoney(actionable.reduce((sum, item) => sum + Number(item.estimatedLift ?? 0), 0)) ?? 0,
    };
  }

  private previewTargetDates(preview: PortfolioActionPreview) {
    return Array.from(new Set(preview.items.map((item) => item.date).filter(Boolean))) as string[];
  }

  private resolveActionTargets(input: PortfolioBulkActionInput, addresses: Address[]): PortfolioResolvedTargets {
    const aliases = new Map<string, string>();
    for (const address of addresses) {
      aliases.set(address.id, address.id);
      if (address.list?.id) aliases.set(address.list.id, address.id);
    }

    const targetSets = new Map<string, Set<string>>();
    for (const target of this.targetList(input.payload?.targets)) {
      const rawPropertyId =
        target.propertyId ?? target.addressId ?? target.listingId ?? target.listId ?? target.id;
      const addressId = aliases.get(String(rawPropertyId ?? ''));
      const date = this.dateOnly(target.date ?? target.targetDate ?? target.data ?? target.day);
      if (!addressId || !date) continue;
      if (!targetSets.has(addressId)) targetSets.set(addressId, new Set<string>());
      targetSets.get(addressId)?.add(date);
    }

    if (targetSets.size) {
      return this.materializeTargets(targetSets, true);
    }

    const dates = this.resolveActionDates(input);
    const fallback = new Map<string, Set<string>>();
    for (const address of addresses) {
      fallback.set(address.id, new Set(dates));
    }
    return this.materializeTargets(fallback, false);
  }

  private resolveActionDates(input: PortfolioBulkActionInput): string[] {
    const payload = input.payload ?? {};
    const rawDates = [
      ...this.dateList(input.dates),
      ...this.dateList(payload.dates),
      ...this.dateList(payload.targetDates),
      ...this.dateList(payload.date),
      ...this.dateList(payload.targetDate),
    ];
    const explicitDates = Array.from(new Set(rawDates.map((date) => this.dateOnly(date)).filter(Boolean))) as string[];
    if (explicitDates.length) return explicitDates.slice(0, 360).sort();
    const from = input.from ?? (typeof payload.from === 'string' ? payload.from : undefined);
    const to = input.to ?? (typeof payload.to === 'string' ? payload.to : undefined);
    if (!from && !to) return [];
    return this.resolveRange(from, to, 1, 360).dates;
  }

  private materializeTargets(targets: Map<string, Set<string>>, explicit: boolean): PortfolioResolvedTargets {
    const byAddress = new Map<string, string[]>();
    const keys = new Set<string>();
    const allDates = new Set<string>();
    for (const [addressId, dates] of targets.entries()) {
      const sorted = Array.from(dates).sort().slice(0, 360);
      if (!sorted.length) continue;
      byAddress.set(addressId, sorted);
      for (const date of sorted) {
        keys.add(`${addressId}:${date}`);
        allDates.add(date);
      }
    }
    return {
      explicit,
      dates: Array.from(allDates).sort().slice(0, 360),
      byAddress,
      keys,
    };
  }

  private targetList(value: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
    }
    return value && typeof value === 'object' ? [value as Record<string, unknown>] : [];
  }

  private dateList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return value ? [String(value)] : [];
  }

  private async portfolioSettingsByAddress(addressIds: string[]) {
    if (!addressIds.length) return new Map<string, PortfolioPropertySetting>();
    const settings = await this.portfolioSettingRepo.find({
      where: { address: { id: In(addressIds) } } as any,
      relations: ['address'],
    });
    return new Map(settings.map((setting) => [setting.address.id, setting]));
  }

  private async portfolioOverridesByAddressDate(userId: string, addressIds: string[], range: DateRange) {
    if (!addressIds.length) return new Map<string, PortfolioDailyPriceOverride>();
    const overrides = await this.portfolioOverrideRepo.find({
      where: {
        user: { id: userId },
        address: { id: In(addressIds) },
        targetDate: Between(range.from, range.to),
      } as any,
      relations: ['address'],
      take: Math.max(1000, addressIds.length * range.dates.length),
    });
    return new Map(
      overrides
        .map((override) => {
          const date = this.dateOnly(override.targetDate);
          return date ? [`${override.address.id}:${date}`, override] as const : null;
        })
        .filter(Boolean),
    );
  }

  private resolvePortfolioStrategyMetadata(
    requested: PortfolioPricingStrategy | null,
    stored: PortfolioPricingStrategy | null | undefined,
    userDefault: PortfolioPricingStrategy | null,
  ): PortfolioStrategyMetadata {
    const strategy = requested ?? stored ?? userDefault ?? 'balanced';
    const source = requested ? 'request' : stored ? 'property_default' : userDefault ? 'user_default' : 'fallback';
    return {
      strategy,
      source,
      ...this.portfolioStrategyAdjustment(strategy),
    };
  }

  private portfolioStrategyAdjustment(strategy: PortfolioPricingStrategy) {
    if (strategy === 'conservative') {
      return {
        adjustmentPercent: -5,
        multiplier: 0.95,
        rule: 'conservative aplica -5% sobre precoSugerido.',
      };
    }
    if (strategy === 'aggressive') {
      return {
        adjustmentPercent: 5,
        multiplier: 1.05,
        rule: 'aggressive aplica +5% sobre precoSugerido.',
      };
    }
    if (strategy === 'ai') {
      return {
        adjustmentPercent: 0,
        multiplier: 1,
        rule: 'ai/autonomous mantém precoSugerido original nesta etapa.',
      };
    }
    return {
      adjustmentPercent: 0,
      multiplier: 1,
      rule: 'balanced mantém precoSugerido original.',
    };
  }

  private applyPortfolioStrategy(value: unknown, strategy: PortfolioPricingStrategy) {
    const base = Number(value);
    if (!Number.isFinite(base)) return null;
    return this.roundMoney(base * this.portfolioStrategyAdjustment(strategy).multiplier);
  }

  private portfolioRisk(currentPrice: number, suggestedPrice?: number | null, event?: EventEntity | null) {
    if (!suggestedPrice || currentPrice <= 0) return 'baixa';
    const delta = (suggestedPrice - currentPrice) / currentPrice;
    if (delta >= 0.25 || (event && this.eventImpact(event) === 'alta')) return 'alta';
    if (delta >= 0.1) return 'media';
    return 'baixa';
  }

  private portfolioConfidence(event?: EventEntity | null) {
    if (!event) return 'baixa';
    return this.eventImpact(event) === 'alta' ? 'alta' : 'media';
  }

  private async getUser(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  private async getOwnedAddresses(userId: string, propertyIds?: string[]) {
    const addresses = await this.addressRepo.find({
      where: [
        { ativo: true, user: { id: userId } } as any,
        { ativo: true, list: { user: { id: userId } } } as any,
      ],
      relations: ['list', 'user', 'list.user'],
      take: 1000,
    });
    const byId = new Map<string, Address>();
    for (const address of addresses) {
      if (address?.id && address.list?.id) byId.set(address.id, address);
    }
    const unique = Array.from(byId.values());
    if (!propertyIds?.length) return unique;
    const wanted = new Set(propertyIds);
    return unique.filter((address) => wanted.has(address.id) || wanted.has(address.list?.id));
  }

  private async getOwnedAddress(userId: string, propertyId: string) {
    const [address] = await this.getOwnedAddresses(userId, [propertyId]);
    if (!address) throw new NotFoundException('Imóvel não encontrado');
    return address;
  }

  private async getComparableAddresses(userId: string, target: Address) {
    const addresses = await this.addressRepo.find({
      where: { ativo: true },
      relations: ['list', 'user', 'list.user'],
      take: 1000,
    });
    const targetLat = this.num(target.latitude);
    const targetLng = this.num(target.longitude);
    return addresses
      .filter((address) => address.id !== target.id && address.list?.id)
      .map((address) => {
        const distanceKm =
          targetLat != null && targetLng != null && this.num(address.latitude) != null && this.num(address.longitude) != null
            ? this.distanceKm(targetLat, targetLng, this.num(address.latitude), this.num(address.longitude))
            : null;
        return { address, distanceKm };
      })
      .filter(({ address, distanceKm }) => {
        if (distanceKm != null) return distanceKm <= 3;
        return (
          this.normalize(address.cidade) === this.normalize(target.cidade) &&
          this.normalize(address.estado) === this.normalize(target.estado)
        );
      })
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
      .map((item) => item.address);
  }

  private async buildComparableRows(target: Address, comparables: Address[], from: string, to: string) {
    const rows = [];
    for (let i = 0; i < comparables.length; i++) {
      const address = comparables[i];
      const medianAdr = await this.medianAdrForList(address.list?.id, from, to, this.resolveBasePrice(address.list));
      const occupancy = await this.occupancyRate([address.list?.id].filter(Boolean), from, to);
      const distance = this.addressDistanceKm(target, address);
      rows.push({
        anonymousId: this.anonymousId(i),
        type: this.propertyType(address.list),
        bedrooms: Number(address.list?.quartos ?? 0),
        medianAdr,
        occupancy,
        distanceKm: Number((distance ?? 0).toFixed(2)),
        similarityScore: this.similarityScore(target, address, distance),
      });
    }
    return rows.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  private async buildMarketDaily(target: Address, comparables: Address[], range: DateRange) {
    const ids = [target.list?.id, ...comparables.map((address) => address.list?.id)].filter(Boolean);
    const snapshots = ids.length
      ? await this.snapshotRepo
          .createQueryBuilder('snapshot')
          .leftJoinAndSelect('snapshot.list', 'list')
          .where('list.id IN (:...ids)', { ids })
          .andWhere('snapshot.snapshotDate BETWEEN :from AND :to', { from: range.from, to: range.to })
          .getMany()
      : [];
    const targetListId = target.list?.id;
    const compIds = new Set(comparables.map((address) => address.list?.id).filter(Boolean));

    return range.dates.map((date) => {
      const own = snapshots.find((snapshot) => snapshot.snapshotDate === date && snapshot.list?.id === targetListId);
      const comps = snapshots
        .filter((snapshot) => snapshot.snapshotDate === date && compIds.has(snapshot.list?.id))
        .map((snapshot) => Math.round(Number(snapshot.priceCents) / 100));
      return {
        date,
        yourAdr: own ? Math.round(Number(own.priceCents) / 100) : this.resolveBasePrice(target.list),
        medianAdr: this.median(comps) || this.median(comparables.map((address) => this.resolveBasePrice(address.list))) || 0,
      };
    });
  }

  private async buildPricingPreview(address: Address, rules: PricingRuleConfigItem[]) {
    const range = this.resolveRange(undefined, undefined, 14, 14);
    const base = this.resolveBasePrice(address.list);
    const events = await this.eventsByDateForAddresses([address], range.from, range.to);
    const occupancy = await this.findOccupancy([address.list?.id].filter(Boolean), range.from, range.to);

    return range.dates.map((date, index) => {
      let price = base;
      const appliedRules: PricingRuleType[] = [];
      const weekday = this.startDate(date).getDay();
      const isWeekend = weekday === 5 || weekday === 6;
      const isSlowWeekday = weekday >= 1 && weekday <= 3;
      const dayEvents = events.get(date) ?? [];

      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (rule.type === 'weekend_uplift' && isWeekend) {
          price = this.applyPercent(price, rule.params.percent);
          appliedRules.push(rule.type);
        }
        if (rule.type === 'weekday_discount' && isSlowWeekday) {
          price = this.applyPercent(price, rule.params.percent);
          appliedRules.push(rule.type);
        }
        if (rule.type === 'last_minute' && index <= Number(rule.params.daysBefore ?? 3)) {
          const occupied = occupancy.some((record) => record.date === date && record.status === 'booked');
          if (!occupied) {
            price = this.applyPercent(price, rule.params.percent);
            appliedRules.push(rule.type);
          }
        }
        if (rule.type === 'gap_night_filler') {
          const prev = this.dateOnly(new Date(this.startDate(date).getTime() - MS_PER_DAY));
          const next = this.dateOnly(new Date(this.startDate(date).getTime() + MS_PER_DAY));
          const isGap =
            occupancy.some((record) => record.date === prev && record.status === 'booked') &&
            occupancy.some((record) => record.date === next && record.status === 'booked') &&
            !occupancy.some((record) => record.date === date && record.status === 'booked');
          if (isGap) {
            price = this.applyPercent(price, rule.params.percent);
            appliedRules.push(rule.type);
          }
        }
        if (rule.type === 'event_uplift' && dayEvents.some((event) => this.eventImpact(event) === 'alta')) {
          price = this.applyPercent(price, rule.params.percent);
          appliedRules.push(rule.type);
        }
        if (rule.type === 'occupancy_floor') {
          const floor = Number(rule.params.minPrice ?? 0);
          if (floor > 0 && price < floor) {
            price = floor;
            appliedRules.push(rule.type);
          }
        }
      }

      return {
        date,
        basePrice: base,
        rulesPrice: Math.round(price),
        appliedRules: Array.from(new Set(appliedRules)),
      };
    });
  }

  private async eventsByDateForAddresses(addresses: Address[], from: string, to: string) {
    const cities = Array.from(new Set(addresses.map((address) => address.cidade).filter(Boolean)));
    const states = Array.from(new Set(addresses.map((address) => address.estado).filter(Boolean)));
    if (cities.length === 0 && states.length === 0) return new Map<string, EventEntity[]>();
    const events = await this.eventRepo
      .createQueryBuilder('event')
      .where('event.ativo = :active', { active: true })
      .andWhere('event.outOfScope = :outOfScope', { outOfScope: false })
      .andWhere('event.dataInicio BETWEEN :from AND :to', {
        from: this.startDate(from),
        to: this.endDate(to),
      })
      .andWhere('event.duplicateOfEventId IS NULL')
      .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
      .take(500)
      .getMany();
    const out = new Map<string, EventEntity[]>();
    for (const event of events) {
      const eventDate = this.dateOnly(event.dataInicio);
      if (!eventDate) continue;
      const matches = addresses.some((address) => this.eventMatchesAddress(event, address));
      if (!matches) continue;
      out.set(eventDate, [...(out.get(eventDate) ?? []), event]);
    }
    return out;
  }

  private eventMatchesAddress(event: EventEntity, address: Address) {
    const lat1 = this.num(event.latitude);
    const lng1 = this.num(event.longitude);
    const lat2 = this.num(address.latitude);
    const lng2 = this.num(address.longitude);
    if (lat1 != null && lng1 != null && lat2 != null && lng2 != null) {
      const radius = Math.max(3, Number(event.raioImpactoKm ?? 0) || 3);
      return this.distanceKm(lat1, lng1, lat2, lng2) <= radius;
    }
    return (
      this.normalize(event.cidade) === this.normalize(address.cidade) &&
      this.normalize(event.estado) === this.normalize(address.estado)
    );
  }

  private isCanonicalEvent(event: EventEntity | null | undefined): boolean {
    return Boolean(
      event &&
        !event.duplicateOfEventId &&
        (!event.dedupStatus || event.dedupStatus === 'canonical'),
    );
  }

  private async findOccupancy(listIds: string[], from: string, to: string) {
    if (!listIds.length || !from || !to) return [];
    return this.occupancyRepo
      .createQueryBuilder('occupancy')
      .leftJoinAndSelect('occupancy.list', 'list')
      .where('list.id IN (:...listIds)', { listIds })
      .andWhere('occupancy.date BETWEEN :from AND :to', { from, to })
      .getMany();
  }

  private async medianAdrForList(listId: string | undefined, from: string, to: string, fallback: number) {
    if (!listId) return fallback;
    const snapshots = await this.snapshotRepo.find({
      where: { list: { id: listId } as any, snapshotDate: Between(from, to) },
      take: 120,
    });
    return this.median(snapshots.map((snapshot) => Math.round(Number(snapshot.priceCents) / 100))) || fallback;
  }

  private async occupancyRate(listIds: string[], from: string, to: string) {
    const records = await this.findOccupancy(listIds, from, to);
    const denominator = records.filter((record) => record.status === 'booked' || record.status === 'available').length;
    if (!denominator) return 0;
    return Number((records.filter((record) => record.status === 'booked').length / denominator).toFixed(2));
  }

  private expectedOccupancyByWeekday(records: OccupancyHistory[]) {
    const byWeekday = new Map<number, { booked: number; denominator: number }>();
    for (const record of records) {
      if (record.status !== 'booked' && record.status !== 'available') continue;
      const weekday = this.startDate(record.date).getDay();
      const curr = byWeekday.get(weekday) ?? { booked: 0, denominator: 0 };
      curr.denominator += 1;
      if (record.status === 'booked') curr.booked += 1;
      byWeekday.set(weekday, curr);
    }
    return new Map(
      Array.from(byWeekday.entries()).map(([weekday, value]) => [
        weekday,
        value.denominator ? Math.round((value.booked / value.denominator) * 100) : 0,
      ]),
    );
  }

  private async eventReactivity(userId: string, addressId: string, from: string, to: string) {
    const analyses = await this.analiseRepo.find({
      where: {
        usuarioProprietario: { id: userId },
        endereco: { id: addressId },
        evento: { dataInicio: Between(this.startDate(from), this.endDate(to)) },
      } as any,
      relations: ['evento'],
      take: 200,
    });
    const canonicalAnalyses = analyses.filter((analysis) => this.isCanonicalEvent(analysis.evento));
    if (!canonicalAnalyses.length) return 0;
    return Math.round((canonicalAnalyses.filter((analysis) => analysis.aceito || Number(analysis.precoAplicado) > 0).length / canonicalAnalyses.length) * 100);
  }

  private async buildAskAnswer(userId: string, question: string): Promise<{ content: string; citations: AskUrbanCitation[] }> {
    const q = question.toLowerCase();
    const addresses = await this.getOwnedAddresses(userId);
    const addressIds = addresses.map((address) => address.id);
    const analyses = addressIds.length
      ? await this.analiseRepo.find({
          where: { usuarioProprietario: { id: userId } } as any,
          relations: ['endereco', 'evento'],
          order: { criadoEm: 'DESC' },
          take: 500,
        })
      : [];
    const canonicalAnalyses = analyses.filter((analysis) =>
      analysis.evento ? this.isCanonicalEvent(analysis.evento) : true,
    );
    const realRevenue = canonicalAnalyses.reduce((sum, analysis) => sum + (Number(analysis.receitaReal) || 0), 0);
    const potentialLift = canonicalAnalyses.reduce((sum, analysis) => {
      const suggested = Number(analysis.precoSugerido);
      const current = Number(analysis.seuPrecoAtual);
      return Number.isFinite(suggested) && Number.isFinite(current) ? sum + Math.max(0, suggested - current) : sum;
    }, 0);
    const accepted = canonicalAnalyses.filter((analysis) => analysis.aceito).length;
    const applied = canonicalAnalyses.filter((analysis) => Number(analysis.precoAplicado) > 0).length;
    const booked = canonicalAnalyses.filter((analysis) => analysis.reservaStatus === 'booked').length;
    const futureEvents = canonicalAnalyses.filter((analysis) => analysis.evento?.dataInicio && analysis.evento.dataInicio >= new Date()).length;

    if (q.includes('receita') || q.includes('projec') || q.includes('ganho')) {
      return {
        content: `Com base nos dados reais salvos, seu portfólio tem ${this.countPt(addresses.length, 'imóvel', 'imóveis')}, ${this.countPt(canonicalAnalyses.length, 'recomendação', 'recomendações')} geradas e ${this.formatBRL(realRevenue)} de receita real registrada. As recomendações ainda abertas somam ${this.formatBRL(potentialLift)} de lift diário potencial.`,
        citations: [
          { id: 'painel', label: 'Painel', url: '/painel' },
          { id: 'roi', label: 'ROI', url: '/my-roi' },
          { id: 'portfolio', label: 'Portfólio', url: '/portfolio' },
        ],
      };
    }

    if (q.includes('ocupa') || q.includes('benchmark') || q.includes('compar')) {
      const first = addresses[0];
      const occupancy = first ? await this.occupancyRate([first.list?.id].filter(Boolean), this.dateOnly(new Date(Date.now() - 30 * MS_PER_DAY)), this.dateOnly(new Date())) : 0;
      return {
        content: first
          ? `Nos últimos 30 dias, a ocupação registrada para ${first.list?.titulo ?? 'seu primeiro imóvel'} está em ${Math.round(occupancy * 100)}%. Para comparação anônima por bairro, abra Mercado do imóvel: ele usa seus PriceSnapshots e imóveis reais próximos.`
          : 'Ainda não encontrei imóveis ativos para calcular ocupação comparada.',
        citations: [
          { id: 'market', label: 'Mercado', url: first ? `/properties/${first.id}/market` : '/properties' },
          { id: 'portfolio', label: 'Portfólio', url: '/portfolio' },
        ],
      };
    }

    if (q.includes('evento') || q.includes('impact')) {
      return {
        content: `Encontrei ${this.countPt(futureEvents, 'recomendação ligada', 'recomendações ligadas')} a eventos futuros no seu histórico recente. ${this.countPt(accepted, 'recomendação foi aceita', 'recomendações foram aceitas')} e ${this.countPt(applied, 'recomendação já tem preço aplicado registrado', 'recomendações já têm preço aplicado registrado')}.`,
        citations: [
          { id: 'calendar', label: 'Calendário', url: '/dashboard' },
          { id: 'near-events', label: 'Eventos próximos', url: '/near-events' },
          { id: 'portfolio', label: 'Portfólio', url: '/portfolio' },
        ],
      };
    }

    return {
      content: `Resumo atual: ${this.countPt(addresses.length, 'imóvel ativo', 'imóveis ativos')}, ${this.countPt(analyses.length, 'recomendação', 'recomendações')}, ${this.countPt(accepted, 'aceite', 'aceites')}, ${this.countPt(applied, 'aplicação registrada', 'aplicações registradas')} e ${this.countPt(booked, 'reserva confirmada', 'reservas confirmadas')} no feedback. Posso detalhar receita, ocupação, eventos ou desempenho recente.`,
      citations: [
        { id: 'painel', label: 'Painel', url: '/painel' },
        { id: 'portfolio', label: 'Portfólio', url: '/portfolio' },
      ],
    };
  }

  private countPt(count: number, singular: string, plural: string) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  private normalizeRules(rules: PricingRuleConfigItem[] | undefined) {
    if (!Array.isArray(rules)) throw new BadRequestException('rules deve ser array');
    return rules.map((rule) => {
      if (!PRICING_RULE_TYPES.includes(rule.type)) {
        throw new BadRequestException(`Regra invalida: ${String(rule.type)}`);
      }
      const fallback = DEFAULT_PRICING_RULES.find((item) => item.type === rule.type);
      return {
        type: rule.type,
        enabled: Boolean(rule.enabled),
        params: this.normalizeParams(rule.params),
        label: String(rule.label || fallback?.label || rule.type),
        description: String(rule.description || fallback?.description || ''),
      };
    });
  }

  private normalizeParams(params: Record<string, number> | undefined) {
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(params ?? {})) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) out[key] = parsed;
    }
    return out;
  }

  private cloneDefaultRules() {
    return DEFAULT_PRICING_RULES.map((rule) => ({
      ...rule,
      params: { ...rule.params },
    }));
  }

  private resolveRange(from?: string, to?: string, defaultDays = 30, maxDays = 180): DateRange {
    const start = from ? this.dateOnly(from) : this.dateOnly(new Date());
    const end = to ? this.dateOnly(to) : this.dateOnly(new Date(this.startDate(start).getTime() + (defaultDays - 1) * MS_PER_DAY));
    if (!start || !end) throw new BadRequestException('Datas invalidas');
    const days = Math.max(1, Math.min(maxDays, Math.round((this.startDate(end).getTime() - this.startDate(start).getTime()) / MS_PER_DAY) + 1));
    return {
      from: start,
      to: this.dateOnly(new Date(this.startDate(start).getTime() + (days - 1) * MS_PER_DAY)),
      dates: Array.from({ length: days }, (_, i) => this.dateOnly(new Date(this.startDate(start).getTime() + i * MS_PER_DAY))),
    };
  }

  private csv(value?: string) {
    return String(value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private resolveBasePrice(list?: List | null) {
    const price = Number(list?.manualDailyPrice ?? list?.dailyPrice ?? list?.raw ?? 0);
    return Number.isFinite(price) && price > 0 ? Math.round(price) : 0;
  }

  private applyPercent(price: number, percent: number | undefined) {
    return Math.round(price * (1 + Number(percent ?? 0) / 100));
  }

  private eventImpact(event: EventEntity): 'alta' | 'media' {
    const relevance = Number(event.relevancia ?? 0);
    const audience = Number(event.expectedAttendance ?? event.capacidadeEstimada ?? event.venueCapacity ?? 0);
    return relevance >= 70 || audience >= 10000 ? 'alta' : 'media';
  }

  private normalizeStrategy(strategy: string): PortfolioPricingStrategy | null {
    const normalized = this.normalize(strategy);
    const map: Record<string, PortfolioPricingStrategy> = {
      conservadora: 'conservative',
      conservative: 'conservative',
      moderada: 'balanced',
      balanced: 'balanced',
      agressiva: 'aggressive',
      aggressive: 'aggressive',
      autonomous: 'ai',
      automatico: 'ai',
      auto: 'ai',
      ai: 'ai',
    };
    return map[normalized] ?? null;
  }

  private propertyType(list?: List | null) {
    const raw = this.normalize(list?.propertyType);
    if (raw.includes('studio')) return 'studio';
    if (raw.includes('loft')) return 'loft';
    if (raw.includes('casa') || raw.includes('house')) return 'casa';
    return 'apartamento';
  }

  private similarityScore(target: Address, other: Address, distanceKm: number | null) {
    const distancePenalty = distanceKm == null ? 0.15 : Math.min(0.4, distanceKm / 8);
    const bedroomPenalty = Math.min(0.2, Math.abs(Number(target.list?.quartos ?? 0) - Number(other.list?.quartos ?? 0)) * 0.05);
    return Number(Math.max(0.45, Math.min(0.98, 0.96 - distancePenalty - bedroomPenalty)).toFixed(2));
  }

  private addressDistanceKm(a: Address, b: Address) {
    const lat1 = this.num(a.latitude);
    const lng1 = this.num(a.longitude);
    const lat2 = this.num(b.latitude);
    const lng2 = this.num(b.longitude);
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
    return this.distanceKm(lat1, lng1, lat2, lng2);
  }

  private distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private median(values: number[]) {
    const nums = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (!nums.length) return 0;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : Math.round((nums[mid - 1] + nums[mid]) / 2);
  }

  private roundMoney(value: unknown) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  private num(value: unknown): number | null {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private dateOnly(value: unknown): string {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  private startDate(value: string) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return date;
  }

  private endDate(value: string) {
    const date = new Date(`${value}T23:59:59.999Z`);
    return date;
  }

  private toIso(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private startOfToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private anonymousId(index: number) {
    const letter = String.fromCharCode(65 + (index % 26));
    const suffix = index >= 26 ? String(Math.floor(index / 26) + 1) : '';
    return `${letter}${suffix}`;
  }

  private async resolveAskEntitlement(userId: string): Promise<AskEntitlement> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user && this.hasAlphaAskAccess(userId, user.email)) {
      return this.askEntitlementForPlan('alpha');
    }

    const paymentRepo = this.dataSource.getRepository(Payment);
    const payments = await paymentRepo.find({
      where: {
        user: { id: userId },
        status: In(ASK_ACCESS_STATUSES),
      } as any,
      order: { updatedAt: 'DESC' },
      take: 10,
    });

    if (!payments.length) {
      return { plan: 'none', planAllowed: false, reason: 'no_active_subscription' };
    }

    const now = Date.now();
    const activePayment = payments.find((payment) => {
      if (!payment.expireDate) return true;
      const expiresAt = new Date(payment.expireDate).getTime();
      return Number.isFinite(expiresAt) && expiresAt >= now;
    });
    const latestPayment = activePayment ?? payments[0];
    const plan = this.normalizeAskPlan(
      latestPayment.planName || (latestPayment.status === 'alpha' ? 'alpha' : 'unknown'),
    );

    if (!activePayment) {
      return { plan, planAllowed: false, reason: 'subscription_expired' };
    }

    return this.askEntitlementForPlan(plan);
  }

  private askEntitlementForPlan(plan: string): AskEntitlement {
    const normalizedPlan = this.normalizeAskPlan(plan);
    const planAllowed = this.askAllowedPlans().has(normalizedPlan);
    return {
      plan: normalizedPlan,
      planAllowed,
      reason: planAllowed ? null : 'plan_not_allowed',
    };
  }

  private askUsagePayload(used: number, entitlement: AskEntitlement): AskUsagePayload {
    const quota = entitlement.planAllowed
      ? this.askPlanLimit('ASK_URBAN_DAILY_QUOTA', entitlement.plan, 100)
      : 0;
    const hardCap = entitlement.planAllowed
      ? this.askPlanLimit('ASK_URBAN_DAILY_HARD_CAP', entitlement.plan, 200)
      : 0;
    let reason: AskUsageReason = entitlement.reason;
    if (!reason && used >= quota) reason = 'quota_exceeded';
    if (!reason && used >= hardCap) reason = 'hard_cap_exceeded';

    return {
      used,
      quota,
      hardCap,
      canUse: !reason,
      plan: entitlement.plan,
      reason,
    };
  }

  private ensureAskCanUse(usage: AskUsagePayload) {
    if (usage.canUse) return;

    if (usage.reason === 'quota_exceeded' || usage.reason === 'hard_cap_exceeded') {
      throw new HttpException(
        {
          message: 'Limite diário do Ask Urban atingido',
          reason: usage.reason,
          usage,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    throw new ForbiddenException({
      message: 'Ask Urban indisponível para este plano',
      reason: usage.reason,
      usage,
    });
  }

  private askAllowedPlans() {
    const raw = process.env.ASK_URBAN_ALLOWED_PLANS || DEFAULT_ASK_ALLOWED_PLANS.join(',');
    return new Set(
      raw
        .split(',')
        .map((plan) => this.normalizeAskPlan(plan))
        .filter(Boolean),
    );
  }

  private askPlanLimit(envBase: string, plan: string, fallback: number) {
    const globalValue = this.readPositiveIntEnv(envBase, fallback);
    return this.readPositiveIntEnv(`${envBase}_${this.envPlanKey(plan)}`, globalValue);
  }

  private readPositiveIntEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  private envPlanKey(plan: string) {
    return this.normalizeAskPlan(plan).replace(/[^a-z0-9]+/g, '_').toUpperCase();
  }

  private normalizeAskPlan(plan: unknown) {
    return this.normalize(plan) || 'unknown';
  }

  private hasAlphaAskAccess(userId: string, email?: string | null) {
    const raw = process.env.ALPHA_USER_QUOTAS || '';
    if (!raw.trim()) return false;
    const keys = new Set([userId.toLowerCase(), email?.toLowerCase()].filter(Boolean));

    for (const entry of raw.split(',')) {
      const [rawKey, rawQuota] = entry.split(':').map((part) => part?.trim());
      if (!rawKey || !rawQuota) continue;
      if (!keys.has(rawKey.toLowerCase())) continue;
      const quota = Number(rawQuota);
      if (Number.isFinite(quota) && quota > 0) return true;
    }
    return false;
  }

  private formatBRL(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }
}
