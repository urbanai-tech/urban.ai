import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as crypto from 'crypto';

/**
 * REST client para a Open API da Stays (stays.net).
 *
 * Contrato público: https://stays.net/external-api/ (05/09/2026).
 * Credenciais Basic (clientId:clientSecret).
 *
 * Destino (SSRF): o anfitrião informa APENAS o identificador da conta (slug do
 * subdomínio, `^[a-z0-9-]{1,63}$`). A URL é sempre montada como
 * `https://<slug>.stays.net/external/v1`, ou mapeada para um host de sandbox
 * declarado pela operação em `STAYS_ALLOWED_API_HOSTS` (`slug=host,...`).
 * Nenhuma URL vinda do usuário chega ao axios; redirects ficam desligados.
 *
 * Leituras têm retry limitado com backoff. Escritas nunca são repetidas
 * automaticamente: um timeout pode ocorrer depois da aplicação no fornecedor.
 * Toda escrita fica desligada até `STAYS_PRICE_WRITES_ENABLED=true`.
 */

export const STAYS_ACCOUNT_SLUG_PATTERN = /^[a-z0-9-]{1,63}$/;
const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789-';
const STAYS_ROOT_DOMAIN = 'stays.net';
const API_PATH = '/external/v1';

export interface StaysPushPriceInput {
  listingId: string;
  date: string;          // YYYY-MM-DD
  priceCents: number;
  currency: string;      // ISO 4217, default BRL
  idempotencyKey: string;
  previousPriceCents: number;
}

export interface StaysCredentials {
  clientId: string;
  clientSecret: string;
  /** Slug da conta Stays (subdomínio). null/undefined usa STAYS_API_BASE_URL do ambiente. */
  accountSlug?: string | null;
}

export interface StaysProviderMetadata {
  shortId: string | null;
  propertyId: string | null;
  currency: string | null;
  cloneMasterId: string | null;
  verticalPriceMasterId: string | null;
  horizontalPriceMasterId: string | null;
}

export interface StaysCalendarDay {
  date: string;
  avail: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  prices: Array<{ minStay: number; _mcval: Record<string, number> }>;
}

export interface StaysPushPriceResult {
  ok: boolean;
  externalReference?: string;
  rejectedReason?: string;
}

export interface StaysListingSummary {
  listingId: string;
  title: string;
  address: string | null;
  basePriceCents: number | null;
  active: boolean;
  providerMetadata: StaysProviderMetadata;
}

/** Categoria do erro: decide se a conta vira `error` ou continua ativa. */
export type StaysErrorKind = 'auth' | 'transient' | 'contract' | 'config';

/**
 * Erro saneado do conector — nunca carrega o AxiosError (que contém o header
 * Authorization) nem a mensagem do fornecedor.
 */
export class StaysConnectorError extends Error {
  constructor(
    message: string,
    readonly kind: StaysErrorKind,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'StaysConnectorError';
  }
}

export function isStaysAuthError(err: unknown): boolean {
  return err instanceof StaysConnectorError && err.kind === 'auth';
}

export function isStaysTransientError(err: unknown): boolean {
  return err instanceof StaysConnectorError && err.kind === 'transient';
}

/**
 * Valida o slug e o reconstrói a partir de um alfabeto constante: o valor que
 * segue adiante não é o texto recebido, e sim caracteres do alfabeto fixo.
 */
export function sanitizeStaysAccountSlug(raw: unknown): string {
  if (typeof raw !== 'string' || !STAYS_ACCOUNT_SLUG_PATTERN.test(raw) || raw.startsWith('-') || raw.endsWith('-')) {
    throw new StaysConnectorError('Invalid Stays account identifier', 'config');
  }
  let safe = '';
  for (const ch of raw) {
    const index = SLUG_ALPHABET.indexOf(ch);
    if (index < 0) throw new StaysConnectorError('Invalid Stays account identifier', 'config');
    safe += SLUG_ALPHABET.charAt(index);
  }
  return safe;
}

