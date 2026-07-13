import {
  easterSunday,
  movableHolidays,
  isSpHoliday,
  seasonalDemandBaseline,
  MAX_SEASONAL_POINTS,
} from './data/sp-seasonality';

describe('sp-seasonality (baseline IA-3d)', () => {
  describe('easterSunday', () => {
    it('acerta datas conhecidas de Páscoa', () => {
      // Domingos de Páscoa (UTC).
      expect(easterSunday(2024).toISOString().slice(0, 10)).toBe('2024-03-31');
      expect(easterSunday(2025).toISOString().slice(0, 10)).toBe('2025-04-20');
      expect(easterSunday(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
    });
  });

  describe('movableHolidays', () => {
    it('deriva Sexta-Santa, Carnaval e Corpus Christi de 2026', () => {
      const { goodFriday, carnivalTuesday, corpusChristi } = movableHolidays(2026);
      expect(goodFriday.toISOString().slice(0, 10)).toBe('2026-04-03');
      expect(carnivalTuesday.toISOString().slice(0, 10)).toBe('2026-02-17');
      expect(corpusChristi.toISOString().slice(0, 10)).toBe('2026-06-04');
    });
  });

  describe('isSpHoliday', () => {
    it('reconhece feriados fixos e o aniversário de SP', () => {
      expect(isSpHoliday(new Date('2026-01-01T12:00:00Z'))).toBe(true); // Ano novo
      expect(isSpHoliday(new Date('2026-01-25T12:00:00Z'))).toBe(true); // Aniv. SP
      expect(isSpHoliday(new Date('2026-09-07T12:00:00Z'))).toBe(true); // Independência
      expect(isSpHoliday(new Date('2026-12-25T12:00:00Z'))).toBe(true); // Natal
    });
    it('reconhece feriados móveis', () => {
      expect(isSpHoliday(new Date('2026-02-17T12:00:00Z'))).toBe(true); // Carnaval
      expect(isSpHoliday(new Date('2026-04-03T12:00:00Z'))).toBe(true); // Sexta-Santa
    });
    it('dia comum não é feriado', () => {
      expect(isSpHoliday(new Date('2026-08-11T12:00:00Z'))).toBe(false);
    });
  });

  describe('seasonalDemandBaseline', () => {
    it('dá 0 para data comum (sem regressão)', () => {
      const r = seasonalDemandBaseline(new Date('2026-08-11T12:00:00Z')); // terça comum
      expect(r.points).toBe(0);
      expect(r.label).toBeNull();
    });

    it('pontua Réveillon/verão', () => {
      const r = seasonalDemandBaseline(new Date('2026-12-31T12:00:00Z'));
      expect(r.points).toBeGreaterThan(0);
      expect(r.label).toBe('Réveillon/Verão');
    });

    it('pontua semana de Carnaval', () => {
      const r = seasonalDemandBaseline(new Date('2026-02-16T12:00:00Z')); // segunda de carnaval
      expect(r.points).toBeGreaterThan(0);
    });

    it('pontua recesso de julho', () => {
      const r = seasonalDemandBaseline(new Date('2026-07-15T12:00:00Z'));
      expect(r.points).toBeGreaterThan(0);
    });

    it('nunca passa do teto', () => {
      const r = seasonalDemandBaseline(new Date('2026-01-01T12:00:00Z')); // feriado + verão
      expect(r.points).toBeLessThanOrEqual(MAX_SEASONAL_POINTS);
    });

    it('lida com data inválida/nula', () => {
      expect(seasonalDemandBaseline(null).points).toBe(0);
      expect(seasonalDemandBaseline('nao-e-data').points).toBe(0);
    });
  });
});
