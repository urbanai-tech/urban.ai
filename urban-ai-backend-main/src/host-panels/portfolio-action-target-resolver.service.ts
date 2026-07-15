import { BadRequestException, Injectable } from '@nestjs/common';
import { Address } from '../entities/addresses.entity';

const MS_PER_DAY = 86_400_000;

export type PortfolioBulkActionInput = {
  propertyIds: string[];
  action: string;
  payload?: Record<string, unknown>;
  dates?: string[];
  from?: string;
  to?: string;
};

export type PortfolioResolvedTargets = {
  explicit: boolean;
  dates: string[];
  byAddress: Map<string, string[]>;
  keys: Set<string>;
};

@Injectable()
export class PortfolioActionTargetResolverService {
  resolve(input: PortfolioBulkActionInput, addresses: Address[]): PortfolioResolvedTargets {
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
      return this.materialize(targetSets, true);
    }

    const dates = this.resolveDates(input);
    const fallback = new Map<string, Set<string>>();
    for (const address of addresses) {
      fallback.set(address.id, new Set(dates));
    }
    return this.materialize(fallback, false);
  }

  private resolveDates(input: PortfolioBulkActionInput): string[] {
    const payload = input.payload ?? {};
    const rawDates = [
      ...this.dateList(input.dates),
      ...this.dateList(payload.dates),
      ...this.dateList(payload.targetDates),
      ...this.dateList(payload.date),
      ...this.dateList(payload.targetDate),
    ];
    const explicitDates = Array.from(
      new Set(rawDates.map((date) => this.dateOnly(date)).filter(Boolean)),
    ) as string[];
    if (explicitDates.length) return explicitDates.slice(0, 360).sort();
    const from = input.from ?? (typeof payload.from === 'string' ? payload.from : undefined);
    const to = input.to ?? (typeof payload.to === 'string' ? payload.to : undefined);
    if (!from && !to) return [];
    return this.resolveRange(from, to, 1, 360);
  }

  private materialize(targets: Map<string, Set<string>>, explicit: boolean): PortfolioResolvedTargets {
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
      return value.filter(
        (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
      );
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

  private resolveRange(from?: string, to?: string, defaultDays = 1, maxDays = 360): string[] {
    const start = from ? this.dateOnly(from) : this.dateOnly(new Date());
    const end = to
      ? this.dateOnly(to)
      : this.dateOnly(new Date(this.startDate(start).getTime() + (defaultDays - 1) * MS_PER_DAY));
    if (!start || !end) throw new BadRequestException('Datas invalidas');
    const days = Math.max(
      1,
      Math.min(
        maxDays,
        Math.round((this.startDate(end).getTime() - this.startDate(start).getTime()) / MS_PER_DAY) + 1,
      ),
    );
    return Array.from({ length: days }, (_, index) =>
      this.dateOnly(new Date(this.startDate(start).getTime() + index * MS_PER_DAY)),
    );
  }

  private dateOnly(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  private startDate(value: string | null) {
    return new Date(`${value}T00:00:00.000Z`);
  }
}
