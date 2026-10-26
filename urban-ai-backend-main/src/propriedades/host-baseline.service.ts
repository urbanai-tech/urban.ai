import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from 'src/entities/addresses.entity';
import { List } from 'src/entities/list.entity';
import { PricingInputHistory } from 'src/entities/pricing-input-history.entity';
import { User } from 'src/entities/user.entity';
import { BaselinePrice, selectBaselinePrice } from 'src/pricing/baseline-price.util';
import { UpdateHostBaselineDto } from './propriedade.dto';

export type PublicBaseline = {
  addressId: string;
  listId: string;
  dailyPrice: number | null;
  /** 'host_input' | 'airbnb' | null (nenhuma diária utilizável). */
  source: BaselinePrice['source'];
  updatedAt: Date | null;
  /** Leitura do Airbnb velha demais — usada por falta de coisa melhor. */
  stale: boolean;
  reason: BaselinePrice['reason'];
  minDailyPrice: number | null;
  weekendDailyPrice: number | null;
  essentialsSource: string | null;
  essentialsUpdatedAt: Date | null;
};

/**
 * Plano B do scraping (ADR 0010): permite ao anfitrião informar diária base (e opcionalmente
 * piso, fim de semana e dados essenciais) quando a leitura do Airbnb falha — ou a qualquer
 * momento. Sempre escopado ao dono do endereço (404 para imóvel de outro usuário).
 */
@Injectable()
export class HostBaselineService {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    @InjectRepository(List)
    private readonly listRepository: Repository<List>,
    @InjectRepository(PricingInputHistory)
    private readonly pricingInputHistoryRepository: Repository<PricingInputHistory>,
  ) {}

  async getBaseline(addressId: string, userId: string): Promise<PublicBaseline> {
    const address = await this.findOwned(addressId, userId);
    return this.toPublic(address, address.list);
  }

  async saveHostInput(addressId: string, userId: string, input: UpdateHostBaselineDto): Promise<PublicBaseline> {
    const address = await this.findOwned(addressId, userId);
    const list = address.list;

    const manualDailyPrice = this.money(input.manualDailyPrice, 'manualDailyPrice');
    if (manualDailyPrice === null) {
      throw new BadRequestException('Informe a diária base do imóvel.');
    }
    const minDailyPrice = this.money(input.minDailyPrice, 'minDailyPrice');
    const weekendDailyPrice = this.money(input.weekendDailyPrice, 'weekendDailyPrice');
    if (minDailyPrice !== null && minDailyPrice > manualDailyPrice) {
      throw new BadRequestException('A diária mínima não pode ser maior que a diária base.');
    }

    const now = new Date();
    const previousManualDailyPrice = list.manualDailyPrice ?? null;
    const previousAverageMonthlyRevenue = list.averageMonthlyRevenue ?? null;

    list.manualDailyPrice = manualDailyPrice;
    list.minDailyPrice = minDailyPrice;
    list.weekendDailyPrice = weekendDailyPrice;
    list.hostInputUpdatedAt = now;
    list.pricingInputSource = 'host_input';
    list.pricingInputsUpdatedAt = now;
    list.dailyPrice = manualDailyPrice;
    list.raw = manualDailyPrice;
    list.currency = 'BRL';
    list.priceText = `R$${manualDailyPrice.toFixed(2)}`;

    // Essenciais: só grava o que veio; um campo omitido preserva o valor atual.
    const essentials: Array<[keyof List, unknown]> = [
      ['quartos', input.quartos],
      ['camas', input.camas],
      ['banheiros', input.banheiros],
      ['hospedes', input.hospedes],
      ['propertyType', typeof input.propertyType === 'string' ? input.propertyType.trim() || undefined : undefined],
    ];
    let essentialsTouched = false;
    for (const [field, value] of essentials) {
      if (value === undefined || value === null) continue;
      (list as any)[field] = value;
      essentialsTouched = true;
    }
    if (essentialsTouched) {
      list.essentialsSource = 'host_input';
      list.essentialsUpdatedAt = now;
    }

    const saved = await this.listRepository.save(list);

    if (previousManualDailyPrice === null || Math.abs(previousManualDailyPrice - manualDailyPrice) > 0.004) {
      await this.pricingInputHistoryRepository.save(
        this.pricingInputHistoryRepository.create({
          address,
          list: saved,
          user: { id: userId } as User,
          previousManualDailyPrice,
          newManualDailyPrice: manualDailyPrice,
          previousAverageMonthlyRevenue,
          newAverageMonthlyRevenue: saved.averageMonthlyRevenue ?? null,
          source: 'host_input',
          changedByUserId: userId,
        }),
      );
    }

    return this.toPublic(address, saved);
  }

  private async findOwned(addressId: string, userId: string): Promise<Address & { list: List }> {
    const address = await this.addressRepository.findOne({
      where: { id: addressId, user: { id: userId } },
      relations: ['list'],
    });
    if (!address?.list) {
      throw new NotFoundException('Propriedade não encontrada');
    }
    return address as Address & { list: List };
  }

  private money(value: unknown, field: string): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException(`${field} inválido`);
    }
    return Number(parsed.toFixed(2));
  }

  private toPublic(address: Address, list: List): PublicBaseline {
    const baseline = selectBaselinePrice(list);
    return {
      addressId: address.id,
      listId: list.id,
      dailyPrice: baseline.dailyPrice,
      source: baseline.source,
      updatedAt: baseline.updatedAt,
      stale: baseline.stale,
      reason: baseline.reason,
      minDailyPrice: list.minDailyPrice ?? null,
      weekendDailyPrice: list.weekendDailyPrice ?? null,
      essentialsSource: list.essentialsSource ?? null,
      essentialsUpdatedAt: list.essentialsUpdatedAt ?? null,
    };
  }
}
