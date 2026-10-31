import { Injectable, Logger } from '@nestjs/common';
import { fetchWithTimeout, HTTP_TIMEOUT_MS } from '../common/http-timeouts';
import { cleanText } from './event-reference-normalize';

export interface WebDocument {
  /** URL de evidência (a mostrada na auditoria). */
  url: string;
  title: string | null;
  /** Texto bruto entregue ao extrator (dado de terceiros, nunca instrução). */
  content: string;
  /** Sobrescreve a chave de independência (agregadores como o Google Events). */
  validatorKeyOverride?: string;
}

const MAX_DOC_CHARS = 12_000;

/**
 * Provedores externos da curadoria (ADR 0026): busca Tavily, Google Events via SerpAPI e
 * leitura da página oficial via Firecrawl. Sem a chave de um provedor, o método devolve `null`
 * (e a curadoria registra o aviso) — nunca lança por falta de configuração. Chaves nunca são
 * logadas. Nenhum scraping de calendário de terceiros: só APIs e a página oficial do venue.
 */
@Injectable()
export class EventReferenceSourcesService {
  private readonly logger = new Logger(EventReferenceSourcesService.name);

  async searchTavily(query: string, maxResults: number): Promise<WebDocument[] | null> {
    const key = process.env.TAVILY_API_KEY?.trim();
    if (!key) return null;
    try {
      const response = await fetchWithTimeout(
        'https://api.tavily.com/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: key,
            query,
            search_depth: 'basic',
            include_answer: false,
            include_images: false,
            include_raw_content: false,
            max_results: maxResults,
          }),
        },
        HTTP_TIMEOUT_MS.slow,
      );
      if (!response.ok) {
        this.logger.warn(`Tavily respondeu ${response.status}.`);
        return [];
      }
      const body = (await response.json()) as { results?: Array<{ url?: string; title?: string; content?: string }> };
      return (body.results ?? [])
        .filter((r) => typeof r.url === 'string' && /^https?:\/\//i.test(r.url) && typeof r.content === 'string')
        .map((r) => ({
          url: r.url as string,
          title: cleanText(r.title, 200) || null,
          content: String(r.content).slice(0, MAX_DOC_CHARS),
        }));
    } catch (error: any) {
      this.logger.warn(`Tavily falhou: ${error?.name ?? 'erro'}`);
      return [];
    }
  }

  async searchSerpApi(query: string): Promise<WebDocument[] | null> {
    const key = process.env.SERPAPI_KEY?.trim();
    if (!key) return null;
    try {
      const params = new URLSearchParams({
        engine: 'google_events',
        q: query,
        hl: 'pt-br',
        gl: 'br',
        api_key: key,
      });
      const response = await fetchWithTimeout(`https://serpapi.com/search.json?${params.toString()}`, {}, HTTP_TIMEOUT_MS.slow);
      if (!response.ok) {
        this.logger.warn(`SerpAPI respondeu ${response.status}.`);
        return [];
      }
      const body = (await response.json()) as {
        events_results?: Array<{
          title?: string;
          date?: { start_date?: string; when?: string };
          address?: string[];
          link?: string;
        }>;
      };
      const lines = (body.events_results ?? []).slice(0, 40).map((e) =>
        [
          cleanText(e.title, 200),
          cleanText(e.date?.when ?? e.date?.start_date, 120),
          cleanText((e.address ?? []).join(', '), 200),
        ].join(' | '),
      );
      if (lines.length === 0) return [];
      return [
        {
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}&ibp=htl;events`,
          title: 'Google Events',
          content: lines.join('\n').slice(0, MAX_DOC_CHARS),
          validatorKeyOverride: 'web:google-events',
        },
      ];
    } catch (error: any) {
      this.logger.warn(`SerpAPI falhou: ${error?.name ?? 'erro'}`);
      return [];
    }
  }

  async scrapeFirecrawl(url: string): Promise<WebDocument | null | undefined> {
    const key = process.env.FIRECRAWL_API_KEY?.trim();
    if (!key) return null;
    try {
      const response = await fetchWithTimeout(
        'https://api.firecrawl.dev/v1/scrape',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
        },
        HTTP_TIMEOUT_MS.scrape,
      );
      if (!response.ok) {
        this.logger.warn(`Firecrawl respondeu ${response.status}.`);
        return undefined;
      }
      const body = (await response.json()) as { data?: { markdown?: string; metadata?: { title?: string } } };
      const markdown = body.data?.markdown;
      if (typeof markdown !== 'string' || !markdown.trim()) return undefined;
      return {
        url,
        title: cleanText(body.data?.metadata?.title, 200) || 'Página oficial',
        content: markdown.slice(0, MAX_DOC_CHARS),
      };
    } catch (error: any) {
      this.logger.warn(`Firecrawl falhou: ${error?.name ?? 'erro'}`);
      return undefined;
    }
  }
}
