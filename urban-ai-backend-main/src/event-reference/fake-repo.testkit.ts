import { randomUUID } from 'crypto';
import { FindOperator } from 'typeorm';

/**
 * Repositório em memória só para os specs da lista de referência: suporta igualdade e os
 * operadores do TypeORM usados nos serviços (Between, In, Not, LessThan). Não é um mock de
 * comportamento — o filtro roda de verdade sobre as linhas guardadas.
 */
export class FakeRepo<T extends Record<string, any>> {
  rows: T[] = [];

  create(data: Partial<T>): T {
    return { ...data } as T;
  }

  async save(entity: any): Promise<any> {
    if (!entity.id) {
      entity.id = randomUUID();
      entity.createdAt = entity.createdAt ?? new Date();
      this.rows.push(entity);
      return entity;
    }
    const idx = this.rows.findIndex((r) => r.id === entity.id);
    if (idx >= 0) this.rows[idx] = Object.assign(this.rows[idx], entity);
    else this.rows.push(entity);
    return this.rows[idx >= 0 ? idx : this.rows.length - 1];
  }

  async insert(items: any[]): Promise<void> {
    for (const item of items) await this.save({ ...item });
  }

  private matchValue(actual: any, expected: any): boolean {
    if (expected instanceof FindOperator) {
      const { type, value } = expected as unknown as { type: string; value: any };
      if (type === 'between') return actual >= value[0] && actual <= value[1];
      if (type === 'in') return (value as any[]).includes(actual);
      if (type === 'not') return !this.matchValue(actual, value);
      if (type === 'lessThan') return actual < value;
      if (type === 'isNull') return actual === null || actual === undefined;
      throw new Error(`operador não suportado no fake: ${type}`);
    }
    if (expected === null) return actual === null || actual === undefined;
    if (expected instanceof Date) return actual instanceof Date && actual.getTime() === expected.getTime();
    return actual === expected;
  }

  private matches(row: any, where: any): boolean {
    if (!where) return true;
    if (Array.isArray(where)) return where.some((w) => this.matches(row, w));
    return Object.entries(where).every(([key, expected]) => this.matchValue(row[key], expected));
  }

  async find(options: { where?: any; order?: Record<string, 'ASC' | 'DESC'>; take?: number; skip?: number } = {}): Promise<T[]> {
    let out = this.rows.filter((r) => this.matches(r, options.where));
    if (options.order) {
      const [[key, dir]] = Object.entries(options.order);
      out = [...out].sort((a: any, b: any) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * (dir === 'DESC' ? -1 : 1));
    }
    if (options.skip) out = out.slice(options.skip);
    if (options.take) out = out.slice(0, options.take);
    return out;
  }

  async findAndCount(options: any): Promise<[T[], number]> {
    const all = await this.find({ where: options.where, order: options.order });
    const sliced = await this.find(options);
    return [sliced, all.length];
  }

  async findOne(options: { where?: any }): Promise<T | null> {
    return this.rows.find((r) => this.matches(r, options.where)) ?? null;
  }

  async update(criteria: string | Record<string, any>, patch: Partial<T>): Promise<void> {
    const where = typeof criteria === 'string' ? { id: criteria } : criteria;
    for (const row of this.rows) if (this.matches(row, where)) Object.assign(row, patch);
  }

  async delete(criteria: Record<string, any>): Promise<void> {
    this.rows = this.rows.filter((r) => !this.matches(r, criteria));
  }
}
