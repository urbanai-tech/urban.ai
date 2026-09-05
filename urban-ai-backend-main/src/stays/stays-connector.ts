import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * REST client para a Open API da Stays (stays.net).
 *
 * Contrato público: https://stays.net/external-api/ (05/09/2026).
 * Credenciais Basic; STAYS_API_BASE_URL contém o domínio da conta.
 * Leituras têm retry limitado. Escritas nunca são repetidas automaticamente:
 * um timeout pode ocorrer depois da aplicação no fornecedor.
 * A publicação fica desligada até validar o piloto na conta real.
 */

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
  apiBaseUrl?: string | null;
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

@Injectable()
export class StaysConnector {
  private readonly logger = new Logger(StaysConnector.name);
  private readonly baseURL = process.env.STAYS_API_BASE_URL || '';
  private readonly maxRetries = 3;

  private client(credentials: StaysCredentials): AxiosInstance {
    const accountUrl = credentials.apiBaseUrl || this.baseURL;
    if (!accountUrl) {
      throw new Error('STAYS_API_BASE_URL is required before calling Stays API');
    }

    const url = new URL(accountUrl);
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash) {
      throw new Error('STAYS_API_BASE_URL must be an HTTPS account URL without credentials or query');
    }
    const path = url.pathname.replace(/\/+$/, '');
    if (path !== '' && path !== '/external/v1') {
      throw new Error('STAYS_API_BASE_URL must use the account root or /external/v1');
    }
    const approvedHosts = new Set((process.env.STAYS_ALLOWED_API_HOSTS || '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean));
    if (this.baseURL) {
      try { approvedHosts.add(new URL(this.baseURL).hostname.toLowerCase()); }
      catch { /* A valid per-account URL can operate without a valid legacy fallback. */ }
    }
    if (!url.hostname.endsWith('.stays.net') && !approvedHosts.has(url.hostname.toLowerCase())) {
      throw new Error('Stays account host is not approved');
    }
    if (!credentials.clientId?.trim() || !credentials.clientSecret || credentials.clientId.includes(':')) {
      throw new Error('Stays clientId and clientSecret are required');
    }
    return axios.create({
      baseURL: `${url.origin}/external/v1`,
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

  private isRetryable(err: unknown): boolean {
    if (!(err instanceof AxiosError)) return true; // network error, retry
    const status = err.response?.status;
    if (!status) return true; // no response = network
    return status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);
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
   * Executa `fn` com retry exponencial em falhas retryable.
   * Em sucesso retorna o resultado; em erro não-retryable relança.
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
    const status = lastErr instanceof AxiosError ? lastErr.response?.status : undefined;
    throw new Error(status ? `Stays read failed (HTTP ${status})` : 'Stays read failed');
  }

  private mapListing(item: any): StaysListingSummary {
    if (!item || typeof item._id !== 'string' || !item._id.trim() ||
        !['active', 'inactive', 'hidden', 'draft'].includes(item.status)) {
      throw new Error('Invalid Stays listing contract: identifier or status');
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
      // Content is not an observation of a nightly calendar price.
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

  async listListings(credentials: StaysCredentials): Promise<StaysListingSummary[]> {
    const http = this.client(credentials);
    const listings: StaysListingSummary[] = [];
    const seen = new Set<string>();
    const limit = 20;
    for (let page = 0; page < 1000; page++) {
      const { data } = await this.withRetry(() => http.get('/content/listings', { params: { skip: page * limit, limit } }));
      if (!Array.isArray(data) || data.length > limit) throw new Error('Invalid Stays listings response: expected paginated array');
      for (const item of data) {
        const listing = this.mapListing(item);
        if (seen.has(listing.listingId)) throw new Error('Stays pagination returned duplicate listings; retry a full sync');
        seen.add(listing.listingId);
        listings.push(listing);
      }
      if (data.length < limit) return listings;
    }
    throw new Error('Stays pagination exceeded its safety limit');
  }

  async readCalendar(credentials: StaysCredentials, listingId: string, from: string, to: string): Promise<StaysCalendarDay[]> {
    if (!listingId?.trim() || !this.validDate(from) || !this.validDate(to) || from > to) {
      throw new Error('Invalid Stays calendar range or listing');
    }
    const http = this.client(credentials);
    const { data } = await this.withRetry(() => http.get(`/calendar/listing/${encodeURIComponent(listingId)}`, { params: { from, to } }));
    if (!Array.isArray(data)) throw new Error('Invalid Stays calendar response');
    const seen = new Set<string>();
    for (const day of data) {
      if (!day || !this.validDate(day.date) || day.date < from || day.date > to || seen.has(day.date) ||
          !Number.isInteger(day.avail) || day.avail < 0 || typeof day.closedToArrival !== 'boolean' ||
          typeof day.closedToDeparture !== 'boolean' || !Array.isArray(day.prices) ||
          day.prices.some((price: any) => !price || !Number.isInteger(price.minStay) || price.minStay < 1 ||
            !price._mcval || typeof price._mcval !== 'object' || Array.isArray(price._mcval) ||
            Object.values(price._mcval).some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0))) {
        throw new Error('Invalid Stays calendar day');
      }
      seen.add(day.date);
    }
    return data;
  }

  private validDate(value: string): boolean {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  async pushPrice(credentials: StaysCredentials, input: StaysPushPriceInput): Promise<StaysPushPriceResult> {
    if (process.env.STAYS_PRICE_WRITES_ENABLED !== 'true') {
      return { ok: false, rejectedReason: 'stays_price_writes_disabled' };
    }
    if (!this.validDate(input.date) || !input.listingId?.trim() || !/^[A-Z]{3}$/.test(input.currency) ||
        !Number.isSafeInteger(input.priceCents) || input.priceCents <= 0 ||
        !Number.isSafeInteger(input.previousPriceCents) || input.previousPriceCents <= 0) {
      return { ok: false, rejectedReason: 'invalid_price_input' };
    }
    const http = this.client(credentials);
    try {
      const { data } = await this.withRetry(() => http.get(`/content/listings/${encodeURIComponent(input.listingId)}`));
      const listing = this.mapListing(data);
      const meta = listing.providerMetadata;
      if (!listing.active || meta.currency !== input.currency || meta.cloneMasterId || meta.verticalPriceMasterId || meta.horizontalPriceMasterId) {
        return { ok: false, rejectedReason: 'listing_requires_pricing_mapping' };
      }
      // A master can affect other units even when it has no parent itself.
      // Re-read the complete paginated inventory; cached metadata is insufficient.
      const inventory = await this.listListings(credentials);
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
      // Pilot supports one existing rate only. Never invent minStay or alter restrictions.
      // Public table specifies an array; its curl example differs. Confirm live before enabling.
      await http.patch(`/calendar/listing/${encodeURIComponent(input.listingId)}/prices`, [{
        from: input.date, to: input.date,
        prices: [{ minStay: rate.minStay, _f_val: input.priceCents / 100 }],
      }]);
      const after = await this.readCalendar(credentials, input.listingId, input.date, input.date);
      if (after.length !== 1 || after[0].prices.length !== 1 || after[0].prices[0].minStay !== rate.minStay ||
          Math.round(after[0].prices[0]._mcval[input.currency] * 100) !== input.priceCents ||
          after[0].closedToArrival !== day.closedToArrival || after[0].closedToDeparture !== day.closedToDeparture) {
        throw new Error('Stays write could not be reconciled; inspect calendar before any new write');
      }
      return { ok: true };
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status && err.response.status < 500) {
        // rejeição de negócio (400/403/404/409) — log e devolve ok=false
        const reason = `stays_http_${err.response.status}`;
        this.logger.warn(
          `Stays pushPrice rejeitado listing=${input.listingId} date=${input.date}: ${reason}`,
        );
        return { ok: false, rejectedReason: reason };
      }
      // Axios errors contain request credentials. Do not propagate them to exception telemetry.
      throw new Error('Stays price operation failed; reconcile calendar before retrying');
    }
  }

  /**
   * Testa se o accessToken é válido — usado no fluxo "connect" para validar
   * antes de persistir.
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
