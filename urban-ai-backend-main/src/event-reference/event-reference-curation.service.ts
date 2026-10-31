import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'crypto';
import { Between, In, LessThan, Not, Repository } from 'typeorm';
import { Event } from '../entities/events.entity';
import { EventSource } from '../entities/event-source.entity';
import { EventReference } from '../entities/event-reference.entity';
import { EventReferenceVote } from '../entities/event-reference-vote.entity';
import { EventReferenceFetchCache } from '../entities/event-reference-fetch-cache.entity';
import { EventIdentityService } from '../evento/event-identity.service';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';
import { addDaysToDateKey, parseEventDateTime, saoPauloDayBounds, todaySaoPauloDateKey } from '../common/sp-date';
import {
  readEventReferenceConfig,
  readProviderAvailability,
  loadReferenceVenues,
  type EventReferenceConfig,
  type ReferenceVenueConfig,
} from './event-reference.config';
import {
  cleanText,
  dbValidatorKey,
  referenceFingerprint,
  webValidatorKey,
  windowForHorizon,
  type ExtractedCandidate,
} from './event-reference-normalize';
import {
  canAutoDecide,
  clusterObservations,
  decideReference,
  type Observation,
  type SiblingLike,
} from './event-reference-consensus';
import { buildVenueResolver } from './event-coverage-metrics';
import { EventReferenceSourcesService, type WebDocument } from './event-reference-sources.service';
import { EventReferenceLlmService } from './event-reference-llm.service';

export interface CurationResult {
  venuesProcessed: number;
  venuesTotal: number;
  observations: number;
  referencesCreated: number;
  referencesTouched: number;
  approvedAuto: number;
  conflicts: number;
  candidates: number;
  calls: { search: number; scrape: number; llm: number; judge: number; cacheHits: number };
  providers: ReturnType<typeof readProviderAvailability>;
  budgetExhausted: string[];
  warnings: string[];
}

/** Teto de chamadas pagas por execução (ADR 0026). */
export class CurationBudget {
  readonly used = { search: 0, scrape: 0, llm: 0, judge: 0, cacheHits: 0 };
  readonly exhausted = new Set<string>();

  constructor(private readonly caps: { search: number; scrape: number; llm: number; judge: number }) {}

  take(kind: 'search' | 'scrape' | 'llm' | 'judge'): boolean {
    if (this.used[kind] >= this.caps[kind]) {
      this.exhausted.add(kind);
      return false;
    }
    this.used[kind] += 1;
    return true;
  }
}

interface CachedDoc {
  url: string;
  title: string | null;
  key: string;
  candidates: ExtractedCandidate[];
}

const CACHE_RETENTION_DAYS = 3;
const MAX_EVIDENCE_URLS = 10;

@Injectable()
export class EventReferenceCurationService {
  private readonly logger = new Logger(EventReferenceCurationService.name);

