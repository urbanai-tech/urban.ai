import {
  seriesKey,
  aggregateWikidataRows,
  aggregateFeedbackRows,
  WikidataRow,
  FeedbackRow,
} from './event-historical.service';
import { eventDemandScore } from './event-pricing-intelligence.service';
import { EventIdentityService } from '../evento/event-identity.service';
import { SP_RECURRING_EVENTS } from './data/sp-recurring-events';

describe('event-historical pure helpers (IA-3b)', () => {
  const identity = new EventIdentityService();
  const normalize = (v?: string | null) => identity.normalizeText(v);

  describe('seriesKey', () => {
    it('remove o ano para colapsar edições', () => {
      expect(seriesKey('ccxp 2023')).toBe('ccxp');
      expect(seriesKey('ccxp 2026')).toBe('ccxp');
      expect(seriesKey('lollapalooza brasil 2024')).toBe('lollapalooza brasil');
    });
    it('mantém nome sem ano', () => {
      expect(seriesKey('the town')).toBe('the town');
    });
    it('lida com vazio/nulo', () => {
      expect(seriesKey(null)).toBe('');
      expect(seriesKey('')).toBe('');
    });
  });

  describe('aggregateWikidataRows', () => {
    it('agrega edições pela chave de série usando a mediana', () => {
      const rows: WikidataRow[] = [
        { name: 'CCXP 2022', attendance: 260000, year: 2022 },
        { name: 'CCXP 2023', attendance: 280000, year: 2023 },
        { name: 'CCXP 2024', attendance: 300000, year: 2024 },
      ];
      const out = aggregateWikidataRows(rows, normalize);
      const ccxp = out.find((a) => a.canonicalName === 'ccxp');
      expect(ccxp).toBeDefined();
      expect(ccxp!.realAttendance).toBe(280000); // mediana
      expect(ccxp!.sampleSize).toBe(3);
      expect(ccxp!.lastYear).toBe(2024);
    });
    it('descarta público inválido/zero', () => {
      const rows: WikidataRow[] = [
        { name: 'Evento X', attendance: 0 },
        { name: 'Evento X', attendance: NaN as any },
      ];
      expect(aggregateWikidataRows(rows, normalize)).toEqual([]);
    });
  });

  describe('aggregateFeedbackRows (idempotente)', () => {
    it('ocupação = fração de booked; multiplicador = média dos que reservaram', () => {
      const rows: FeedbackRow[] = [
        { seriesKey: 'ccxp', booked: true, multiplier: 1.4, year: 2025 },
        { seriesKey: 'ccxp', booked: true, multiplier: 1.6, year: 2025 },
        { seriesKey: 'ccxp', booked: false, multiplier: 2.0, year: 2025 },
        { seriesKey: 'ccxp', booked: false, multiplier: null, year: 2024 },
      ];
      const [anchor] = aggregateFeedbackRows(rows);
      expect(anchor.canonicalName).toBe('ccxp');
      expect(anchor.realOccupancy).toBeCloseTo(0.5, 5); // 2 de 4
      expect(anchor.realMultiplier).toBeCloseTo(1.5, 5); // média de 1.4 e 1.6 (só booked)
      expect(anchor.sampleSize).toBe(4);
      expect(anchor.lastYear).toBe(2025);
    });
  });

  describe('seed curado de eventos recorrentes', () => {
    it('canonicalName de cada seed já é a própria chave de série (casa com eventos)', () => {
      for (const s of SP_RECURRING_EVENTS) {
        expect(seriesKey(normalize(s.displayName))).toBe(s.canonicalName);
        expect(s.attendance).toBeGreaterThan(0);
        expect(s.sourceUrl).toMatch(/^https?:\/\//);
      }
    });

    it('um evento "CCXP 2026" casaria com a âncora curada ccxp', () => {
      expect(seriesKey(normalize('CCXP 2026'))).toBe('ccxp');
      expect(seriesKey(normalize('Lollapalooza Brasil 2026'))).toBe('lollapalooza brasil');
      expect(seriesKey(normalize('The Town 2025'))).toBe('the town');
    });
  });

  describe('âncora histórica flui no eventDemandScore', () => {
    it('usa historicalAttendance como público quando não há expected/capacidade', () => {
      const res = eventDemandScore({
        relevancia: 50,
        historicalAttendance: 280000,
        startsAt: '2026-12-05T12:00:00Z',
      } as any);
      expect(res.expectedAttendance).toBe(280000);
    });
    it('expectedAttendance real tem prioridade sobre a âncora', () => {
      const res = eventDemandScore({
        relevancia: 50,
        expectedAttendance: 1000,
        historicalAttendance: 280000,
        startsAt: '2026-12-05T12:00:00Z',
      } as any);
      expect(res.expectedAttendance).toBe(1000);
    });
  });
});
