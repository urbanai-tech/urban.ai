/**
 * Cache em memória com TTL e deduplicação de chamadas em voo.
 *
 * Para endpoints que custam dinheiro/tempo a montante (scraping headless,
 * RapidAPI): a mesma consulta repetida dentro do TTL não dispara nova chamada, e
 * N requisições simultâneas à mesma chave compartilham uma só chamada. Falhas
 * NÃO são cacheadas (a próxima tentativa refaz). Por instância do processo —
 * é um amortecedor de custo, não fonte de verdade.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();
  private readonly inflight = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  async getOrLoad(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value;
    if (hit) this.entries.delete(key);

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const promise = loader()
      .then((value) => {
        this.store(key, value);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });
    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }

  private store(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) {
      const t = this.now();
      for (const [k, v] of this.entries) if (v.expiresAt <= t) this.entries.delete(k);
      if (this.entries.size >= this.maxEntries) {
        const oldest = this.entries.keys().next().value;
        if (oldest !== undefined) this.entries.delete(oldest);
      }
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }
}
