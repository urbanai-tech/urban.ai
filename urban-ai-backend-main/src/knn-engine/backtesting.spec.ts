import { calculateBacktest, meetsQualityGate } from './backtesting';

describe('calculateBacktest', () => {
  it('returns 0% MAPE when prediction equals actual', () => {
    const pairs = [
      { predicted: 100, actual: 100 },
      { predicted: 200, actual: 200 },
      { predicted: 50, actual: 50 },
    ];

    const result = calculateBacktest(pairs);

    expect(result.mapePercent).toBe(0);
    expect(result.rmse).toBe(0);
    expect(result.sampleSize).toBe(3);
    expect(result.discarded).toBe(0);
  });

  it('returns ~10% MAPE when prediction is consistently 10% off', () => {
    const pairs = [
      { predicted: 110, actual: 100 },
      { predicted: 220, actual: 200 },
      { predicted: 55, actual: 50 },
    ];

    const result = calculateBacktest(pairs);

    expect(result.mapePercent).toBeCloseTo(10, 1);
    expect(result.sampleSize).toBe(3);
  });

  it('discards pairs where actual <= 0', () => {
    const pairs = [
      { predicted: 100, actual: 100 },
      { predicted: 200, actual: 0 },     // discarded
      { predicted: 50, actual: -10 },    // discarded
      { predicted: 80, actual: 80 },
    ];

    const result = calculateBacktest(pairs);

    expect(result.sampleSize).toBe(2);
    expect(result.discarded).toBe(2);
    expect(result.mapePercent).toBe(0);
  });

  it('returns NaN when all pairs are discarded', () => {
    const pairs = [
      { predicted: 100, actual: 0 },
      { predicted: 200, actual: -5 },
    ];

    const result = calculateBacktest(pairs);

    expect(result.sampleSize).toBe(0);
    expect(Number.isNaN(result.mapePercent)).toBe(true);
  });

  it('computes medianAbsoluteError correctly with outliers', () => {
    // Erros absolutos: [5, 10, 15, 20, 1000] — mediana = 15
    const pairs = [
      { predicted: 105, actual: 100 },
      { predicted: 110, actual: 100 },
      { predicted: 115, actual: 100 },
      { predicted: 120, actual: 100 },
      { predicted: 1100, actual: 100 },
    ];

    const result = calculateBacktest(pairs);

    expect(result.medianAbsoluteError).toBe(15);
  });
});

describe('meetsQualityGate', () => {
  it('passes when MAPE <= threshold (default 15%)', () => {
    const pairs = [
      { predicted: 110, actual: 100 }, // 10% erro
      { predicted: 220, actual: 200 }, // 10% erro
    ];

    const gate = meetsQualityGate(pairs);

    expect(gate.passes).toBe(true);
    expect(gate.mape).toBeCloseTo(10, 1);
  });

  it('fails when MAPE > threshold', () => {
    const pairs = [
      { predicted: 130, actual: 100 }, // 30% erro
      { predicted: 260, actual: 200 }, // 30% erro
    ];

    const gate = meetsQualityGate(pairs);

    expect(gate.passes).toBe(false);
    expect(gate.mape).toBeCloseTo(30, 1);
  });

  it('respects custom threshold', () => {
    const pairs = [
      { predicted: 105, actual: 100 }, // 5% erro
      { predicted: 210, actual: 200 }, // 5% erro
    ];

    const tightGate = meetsQualityGate(pairs, 3); // exige <= 3%
    expect(tightGate.passes).toBe(false);

    const looseGate = meetsQualityGate(pairs, 10); // exige <= 10%
    expect(looseGate.passes).toBe(true);
  });

  it('fails when sampleSize is 0 (all discarded)', () => {
    const pairs = [
      { predicted: 100, actual: 0 },
    ];

    const gate = meetsQualityGate(pairs);

    expect(gate.passes).toBe(false);
    expect(gate.sampleSize).toBe(0);
  });
});