/**
 * Converte uma base URL legada (`https://<slug>.stays.net[/external/v1]`) em
 * slug. Devolve null para qualquer valor ambíguo (outro domínio, porta,
 * credenciais, query, path diferente, URL inválida).
 */
export function slugFromLegacyStaysUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash) return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (path !== '' && path !== API_PATH) return null;
  const host = url.hostname.toLowerCase();
  const suffix = `.${STAYS_ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  try {
    return sanitizeStaysAccountSlug(slug);
  } catch {
    return null;
  }
}

/** `STAYS_ALLOWED_API_HOSTS=slug=host,outro=host2` — só hosts declarados pela operação. */
function sandboxHostMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of (process.env.STAYS_ALLOWED_API_HOSTS || '').split(',')) {
    const [slug, host] = entry.split('=').map((part) => part?.trim().toLowerCase());
    if (!slug || !host) continue;
    if (!STAYS_ACCOUNT_SLUG_PATTERN.test(slug) || !/^[a-z0-9.-]{1,253}$/.test(host)) continue;
    map.set(slug, host);
  }
  return map;
}

/** Base URL legada do ambiente (configuração de operação, não input de usuário). */
function environmentBaseUrl(): string {
  const raw = process.env.STAYS_API_BASE_URL?.trim();
  if (!raw) {
    throw new StaysConnectorError('STAYS_API_BASE_URL is required before calling Stays API', 'config');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new StaysConnectorError('STAYS_API_BASE_URL must be an HTTPS account URL', 'config');
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash) {
    throw new StaysConnectorError('STAYS_API_BASE_URL must be an HTTPS account URL without credentials or query', 'config');
  }
  const path = url.pathname.replace(/\/+$/, '');
  if (path !== '' && path !== API_PATH) {
    throw new StaysConnectorError('STAYS_API_BASE_URL must use the account root or /external/v1', 'config');
  }
  return `${url.origin}${API_PATH}`;
}

export function resolveStaysApiBaseUrl(accountSlug?: string | null): string {
  if (accountSlug === null || accountSlug === undefined || accountSlug === '') {
    return environmentBaseUrl();
  }
  const slug = sanitizeStaysAccountSlug(accountSlug);
  const sandboxHost = sandboxHostMap().get(slug);
  if (sandboxHost) return `https://${sandboxHost}${API_PATH}`;
  return `https://${slug}.${STAYS_ROOT_DOMAIN}${API_PATH}`;
}

interface InventoryCacheEntry {
  expiresAt: number;
  listings: StaysListingSummary[];
}

@Injectable()
export class StaysConnector {
  private readonly logger = new Logger(StaysConnector.name);
  private readonly maxRetries = 3;
  private readonly inventoryCache = new Map<string, InventoryCacheEntry>();

