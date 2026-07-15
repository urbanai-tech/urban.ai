import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';

export type AirbnbRenderedListingSnapshot = {
  roomId: string;
  url: string;
  finalUrl: string;
  title: string | null;
  pictureUrl: string | null;
  hostId: string | null;
  hostName: string | null;
  hostProfileUrl: string | null;
  listingIds: string[];
  priceTotal: number | null;
  priceText: string | null;
  currency: string | null;
  captchaDetected: boolean;
  diagnosticReason: AirbnbHeadlessDiagnosticReason | null;
  priceCandidateCount: number;
};

export type AirbnbAvailabilityCalendarDay = {
  date: string;
  available: boolean;
  bookable: boolean;
  availableForCheckin: boolean;
  availableForCheckout: boolean;
  minNights: number | null;
  maxNights: number | null;
};

export type AirbnbAvailabilityCalendar = {
  roomId: string;
  url: string;
  finalUrl: string;
  source: 'PdpAvailabilityCalendar';
  days: AirbnbAvailabilityCalendarDay[];
};

export type AirbnbRenderedHostListing = {
  roomId: string;
  title: string;
  pictureUrl: string;
};

export type AirbnbHeadlessDiagnosticReason =
  | 'captcha_blocked'
  | 'timeout'
  | 'price_not_found'
  | 'layout_parser'
  | 'navigation_error';

export class AirbnbHeadlessScrapeError extends Error {
  constructor(
    message: string,
    readonly reason: AirbnbHeadlessDiagnosticReason,
    readonly url: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AirbnbHeadlessScrapeError';
  }
}

type BrowserPageSnapshot = {
  title: string;
  bodyText: string;
  html: string;
  metas: Record<string, string>;
  links: Array<{ href: string; text: string; ariaLabel: string; image: string }>;
  images: Array<{ src: string; alt: string }>;
};

type CapturedGraphqlResponse = {
  operationName: string;
  url: string;
  payload: unknown;
};

type DateWindow = {
  checkIn?: string;
  checkOut?: string;
  adults?: number;
};

