import { forwardRef, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PropriedadeService } from 'src/propriedades/propriedade.service';
import { FirstAvailablePriceResult } from './types';

@Injectable()
export class AirbnbService {
  private readonly logger = new Logger(AirbnbService.name);
  private readonly apiHost = 'airbnb19.p.rapidapi.com';
  private readonly pricingApiHost = 'airbnb-search.p.rapidapi.com';
  private readonly pricingApiUrl = 'https://airbnb-search.p.rapidapi.com/property/get-price';
  private readonly apiKey: string;

  constructor(
    @Inject(forwardRef(() => PropriedadeService))
    private readonly propriedadeService: PropriedadeService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('RAPIDAPI_KEY') ?? '';
    if (!this.apiKey) {
      this.logger.warn('RAPIDAPI_KEY environment variable is not set; Airbnb price lookups will fail');
    } else {
      const masked = `${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}`;
      this.logger.log(`RapidAPI key loaded: ${masked}`);
    }
  }

  async getAvailability(propertyId: string) {
    const url = `https://${this.apiHost}/api/v1/checkAvailability`;
    const params = { propertyId };
    const headers = {
      'x-rapidapi-host': this.apiHost,
      'x-rapidapi-key': this.apiKey,
    };

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      await sleep(5000);

      const { data } = await axios.get(url, { params, headers });
      return data;
    } catch (error: any) {
      console.error('Erro ao consultar disponibilidade Airbnb:', error.response?.data || error.message);
      throw new InternalServerErrorException({
        status: false,
        message: 'Erro ao consultar disponibilidade no Airbnb',
        details: error.response?.data || error.message,
      });
    }
  }

  async getCheckoutPrice(propertyId: string, checkIn: string, checkOut: string) {
    const url = `https://${this.apiHost}/api/v1/getPropertyCheckoutPrice`;
    const params = {
      propertyId,
      currency: 'BRL',
      checkIn,
      checkOut,
    };

    const headers = {
      'x-rapidapi-host': this.apiHost,
      'x-rapidapi-key': this.apiKey,
    };

    try {
      const { data } = await axios.get(url, { params, headers });
      return data;
    } catch (error: any) {
      console.error('Erro ao consultar preco Airbnb:', error.response?.data || error.message);
      throw new InternalServerErrorException({
        status: false,
        message: 'Erro ao consultar preco no Airbnb',
        details: error.response?.data || error.message,
      });
    }
  }

  async getFirstAvailablePrice(propertyId: string): Promise<FirstAvailablePriceResult> {
    const propertyDetails = await this.getSafePropertyDetails(propertyId);

    try {
      const availability = await this.getAvailability(propertyId);

      if (!availability?.data?.length) {
        throw new InternalServerErrorException({
          status: false,
          message: 'Nao foi encontrada nenhuma disponibilidade para este imovel',
        });
      }

      let checkIn: string | null = null;
      let checkOut: string | null = null;

      for (const month of availability.data) {
        for (let i = 0; i < month.days.length; i++) {
          const day = month.days[i];

          if (day.available && day.available_for_checkin) {
            checkIn = day.date;
            const minNights = day.min_nights ?? 1;
            const maxNights = day.max_nights ?? 365;

            for (let j = i + minNights; j <= Math.min(i + maxNights, month.days.length - 1); j++) {
              const nextDay = month.days[j];
              if (nextDay.available_for_checkout) {
                checkOut = nextDay.date;
                break;
              }
            }
          }

          if (checkIn && checkOut) break;
        }
        if (checkIn && checkOut) break;
      }

      if (!checkIn || !checkOut) {
        throw new InternalServerErrorException({
          status: false,
          message: 'Nenhuma data valida para check-in e check-out encontrada',
        });
      }

      const price = await this.getCheckoutPrice(propertyId, checkIn, checkOut);
      return { price, propertyDetails };
    } catch (error) {
      this.logger.warn(
        `Consulta airbnb19 falhou para listing=${propertyId}; tentando airbnb-search: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.getFirstAvailablePriceFromPricingApi(propertyId, propertyDetails);
    }
  }

  private async getSafePropertyDetails(propertyId: string) {
    try {
      return await this.propriedadeService.getPropertyDetails(propertyId);
    } catch (error) {
      this.logger.warn(
        `Nao foi possivel obter detalhes do Airbnb para listing=${propertyId}; usando fallback conservador: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { bedrooms: 1, beds: 1, guestMaximum: 1 };
    }
  }

  private async getFirstAvailablePriceFromPricingApi(
    propertyId: string,
    propertyDetails: FirstAvailablePriceResult['propertyDetails'],
  ): Promise<FirstAvailablePriceResult> {
    const offsets = [7, 14, 30, 60, 90];
    const nightsOptions = [2, 3];

    for (const offsetDays of offsets) {
      for (const nights of nightsOptions) {
        const { checkIn, checkOut } = this.buildDateWindow(offsetDays, nights);
        try {
          const { data } = await axios.get(this.pricingApiUrl, {
            headers: {
              'X-RapidAPI-Host': this.pricingApiHost,
              'X-RapidAPI-Key': this.apiKey,
            },
            params: {
              id: propertyId,
              checkin: checkIn,
              checkout: checkOut,
              locale: 'PT-BR',
              currency: 'BRL',
            },
            timeout: 15000,
          });

          const total = this.extractTotalPrice(data);
          if (!total || total <= 0) continue;

          const daily = total / nights;
          return {
            price: {
              status: true,
              message: 'Preco obtido via airbnb-search',
              timestamp: Date.now(),
              data: {
                accommodationCost: Number(total.toFixed(2)),
                accommodationCostFormatted: `R$${total.toFixed(2)}`,
                accommodationCostTitle: `${nights} nights x R$${daily.toFixed(2)}`,
                details: [],
              },
            },
            propertyDetails,
          };
        } catch (error) {
          this.logger.warn(
            `airbnb-search sem preco para listing=${propertyId} (${checkIn}..${checkOut}): ${
              axios.isAxiosError(error)
                ? JSON.stringify(error.response?.data || error.message)
                : error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    throw new InternalServerErrorException({
      status: false,
      message: 'Nao foi possivel obter preco real do Airbnb nas APIs configuradas',
    });
  }

  private buildDateWindow(offsetDays: number, nights: number) {
    const checkInDate = new Date();
    checkInDate.setUTCDate(checkInDate.getUTCDate() + offsetDays);
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setUTCDate(checkOutDate.getUTCDate() + nights);
    return {
      checkIn: checkInDate.toISOString().slice(0, 10),
      checkOut: checkOutDate.toISOString().slice(0, 10),
    };
  }

  private extractTotalPrice(payload: unknown): number | null {
    const candidates: Array<{ value: number; score: number }> = [];

    const walk = (value: unknown, path: string[]) => {
      if (value === null || value === undefined) return;

      const keyPath = path.join('.').toLowerCase();
      const parsed = this.parseMoney(value, keyPath);
      if (parsed && parsed >= 50 && parsed <= 100000 && /price|total|amount|cost|rate/.test(keyPath)) {
        candidates.push({ value: parsed, score: this.pricePathScore(keyPath) });
      }

      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, [...path, String(index)]));
        return;
      }

      if (typeof value === 'object') {
        Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
          walk(item, [...path, key]);
        });
      }
    };

    walk(payload, []);
    candidates.sort((a, b) => b.score - a.score || b.value - a.value);
    return candidates[0]?.value ?? null;
  }

  private pricePathScore(path: string): number {
    let score = 0;
    if (/totalprice|price_total|pricetotal|total_price/.test(path)) score += 120;
    if (path.includes('pricebreakdown') && path.includes('total')) score += 100;
    if (path.includes('bookingprefetchdata') && path.includes('price')) score += 80;
    if (path.includes('accommodation') || path.includes('base')) score += 60;
    if (path.includes('barprice') || path.includes('displayprice')) score += 50;
    if (path.includes('price')) score += 30;
    if (/fee|tax|discount|deposit|service|cleaning/.test(path)) score -= 80;
    if (/night|nightly/.test(path)) score -= 20;
    return score;
  }

  private parseMoney(value: unknown, path: string): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (/micros|micro/.test(path)) return value / 1_000_000;
      if (/cents|centavos|minor/.test(path)) return value / 100;
      return value;
    }

    if (typeof value !== 'string') return null;

    const cleaned = value
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  getFirstAvailablePriceMock_bkp(propertyId: string): Promise<any> {
    return new Promise((resolve) => {
      const delay = Math.random() * 1000 + 1000;

      setTimeout(() => {
        const dadosAirbnb = {
          price: {
            data: {
              accommodationCost: 350,
            },
          },
          propertyDetails: {
            bedrooms: 3,
            bathrooms: 2,
          },
        };

        resolve(dadosAirbnb);
      }, delay);
    });
  }
}
