import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository, IsNull, Not } from 'typeorm';
import axios from 'axios';
import { Event } from '../entities/events.entity';
import { EventHistoricalMultiplier } from '../entities/event-historical-multiplier.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { EventIdentityService } from '../evento/event-identity.service';

// ============================================================================
// Funções puras (testáveis sem I/O)
// ============================================================================

/**
 * Reduz um nome normalizado à "chave de série" do evento recorrente, tirando o
 * ano e palavras de edição — para que "ccxp 2023", "ccxp 2024" e "ccxp 2026"
 * caiam todos em "ccxp" e compartilhem a mesma âncora.
 */
export function seriesKey(normalizedName?: string | null): string {
  if (!normalizedName) return '';
  const editionWords = new Set(['edicao', 'edition', 'ed']);
  return normalizedName
    .split(' ')
    .filter((t) => t && !/^(19|20)\d{2}$/.test(t) && !editionWords.has(t))
    .join(' ')
    .trim();
}

function median(values: number[]): number | null {
  const arr = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (arr.length === 0) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
}

export type WikidataRow = { name: string; attendance: number; year?: number | null };

export type AggregatedAnchor = {
  canonicalName: string;
  displayName: string;
  realAttendance: number | null;
  lastYear: number | null;
  sampleSize: number;
};

/**
 * Agrega linhas do Wikidata por chave de série: público = mediana das edições
 * (robusto a outlier de uma edição atípica), sampleSize = nº de edições.
 */
export function aggregateWikidataRows(
  rows: WikidataRow[],
  normalizeName: (v?: string | null) => string,
): AggregatedAnchor[] {
  const groups = new Map<string, { displays: string[]; atts: number[]; years: number[] }>();
  for (const r of rows) {
    if (!r.name || !Number.isFinite(r.attendance) || r.attendance <= 0) continue;
    const key = seriesKey(normalizeName(r.name));
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { displays: [], atts: [], years: [] });
    const g = groups.get(key)!;
    g.displays.push(r.name);
    g.atts.push(r.attendance);
    if (r.year && Number.isFinite(r.year)) g.years.push(r.year);
  }

  const out: AggregatedAnchor[] = [];
  for (const [key, g] of groups) {
    out.push({
      canonicalName: key,
      displayName: g.displays[g.displays.length - 1] ?? key,
      realAttendance: median(g.atts),
      lastYear: g.years.length ? Math.max(...g.years) : null,
      sampleSize: g.atts.length,
    });
  }
  return out;
}

export type FeedbackRow = {
  seriesKey: string;
  booked: boolean;
  multiplier: number | null;
  year?: number | null;
};

export type FeedbackAnchor = {
  canonicalName: string;
  realOccupancy: number | null;
  realMultiplier: number | null;
  sampleSize: number;
  lastYear: number | null;
};

/**
 * Agrega observações realizadas (por evento canônico) de forma IDEMPOTENTE
 * (recomputa do zero, não faz blend incremental): ocupação = fração de booked,
 * multiplicador = média dos multiplicadores que efetivamente reservaram.
 */
export function aggregateFeedbackRows(rows: FeedbackRow[]): FeedbackAnchor[] {
  const groups = new Map<
    string,
    { bookedCount: number; total: number; mults: number[]; years: number[] }
  >();
  for (const r of rows) {
    if (!r.seriesKey) continue;
    if (!groups.has(r.seriesKey)) groups.set(r.seriesKey, { bookedCount: 0, total: 0, mults: [], years: [] });
    const g = groups.get(r.seriesKey)!;
    g.total += 1;
    if (r.booked) {
      g.bookedCount += 1;
      if (r.multiplier !== null && Number.isFinite(r.multiplier) && r.multiplier > 0) g.mults.push(r.multiplier);
    }
    if (r.year && Number.isFinite(r.year)) g.years.push(r.year);
  }

  const out: FeedbackAnchor[] = [];
  for (const [key, g] of groups) {
    out.push({
      canonicalName: key,
      realOccupancy: g.total > 0 ? g.bookedCount / g.total : null,
      realMultiplier: g.mults.length ? g.mults.reduce((a, b) => a + b, 0) / g.mults.length : null,
      sampleSize: g.total,
      lastYear: g.years.length ? Math.max(...g.years) : null,
    });
  }
  return out;
}

// ============================================================================
// Serviço
// ============================================================================

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