  constructor(
    @InjectRepository(EventReference) private readonly refRepo: Repository<EventReference>,
    @InjectRepository(EventReferenceVote) private readonly voteRepo: Repository<EventReferenceVote>,
    @InjectRepository(EventReferenceFetchCache) private readonly cacheRepo: Repository<EventReferenceFetchCache>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(EventSource) private readonly eventSourceRepo: Repository<EventSource>,
    private readonly identity: EventIdentityService,
    private readonly sources: EventReferenceSourcesService,
    private readonly llm: EventReferenceLlmService,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

  @Cron('10 3 * * *', {
    name: 'event-reference-curation',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async handleDailyCuration(): Promise<CurationResult | { skipped: true; reason: string }> {
    return runScheduledJob(this.scheduledJobRunner, 'event-reference-curation', async () => {
      if (!readEventReferenceConfig().curationEnabled) {
        return {
          skipped: true as const,
          reason: 'curadoria desligada (EVENT_REFERENCE_CURATION_ENABLED) ou sem GEMINI_API_KEY + provedor externo',
        };
      }
      return this.run();
    });
  }

  /**
   * Uma execução completa: coleta candidatos por venue (busca, página oficial e eventos
   * ingeridos), grava votos, decide por consenso e (opcional) consulta o juiz independente.
   * Aceita `now` para testes.
   */
  async run(now: Date = new Date()): Promise<CurationResult> {
    const config = readEventReferenceConfig();
    const providers = readProviderAvailability();
    const { venues: allVenues, warning: venuesWarning } = loadReferenceVenues();
    const warnings: string[] = [];
    if (venuesWarning) warnings.push(venuesWarning);

    if (!providers.gemini) warnings.push('GEMINI_API_KEY ausente: sem extração por IA; só o banco de eventos vota.');
    if (!providers.tavily && !providers.serpapi && !providers.firecrawl) {
      warnings.push('Nenhuma fonte externa configurada (TAVILY_API_KEY, SERPAPI_KEY, FIRECRAWL_API_KEY).');
    }
    const webReady = providers.gemini && (providers.tavily || providers.serpapi || providers.firecrawl);
    if (!webReady) {
      warnings.push('Sem chaves para validar fora do banco: tudo vira candidato na fila de revisão humana.');
    }
    if (!providers.anthropic) warnings.push('ANTHROPIC_API_KEY ausente: sem juiz independente.');

    const today = todaySaoPauloDateKey(now);
    const window = windowForHorizon(today, config.horizonDays);
    const budget = new CurationBudget({
      search: config.maxSearchCalls,
      scrape: config.maxScrapeCalls,
      llm: config.maxLlmCalls,
      judge: config.maxJudgeCalls,
    });

    const venues = this.rotateVenues(allVenues, config, today);
    const resolver = buildVenueResolver(allVenues, this.identity);

    // Observações do banco (uma consulta para todos os venues).
    const dbObservations = await this.collectDbObservations(window, allVenues, resolver);

    const touched = new Set<string>();
    let observationsTotal = 0;
    let created = 0;
    const preloaded = await this.refRepo.find({
      where: { dateKey: Between(addDaysToDateKey(window.fromDateKey, -config.divergenceDays), addDaysToDateKey(window.toDateKey, config.divergenceDays)) },
    });
    const refsByKey = new Map<string, EventReference[]>();
    const indexRef = (ref: EventReference) => {
      const bucket = refsByKey.get(`${ref.venueKey}|${ref.dateKey}`) ?? [];
      bucket.push(ref);
      refsByKey.set(`${ref.venueKey}|${ref.dateKey}`, bucket);
    };
    preloaded.forEach(indexRef);

    for (const venue of venues) {
      const observations = [...(dbObservations.get(venue.key) ?? [])];
      if (webReady) {
        observations.push(...(await this.collectWebObservations(venue, window, budget, config, providers, today)));
      }
      observationsTotal += observations.length;
      if (observations.length === 0) continue;

      const clusters = clusterObservations(observations, this.identity, config.nameSimilarity);
      for (const cluster of clusters) {
        const startsAt =
          parseEventDateTime(`${cluster.dateKey}${cluster.time ? `T${cluster.time}:00` : ''}`)?.instant ??
          saoPauloDayBounds(cluster.dateKey).start;
        let ref = this.findExisting(refsByKey, cluster.venueKey, cluster.dateKey, cluster.name, venue.name);
        if (!ref) {
          const fingerprint = referenceFingerprint(this.identity, {
            name: cluster.name,
            dateKey: cluster.dateKey,
            venue: venue.name,
          });
          const stored = await this.refRepo.findOne({ where: { fingerprint } });
          if (!stored) created += 1;
          ref =
            stored ??
            (await this.refRepo.save(
              this.refRepo.create({
                name: cleanText(cluster.name, 255),
                normalizedName: this.identity.normalizeText(cluster.name).slice(0, 255),
                venueKey: venue.key,
                venueName: venue.name,
                normalizedVenue: this.identity.normalizeVenue(venue.name).slice(0, 255),
                startsAt,
                dateKey: cluster.dateKey,
                city: venue.city,
                category: cluster.category ?? venue.category,
                size: cluster.size,
                status: 'candidato',
                origin: 'curadoria',
                fingerprint,
                evidenceUrls: [],
                votesSupport: 0,
                votesAgainst: 0,
              }),
            ));
          indexRef(ref);
        }
        await this.recordVotes(ref, cluster.observations);
        touched.add(ref.id);
      }
    }

    const decisionSummary = await this.decideTouched([...touched], config, budget, providers.anthropic);

    await this.cleanupCache(today);

    for (const kind of budget.exhausted) {
      warnings.push(`Teto de chamadas atingido (${kind}); o resto fica para a próxima execução.`);
    }

    const result: CurationResult = {
      venuesProcessed: venues.length,
      venuesTotal: allVenues.length,
      observations: observationsTotal,
      referencesCreated: created,
      referencesTouched: touched.size,
      approvedAuto: decisionSummary.approved,
      conflicts: decisionSummary.conflicts,
      candidates: decisionSummary.candidates,
      calls: { ...budget.used },
      providers,
      budgetExhausted: [...budget.exhausted],
      warnings,
    };
    this.logger.log(
      `Curadoria: ${result.venuesProcessed}/${result.venuesTotal} venues, ${result.observations} observações, ` +
        `${result.referencesTouched} referências (${result.approvedAuto} aprovadas, ${result.conflicts} conflitos, ${result.candidates} candidatas).`,
    );
    return result;
  }

  // ---------------------------------------------------------------------------
  // Coleta
  // ---------------------------------------------------------------------------

  /** Com teto de venues por execução, rotaciona pelo dia do ano para cobrir todos ao longo da semana. */
  rotateVenues(venues: ReferenceVenueConfig[], config: EventReferenceConfig, today: string): ReferenceVenueConfig[] {
    if (!config.maxVenuesPerRun || config.maxVenuesPerRun >= venues.length) return venues;
    const [y, m, d] = today.split('-').map(Number);
    const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
    const start = (dayNumber * config.maxVenuesPerRun) % venues.length;
    return Array.from({ length: config.maxVenuesPerRun }, (_, i) => venues[(start + i) % venues.length]);
  }

  private async collectDbObservations(
    window: { fromDateKey: string; toDateKey: string },
    venues: ReferenceVenueConfig[],
    resolver: ReturnType<typeof buildVenueResolver>,
  ): Promise<Map<string, Observation[]>> {
    const out = new Map<string, Observation[]>();
    const events = await this.eventRepo.find({
      where: {
        dataInicio: Between(saoPauloDayBounds(window.fromDateKey).start, saoPauloDayBounds(window.toDateKey).end),
        outOfScope: false,
        dedupStatus: Not('duplicate'),
      },
      take: 5000,
      order: { dataInicio: 'ASC' },
    });
    const byVenue = new Map<string, Event[]>();
    for (const event of events) {
      const venue = resolver(event);
      if (!venue) continue;
      byVenue.set(venue.key, [...(byVenue.get(venue.key) ?? []), event]);
    }
    const ids = [...byVenue.values()].flat().map((e) => e.id);
    const sourceRows = ids.length
      ? await this.eventSourceRepo.find({ where: { eventId: In(ids) }, select: ['eventId', 'source', 'url'] as any })
      : [];
    const sourcesByEvent = new Map<string, Array<{ source: string; url: string | null }>>();
    for (const row of sourceRows) {
      sourcesByEvent.set(row.eventId, [...(sourcesByEvent.get(row.eventId) ?? []), { source: row.source, url: row.url }]);
    }

    for (const venue of venues) {
      const list: Observation[] = [];
      for (const event of byVenue.get(venue.key) ?? []) {
        const dateKey = this.identity.eventDateKey(event.dataInicio);
        if (!dateKey) continue;
        const sources = sourcesByEvent.get(event.id) ?? (event.source ? [{ source: event.source, url: event.linkSiteOficial ?? null }] : []);
        const seen = new Set<string>();
        for (const source of sources) {
          const validatorKey = dbValidatorKey(source.source);
          if (seen.has(validatorKey)) continue;
          seen.add(validatorKey);
          list.push({
            validatorKey,
            validatorKind: 'events_db',
            sourceUrl: source.url ?? null,
            extractor: 'none',
            name: cleanText(event.canonicalName || event.nome, 255),
            dateKey,
            time: null,
            venueKey: venue.key,
            venueName: venue.name,
            category: event.categoria ? cleanText(event.categoria, 64).toLowerCase() : null,
            size: venue.size,
            snippet: `Evento ingerido pela fonte ${source.source}`,
          });
        }
      }
      out.set(venue.key, list);
    }
    return out;
  }

  private async collectWebObservations(
    venue: ReferenceVenueConfig,
    window: { fromDateKey: string; toDateKey: string },
    budget: CurationBudget,
    config: EventReferenceConfig,
    providers: ReturnType<typeof readProviderAvailability>,
    today: string,
  ): Promise<Observation[]> {
    const out: Observation[] = [];
    const push = (kind: Observation['validatorKind'], docs: CachedDoc[]) => {
      for (const doc of docs) {
        for (const candidate of doc.candidates) {
          if (!this.matchesVenue(candidate.venue, venue)) continue;
          out.push({
            validatorKey: doc.key,
            validatorKind: kind,
            sourceUrl: doc.url,
            extractor: 'gemini',
            name: candidate.name,
            dateKey: candidate.dateKey,
            time: candidate.time,
            venueKey: venue.key,
            venueName: venue.name,
            category: candidate.category,
            size: venue.size,
            snippet: doc.title,
          });
        }
      }
    };

    if (providers.tavily) {
      const query = `agenda de eventos ${venue.name} São Paulo próximos meses`;
      const docs = await this.cached('tavily', query, today, async () => {
        if (!budget.take('search')) return null;
        const results = await this.sources.searchTavily(query, config.docsPerSearch);
        return results ? this.extractAll(results, venue, window, budget) : [];
      }, budget);
      if (docs) push('tavily', docs);
    }

    if (providers.serpapi) {
      const query = `Eventos ${venue.name} São Paulo`;
      const docs = await this.cached('serpapi', query, today, async () => {
        if (!budget.take('search')) return null;
        const results = await this.sources.searchSerpApi(query);
        return results ? this.extractAll(results, venue, window, budget) : [];
      }, budget);
      if (docs) push('serpapi', docs);
    }

    if (providers.firecrawl && venue.officialUrl) {
      const url = venue.officialUrl;
      const docs = await this.cached('firecrawl', url, today, async () => {
        if (!budget.take('scrape')) return null;
        const doc = await this.sources.scrapeFirecrawl(url);
        return doc ? this.extractAll([doc], venue, window, budget) : [];
      }, budget);
      if (docs) push('firecrawl', docs);
    }

    return out;
  }

  /** Extrai candidatos de cada documento, respeitando o teto de chamadas ao LLM. */
  private async extractAll(
    docs: WebDocument[],
    venue: ReferenceVenueConfig,
    window: { fromDateKey: string; toDateKey: string },
    budget: CurationBudget,
  ): Promise<CachedDoc[]> {
    const out: CachedDoc[] = [];
    for (const doc of docs) {
      const key = doc.validatorKeyOverride ?? webValidatorKey(doc.url);
      if (!key) continue;
      if (!budget.take('llm')) break;
      const candidates = await this.llm.extractEvents(doc.content, venue, window);
      if (candidates === null) break; // sem chave do Gemini
      out.push({ url: doc.url, title: doc.title, key, candidates: Array.isArray(candidates) ? candidates : [] });
    }
    return out;
  }

  /**
   * Cache por provedor + URL/consulta + dia. `loader` devolve `null` quando o teto de custo foi
   * atingido (nada é gravado, para tentar de novo na próxima execução).
   */
  private async cached(
    provider: string,
    subject: string,
    day: string,
    loader: () => Promise<CachedDoc[] | null>,
    budget: CurationBudget,
  ): Promise<CachedDoc[] | null> {
    const cacheKey = createHash('sha1').update(`${provider}|${subject}|${day}`).digest('hex');
    const hit = await this.cacheRepo.findOne({ where: { cacheKey } });
    if (hit) {
      try {
        const parsed = JSON.parse(hit.payload) as CachedDoc[];
        if (Array.isArray(parsed)) {
          budget.used.cacheHits += 1;
          return parsed;
        }
      } catch {
        // Entrada corrompida: refaz.
      }
    }
    const docs = await loader();
    if (docs === null) return null;
    try {
      await this.cacheRepo.save(
        this.cacheRepo.create({ cacheKey, day, provider, payload: JSON.stringify(docs).slice(0, 60_000) }),
      );
    } catch {
      // Corrida com outra réplica gravando a mesma chave: sem problema.
    }
    return docs;
  }

  private async cleanupCache(today: string): Promise<void> {
    try {
      await this.cacheRepo.delete({ day: LessThan(addDaysToDateKey(today, -CACHE_RETENTION_DAYS)) });
    } catch (error: any) {
      this.logger.warn(`Limpeza do cache da curadoria falhou: ${error?.message}`);
    }
  }

  /** O venue citado no texto precisa ser o venue-alvo (ou não ser citado). */
  matchesVenue(mentioned: string | null, venue: ReferenceVenueConfig): boolean {
    if (!mentioned) return true;
    const normalized = this.identity.normalizeVenue(mentioned);
    if (!normalized) return true;
    const names = [venue.name, ...venue.aliases].map((n) => this.identity.normalizeVenue(n)).filter((n) => n.length >= 3);
    return names.some((n) => normalized === n || normalized.includes(n) || n.includes(normalized));
  }

  // ---------------------------------------------------------------------------
  // Persistência e decisão
  // ---------------------------------------------------------------------------

  private findExisting(
    index: Map<string, EventReference[]>,
    venueKey: string,
    dateKey: string,
    name: string,
    venueName: string,
  ): EventReference | null {
    const fingerprint = referenceFingerprint(this.identity, { name, dateKey, venue: venueName });
    const bucket = index.get(`${venueKey}|${dateKey}`) ?? [];
    return (
      bucket.find((r) => r.fingerprint === fingerprint) ??
      bucket.find((r) => this.identity.tokenSetSimilarity(r.name, name) >= 0.7) ??
      null
    );
  }

  private async recordVotes(ref: EventReference, observations: Observation[]): Promise<void> {
    const existing = await this.voteRepo.find({ where: { referenceId: ref.id } });
    const known = new Set(existing.map((v) => v.validatorKey));
    const urls = new Set(ref.evidenceUrls ?? []);
    let added = 0;
    for (const obs of observations) {
      if (known.has(obs.validatorKey)) continue;
      known.add(obs.validatorKey);
      try {
        await this.voteRepo.save(
          this.voteRepo.create({
            referenceId: ref.id,
            validatorKey: obs.validatorKey.slice(0, 160),
            validatorKind: obs.validatorKind,
            verdict: 'support',
            sourceUrl: obs.sourceUrl,
            extractor: obs.extractor,
            observedName: cleanText(obs.name, 255),
            observedDate: obs.dateKey,
            observedVenue: cleanText(obs.venueName, 160),
            snippet: obs.snippet ? cleanText(obs.snippet, 500) : null,
          }),
        );
        added += 1;
        if (obs.sourceUrl && /^https?:\/\//i.test(obs.sourceUrl)) urls.add(obs.sourceUrl);
      } catch (error: any) {
        this.logger.warn(`Voto não gravado (${obs.validatorKey}): ${error?.code ?? error?.message}`);
      }
    }
    if (added > 0) {
      ref.evidenceUrls = [...urls].slice(0, MAX_EVIDENCE_URLS);
      ref.votesSupport = known.size;
      await this.refRepo.update(ref.id, { evidenceUrls: ref.evidenceUrls, votesSupport: ref.votesSupport });
    }
  }

  /** Recalcula status das referências tocadas (e das irmãs, para propagar conflito de data). */
  async decideTouched(
    ids: string[],
    config: EventReferenceConfig,
    budget: CurationBudget,
    judgeAvailable: boolean,
  ): Promise<{ approved: number; conflicts: number; candidates: number }> {
    const summary = { approved: 0, conflicts: 0, candidates: 0 };
    if (ids.length === 0) return summary;
    const refs = await this.refRepo.find({ where: { id: In(ids) } });
    const toDecide = new Map(refs.map((r) => [r.id, r]));

    // Irmãs (mesmo venue, datas próximas) entram na reavaliação para receber o conflito também.
    for (const ref of refs) {
      if (!ref.venueKey) continue;
      const siblings = await this.findSiblings(ref, config.divergenceDays);
      for (const s of siblings) if (!toDecide.has(s.id)) toDecide.set(s.id, s as EventReference);
    }

    for (const ref of toDecide.values()) {
      if (!canAutoDecide(ref)) continue;
      const votes = await this.voteRepo.find({ where: { referenceId: ref.id } });
      const siblings = await this.findSiblings(ref, config.divergenceDays);
      const asSiblings: SiblingLike[] = siblings.map((s) => ({
        id: s.id,
        name: s.name,
        dateKey: s.dateKey,
        venueKey: s.venueKey,
        status: s.status,
      }));
      let decision = decideReference({ ref, votes, siblings: asSiblings }, this.identity, config);

      if (decision.status === 'aprovado' && judgeAvailable && !decision.judge && budget.take('judge')) {
        const verdict = await this.llm.judge({
          name: ref.name,
          dateKey: ref.dateKey,
          venueName: ref.venueName,
          evidence: votes
            .filter((v) => v.verdict === 'support')
            .map((v) => `${v.validatorKey}: "${v.observedName}" em ${v.observedDate}${v.sourceUrl ? ` (${v.sourceUrl})` : ''}${v.snippet ? ` — ${v.snippet}` : ''}`),
        });
        if (verdict) {
          const judgeKey = `judge:${this.llm.judgeModel}`.slice(0, 160);
          try {
            const saved = await this.voteRepo.save(
              this.voteRepo.create({
                referenceId: ref.id,
                validatorKey: judgeKey,
                validatorKind: 'judge',
                verdict: verdict.verdict,
                sourceUrl: null,
                extractor: 'anthropic',
                observedName: null,
                observedDate: null,
                observedVenue: null,
                snippet: verdict.reason,
              }),
            );
            votes.push(saved);
          } catch {
            // Juiz já votou nesta referência em outra execução.
          }
          decision = decideReference({ ref, votes, siblings: asSiblings }, this.identity, config);
        }
      }

      const patch: Partial<EventReference> = { status: decision.status };
      if (decision.status === 'aprovado') {
        if (ref.status !== 'aprovado') patch.approvedAt = new Date();
        patch.approvedBy = 'auto-consenso';
        patch.conflictReason = null;
        patch.decisionNote = decision.reason.slice(0, 500);
        summary.approved += 1;
      } else {
        patch.approvedBy = null;
        patch.approvedAt = null;
        patch.conflictReason = decision.status === 'conflito' ? decision.reason.slice(0, 255) : null;
        patch.decisionNote = decision.reason.slice(0, 500);
        if (decision.status === 'conflito') summary.conflicts += 1;
        else summary.candidates += 1;
      }
      patch.votesSupport = votes.filter((v) => v.verdict === 'support').length;
      patch.votesAgainst = votes.filter((v) => v.verdict === 'reject').length;
      await this.refRepo.update(ref.id, patch);
    }
    return summary;
  }

  private async findSiblings(ref: EventReference, days: number): Promise<EventReference[]> {
    if (!ref.venueKey) return [];
    return this.refRepo.find({
      where: {
        venueKey: ref.venueKey,
        dateKey: Between(addDaysToDateKey(ref.dateKey, -days), addDaysToDateKey(ref.dateKey, days)),
        id: Not(ref.id),
      },
    });
  }
}
