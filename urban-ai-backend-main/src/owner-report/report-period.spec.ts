import {
  businessDayIndexInMonth,
  currentPeriodKey,
  isBusinessDay,
  isValidPeriodKey,
  lastDayOfMonthKey,
  parseSkipDates,
  periodBounds,
  previousPeriodKey,
  shiftPeriodKey,
} from './report-period';

describe('report-period (calendário de São Paulo)', () => {
  it('valida a chave YYYY-MM', () => {
    expect(isValidPeriodKey('2026-09')).toBe(true);
    expect(isValidPeriodKey('2026-13')).toBe(false);
    expect(isValidPeriodKey('2026-9')).toBe(false);
    expect(isValidPeriodKey('2019-12')).toBe(false);
    expect(isValidPeriodKey(undefined)).toBe(false);
  });

  it('soma meses atravessando o ano', () => {
    expect(shiftPeriodKey('2026-01', -1)).toBe('2025-12');
    expect(shiftPeriodKey('2026-12', 1)).toBe('2027-01');
    expect(shiftPeriodKey('2026-03', -12)).toBe('2025-03');
  });

  it('o mês do relatório é o de São Paulo, não o UTC', () => {
    // 01/11 01:30 UTC ainda é 31/10 22:30 em SP.
    expect(currentPeriodKey(new Date('2026-11-01T01:30:00Z'))).toBe('2026-10');
    expect(previousPeriodKey(new Date('2026-11-01T01:30:00Z'))).toBe('2026-09');
    expect(previousPeriodKey(new Date('2026-11-01T12:00:00Z'))).toBe('2026-10');
    expect(previousPeriodKey(new Date('2026-01-02T12:00:00Z'))).toBe('2025-12');
  });

  it('limites do mês: início inclusivo, fim exclusivo, em horário de SP', () => {
    const p = periodBounds('2026-02');
    expect(p.startKey).toBe('2026-02-01');
    expect(p.endKeyExclusive).toBe('2026-03-01');
    expect(p.daysInMonth).toBe(28);
    expect(p.label).toBe('fevereiro de 2026');
    expect(p.start.toISOString()).toBe('2026-02-01T03:00:00.000Z');
    expect(p.endExclusive.toISOString()).toBe('2026-03-01T03:00:00.000Z');
  });

  it('último dia do mês', () => {
    expect(lastDayOfMonthKey('2026-10-05')).toBe('2026-10-31');
    expect(lastDayOfMonthKey('2028-02-10')).toBe('2028-02-29');
    expect(lastDayOfMonthKey('2026-12-31')).toBe('2026-12-31');
  });

  it('dia útil: fim de semana e feriados listados ficam de fora', () => {
    // 01/11/2026 é domingo; 02/11 é segunda (Finados).
    expect(isBusinessDay('2026-11-01')).toBe(false);
    expect(isBusinessDay('2026-11-02')).toBe(true);
    expect(businessDayIndexInMonth('2026-11-02')).toBe(1);
    expect(businessDayIndexInMonth('2026-11-03')).toBe(2);
    expect(businessDayIndexInMonth('2026-11-07')).toBeNull();
    const skip = parseSkipDates('2026-11-02, 2026-11-15, lixo');
    expect(skip.has('2026-11-02')).toBe(true);
    expect(skip.size).toBe(2);
    expect(isBusinessDay('2026-11-02', skip)).toBe(false);
    expect(businessDayIndexInMonth('2026-11-03', skip)).toBe(1);
  });
});
