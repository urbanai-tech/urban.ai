import { forwardRef, Inject, Injectable, InternalServerErrorException, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as Sentry from '@sentry/nestjs';
import axios from 'axios';
import { Repository } from 'typeorm';
import { AirbnbPricingAttemptLog, AirbnbPricingAttemptStatus } from 'src/entities/airbnb-pricing-attempt-log.entity';
import { PropriedadeService } from 'src/propriedades/propriedade.service';
import { FirstAvailablePriceResult } from './types';
import {
  AirbnbAvailabilityCalendar,
  AirbnbAvailabilityCalendarDay,
  AirbnbBrowserScraperService,
  AirbnbHeadlessDiagnosticReason,
  AirbnbHeadlessScrapeError,
  AirbnbRenderedHostListing,
} from './airbnb-browser-scraper.service';

type AirbnbPriceStrategy = 'browser-first' | 'api-first' | 'browser-only' | 'api-only';
type AirbnbPriceSource = 'airbnb-search' | 'airbnb-browser' | 'headless' | string;
type DateWindow = { checkIn: string; checkOut: string };
type AirbnbPricingFailureReason =
  | 'captcha_blocked'
  | 'systemic_block'
  | 'timeout'
  | 'price_not_found'
  | 'layout_parser'
  | 'api_blocked'
  | 'api_invalid_response'
  | 'api_error'
  | 'navigation_error'
  | 'unknown';

type AirbnbPricingContext = {
  listingId: string;
  source: AirbnbPriceSource;
  checkIn?: string;
  checkOut?: string;
  reason?: AirbnbPricingFailureReason;
};

class AirbnbPricingError extends InternalServerErrorException {
  declare cause: unknown;

  constructor(
    message: string,
    readonly reason: AirbnbPricingFailureReason,
    readonly context: AirbnbPricingContext,
    readonly retryable = true,
    readonly originalCause?: unknown,
  ) {
    super({
      status: false,
      message,
      reason,
    }, { cause: originalCause });
    this.name = 'AirbnbPricingError';
    this.message = message;
    this.cause = originalCause;
  }
}

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
    @Optional()
    private readonly browserScraper?: AirbnbBrowserScraperService,
    @Optional()
    @InjectRepository(AirbnbPricingAttemptLog)
    private readonly pricingAttemptRepo?: Repository<AirbnbPricingAttemptLog>,
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
    return this.getFirstAvailablePriceFromConfiguredSources(propertyId, propertyDetails);
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

  private async getFirstAvailablePriceFromConfiguredSources(
    propertyId: string,
    propertyDetails: FirstAvailablePriceResult['propertyDetails'],
  ): Promise<FirstAvailablePriceResult> {
    const strategy = this.priceStrategy;
    const searchPlan = await this.resolveAvailabilityAwarePriceSearchWindows(propertyId, strategy);
    const windows = searchPlan.windows;

    if (strategy === 'browser-first' && this.browserScraper?.isEnabled()) {
      const browserQuote = await this.findFirstPriceAcrossWindows(
        propertyId,
        propertyDetails,
        windows,
        'headless',
        (checkIn, checkOut) => this.getPriceForDateWindowFromBrowser(propertyId, checkIn, checkOut, propertyDetails),
      );

      if (browserQuote) return browserQuote;

      const apiQuote = this.paidApiFallbackEnabled
        ? await this.findFirstPriceAcrossWindows(
            propertyId,
            propertyDetails,
            windows,
            'airbnb-search',
            (checkIn, checkOut) =>
              this.getPriceForDateWindowFromPricingApi(propertyId, checkIn, checkOut, propertyDetails),
          )
        : null;

      if (apiQuote) return apiQuote;
      this.reportPricingFailure(propertyId, 'all-browser-first-sources-failed', {
        windows,
        windowSource: searchPlan.source,
        calendarLoaded: searchPlan.calendarLoaded,
      });
      throw new InternalServerErrorException({
        status: false,
        message: 'Nao foi possivel obter preco real do Airbnb nas fontes configuradas',
      });
    }

    const configuredQuote = await this.findFirstPriceAcrossWindows(
      propertyId,
      propertyDetails,
      windows,
      'fontes configuradas',
      (checkIn, checkOut) => this.getPriceForDateWindow(propertyId, checkIn, checkOut, propertyDetails),
    );

    if (configuredQuote) return configuredQuote;

    this.reportPricingFailure(propertyId, 'all-configured-sources-failed', {
      windows,
      strategy,
      windowSource: searchPlan.source,
      calendarLoaded: searchPlan.calendarLoaded,
    });
    throw new InternalServerErrorException({
      status: false,
      message: 'Nao foi possivel obter preco real do Airbnb nas fontes configuradas',
    });
  }

  private async resolveAvailabilityAwarePriceSearchWindows(propertyId: string, strategy: AirbnbPriceStrategy): Promise<{
    windows: DateWindow[];
    source: 'calendar' | 'fixed';
    calendarLoaded: boolean;
    calendarDayCount?: number;
  }> {
    const fallbackWindows = this.priceSearchWindows();
    if (strategy === 'api-only') {
      return {
        windows: fallbackWindows,
        source: 'fixed',
        calendarLoaded: false,
      };
    }

    const calendar = await this.loadAvailabilityCalendar(propertyId);

    if (!calendar) {
      return {
        windows: fallbackWindows,
        source: 'fixed',
        calendarLoaded: false,
      };
    }

    const windows = this.findBookableWindowsFromAvailabilityCalendar(calendar);
    if (windows.length === 0) {
      this.logger.warn(
        `Calendario Airbnb carregado sem janelas bookable para listing=${propertyId}; sem fallback cego`,
      );
      await this.recordPricingAttempt({
        listingId: propertyId,
        source: 'airbnb-calendar',
        checkIn: this.todayIso(),
        checkOut: this.addDaysIso(this.todayIso(), 1),
        status: 'skipped',
        reason: 'calendar_no_bookable_window',
        durationMs: 0,
        metadata: {
          calendarDayCount: calendar.days.length,
          finalUrl: calendar.finalUrl,
        },
      });
    } else {
      this.logger.log(
        `Calendario Airbnb gerou ${windows.length} janelas bookable para listing=${propertyId}`,
      );
    }

    return {
      windows,
      source: 'calendar',
      calendarLoaded: true,
      calendarDayCount: calendar.days.length,
    };
  }

  private async loadAvailabilityCalendar(propertyId: string): Promise<AirbnbAvailabilityCalendar | null> {
    if (!this.browserScraper?.isEnabled()) return null;

    const scraper = this.browserScraper as AirbnbBrowserScraperService & {
      scrapeAvailabilityCalendar?: (roomId: string) => Promise<AirbnbAvailabilityCalendar | null>;
    };
    if (typeof scraper.scrapeAvailabilityCalendar !== 'function') return null;

    try {
      return await scraper.scrapeAvailabilityCalendar(propertyId);
    } catch (error) {
      this.logger.warn(
        `Nao foi possivel carregar calendario Airbnb para listing=${propertyId}; usando janelas fixas: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private findBookableWindowsFromAvailabilityCalendar(
    calendar: AirbnbAvailabilityCalendar,
    limit = 12,
  ): DateWindow[] {
    const sortedDays = calendar.days
      .filter((day) => this.isIsoDate(day.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    const dayByDate = new Map(sortedDays.map((day) => [day.date, day]));
    const windows: DateWindow[] = [];
    const today = this.todayIso();

    for (const day of sortedDays) {
      if (day.date < today || !this.isBookableCheckInDay(day)) continue;

      for (const nights of this.calendarNightOptions(day)) {
        const checkOut = this.addDaysIso(day.date, nights);
        if (!this.isCalendarWindowBookable(day.date, checkOut, dayByDate)) continue;

        windows.push({ checkIn: day.date, checkOut });
        break;
      }

      if (windows.length >= limit) break;
    }

    return windows;
  }

  private async findFirstPriceAcrossWindows(
    propertyId: string,
    propertyDetails: FirstAvailablePriceResult['propertyDetails'],
    windows: DateWindow[],
    sourceLabel: string,
    getter: (checkIn: string, checkOut: string) => Promise<FirstAvailablePriceResult>,
  ): Promise<FirstAvailablePriceResult | null> {
    for (const { checkIn, checkOut } of windows) {
      try {
        return await getter(checkIn, checkOut);
      } catch (error) {
        if (this.isNonRetryablePricingError(error)) {
          this.reportPricingFailureFromError(error, { listingId: propertyId, source: sourceLabel, checkIn, checkOut });
          throw error;
        }

        this.reportPricingFailureFromError(error, { listingId: propertyId, source: sourceLabel, checkIn, checkOut });
        this.logger.warn(
          `${sourceLabel} sem preco para listing=${propertyId} (${checkIn}..${checkOut}): ${this.formatPricingError(error)}`,
        );
      }
    }

    return null;
  }

  private priceSearchWindows(): DateWindow[] {
    const offsets = [7, 14, 30, 60, 90];
    const nightsOptions = [2, 3];
    return offsets.flatMap((offsetDays) =>
      nightsOptions.map((nights) => this.buildDateWindow(offsetDays, nights)),
    );
  }

  async getPriceForDateWindow(
    propertyId: string,
    checkIn: string,
    checkOut: string,
    propertyDetails: FirstAvailablePriceResult['propertyDetails'] = {
      bedrooms: 1,
      beds: 1,
      guestMaximum: 1,
    },
  ): Promise<FirstAvailablePriceResult> {
    const strategy = this.priceStrategy;

    if (strategy === 'browser-only') {
      return this.getPriceForDateWindowFromBrowser(propertyId, checkIn, checkOut, propertyDetails);
    }

    if (strategy === 'api-only' || !this.browserScraper?.isEnabled()) {
      return this.getPriceForDateWindowFromPricingApi(propertyId, checkIn, checkOut, propertyDetails);
    }

    if (strategy === 'api-first') {
      return this.getPriceWithFallback({
        primaryName: 'airbnb-search',
        fallbackName: 'headless',
        primary: () => this.getPriceForDateWindowFromPricingApi(propertyId, checkIn, checkOut, propertyDetails),
        fallback: () => this.getPriceForDateWindowFromBrowser(propertyId, checkIn, checkOut, propertyDetails),
        listingId: propertyId,
      });
    }

    return this.getPriceWithFallback({
      primaryName: 'headless',
      fallbackName: 'airbnb-search',
      primary: () => this.getPriceForDateWindowFromBrowser(propertyId, checkIn, checkOut, propertyDetails),
      fallback: () => this.getPriceForDateWindowFromPricingApi(propertyId, checkIn, checkOut, propertyDetails),
      listingId: propertyId,
    });
  }

  private get priceStrategy(): AirbnbPriceStrategy {
    const configured = String(
      this.configService.get<string>('AIRBNB_PRICE_STRATEGY') ||
      this.configService.get<string>('AIRBNB_PRICE_PROVIDER') ||
      '',
    ).toLowerCase();

    if (['api-first', 'airbnb-search', 'rapidapi', 'rapid-api'].includes(configured)) return 'api-first';
    if (['api-only', 'rapidapi-only', 'airbnb-search-only'].includes(configured)) return 'api-only';
    if (['browser-only', 'headless-only', 'scraper-only'].includes(configured)) return 'browser-only';
    return 'browser-first';
  }

  private get paidApiFallbackEnabled(): boolean {
    return this.configService.get<string>('AIRBNB_PRICE_FALLBACK_API_ENABLED') !== 'false';
  }

  private async getPriceWithFallback(input: {
    listingId: string;
    primaryName: string;
    fallbackName: string;
    primary: () => Promise<FirstAvailablePriceResult>;
    fallback: () => Promise<FirstAvailablePriceResult>;
  }): Promise<FirstAvailablePriceResult> {
    try {
      return await input.primary();
    } catch (error) {
      this.reportPricingFailureFromError(error, {
        listingId: input.listingId,
        source: input.primaryName,
      });

      if (this.isSystemicBlock(error)) {
        this.logger.warn(
          `${input.primaryName} bloqueado para listing=${input.listingId}; sem retry/fallback inutil: ${
            this.formatPricingError(error)
          }`,
        );
        throw error;
      }

      this.logger.warn(
        `${input.primaryName} falhou para listing=${input.listingId}; tentando ${input.fallbackName}: ${
          this.formatPricingError(error)
        }`,
      );
      return input.fallback();
    }
  }

  async resolveListingHostId(propertyId: string): Promise<{ hostId: string | null; hostName: string | null }> {
    const snapshot = await this.browserScraper?.scrapeListing(propertyId);
    return {
      hostId: snapshot?.hostId ?? null,
      hostName: snapshot?.hostName ?? null,
    };
  }

  async scrapeHostListingsWithBrowser(hostId: string): Promise<AirbnbRenderedHostListing[]> {
    return this.browserScraper?.scrapeHostListings(hostId) ?? [];
  }

  private async getPriceForDateWindowFromPricingApi(
    propertyId: string,
    checkIn: string,
    checkOut: string,
    propertyDetails: FirstAvailablePriceResult['propertyDetails'],
  ): Promise<FirstAvailablePriceResult> {
    const startedAt = new Date();
    const startMs = Date.now();
    const nights = this.diffCalendarDays(checkIn, checkOut);
    const context: AirbnbPricingContext = {
      listingId: propertyId,
      source: 'airbnb-search',
      checkIn,
      checkOut,
    };

    let data: unknown;
    try {
      const response = await axios.get(this.pricingApiUrl, {
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
      data = response.data;
    } catch (error) {
      const pricingError = this.toPricingError(error, context);
      await this.recordPricingAttempt({
        listingId: propertyId,
        source: 'airbnb-search',
        checkIn,
        checkOut,
        status: pricingError.reason === 'timeout' ? 'timeout' : 'failed',
        reason: pricingError.reason,
        durationMs: Date.now() - startMs,
        startedAt,
        finishedAt: new Date(),
        metadata: { message: pricingError.message },
      });
      throw pricingError;
    }

    const total = this.extractTotalPrice(data);
    if (!total || total <= 0) {
      await this.recordPricingAttempt({
        listingId: propertyId,
        source: 'airbnb-search',
        checkIn,
        checkOut,
        status: 'failed',
        reason: 'api_invalid_response',
        durationMs: Date.now() - startMs,
        startedAt,
        finishedAt: new Date(),
        metadata: { responseShape: this.compactPayloadForAttemptLog(data) },
      });
      throw new AirbnbPricingError(
        'Resposta do airbnb-search nao trouxe preco total valido',
        'api_invalid_response',
        context,
        true,
        data,
      );
    }

    const daily = total / nights;
    await this.recordPricingAttempt({
      listingId: propertyId,
      source: 'airbnb-search',
      checkIn,
      checkOut,
      status: 'success',
      durationMs: Date.now() - startMs,
      priceTotal: total,
      dailyPrice: daily,
      startedAt,
      finishedAt: new Date(),
      metadata: { nights },
    });

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
      checkIn,
      checkOut,
      nights,
      source: 'airbnb-search',
    };
  }

  private async getPriceForDateWindowFromBrowser(
    propertyId: string,
    checkIn: string,
    checkOut: string,
    propertyDetails: FirstAvailablePriceResult['propertyDetails'],
  ): Promise<FirstAvailablePriceResult> {
    const startedAt = new Date();
    const startMs = Date.now();
    const nights = this.diffCalendarDays(checkIn, checkOut);
    const context: AirbnbPricingContext = {
      listingId: propertyId,
      source: 'airbnb-browser',
      checkIn,
      checkOut,
    };

    let snapshot: Awaited<ReturnType<AirbnbBrowserScraperService['scrapeListing']>>;
    try {
      snapshot = await this.browserScraper?.scrapeListing(propertyId, { checkIn, checkOut });
    } catch (error) {
      const pricingError = this.toPricingError(error, context);
      await this.recordPricingAttempt({
        listingId: propertyId,
        source: 'airbnb-browser',
        checkIn,
        checkOut,
        status: pricingError.reason === 'timeout' ? 'timeout' : 'failed',
        reason: pricingError.reason,
        durationMs: Date.now() - startMs,
        startedAt,
        finishedAt: new Date(),
        metadata: { message: pricingError.message },
      });
      throw pricingError;
    }

    if (snapshot?.captchaDetected) {
      await this.recordPricingAttempt({
        listingId: propertyId,
        source: 'airbnb-browser',
        checkIn,
        checkOut,
        status: 'failed',
        reason: 'captcha_blocked',
        durationMs: Date.now() - startMs,
        finalUrl: snapshot.finalUrl,
        startedAt,
        finishedAt: new Date(),
        metadata: { priceCandidateCount: snapshot.priceCandidateCount ?? 0 },
      });
      throw new AirbnbPricingError(
        'Airbnb exibiu verificacao/captcha no fallback headless',
        'captcha_blocked',
        context,
        false,
      );
    }

    const total = snapshot?.priceTotal;
    if (!total || total <= 0) {
      const reason = this.normalizeHeadlessReason(snapshot?.diagnosticReason) ?? 'price_not_found';
      await this.recordPricingAttempt({
        listingId: propertyId,
        source: 'airbnb-browser',
        checkIn,
        checkOut,
        status: 'failed',
        reason,
        durationMs: Date.now() - startMs,
        finalUrl: snapshot?.finalUrl ?? null,
        startedAt,
        finishedAt: new Date(),
        metadata: {
          priceCandidateCount: snapshot?.priceCandidateCount ?? 0,
          title: snapshot?.title ?? null,
        },
      });
      throw new AirbnbPricingError(
        'Fallback headless nao encontrou preco renderizado valido',
        reason,
        context,
        reason !== 'captcha_blocked',
        {
          finalUrl: snapshot?.finalUrl,
          priceCandidateCount: snapshot?.priceCandidateCount ?? 0,
          title: snapshot?.title,
        },
      );
    }

    const daily = total / nights;
    await this.recordPricingAttempt({
      listingId: propertyId,
      source: 'airbnb-browser',
      checkIn,
      checkOut,
      status: 'success',
      durationMs: Date.now() - startMs,
      priceTotal: total,
      dailyPrice: daily,
      finalUrl: snapshot.finalUrl,
      startedAt,
      finishedAt: new Date(),
      metadata: {
        nights,
        priceText: snapshot.priceText,
        priceCandidateCount: snapshot.priceCandidateCount,
      },
    });

    return {
      price: {
        status: true,
        message: 'Preco obtido via fallback headless Airbnb',
        timestamp: Date.now(),
        data: {
          accommodationCost: Number(total.toFixed(2)),
          accommodationCostFormatted: `R$${total.toFixed(2)}`,
          accommodationCostTitle: `${nights} nights x R$${daily.toFixed(2)}`,
          details: snapshot.priceText
            ? [{
                type: 'rendered_price',
                localizedTitle: snapshot.priceText,
                amount: Number(total.toFixed(2)),
                amountFormatted: `R$${total.toFixed(2)}`,
              }]
            : [],
        },
      },
      propertyDetails,
      checkIn,
      checkOut,
      nights,
      source: 'airbnb-browser',
    };
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

  private isBookableCheckInDay(day: AirbnbAvailabilityCalendarDay): boolean {
    return day.available && day.bookable && day.availableForCheckin;
  }

  private calendarNightOptions(day: AirbnbAvailabilityCalendarDay): number[] {
    const minNights = Math.max(1, day.minNights ?? 1);
    const maxNights = day.maxNights ?? 365;
    if (maxNights < minNights) return [];

    const preferredNights = [2, 3]
      .map((nights) => Math.max(nights, minNights))
      .filter((nights) => nights <= maxNights);
    const candidates = preferredNights.length > 0 ? preferredNights : [minNights];

    return [...new Set(candidates)]
      .filter((nights) => nights >= minNights && nights <= maxNights)
      .sort((a, b) => a - b);
  }

  private isCalendarWindowBookable(
    checkIn: string,
    checkOut: string,
    dayByDate: Map<string, AirbnbAvailabilityCalendarDay>,
  ): boolean {
    const checkInDay = dayByDate.get(checkIn);
    if (!checkInDay) return false;

    const nights = this.diffCalendarDays(checkIn, checkOut);
    const minNights = Math.max(1, checkInDay.minNights ?? 1);
    const maxNights = checkInDay.maxNights ?? 365;
    if (nights < minNights || nights > maxNights) return false;

    for (let offset = 0; offset < nights; offset += 1) {
      const stayDate = this.addDaysIso(checkIn, offset);
      const stayDay = dayByDate.get(stayDate);
      if (!stayDay?.available || !stayDay.bookable) return false;
    }

    return dayByDate.get(checkOut)?.availableForCheckout === true;
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private addDaysIso(date: string, days: number): string {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    parsed.setUTCDate(parsed.getUTCDate() + days);
    return parsed.toISOString().slice(0, 10);
  }

  private isIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private async recordPricingAttempt(input: {
    listingId: string;
    source: string;
    checkIn: string;
    checkOut: string;
    status: AirbnbPricingAttemptStatus;
    reason?: string | null;
    durationMs?: number | null;
    priceTotal?: number | null;
    dailyPrice?: number | null;
    finalUrl?: string | null;
    metadata?: Record<string, unknown> | null;
    startedAt?: Date;
    finishedAt?: Date | null;
  }): Promise<void> {
    if (!this.pricingAttemptRepo) return;

    try {
      await this.pricingAttemptRepo.save(
        this.pricingAttemptRepo.create({
          listingId: input.listingId,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          source: input.source,
          status: input.status,
          reason: input.reason?.slice(0, 255) ?? null,
          durationMs: Number.isFinite(Number(input.durationMs))
            ? Math.max(0, Math.round(Number(input.durationMs)))
            : null,
          priceTotal: input.priceTotal == null ? null : Number(input.priceTotal.toFixed(2)),
          dailyPrice: input.dailyPrice == null ? null : Number(input.dailyPrice.toFixed(2)),
          currency: 'BRL',
          finalUrl: input.finalUrl ?? null,
          metadata: input.metadata ?? null,
          startedAt: input.startedAt ?? new Date(),
          finishedAt: input.finishedAt ?? null,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Falha ao registrar tentativa Airbnb listing=${input.listingId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private compactPayloadForAttemptLog(payload: unknown): Record<string, unknown> {
    if (payload === null || payload === undefined) return { kind: String(payload) };
    if (Array.isArray(payload)) return { kind: 'array', length: payload.length };
    if (typeof payload === 'object') {
      return { kind: 'object', keys: Object.keys(payload as Record<string, unknown>).slice(0, 20) };
    }
    return { kind: typeof payload, value: String(payload).slice(0, 120) };
  }

  private isNonRetryablePricingError(error: unknown): boolean {
    if (error instanceof AirbnbPricingError) return !error.retryable;
    if (!axios.isAxiosError(error)) return false;
    const status = error.response?.status;
    return status === 401 || status === 403 || status === 429;
  }

  private isSystemicBlock(error: unknown): boolean {
    if (error instanceof AirbnbPricingError) {
      return !error.retryable && ['captcha_blocked', 'systemic_block', 'api_blocked'].includes(error.reason);
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      return status === 401 || status === 403 || status === 429;
    }

    return false;
  }

  private formatPricingError(error: unknown): string {
    if (error instanceof AirbnbPricingError) {
      return JSON.stringify({
        reason: error.reason,
        message: error.message,
        listingId: error.context.listingId,
        source: error.context.source,
        checkIn: error.context.checkIn,
        checkOut: error.context.checkOut,
      });
    }
    if (axios.isAxiosError(error)) {
      return JSON.stringify(error.response?.data || error.message);
    }
    return error instanceof Error ? error.message : String(error);
  }

  private toPricingError(error: unknown, context: AirbnbPricingContext): AirbnbPricingError {
    if (error instanceof AirbnbPricingError) return error;

    if (error instanceof AirbnbHeadlessScrapeError) {
      const reason = this.normalizeHeadlessReason(error.reason);
      return new AirbnbPricingError(
        error.message,
        reason,
        context,
        reason !== 'captcha_blocked',
        error.cause ?? error,
      );
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const code = String(error.code ?? '').toUpperCase();
      const reason: AirbnbPricingFailureReason =
        status === 401 || status === 403 || status === 429
          ? 'api_blocked'
          : code === 'ECONNABORTED' || /timeout/i.test(error.message)
            ? 'timeout'
            : 'api_error';

      return new AirbnbPricingError(
        error.message,
        reason,
        context,
        reason !== 'api_blocked',
        error.response?.data ?? error,
      );
    }

    return new AirbnbPricingError(
      error instanceof Error ? error.message : String(error),
      'unknown',
      context,
      true,
      error,
    );
  }

  private normalizeHeadlessReason(reason?: AirbnbHeadlessDiagnosticReason | null): AirbnbPricingFailureReason | null {
    if (!reason) return null;
    if (reason === 'navigation_error') return 'navigation_error';
    return reason;
  }

  private reportPricingFailureFromError(error: unknown, fallbackContext: AirbnbPricingContext): void {
    const pricingError = error instanceof AirbnbPricingError ? error : this.toPricingError(error, fallbackContext);
    this.reportPricingFailure(
      pricingError.context.listingId,
      pricingError.reason,
      {
        source: pricingError.context.source,
        checkIn: pricingError.context.checkIn,
        checkOut: pricingError.context.checkOut,
        retryable: pricingError.retryable,
        message: pricingError.message,
      },
    );
  }

  private reportPricingFailure(
    propertyId: string,
    reason: string,
    extra: Record<string, unknown>,
  ): void {
    const payload = {
      event: 'airbnb_pricing_failure',
      listingId: propertyId,
      reason,
      pricingStrategy: this.priceStrategy,
      ...extra,
    };
    this.logger.error(JSON.stringify(payload));
    Sentry.captureMessage('Airbnb pricing failure', {
      level: 'warning',
      tags: {
        integration: 'airbnb',
        reason,
        pricingStrategy: this.priceStrategy,
        source: typeof extra.source === 'string' ? extra.source : 'unknown',
      },
      extra: {
        listingId: propertyId,
        ...extra,
      },
    });
  }

  private diffCalendarDays(checkIn: string, checkOut: string) {
    const inDate = new Date(`${checkIn}T00:00:00.000Z`);
    const outDate = new Date(`${checkOut}T00:00:00.000Z`);
    const diffMs = outDate.getTime() - inDate.getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return 1;
    return Math.max(1, Math.round(diffMs / 86_400_000));
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
    if (path.includes('pricestring')) score += 25;
    if (path.includes('price')) score += 30;
    if (path.includes('primaryline.price') || path.includes('accessibilitylabel')) score -= 10;
    if (path.includes('description')) score -= 30;
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

    const rawValue = value.trim();
    const currencyMatch = rawValue.match(/(?:R\$|BRL|\$)\s*([-+]?\d[\d.,]*)/i);
    const numericMatch = rawValue.match(/[-+]?\d[\d.,]*/);
    const moneyText = currencyMatch?.[1] ?? numericMatch?.[0] ?? '';
    let cleaned = moneyText.replace(/[^\d,.-]/g, '');
    if (!cleaned) return null;

    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (lastComma >= 0) {
      const decimals = cleaned.length - lastComma - 1;
      cleaned = decimals === 3 ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
    } else if (lastDot >= 0) {
      const decimals = cleaned.length - lastDot - 1;
      if (decimals === 3) cleaned = cleaned.replace(/\./g, '');
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

}