@Injectable()
export class AirbnbBrowserScraperService {
  private readonly logger = new Logger(AirbnbBrowserScraperService.name);
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<string>('AIRBNB_HEADLESS_SCRAPER_ENABLED') !== 'false';
  }

  async scrapeListing(
    roomId: string,
    dateWindow: DateWindow = {},
  ): Promise<AirbnbRenderedListingSnapshot | null> {
    if (!this.isEnabled()) return null;

    const url = this.buildListingUrl(roomId, dateWindow);
    return this.withSnapshot(url, async (snapshot, finalUrl) => {
      const host = this.extractHost(snapshot);
      const price = this.extractRenderedPrice(snapshot.bodyText, snapshot.html);
      const listingIds = this.extractListingIds(snapshot.links.map((link) => link.href).join('\n'));
      const captchaDetected = this.hasCaptcha(snapshot);
      const diagnosticReason = this.classifyListingDiagnostic(snapshot, price, captchaDetected);

      return {
        roomId,
        url,
        finalUrl,
        title: snapshot.metas['og:title'] || snapshot.title || null,
        pictureUrl: snapshot.metas['og:image'] || snapshot.images[0]?.src || null,
        hostId: host.hostId,
        hostName: host.hostName,
        hostProfileUrl: host.hostProfileUrl,
        listingIds,
        priceTotal: captchaDetected ? null : price.value,
        priceText: captchaDetected ? null : price.text,
        currency: price.value ? 'BRL' : null,
        captchaDetected,
        diagnosticReason,
        priceCandidateCount: price.candidateCount,
      };
    });
  }

  async scrapeAvailabilityCalendar(roomId: string): Promise<AirbnbAvailabilityCalendar | null> {
    if (!this.isEnabled()) return null;

    const url = this.buildListingUrl(roomId, {});
    return this.withSnapshot(
      url,
      async (snapshot, finalUrl, capturedResponses) => {
        const calendar = this.parseAvailabilityCalendar(roomId, url, finalUrl, snapshot, capturedResponses);
        if (!calendar?.days.length) {
          this.logger.warn(`PdpAvailabilityCalendar não trouxe dias parseáveis para room=${roomId}`);
          return null;
        }

        return calendar;
      },
      { captureGraphqlOperations: ['PdpAvailabilityCalendar'] },
    );
  }

  async scrapeHostListings(hostId: string): Promise<AirbnbRenderedHostListing[]> {
    if (!this.isEnabled()) return [];

    const url = `https://www.airbnb.com/users/show/${encodeURIComponent(hostId)}`;
    const candidates = await this.withSnapshot(url, async (snapshot) => {
      if (this.hasCaptcha(snapshot)) {
        this.logger.warn(`Headless profile scrape hit captcha/interstitial for host ${hostId}`);
        return [];
      }

      const listings = new Map<string, AirbnbRenderedHostListing>();
      for (const link of snapshot.links) {
        const roomId = this.extractRoomId(link.href);
        if (!roomId || listings.has(roomId)) continue;

        const title =
          link.ariaLabel ||
          link.text ||
          snapshot.images.find((image) => image.src === link.image)?.alt ||
          `Imóvel ${roomId}`;

        listings.set(roomId, {
          roomId,
          title: this.cleanOneLine(title),
          pictureUrl: link.image || '',
        });
      }

      return [...listings.values()];
    }, { scroll: true });

    return this.verifyHostListings(hostId, candidates ?? []);
  }

  private async withSnapshot<T>(
    url: string,
    parser: (
      snapshot: BrowserPageSnapshot,
      finalUrl: string,
      capturedResponses: CapturedGraphqlResponse[],
    ) => T | Promise<T>,
    options: { scroll?: boolean; captureGraphqlOperations?: string[] } = {},
  ): Promise<T | null> {
    let browser: any;
    const capturedResponses: CapturedGraphqlResponse[] = [];
    try {
      const playwright = await import('playwright-core');
      const executablePath = this.resolveChromiumExecutablePath();

      browser = await playwright.chromium.launch({
        headless: true,
        executablePath,
        args: [
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-gpu',
          '--no-sandbox',
        ],
      });

      const context = await browser.newContext({
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        userAgent: this.userAgent,
        viewport: { width: 1365, height: 900 },
        extraHTTPHeaders: {
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      const page = await context.newPage();
      this.captureGraphqlResponses(page, options.captureGraphqlOperations ?? [], capturedResponses);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.navigationTimeoutMs });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
      await this.acceptCookiePrompt(page);

      if (options.captureGraphqlOperations?.includes('PdpAvailabilityCalendar')) {
        await this.waitForCapturedOperation(page, capturedResponses, 'PdpAvailabilityCalendar', 2500);
        if (!this.hasCapturedOperation(capturedResponses, 'PdpAvailabilityCalendar')) {
          await this.stimulateAvailabilityCalendar(page, capturedResponses);
        }
      }

      if (options.scroll) {
        await this.scrollProfilePage(page);
      }

      const snapshot = await this.readSnapshot(page);
      return parser(snapshot, page.url(), capturedResponses);
    } catch (error) {
      const reason = this.classifyScrapeError(error);
      this.logger.warn(JSON.stringify({
        event: 'airbnb_headless_scrape_failed',
        source: 'airbnb-browser',
        url,
        reason,
        message: error instanceof Error ? error.message : String(error),
      }));
      throw new AirbnbHeadlessScrapeError(
        `Headless Airbnb scrape failed: ${error instanceof Error ? error.message : String(error)}`,
        reason,
        url,
        error,
      );
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }

  private captureGraphqlResponses(
    page: any,
    operationNames: string[],
    capturedResponses: CapturedGraphqlResponse[],
  ): void {
    if (operationNames.length === 0) return;

    page.on('response', async (response: any) => {
      const operationName = this.matchedGraphqlOperation(response, operationNames);
      if (!operationName) return;

      try {
        const payload = await response.json();
        capturedResponses.push({
          operationName,
          url: response.url(),
          payload,
        });
      } catch (error) {
        this.logger.debug(
          `Não foi possível ler resposta ${operationName}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });
  }

  private matchedGraphqlOperation(response: any, operationNames: string[]): string | null {
    const url = typeof response.url === 'function' ? response.url() : '';
    const request = typeof response.request === 'function' ? response.request() : null;
    const postData = request && typeof request.postData === 'function' ? request.postData() : '';

    return operationNames.find((operationName) =>
      url.includes(operationName) || String(postData ?? '').includes(operationName),
    ) ?? null;
  }

  private async waitForCapturedOperation(
    page: any,
    capturedResponses: CapturedGraphqlResponse[],
    operationName: string,
    timeoutMs: number,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.hasCapturedOperation(capturedResponses, operationName)) return;
      await page.waitForTimeout(250).catch(() => undefined);
    }
  }

  private hasCapturedOperation(
    capturedResponses: CapturedGraphqlResponse[],
    operationName: string,
  ): boolean {
    return capturedResponses.some((response) => response.operationName === operationName);
  }

  private async stimulateAvailabilityCalendar(
    page: any,
    capturedResponses: CapturedGraphqlResponse[],
  ): Promise<void> {
    await this.openAvailabilityCalendar(page);

    for (let i = 0; i < 8; i += 1) {
      if (this.hasCapturedOperation(capturedResponses, 'PdpAvailabilityCalendar')) return;

      if (i === 2 || i === 5) {
        await this.openAvailabilityCalendar(page);
      }

      await page.mouse.wheel(0, 1100).catch(() => undefined);
      await this.waitForCapturedOperation(page, capturedResponses, 'PdpAvailabilityCalendar', 750);
    }
  }

  private get navigationTimeoutMs(): number {
    const value = Number(this.configService.get<string>('AIRBNB_HEADLESS_TIMEOUT_MS'));
    return Number.isFinite(value) && value >= 5000 ? value : 45000;
  }

  private resolveChromiumExecutablePath(): string | undefined {
    const configured = this.configService.get<string>('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH');
    if (configured?.trim()) return configured.trim();

    const platform = process.platform;
    if (platform === 'linux') {
      for (const candidate of ['/usr/bin/chromium-browser', '/usr/bin/chromium']) {
        if (existsSync(candidate)) return candidate;
      }
    }

    return undefined;
  }

  private buildListingUrl(roomId: string, dateWindow: DateWindow): string {
    const url = new URL(`https://www.airbnb.com/rooms/${roomId}`);
    if (dateWindow.checkIn) url.searchParams.set('check_in', dateWindow.checkIn);
    if (dateWindow.checkOut) url.searchParams.set('check_out', dateWindow.checkOut);
    url.searchParams.set('adults', String(dateWindow.adults ?? 1));
    url.searchParams.set('source_impression_id', 'urban_ai_headless');
    return url.toString();
  }

  private async acceptCookiePrompt(page: any): Promise<void> {
    const labels = [
      /aceitar todos/i,
      /aceitar/i,
      /accept all/i,
      /accept/i,
      /ok/i,
    ];

    for (const label of labels) {
      const button = page.getByRole('button', { name: label });
      try {
        await button.click({ timeout: 1200 });
        return;
      } catch {
        // Tenta o próximo rótulo disponível.
      }
    }
  }

  private async scrollProfilePage(page: any): Promise<void> {
    for (let i = 0; i < 7; i += 1) {
      await page.mouse.wheel(0, 1800).catch(() => undefined);
      await page.waitForTimeout(700);
    }
  }

  private async openAvailabilityCalendar(page: any): Promise<void> {
    const labels = [
      /check-?in/i,
      /check in/i,
      /datas/i,
      /dates/i,
      /adicionar datas/i,
      /selecionar datas/i,
    ];

    for (const label of labels) {
      try {
        await page.getByRole('button', { name: label }).first().click({ timeout: 1200 });
        return;
      } catch {
        // Tenta o próximo rótulo disponível.
      }
    }

    const selectors = [
      '[data-testid*="datepicker"]',
      '[data-testid*="calendar"]',
      '[data-testid*="check-in"]',
      '[data-testid*="checkin"]',
    ];

    for (const selector of selectors) {
      try {
        await page.locator(selector).first().click({ timeout: 1200 });
        return;
      } catch {
        // Tenta o próximo seletor disponível.
      }
    }
  }

  private async verifyHostListings(
    hostId: string,
    candidates: AirbnbRenderedHostListing[],
  ): Promise<AirbnbRenderedHostListing[]> {
    const normalizedHostId = this.normalizeId(hostId);
    if (!normalizedHostId || candidates.length === 0) return [];

    const shouldVerify = this.configService.get<string>('AIRBNB_HEADLESS_VERIFY_HOST_LISTINGS') !== 'false';
    if (!shouldVerify) return candidates;

    const verified: AirbnbRenderedHostListing[] = [];
    for (const candidate of candidates.slice(0, this.profileVerifyLimit)) {
      const listing = await this.scrapeListing(candidate.roomId);
      const listingHostId = this.normalizeId(listing?.hostId);

      if (listingHostId !== normalizedHostId) {
        this.logger.warn(
          `Ignoring profile candidate room=${candidate.roomId}; expected host=${hostId}, got host=${listing?.hostId ?? 'unknown'}`,
        );
        continue;
      }

      verified.push({
        roomId: candidate.roomId,
        title: listing?.title || candidate.title,
        pictureUrl: listing?.pictureUrl || candidate.pictureUrl,
      });
    }

    return verified;
  }

  private get profileVerifyLimit(): number {
    const value = Number(this.configService.get<string>('AIRBNB_HEADLESS_PROFILE_VERIFY_LIMIT'));
    return Number.isFinite(value) && value > 0 ? value : 40;
  }

  private async readSnapshot(page: any): Promise<BrowserPageSnapshot> {
    return page.evaluate(() => {
      const doc = (globalThis as any).document;
      const metaEntries = Array.from(doc.querySelectorAll('meta')).map((meta: any) => {
        const key =
          meta.getAttribute('property') ||
          meta.getAttribute('name') ||
          meta.getAttribute('itemprop') ||
          '';
        return [key, meta.getAttribute('content') || ''];
      });

      const links = Array.from(doc.querySelectorAll('a[href]')).map((anchor: any) => {
        const element = anchor;
        const image = element.querySelector('img');
        return {
          href: element.href,
          text: element.textContent?.trim() || '',
          ariaLabel: element.getAttribute('aria-label') || '',
          image: image?.src || '',
        };
      });

      const images = Array.from(doc.querySelectorAll('img')).map((image: any) => ({
        src: image.src || '',
        alt: image.alt || '',
      }));

      return {
        title: doc.title || '',
        bodyText: doc.body?.innerText || '',
        html: doc.documentElement?.innerHTML || '',
        metas: Object.fromEntries(metaEntries.filter(([key, value]) => key && value)),
        links,
        images,
      };
    });
  }

  private extractHost(snapshot: BrowserPageSnapshot): {
    hostId: string | null;
    hostName: string | null;
    hostProfileUrl: string | null;
  } {
    const combined = `${snapshot.html}\n${snapshot.links.map((link) => link.href).join('\n')}`;
    const patterns = [
      /"hostId"\s*:\s*"(\d+)"/,
      /"hostId"\s*:\s*(\d+)/,
      /\/users\/(?:show|profile)\/(\d+)/,
      /ContextualUser:(\d+)/,
      /Host:(\d+)/,
    ];

    let hostId: string | null = null;
    for (const pattern of patterns) {
      const match = combined.match(pattern);
      if (match?.[1]) {
        hostId = match[1];
        break;
      }
    }

    const hostLink = snapshot.links.find((link) => /\/users\/(?:show|profile)\//.test(link.href));
    const hostName =
      hostLink?.text?.replace(/\s+/g, ' ').trim() ||
      (snapshot.bodyText.match(/Hosted by\s+([^\n]+)/i)?.[1] ?? null);

    return {
      hostId,
      hostName: hostName ? this.cleanOneLine(hostName) : null,
      hostProfileUrl: hostLink?.href ?? (hostId ? `https://www.airbnb.com/users/show/${hostId}` : null),
    };
  }

  private extractRenderedPrice(
    bodyText: string,
    html: string,
  ): { value: number | null; text: string | null; candidateCount: number } {
    const candidates: Array<{ value: number; score: number; text: string }> = [];
    const lines = bodyText
      .split(/\n+/)
      .map((line) => this.cleanOneLine(line))
      .filter((line) => /(?:R\$|BRL|\$)\s*\d/.test(line));

    for (const line of lines) {
      const values = this.extractMoneyValues(line);
      for (const value of values) {
        candidates.push({ value, score: this.priceLineScore(line), text: line });
      }
    }

    const jsonSnippets = html.match(/.{0,80}(?:price|total|amount|cost).{0,120}/gi) ?? [];
    for (const snippet of jsonSnippets) {
      const values = this.extractMoneyValues(snippet);
      for (const value of values) {
        candidates.push({ value, score: this.priceLineScore(snippet) - 5, text: this.cleanOneLine(snippet) });
      }
    }

    candidates.sort((a, b) => b.score - a.score || b.value - a.value);
    const best = candidates.find((candidate) => candidate.value >= 50 && candidate.value <= 100000);
    return best
      ? { value: best.value, text: best.text, candidateCount: candidates.length }
      : { value: null, text: null, candidateCount: candidates.length };
  }

  private parseAvailabilityCalendar(
    roomId: string,
    url: string,
    finalUrl: string,
    snapshot: BrowserPageSnapshot,
    capturedResponses: CapturedGraphqlResponse[],
  ): AirbnbAvailabilityCalendar | null {
    const payloads = [
      ...capturedResponses
        .filter((response) => response.operationName === 'PdpAvailabilityCalendar')
        .map((response) => response.payload),
      ...this.extractJsonPayloadsFromHtml(snapshot.html),
    ];

    const days = this.extractAvailabilityCalendarDays(payloads);
    if (days.length === 0) return null;

    return {
      roomId,
      url,
      finalUrl,
      source: 'PdpAvailabilityCalendar',
      days,
    };
  }

  private extractAvailabilityCalendarDays(payloads: unknown[]): AirbnbAvailabilityCalendarDay[] {
    const daysByDate = new Map<string, AirbnbAvailabilityCalendarDay>();
    const visited = new Set<object>();

    const walk = (value: unknown) => {
      if (value === null || value === undefined) return;

      if (Array.isArray(value)) {
        value.forEach((item) => walk(item));
        return;
      }

      if (typeof value !== 'object') return;
      if (visited.has(value)) return;
      visited.add(value);

      const day = this.normalizeCalendarDay(value as Record<string, unknown>);
      if (day) daysByDate.set(day.date, day);

      Object.values(value as Record<string, unknown>).forEach((item) => walk(item));
    };

    payloads.forEach((payload) => walk(payload));
    return [...daysByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  private normalizeCalendarDay(value: Record<string, unknown>): AirbnbAvailabilityCalendarDay | null {
    const date = this.normalizeCalendarDate(
      value.calendarDate ??
      value.date ??
      value.day ??
      value.isoDate,
    );
    if (!date) return null;

    const hasCalendarSignal = [
      'available',
      'bookable',
      'availableForCheckin',
      'availableForCheckIn',
      'availableForCheckout',
      'availableForCheckOut',
      'minNights',
      'maxNights',
    ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
    if (!hasCalendarSignal) return null;

    const available = this.normalizeBoolean(value.available ?? value.isAvailable) ?? false;
    const bookable = this.normalizeBoolean(value.bookable ?? value.isBookable) ?? available;
    const availableForCheckin =
      this.normalizeBoolean(value.availableForCheckin ?? value.availableForCheckIn) ?? available;
    const availableForCheckout =
      this.normalizeBoolean(value.availableForCheckout ?? value.availableForCheckOut) ?? available;

    return {
      date,
      available,
      bookable,
      availableForCheckin,
      availableForCheckout,
      minNights: this.normalizePositiveInteger(value.minNights ?? value.minimumNights),
      maxNights: this.normalizePositiveInteger(value.maxNights ?? value.maximumNights),
    };
  }

  private extractJsonPayloadsFromHtml(html: string): unknown[] {
    const payloads: unknown[] = [];
    const scriptPattern = /<script\b[^>]*type=["'][^"']*json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = scriptPattern.exec(html)) !== null) {
      const raw = this.decodeHtmlEntities(match[1]?.trim() ?? '');
      if (!raw || !/PdpAvailabilityCalendar|availabilityCalendar|calendarMonths/i.test(raw)) continue;

      const parsed = this.tryParseJson(raw);
      if (parsed !== null) payloads.push(parsed);
    }

    return payloads;
  }

  private normalizeCalendarDate(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const match = value.match(/\d{4}-\d{2}-\d{2}/);
    return match?.[0] ?? null;
  }

  private normalizeBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return null;
  }

  private normalizePositiveInteger(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
  }

  private tryParseJson(raw: string): unknown | null {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  private extractMoneyValues(text: string): number[] {
    const matches = [...text.matchAll(/(?:R\$|BRL|\$)\s*([-+]?\d[\d.,]*)/gi)];
    return matches
      .map((match) => this.parseMoney(match[1]))
      .filter((value): value is number => value !== null);
  }

  private priceLineScore(text: string): number {
    const normalized = this.cleanOneLine(text).toLowerCase();
    let score = 0;
    if (/total|subtotal|preco total|preço total|valor total/.test(normalized)) score += 100;
    if (/before taxes|sem impostos|antes dos impostos/.test(normalized)) score += 60;
    if (/accommodation|hospedagem|estadia/.test(normalized)) score += 25;
    if (/night|noite|diaria|diária/.test(normalized)) score -= 30;
    if (/\d+\s*x\s*(?:r\$|brl|\$)/i.test(normalized)) score -= 35;
    if (/tax|imposto|taxa|fee|limpeza|cleaning|servico|serviço|desconto|discount/.test(normalized)) score -= 80;
    return score;
  }

  private parseMoney(value: string): number | null {
    let cleaned = value.replace(/[^\d,.-]/g, '');
    if (!cleaned) return null;

    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    if (lastComma >= 0 && lastDot >= 0) {
      cleaned = lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
    } else if (lastComma >= 0) {
      const decimals = cleaned.length - lastComma - 1;
      cleaned = decimals === 3 ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
    } else if (lastDot >= 0) {
      const decimals = cleaned.length - lastDot - 1;
      if (decimals === 3) cleaned = cleaned.replace(/\./g, '');
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
  }

  private extractListingIds(text: string): string[] {
    const ids = new Set<string>();
    for (const match of text.matchAll(/\/rooms\/(\d+)/g)) {
      ids.add(match[1]);
    }
    return [...ids];
  }

  private extractRoomId(url: string): string | null {
    const match = url.match(/\/rooms\/(\d+)/);
    return match?.[1] ?? null;
  }

  private normalizeId(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const normalized = String(value).replace(/\D/g, '');
    return normalized || null;
  }

  private hasCaptcha(snapshot: BrowserPageSnapshot): boolean {
    const text = `${snapshot.title}\n${snapshot.bodyText}`.toLowerCase();
    return /captcha|verify you are human|confirme que voce|confirme que você|access denied|forbidden/.test(text);
  }

  private classifyListingDiagnostic(
    snapshot: BrowserPageSnapshot,
    price: { value: number | null; candidateCount: number },
    captchaDetected: boolean,
  ): AirbnbHeadlessDiagnosticReason | null {
    if (captchaDetected) return 'captcha_blocked';
    if (price.value) return null;

    const text = `${snapshot.title}\n${snapshot.bodyText}`.toLowerCase();
    if (
      /unavailable|indisponivel|indisponível|sold out|reservado|nao disponivel|não disponível/.test(text)
      || /check-in|checkout|check out|datas|dates/.test(text)
    ) {
      return 'price_not_found';
    }

    if (price.candidateCount > 0 || /price|total|amount|cost|preco|preço|valor|r\$|brl/.test(text)) {
      return 'layout_parser';
    }

    return 'price_not_found';
  }

  private classifyScrapeError(error: unknown): AirbnbHeadlessDiagnosticReason {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (/timeout|timed out|navigation timeout/.test(message)) return 'timeout';
    if (/captcha|verify you are human|access denied|forbidden|blocked/.test(message)) return 'captcha_blocked';
    return 'navigation_error';
  }

  private cleanOneLine(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }
}
