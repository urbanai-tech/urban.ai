import { Injectable } from '@nestjs/common';
import { EventIntelligenceConfidence, EventIntelligenceSnapshot } from '../entities/event-intelligence-snapshot.entity';
import { Event as EventEntity } from '../entities/events.entity';
import { EventPricingIntelligenceService } from '../knn-engine/event-pricing-intelligence.service';
import { HeatmapCellPayload } from './event-intelligence.types';

type HeatmapDateRange = { from: string; to: string };

@Injectable()
export class EventHeatmapProjectionService {
  constructor(private readonly pricingIntelligence: EventPricingIntelligenceService) {}

  buildCells(
    events: EventEntity[],
    snapshots: Map<string, EventIntelligenceSnapshot>,
    impactCounts: Map<string, number>,
    range: HeatmapDateRange,
  ): HeatmapCellPayload[] {
    const cells = new Map<
      string,
      {
        centerLat: number;
        centerLng: number;
        events: EventEntity[];
        demandScores: number[];
        confidenceScores: number[];
        revenuePotentialCents: number;
        affectedPropertiesCount: number;
        categories: Map<string, number>;
      }
    >();

    for (const event of events) {
      if (!this.hasCoordinates(event)) continue;
      const lat = this.numberOrNull(event.latitude);
      const lng = this.numberOrNull(event.longitude);
      if (lat === null || lng === null) continue;
      const centerLat = Math.round(lat * 50) / 50;
      const centerLng = Math.round(lng * 50) / 50;
      const cellId = `${centerLat.toFixed(2)}:${centerLng.toFixed(2)}`;
      const snapshot = snapshots.get(event.id);
      const derivedDemand = snapshot ? null : this.deriveEventDemand(event);
      const score =
        this.numberOrNull(snapshot?.eventDemandScore) ??
        derivedDemand?.eventDemandScore ??
        this.numberOrNull(event.relevancia);
      const revenue = this.numberOrNull(snapshot?.eventRevenuePotentialCents) ?? 0;
      const confidence = snapshot?.confidence ?? derivedDemand?.confidence ?? this.confidenceFromEvent(event);
      const cell =
        cells.get(cellId) ??
        {
          centerLat,
          centerLng,
          events: [],
          demandScores: [],
          confidenceScores: [],
          revenuePotentialCents: 0,
          affectedPropertiesCount: 0,
          categories: new Map<string, number>(),
        };
      cell.events.push(event);
      if (score !== null) cell.demandScores.push(score);
      cell.confidenceScores.push(this.confidenceScore(confidence));
      cell.revenuePotentialCents += revenue;
      cell.affectedPropertiesCount += impactCounts.get(event.id) ?? 0;
      if (event.categoria) cell.categories.set(event.categoria, (cell.categories.get(event.categoria) ?? 0) + 1);
      cells.set(cellId, cell);
    }

    return Array.from(cells.entries()).map(([cellId, cell]) => {
      const avgDemand = this.average(cell.demandScores);
      return {
        cellId,
        bbox: [
          Math.round((cell.centerLng - 0.01) * 10000) / 10000,
          Math.round((cell.centerLat - 0.01) * 10000) / 10000,
          Math.round((cell.centerLng + 0.01) * 10000) / 10000,
          Math.round((cell.centerLat + 0.01) * 10000) / 10000,
        ] as [number, number, number, number],
        centerLat: cell.centerLat,
        centerLng: cell.centerLng,
        dateFrom: range.from,
        dateTo: range.to,
        eventDemandScore: avgDemand,
        revenuePotentialCents: cell.revenuePotentialCents || null,
        eventsCount: cell.events.length,
        topEventIds: [...cell.events]
          .sort((a, b) => (this.numberOrNull(b.relevancia) ?? 0) - (this.numberOrNull(a.relevancia) ?? 0))
          .slice(0, 5)
          .map((event) => event.id),
        affectedPropertiesCount: cell.affectedPropertiesCount,
        averageConfidence: this.confidenceFromScore(this.average(cell.confidenceScores) ?? 0),
        dominantCategory: this.dominantCategory(cell.categories),
        supplyCompressionScore: null,
      };
    });
  }

  private deriveEventDemand(event: EventEntity) {
    return this.pricingIntelligence.eventDemandScore({
      relevancia: this.numberOrNull(event.relevancia),
      expectedAttendance: this.numberOrNull(event.expectedAttendance),
      capacidadeEstimada: this.numberOrNull(event.capacidadeEstimada),
      historicalAttendance: this.numberOrNull(event.historicalAttendance),
      venueCapacity: this.numberOrNull(event.venueCapacity),
      venueType: event.venueType ?? null,
      categoria: event.categoria ?? null,
      raioImpactoKm: this.numberOrNull(event.raioImpactoKm),
      startsAt: event.dataInicio,
      source: event.source ?? null,
      dataCrawl: event.dataCrawl,
      sourceFreshnessHours: this.sourceFreshnessHours(event.dataCrawl),
      overlapEventsCount: null,
    });
  }

  private numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private hasCoordinates(event: EventEntity) {
    return this.numberOrNull(event.latitude) !== null && this.numberOrNull(event.longitude) !== null;
  }

  private sourceFreshnessHours(dataCrawl?: Date | null) {
    if (!dataCrawl) return null;
    const crawledAt = new Date(dataCrawl).getTime();
    if (Number.isNaN(crawledAt)) return null;
    return Math.round(((Date.now() - crawledAt) / 3_600_000) * 10) / 10;
  }

  private confidenceFromEvent(event: EventEntity): EventIntelligenceConfidence {
    const score = this.numberOrNull(event.relevancia) ?? 0;
    if (score >= 75 && this.hasCoordinates(event)) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private confidenceScore(confidence: EventIntelligenceConfidence) {
    if (confidence === 'high') return 85;
    if (confidence === 'medium') return 60;
    return 30;
  }

  private confidenceFromScore(score: number): EventIntelligenceConfidence {
    if (score >= 75) return 'high';
    if (score >= 45) return 'medium';
    return 'low';
  }

  private average(values: number[]) {
    const valid = values.filter((value) => Number.isFinite(value));
    if (!valid.length) return null;
    return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 100) / 100;
  }

  private dominantCategory(categories: Map<string, number>) {
    let best: { category: string; count: number } | null = null;
    for (const [category, count] of categories.entries()) {
      if (!best || count > best.count) best = { category, count };
    }
    return best?.category ?? null;
  }
}
