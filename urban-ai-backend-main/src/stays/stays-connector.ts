import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * REST client para a Open API da Stays (stays.net).
 *
 * Documentação oficial: a confirmar na reunião inicial (ver
 * docs/outreach/stays-contato-comercial.md). Enquanto isso, o shape das
 * chamadas aqui segue o padrão comum de APIs de channel manager:
 *   - POST /prices (push de preço por date range)
 *   - GET /listings
 *   - GET /reservations
 *
 * Os paths são lidos de env var STAYS_API_BASE_URL — facilita trocar para
 * sandbox Stays se/quando disponível.
 *
 * Retry: exponencial, 3 tentativas, só para erros de rede e 5xx.
 * 4xx não retenta — é bug de cliente e repetir não resolve.
 *
 * Idempotência: o caller gera a chave (em PriceUpdate.idempotencyKey) e
 * passa via header Idempotency-Key. A Stays deve honrar; se não honrar,
 * nosso próprio log de PriceUpdate previne dupla escrita.
 */

export interface StaysPushPriceInput {
  listingId: string;
  date: string;          // YYYY-MM-DD
  priceCents: number;
  currency: string;      // ISO 4217, default BRL
  idempotencyKey: string;
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
}

@Injectable()
export class StaysConnector {
  private readonly logger = new Logger(StaysConnector.name);
  private readonly baseURL = process.env.STAYS_API_BASE_URL || 'https://api.stays.net';
  private readonly maxRetries = 3;

  private client(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: this.baseURL,
      timeout: 15_000,
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
    return status >= 500 && status < 600;
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
        if (!this.isRetryable(err)) throw err;
        if (attempt === this.maxRetries - 1) break;
        const delayMs = 250 * 2 ** attempt + Math.random() * 250;
        this.logger.warn(
          `Stays API retry ${attempt + 1}/${this.maxRetries} em ${Math.round(delayMs)}ms`,
        );
        await this.sleep(delayMs);
      }
    }
    throw lastErr;
  }

  async listListings(accessToken: string): Promise<StaysListingSummary[]> {
    const http = this.client(accessToken);
    const { data } = await this.withRetry(() => http.get('/listings'));
    if (!Array.isArray(data?.items)) return [];
    return data.items.map((item: any) => ({
      listingId: String(item.id),
      title: item.title || item.name || '',
      address: item.address?.shortAddress || item.address || null,
      basePriceCents: typeof item.basePriceCents === 'number' ? item.basePriceCents : null,
      active: item.active !== false,
    }));
  }

  async pushPrice(accessToken: string, input: StaysPushPriceInput): Promise<StaysPushPriceResult> {
    const http = this.client(accessToken);

    try {
      const { data } = await this.withRetry(() =>
        http.post(
          `/listings/${encodeURIComponent(input.listingId)}/prices`,
          {
            date: input.date,
            priceCents: input.priceCents,
            currency: input.currency,
          },
          {
            headers: { 'Idempotency-Key': input.idempotencyKey },
          },
        ),
      );
      return {
        ok: true,
        externalReference: data?.id || data?.reference || undefined,
      };
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status && err.response.status < 500) {
        // rejeição de negócio (400/403/404/409) — log e devolve ok=false
        const reason = err.response.data?.message || err.response.statusText || 'rejected';
        this.logger.warn(
          `Stays pushPrice rejeitado listing=${input.listingId} date=${input.date}: ${reason}`,
        );
        return { ok: false, rejectedReason: reason };
      }
      throw err;
    }
  }

  /**
   * Testa se o accessToken é válido — usado no fluxo "connect" para validar
   * antes de persistir.
   */
  async ping(accessToken: string): Promise<boolean> {
    try {
      const http = this.client(accessToken);
      const res = await http.get('/me');
      return res.status >= 200 && res.status < 300;
    } catch {
      return false;
    }
  }
}