  private client(credentials: StaysCredentials): AxiosInstance {
    const baseURL = resolveStaysApiBaseUrl(credentials.accountSlug);
    if (!credentials.clientId?.trim() || !credentials.clientSecret || credentials.clientId.includes(':')) {
      throw new StaysConnectorError('Stays clientId and clientSecret are required', 'config');
    }
    return axios.create({
      baseURL,
      timeout: 15_000,
      maxRedirects: 0,
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`, 'utf8').toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  private statusOf(err: unknown): number | undefined {
    return err instanceof AxiosError ? err.response?.status : undefined;
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof StaysConnectorError) return err.kind === 'transient';
    if (!(err instanceof AxiosError)) return true; // network error, retry
    const status = err.response?.status;
    if (!status) return true; // no response = network/timeout
    return status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);
  }

  /** Converte qualquer falha num erro saneado e classificado. */
  private sanitize(err: unknown, operation: 'read' | 'write'): StaysConnectorError {
    if (err instanceof StaysConnectorError) return err;
    const status = this.statusOf(err);
    const label = operation === 'read' ? 'Stays read failed' : 'Stays price operation failed; reconcile calendar before retrying';
    if (status === 401 || status === 403) {
      return new StaysConnectorError(`Stays authentication failed (HTTP ${status})`, 'auth', status);
    }
    if (this.isRetryable(err)) {
      return new StaysConnectorError(status ? `${label} (HTTP ${status})` : label, 'transient', status);
    }
    return new StaysConnectorError(status ? `${label} (HTTP ${status})` : label, 'contract', status);
  }

  private retryAfterMs(err: unknown): number | null {
    if (!(err instanceof AxiosError) || err.response?.status !== 429) return null;
    const headers = err.response.headers as any;
    const raw = typeof headers?.get === 'function'
      ? headers.get('retry-after')
      : headers?.['retry-after'];
    if (raw === undefined || raw === null || raw === '') return null;

    const seconds = Number(raw);
    if (Number.isFinite(seconds)) {
      return Math.min(Math.max(seconds * 1000, 0), 30_000);
    }

    const retryAt = Date.parse(String(raw));
    if (Number.isNaN(retryAt)) return null;
    return Math.min(Math.max(retryAt - Date.now(), 0), 30_000);
  }

  /**
   * Executa uma LEITURA com retry exponencial em falhas transitórias.
   * Sempre relança um StaysConnectorError saneado (sem headers/credenciais).
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!this.isRetryable(err)) break;
        if (attempt === this.maxRetries - 1) break;
        const delayMs =
          this.retryAfterMs(err) ?? 250 * 2 ** attempt + Math.random() * 250;
        this.logger.warn(
          `Stays API retry ${attempt + 1}/${this.maxRetries} em ${Math.round(delayMs)}ms`,
        );
        await this.sleep(delayMs);
      }
    }
    throw this.sanitize(lastErr, 'read');
  }

  private mapListing(item: any): StaysListingSummary {
    if (!item || typeof item._id !== 'string' || !item._id.trim() ||
        !['active', 'inactive', 'hidden', 'draft'].includes(item.status)) {
      throw new StaysConnectorError('Invalid Stays listing contract: identifier or status', 'contract');
    }
    const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
    const address = item.address && typeof item.address === 'object'
      ? [item.address.street, item.address.streetNumber, item.address.additional, item.address.city, item.address.stateCode]
          .filter((part) => typeof part === 'string' || typeof part === 'number').join(', ').slice(0, 255) || null
      : null;
    return {
      listingId: item._id,
      title: (text(item.internalName) || text(item._mstitle?.pt_BR) || text(item._mstitle?.en_US) || text(item.id) || item._id).slice(0, 255),
      address,
      // Conteúdo não é observação de preço de diária; o preço vem do calendário.
      basePriceCents: null,
      active: item.status === 'active',
      providerMetadata: {
        shortId: text(item.id), propertyId: text(item._idproperty), currency: text(item.deff_curr),
        cloneMasterId: text(item._idCloneGroupMaster),
        verticalPriceMasterId: text(item._idPriceGroupMaster),
        horizontalPriceMasterId: text(item._idPriceMaster),
      },
    };
  }

  private cacheKey(credentials: StaysCredentials): string {
    return crypto.createHash('sha256')
      .update(`${credentials.accountSlug ?? ''}|${credentials.clientId}`)
      .digest('hex');
  }

  private inventoryTtlMs(): number {
    const raw = Number(process.env.STAYS_INVENTORY_CACHE_TTL_MS);
    if (!Number.isFinite(raw) || raw < 0) return 5 * 60_000;
    return Math.min(raw, 15 * 60_000);
  }

  /** Esquece o inventário em cache (ex.: após reconectar ou desconectar). */
  invalidateInventory(credentials: StaysCredentials): void {
    this.inventoryCache.delete(this.cacheKey(credentials));
  }

  async listListings(credentials: StaysCredentials): Promise<StaysListingSummary[]> {
    const http = this.client(credentials);
    const listings: StaysListingSummary[] = [];
    const seen = new Set<string>();
    const limit = 20;
    for (let page = 0; page < 1000; page++) {
      const { data } = await this.withRetry(() => http.get('/content/listings', { params: { skip: page * limit, limit } }));
      if (!Array.isArray(data) || data.length > limit) {
        throw new StaysConnectorError('Invalid Stays listings response: expected paginated array', 'contract');
      }
      for (const item of data) {
        const listing = this.mapListing(item);
        if (seen.has(listing.listingId)) {
          throw new StaysConnectorError('Stays pagination returned duplicate listings; retry a full sync', 'contract');
        }
        seen.add(listing.listingId);
        listings.push(listing);
      }
      if (data.length < limit) {
        // Inventário completo: vira o cache curto usado pela checagem de masters.
        this.inventoryCache.set(this.cacheKey(credentials), {
          expiresAt: Date.now() + this.inventoryTtlMs(),
          listings,
        });
        return listings;
      }
    }
    throw new StaysConnectorError('Stays pagination exceeded its safety limit', 'contract');
  }

  /**
   * Inventário completo com cache curto por conta. Evita repaginar toda a conta
   * (~25 requisições para 500 listings) a cada push.
   */
  async getInventory(credentials: StaysCredentials): Promise<StaysListingSummary[]> {
    const cached = this.inventoryCache.get(this.cacheKey(credentials));
    if (cached && cached.expiresAt > Date.now()) return cached.listings;
    return this.listListings(credentials);
  }

  async getListing(credentials: StaysCredentials, listingId: string): Promise<StaysListingSummary> {
    if (!listingId?.trim()) throw new StaysConnectorError('Invalid Stays listing', 'contract');
    const http = this.client(credentials);
    const { data } = await this.withRetry(() => http.get(`/content/listings/${encodeURIComponent(listingId)}`));
    return this.mapListing(data);
  }

  async readCalendar(credentials: StaysCredentials, listingId: string, from: string, to: string): Promise<StaysCalendarDay[]> {
    if (!listingId?.trim() || !this.validDate(from) || !this.validDate(to) || from > to) {
      throw new StaysConnectorError('Invalid Stays calendar range or listing', 'contract');
    }
    const http = this.client(credentials);
    const { data } = await this.withRetry(() => http.get(`/calendar/listing/${encodeURIComponent(listingId)}`, { params: { from, to } }));
    if (!Array.isArray(data)) throw new StaysConnectorError('Invalid Stays calendar response', 'contract');
    const seen = new Set<string>();
    for (const day of data) {
      if (!day || !this.validDate(day.date) || day.date < from || day.date > to || seen.has(day.date) ||
          !Number.isInteger(day.avail) || day.avail < 0 || typeof day.closedToArrival !== 'boolean' ||
          typeof day.closedToDeparture !== 'boolean' || !Array.isArray(day.prices) ||
          day.prices.some((price: any) => !price || !Number.isInteger(price.minStay) || price.minStay < 1 ||
            !price._mcval || typeof price._mcval !== 'object' || Array.isArray(price._mcval) ||
            Object.values(price._mcval).some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0))) {
        throw new StaysConnectorError('Invalid Stays calendar day', 'contract');
      }
      seen.add(day.date);
    }
    return data;
  }

  /**
   * Preço vigente (centavos) de uma data no calendário Stays — baseline real
   * para guardrails e para a checagem de concorrência do push.
   * null quando a data tem 0 ou várias tarifas (exige mapeamento manual).
   */
  async readCurrentPriceCents(
    credentials: StaysCredentials,
    listingId: string,
    date: string,
    currency: string,
  ): Promise<number | null> {
    const days = await this.readCalendar(credentials, listingId, date, date);
    if (days.length !== 1 || days[0].prices.length !== 1) return null;
    const value = days[0].prices[0]._mcval[currency];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
    return Math.round(value * 100);
  }

  private validDate(value: string): boolean {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  static writesEnabled(): boolean {
    return process.env.STAYS_PRICE_WRITES_ENABLED === 'true';
  }

  async pushPrice(credentials: StaysCredentials, input: StaysPushPriceInput): Promise<StaysPushPriceResult> {
    if (!StaysConnector.writesEnabled()) {
      return { ok: false, rejectedReason: 'stays_price_writes_disabled' };
    }
    if (!this.validDate(input.date) || !input.listingId?.trim() || !/^[A-Z]{3}$/.test(input.currency) ||
        !Number.isSafeInteger(input.priceCents) || input.priceCents <= 0 ||
        !Number.isSafeInteger(input.previousPriceCents) || input.previousPriceCents <= 0) {
      return { ok: false, rejectedReason: 'invalid_price_input' };
    }
    const http = this.client(credentials);
    // Leituras de pré-condição: falhas aqui não escreveram nada.
    const listing = await this.getListing(credentials, input.listingId);
    const meta = listing.providerMetadata;
    if (!listing.active || meta.currency !== input.currency || meta.cloneMasterId || meta.verticalPriceMasterId || meta.horizontalPriceMasterId) {
      return { ok: false, rejectedReason: 'listing_requires_pricing_mapping' };
    }
    // Um master pode afetar outras unidades mesmo sem ter pai. O inventário
    // completo vem do cache curto por conta (TTL STAYS_INVENTORY_CACHE_TTL_MS).
    const inventory = await this.getInventory(credentials);
    if (!inventory.some((candidate) => candidate.listingId === input.listingId) ||
        inventory.some((candidate) => candidate.listingId !== input.listingId && [
          candidate.providerMetadata.cloneMasterId,
          candidate.providerMetadata.verticalPriceMasterId,
          candidate.providerMetadata.horizontalPriceMasterId,
        ].includes(input.listingId))) {
      return { ok: false, rejectedReason: 'listing_requires_pricing_mapping' };
    }
    const before = await this.readCalendar(credentials, input.listingId, input.date, input.date);
    const day = before[0];
    if (before.length !== 1 || day.prices.length !== 1) {
      return { ok: false, rejectedReason: 'calendar_requires_pricing_mapping' };
    }
    const rate = day.prices[0];
    if (Math.round(rate._mcval[input.currency] * 100) !== input.previousPriceCents) {
      return { ok: false, rejectedReason: 'previous_price_changed' };
    }
    try {
      // Piloto suporta uma tarifa existente. Nunca inventa minStay nem altera restrições.
      // A tabela pública especifica array; o exemplo curl difere. Confirmar na conta real.
      await http.patch(`/calendar/listing/${encodeURIComponent(input.listingId)}/prices`, [{
        from: input.date, to: input.date,
        prices: [{ minStay: rate.minStay, _f_val: input.priceCents / 100 }],
      }]);
    } catch (err) {
      const status = this.statusOf(err);
      if (status === 401 || status === 403) throw this.sanitize(err, 'write');
      if (status && status < 500 && status !== 408 && status !== 425 && status !== 429) {
        // rejeição de negócio (400/404/409/422) — sem mensagem do fornecedor
        const reason = `stays_http_${status}`;
        this.logger.warn(`Stays pushPrice rejeitado listing=${input.listingId} date=${input.date}: ${reason}`);
        return { ok: false, rejectedReason: reason };
      }
      // Timeout/5xx: a escrita pode ter sido aplicada. Nunca repetimos aqui.
      throw this.sanitize(err, 'write');
    }
    const after = await this.readCalendar(credentials, input.listingId, input.date, input.date);
    if (after.length !== 1 || after[0].prices.length !== 1 || after[0].prices[0].minStay !== rate.minStay ||
        Math.round(after[0].prices[0]._mcval[input.currency] * 100) !== input.priceCents ||
        after[0].closedToArrival !== day.closedToArrival || after[0].closedToDeparture !== day.closedToDeparture) {
      throw new StaysConnectorError('Stays write could not be reconciled; inspect calendar before any new write', 'contract');
    }
    return { ok: true };
  }

  /**
   * Testa se as credenciais são válidas — usado no fluxo "connect" para
   * validar antes de persistir.
   */
  async ping(credentials: StaysCredentials): Promise<boolean> {
    try {
      const http = this.client(credentials);
      const res = await http.get('/content/listings', { params: { skip: 0, limit: 1 } });
      if (res.status < 200 || res.status >= 300 || !Array.isArray(res.data) || res.data.length > 1) return false;
      res.data.forEach((item) => this.mapListing(item));
      return true;
    } catch {
      return false;
    }
  }
}
