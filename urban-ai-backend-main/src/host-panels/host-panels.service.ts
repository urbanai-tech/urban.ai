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
    description: 'Aumenta o preco base em sexta e sabado, quando a demanda costuma ser maior.',
  },
  {
    type: 'weekday_discount',
    enabled: true,
    params: { percent: -8 },
    label: 'Desconto dias uteis lentos',
    description: 'Aplica desconto suave em segunda, terca e quarta para puxar reservas.',
  },
  {
    type: 'gap_night_filler',
    enabled: true,
    params: { percent: -20, maxNights: 2 },
    label: 'Gap night filler',
    description: 'Reduz preco quando ha lacunas curtas entre noites reservadas.',
  },
  {
    type: 'last_minute',
    enabled: true,
    params: { percent: -12, daysBefore: 3 },
    label: 'Last-minute',
    description: 'Baixa o preco quando a data esta muito proxima e ainda sem reserva registrada.',
  },
  {
    type: 'length_of_stay',
    enabled: false,
    params: { percent: -10, minNights: 7 },
    label: 'Desconto estadia longa',
    description: 'Regra por reserva; nao altera o preview diario isolado.',
  },
  {
    type: 'min_stay_dynamic',
    enabled: false,
    params: { baseMinNights: 2, highMinNights: 3, occupancyThreshold: 70 },
    label: 'Estadia minima dinamica',
    description: 'Regra operacional de minimo de noites; nao altera preco no preview.',
  },
  {
    type: 'occupancy_floor',
    enabled: true,
    params: { minPrice: 180 },
    label: 'Piso de preco',
    description: 'Impede que regras combinadas baixem o preco abaixo do piso definido.',
  },
  {
    type: 'event_uplift',
    enabled: true,
    params: { percent: 25, radiusKm: 3 },
    label: 'Uplift por evento de alto impacto',
    description: 'Aumenta o preco quando ha evento relevante perto do imovel.',
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
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async portfolioCalendar(
    userId: string,
    input: { from?: string; to?: string; propertyIds?: string; strategy?: string },
  ) {
    const range = this.resolveRange(input.from, input.to, 60, 180);
    const propertyIds = this.csv(input.propertyIds);
    const addresses = await this.getOwnedAddresses(userId, propertyIds);
    const addressIds = addresses.map((address) => address.id);

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
      properties: addresses.map((address) => {
        const basePrice = this.resolveBasePrice(address.list);
        return {
          propertyId: address.id,
          name: address.list?.titulo ?? '(sem nome)',
          thumbnail: address.list?.pictureUrl ?? null,
          days: range.dates.map((date) => {
            const analysis = byAddressDate.get(`${address.id}:${date}`);
            return {
              date,
              sugestao: analysis ? this.roundMoney(analysis.precoSugerido) : null,
              atual: basePrice,
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

  async portfolioBulkAction(userId: string, input: PortfolioBulkActionInput) {
    const requestedIds = Array.from(new Set(input.propertyIds ?? [])).filter(Boolean);
    if (requestedIds.length === 0) {
      throw new BadRequestException('propertyIds e obrigatorio');
    }

    const addresses = await this.getOwnedAddresses(userId, requestedIds);
    const foundIds = new Set(addresses.flatMap((address) => [address.id, address.list?.id].filter(Boolean)));
    const failed = requestedIds
      .filter((id) => !foundIds.has(id))
      .map((propertyId) => ({ propertyId, reason: 'Imovel nao encontrado ou sem permissao' }));

    if (input.action === 'set-base-price') {
      const price = Number(input.payload?.price ?? input.payload?.basePrice ?? input.payload?.manualDailyPrice);
      if (!Number.isFinite(price) || price <= 0) {
        throw new BadRequestException('payload.price deve ser um numero maior que zero');
      }
      let applied = 0;
      for (const address of addresses) {
        if (!address.list) {
          failed.push({ propertyId: address.id, reason: 'Imovel sem listing associado' });
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
      return { applied, failed, auditLogId: randomUUID() };
    }

    if (input.action === 'apply-strategy') {
      const strategy = String(input.payload?.strategy ?? '').trim();
      const mapped = this.normalizeStrategy(strategy);
      if (!mapped) throw new BadRequestException('payload.strategy invalido');
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('Usuario nao encontrado');
      user.pricingStrategy = mapped;
      await this.userRepo.save(user);
      return { applied: addresses.length, failed, auditLogId: randomUUID() };
    }

    if (input.action === 'accept-suggestions') {
      const addressIds = addresses.map((address) => address.id);
      const pending = addressIds.length
        ? await this.analiseRepo
            .createQueryBuilder('analysis')
            .innerJoinAndSelect('analysis.endereco', 'address')
            .leftJoinAndSelect('analysis.evento', 'event')
            .innerJoin('analysis.usuarioProprietario', 'owner')
            .where('owner.id = :userId', { userId })
            .andWhere('address.id IN (:...addressIds)', { addressIds })
            .andWhere('analysis.aceito = :accepted', { accepted: false })
            .andWhere('event.dataInicio >= :now', { now: new Date() })
            .andWhere('event.duplicateOfEventId IS NULL')
            .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
            .getMany()
        : [];
      const changedAddressIds = new Set<string>();
      for (const item of pending) {
        item.aceito = true;
        item.status = 'accepted';
        item.aceitoEm = new Date();
        item.rejeitadoEm = null;
        changedAddressIds.add(item.endereco.id);
      }
      if (pending.length) await this.analiseRepo.save(pending);
      for (const address of addresses) {
        if (!changedAddressIds.has(address.id)) {
          failed.push({ propertyId: address.id, reason: 'Sem sugestoes futuras pendentes' });
        }
      }
      return { applied: changedAddressIds.size, failed, auditLogId: randomUUID() };
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
    if (!user) throw new NotFoundException('Usuario nao encontrado');
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
      neighborhood: address.bairro ?? address.list?.neighborhood ?? address.cidade ?? 'Nao informado',
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
    if (!user) throw new NotFoundException('Usuario nao encontrado');
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
      throw new BadRequestException('messageId e vote sao obrigatorios');
    }
    const message = await this.askRepo.findOne({
      where: { id: input.messageId, user: { id: userId }, role: 'assistant' },
    });
    if (!message) throw new NotFoundException('Mensagem nao encontrada');
    message.feedback = input.vote;
    await this.askRepo.save(message);
    return { ok: true };
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
    if (!address) throw new NotFoundException('Imovel nao encontrado');
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
    const canonicalAnalyses = analyses.filter((analysis) => this.isCanonicalEvent(analysis.evento));
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
        content: `Com base nos dados reais salvos, seu portfolio tem ${addresses.length} imovel(is), ${analyses.length} recomendacao(oes) geradas e ${this.formatBRL(realRevenue)} de receita real registrada. As recomendacoes ainda abertas somam ${this.formatBRL(potentialLift)} de lift diario potencial.`,
        citations: [
          { id: 'painel', label: 'Painel', url: '/painel' },
          { id: 'roi', label: 'ROI', url: '/my-roi' },
          { id: 'portfolio', label: 'Portfolio', url: '/portfolio' },
        ],
      };
    }

    if (q.includes('ocupa') || q.includes('benchmark') || q.includes('compar')) {
      const first = addresses[0];
      const occupancy = first ? await this.occupancyRate([first.list?.id].filter(Boolean), this.dateOnly(new Date(Date.now() - 30 * MS_PER_DAY)), this.dateOnly(new Date())) : 0;
      return {
        content: first
          ? `Nos ultimos 30 dias, a ocupacao registrada para ${first.list?.titulo ?? 'seu primeiro imovel'} esta em ${Math.round(occupancy * 100)}%. Para comparacao anonima por bairro, abra Mercado do imovel: ele usa seus PriceSnapshots e imoveis reais proximos.`
          : 'Ainda nao encontrei imoveis ativos para calcular ocupacao comparada.',
        citations: [
          { id: 'market', label: 'Mercado', url: first ? `/properties/${first.id}/market` : '/properties' },
          { id: 'portfolio', label: 'Portfolio', url: '/portfolio' },
        ],
      };
    }

    if (q.includes('evento') || q.includes('impact')) {
      return {
        content: `Encontrei ${futureEvents} recomendacao(oes) ligadas a eventos futuros no seu historico recente. ${accepted} recomendacao(oes) foram aceitas e ${applied} ja tem preco aplicado registrado.`,
        citations: [
          { id: 'calendar', label: 'Calendario', url: '/dashboard' },
          { id: 'near-events', label: 'Eventos proximos', url: '/near-events' },
          { id: 'portfolio', label: 'Portfolio', url: '/portfolio' },
        ],
      };
    }

    return {
      content: `Resumo atual: ${addresses.length} imovel(is) ativos, ${analyses.length} recomendacao(oes), ${accepted} aceite(s), ${applied} aplicado(s) e ${booked} reserva(s) confirmada(s) no feedback. Posso detalhar receita, ocupacao, eventos ou desempenho recente.`,
      citations: [
        { id: 'painel', label: 'Painel', url: '/painel' },
        { id: 'portfolio', label: 'Portfolio', url: '/portfolio' },
      ],
    };
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

  private normalizeStrategy(strategy: string) {
    const normalized = this.normalize(strategy);
    const map: Record<string, string> = {
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
          message: 'Limite diario do AskUrban atingido',
          reason: usage.reason,
          usage,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    throw new ForbiddenException({
      message: 'AskUrban indisponivel para este plano',
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