/** Eventos localizados em São Paulo (cidade Q174) com público (P1110). */
const WIKIDATA_QUERY = `SELECT ?itemLabel ?attendance ?date WHERE {
  ?item wdt:P1110 ?attendance.
  ?item wdt:P276 ?loc. ?loc wdt:P131* wd:Q174.
  OPTIONAL { ?item wdt:P585 ?date. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". }
}`;

/**
 * IA-3b — âncora histórica de eventos recorrentes.
 *
 * (1) importFromWikidata: popula `event_historical_multiplier` com público de
 *     edições passadas (P1110).
 * (2) applyAnchorsToEvents: copia o público histórico para
 *     `events.historicalAttendance` casando por chave de série (nome sem ano),
 *     para o eventDemandScore usar como prior (resolveAttendance).
 * (3) recordFeedback: o loop de resultado atualiza ocupação/multiplicador reais
 *     ao longo do tempo — a fonte que domina no fim.
 */
@Injectable()
export class EventHistoricalService {
  private readonly logger = new Logger(EventHistoricalService.name);

  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(EventHistoricalMultiplier)
    private readonly anchorRepo: Repository<EventHistoricalMultiplier>,
    @InjectRepository(AnalisePreco)
    private readonly analiseRepo: Repository<AnalisePreco>,
    private readonly identity: EventIdentityService,
  ) {}

  /** Busca o Wikidata e faz upsert das âncoras. Sem chave; tolerante a falha de rede. */
  async importFromWikidata(): Promise<{ fetched: number; upserted: number }> {
    let rows: WikidataRow[];
    try {
      const resp = await axios.get(WIKIDATA_SPARQL, {
        params: { query: WIKIDATA_QUERY, format: 'json' },
        headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'urbanai/1.0' },
        timeout: 45_000,
      });
      const bindings: any[] = resp.data?.results?.bindings ?? [];
      rows = bindings
        .map((b) => ({
          name: b.itemLabel?.value ?? '',
          attendance: Number(b.attendance?.value),
          year: b.date?.value ? new Date(b.date.value).getUTCFullYear() : null,
        }))
        .filter((r) => r.name && Number.isFinite(r.attendance));
    } catch (error: any) {
      this.logger.warn(`Import Wikidata falhou: ${error?.message}`);
      return { fetched: 0, upserted: 0 };
    }

    const anchors = aggregateWikidataRows(rows, (v) => this.identity.normalizeText(v));
    let upserted = 0;
    for (const a of anchors) {
      const existing = await this.anchorRepo.findOne({ where: { canonicalName: a.canonicalName } });
      // Não sobrescreve dado de 'feedback' (mais forte) com wikidata.
      if (existing && existing.source === 'feedback') continue;
      const row = existing ?? this.anchorRepo.create({ canonicalName: a.canonicalName });
      row.displayName = a.displayName;
      row.realAttendance = a.realAttendance;
      row.lastYear = a.lastYear;
      row.sampleSize = a.sampleSize;
      row.source = 'wikidata';
      await this.anchorRepo.save(row);
      upserted += 1;
    }
    this.logger.log(`Âncoras Wikidata: ${upserted} upserted de ${rows.length} linhas.`);
    return { fetched: rows.length, upserted };
  }

  /** Âncora para um nome normalizado de evento (via chave de série). */
  async getAnchor(normalizedName?: string | null): Promise<EventHistoricalMultiplier | null> {
    const key = seriesKey(normalizedName);
    if (!key) return null;
    return this.anchorRepo.findOne({ where: { canonicalName: key } });
  }

  /** Copia o público histórico para events.historicalAttendance (backfill idempotente). */
  async applyAnchorsToEvents(limit = 300): Promise<{ pendentes: number; aplicados: number }> {
    const rows = await this.eventRepo.find({
      where: { historicalAttendance: IsNull() as any, normalizedName: Not(IsNull()) as any },
      take: limit,
      order: { dataInicio: 'DESC' },
    });
    if (rows.length === 0) return { pendentes: 0, aplicados: 0 };

    // Pré-carrega âncoras por chave para não bater no banco por evento.
    const anchors = await this.anchorRepo.find();
    const byKey = new Map(anchors.map((a) => [a.canonicalName, a]));

    let aplicados = 0;
    for (const event of rows) {
      const anchor = byKey.get(seriesKey(event.normalizedName));
      if (!anchor || !anchor.realAttendance) continue;
      event.historicalAttendance = anchor.realAttendance;
      await this.eventRepo.save(event);
      aplicados += 1;
    }
    this.logger.log(`historicalAttendance: ${aplicados}/${rows.length} aplicados neste lote.`);
    return { pendentes: rows.length, aplicados };
  }

  async applyAnchorsAll(batch = 300, maxBatches = 500): Promise<{ processados: number; aplicados: number }> {
    let processados = 0;
    let aplicados = 0;
    for (let i = 0; i < maxBatches; i += 1) {
      const { pendentes, aplicados: a } = await this.applyAnchorsToEvents(batch);
      processados += pendentes;
      aplicados += a;
      if (pendentes === 0) break;
      // Se um lote inteiro não casou nada, os restantes provavelmente também não;
      // mas seguimos alguns lotes pois a ordenação é por data (não por match).
      if (pendentes < batch) break;
    }
    return { processados, aplicados };
  }

  /**
   * Write path do feedback loop: registra ocupação/multiplicador reais por
   * evento canônico. Média móvel simples ponderada por amostra.
   */
  async recordFeedback(
    normalizedName: string | null | undefined,
    obs: { occupancy?: number | null; multiplier?: number | null; demandScore?: number | null; year?: number | null },
  ): Promise<void> {
    const key = seriesKey(normalizedName);
    if (!key) return;
    const existing = await this.anchorRepo.findOne({ where: { canonicalName: key } });
    const row = existing ?? this.anchorRepo.create({ canonicalName: key, sampleSize: 0 });
    const n = row.sampleSize || 0;
    const blend = (prev: number | null, next: number | null | undefined): number | null => {
      if (next === null || next === undefined || !Number.isFinite(next)) return prev;
      if (prev === null || prev === undefined) return next;
      return (prev * n + next) / (n + 1);
    };
    row.realOccupancy = blend(row.realOccupancy, obs.occupancy ?? null);
    row.realMultiplier = blend(row.realMultiplier, obs.multiplier ?? null);
    row.avgDemandScore = blend(row.avgDemandScore, obs.demandScore ?? null);
    row.sampleSize = n + 1;
    if (obs.year) row.lastYear = Math.max(row.lastYear ?? 0, obs.year);
    row.source = 'feedback';
    await this.anchorRepo.save(row);
  }

  /**
   * Recalcula (idempotente, do zero) as âncoras de feedback a partir das análises
   * com resultado registrado. Ocupação/multiplicador reais viram a fonte mais
   * forte — sobrescrevem wikidata para o mesmo evento canônico.
   */
  async recomputeFeedbackAnchors(): Promise<{ analises: number; anchors: number }> {
    const analises = await this.analiseRepo.find({
      where: { resultadoRegistradoEm: Not(IsNull()) as any },
      relations: ['evento'],
      take: 20_000,
    });
    const rows: FeedbackRow[] = [];
    for (const a of analises) {
      const status = a.reservaStatus;
      if (status !== 'booked' && status !== 'not_booked') continue;
      const key = seriesKey(a.evento?.normalizedName ?? null);
      if (!key) continue;
      const base = Number(a.seuPrecoAtual);
      const applied = a.precoAplicado !== null ? Number(a.precoAplicado) : NaN;
      const multiplier = Number.isFinite(base) && base > 0 && Number.isFinite(applied) ? applied / base : null;
      rows.push({
        seriesKey: key,
        booked: status === 'booked',
        multiplier,
        year: a.evento?.dataInicio ? new Date(a.evento.dataInicio).getUTCFullYear() : null,
      });
    }

    const anchors = aggregateFeedbackRows(rows);
    for (const fa of anchors) {
      const existing = await this.anchorRepo.findOne({ where: { canonicalName: fa.canonicalName } });
      const row = existing ?? this.anchorRepo.create({ canonicalName: fa.canonicalName });
      row.realOccupancy = fa.realOccupancy;
      row.realMultiplier = fa.realMultiplier;
      row.sampleSize = fa.sampleSize;
      if (fa.lastYear) row.lastYear = fa.lastYear;
      row.source = 'feedback';
      await this.anchorRepo.save(row);
    }
    this.logger.log(`Feedback anchors: ${anchors.length} recomputados de ${rows.length} observações.`);
    return { analises: rows.length, anchors: anchors.length };
  }

  @Cron('0 0 6 * * 0', { timeZone: 'America/Sao_Paulo' }) // domingo 06:00
  async scheduledImport(): Promise<void> {
    await this.importFromWikidata();
    await this.recomputeFeedbackAnchors();
    await this.applyAnchorsToEvents(500);
  }

  @Cron('0 45 4 * * *', { timeZone: 'America/Sao_Paulo' }) // diário 04:45 (após venues)
  async scheduledApply(): Promise<void> {
    await this.applyAnchorsToEvents(300);
  }
}
