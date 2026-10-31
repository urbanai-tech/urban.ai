import { createHash } from 'crypto';
import { addDaysToDateKey, parseEventDateTime, toSaoPauloDateKey } from '../common/sp-date';
import type { EventReferenceSize } from '../entities/event-reference.entity';

/** Subconjunto do EventIdentityService usado aqui (facilita testar sem Nest). */
export interface IdentityLike {
  normalizeText(value?: string | null): string;
  normalizeVenue(value?: string | null): string;
  tokenSetSimilarity(left?: string | null, right?: string | null): number;
  eventDateKey(date?: string | Date | null): string | null;
}

const SECOND_LEVEL_BR = new Set(['com', 'org', 'net', 'gov', 'edu', 'art', 'mus', 'tur']);

/** Domínio "registrável" aproximado (sem lista pública de sufixos): a.b.com.br -> b.com.br. */
export function registrableDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
  host = host.replace(/^www\./, '');
  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 2) return host || null;
  const last = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  const threeLabel = last.length === 2 && SECOND_LEVEL_BR.has(second);
  return labels.slice(threeLabel ? -3 : -2).join('.');
}

/** Chave de independência de um validador web: duas páginas do mesmo site valem como uma fonte. */
export function webValidatorKey(url: string | null | undefined): string | null {
  const domain = registrableDomain(url);
  return domain ? `web:${domain}` : null;
}

/** Chave de independência de um evento já ingerido: uma por fonte de coleta. */
export function dbValidatorKey(source: string | null | undefined): string {
  const clean = String(source ?? 'desconhecida')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 60);
  return `db:${clean || 'desconhecida'}`;
}

export function referenceFingerprint(
  identity: Pick<IdentityLike, 'normalizeText' | 'normalizeVenue'>,
  input: { name: string; dateKey: string; venue: string },
): string {
  const key = [identity.normalizeText(input.name), input.dateKey, identity.normalizeVenue(input.venue)].join('|');
  return createHash('sha1').update(key).digest('hex');
}

export function dayDiff(a: string, b: string): number {
  const toMs = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toMs(a) - toMs(b)) / 86_400_000);
}

export function normalizeSize(value: unknown): EventReferenceSize | null {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (['grande', 'large', 'g'].includes(text)) return 'grande';
  if (['medio', 'medium', 'm'].includes(text)) return 'medio';
  if (['pequeno', 'small', 'p'].includes(text)) return 'pequeno';
  return null;
}

export function normalizeCategory(value: unknown): string | null {
  const text = String(value ?? '')
    .replace(/\p{Cc}/gu, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 64);
  return text || null;
}

const CSV_DATE_BR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/;

/** Aceita ISO (com ou sem offset), `YYYY-MM-DD` e `dd/mm/aaaa [hh:mm]` (horário de São Paulo). */
export function parseReferenceDate(raw: string | null | undefined): { instant: Date; dateKey: string } | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const br = CSV_DATE_BR.exec(text);
  const normalized = br
    ? `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}${
        br[4] ? `T${br[4].padStart(2, '0')}:${br[5]}:00` : ''
      }`
    : text;
  const parsed = parseEventDateTime(normalized);
  if (!parsed) return null;
  return { instant: parsed.instant, dateKey: toSaoPauloDateKey(parsed.instant) };
}

export function cleanText(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// ---------------------------------------------------------------------------
// Respostas dos LLMs (fronteira de confiança: JSON estrito, nada além disso)
// ---------------------------------------------------------------------------

export interface ExtractedCandidate {
  name: string;
  dateKey: string;
  time: string | null;
  venue: string | null;
  category: string | null;
}

function unwrapJson(text: string): unknown {
  const trimmed = String(text ?? '').trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function isRealDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const MAX_EXTRACTED_PER_DOCUMENT = 40;

/**
 * Valida a resposta de extração: objeto `{ "events": [...] }` (ou array puro). Cada item precisa
 * de nome (3-200) e data real dentro da janela; o resto é opcional. Texto fora do esquema é
 * descartado; o conteúdo da página é dado de terceiros, nunca instrução.
 */
export function parseExtractionResponse(
  text: string,
  window: { fromDateKey: string; toDateKey: string },
): ExtractedCandidate[] {
  const root = unwrapJson(text);
  const list = Array.isArray(root)
    ? root
    : root && typeof root === 'object' && Array.isArray((root as { events?: unknown }).events)
      ? ((root as { events: unknown[] }).events)
      : null;
  if (!list) return [];

  const out: ExtractedCandidate[] = [];
  const seen = new Set<string>();
  for (const item of list.slice(0, MAX_EXTRACTED_PER_DOCUMENT * 2)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const name = cleanText(row.name, 200);
    const date = typeof row.date === 'string' ? row.date.trim() : '';
    if (name.length < 3 || !isRealDateKey(date)) continue;
    if (date < window.fromDateKey || date > window.toDateKey) continue;
    const time = typeof row.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.time.trim()) ? row.time.trim() : null;
    const venue = cleanText(row.venue, 160) || null;
    const dedup = `${name.toLowerCase()}|${date}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    out.push({ name, dateKey: date, time, venue, category: normalizeCategory(row.category) });
    if (out.length >= MAX_EXTRACTED_PER_DOCUMENT) break;
  }
  return out;
}

export interface JudgeResult {
  verdict: 'confirm' | 'reject' | 'unsure';
  reason: string | null;
}

export function parseJudgeResponse(text: string): JudgeResult | null {
  const root = unwrapJson(text);
  if (!root || typeof root !== 'object') return null;
  const verdict = (root as { verdict?: unknown }).verdict;
  if (verdict !== 'confirm' && verdict !== 'reject' && verdict !== 'unsure') return null;
  const reason = cleanText((root as { reason?: unknown }).reason, 240) || null;
  return { verdict, reason };
}

export function windowForHorizon(todayKey: string, horizonDays: number): { fromDateKey: string; toDateKey: string } {
  return { fromDateKey: todayKey, toDateKey: addDaysToDateKey(todayKey, horizonDays) };
}
