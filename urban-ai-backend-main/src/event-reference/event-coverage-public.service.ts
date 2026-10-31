import { Injectable } from '@nestjs/common';
import { TtlCache } from '../common/ttl-cache';
import { readEventReferenceConfig } from './event-reference.config';
import { EventCoverageService } from './event-coverage.service';
import { buildPublicCoverage, emptyPublicCoverage, type PublicCoverageSummary } from './event-coverage-public';

const PUBLIC_CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_KEY = 'public-event-coverage';

/**
 * Resumo público da cobertura (ADR 0026). Cacheado em memória por 10 min (o endpoint é aberto)
 * e, no HTTP, com Cache-Control para CDN/navegador. Se a leitura falhar, responde o estado
 * "medindo", nunca um erro 500 nem um número inventado.
 */
@Injectable()
export class EventCoveragePublicService {
  private readonly cache = new TtlCache<PublicCoverageSummary>(PUBLIC_CACHE_TTL_MS, 4);

  constructor(private readonly coverage: EventCoverageService) {}

  async summary(): Promise<PublicCoverageSummary> {
    try {
      return await this.cache.getOrLoad(CACHE_KEY, () => this.load());
    } catch {
      return emptyPublicCoverage();
    }
  }

  private async load(): Promise<PublicCoverageSummary> {
    const latest = await this.coverage.latestSnapshotDate();
    if (!latest) return emptyPublicCoverage();
    const [first, rows] = await Promise.all([this.coverage.firstSnapshotDate(), this.coverage.snapshotRowsFor(latest)]);
    return buildPublicCoverage({
      latestRows: rows.map((r) => ({
        snapshotDate: r.snapshotDate,
        scope: r.scope,
        dimension: r.dimension,
        dimensionValue: r.dimensionValue,
        referenceTotal: r.referenceTotal,
        referenceMatched: r.referenceMatched,
        recallPct: r.recallPct === null ? null : Number(r.recallPct),
      })),
      firstDate: first,
      minSample: readEventReferenceConfig().publicMinSample,
    });
  }
}
