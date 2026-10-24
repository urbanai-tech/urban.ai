jest.mock('@turf/turf', () => ({
  point: jest.fn(),
  distance: jest.fn(),
}));

import { formatComparisonReport, runEngineComparison } from './engine-comparison';
import { generateSyntheticMarket } from './synthetic-market';

/**
 * Backtest sintético v1 × v2. Os números NÃO provam valor (o gerador é nosso);
 * o teste trava propriedades estruturais e detecta regressão.
 * Para imprimir a tabela: PRICING_BACKTEST_PRINT=1 npx jest engine-comparison
 */
describe('backtest sintético — v1 × v2', () => {
  jest.setTimeout(60_000);

  it('gerador é determinístico para a mesma semente', () => {
    const a = generateSyntheticMarket({ seed: 7, properties: 10, horizonDays: 5 });
    const b = generateSyntheticMarket({ seed: 7, properties: 10, horizonDays: 5 });
    expect(a.nights.map((n) => n.realizedPrice)).toEqual(b.nights.map((n) => n.realizedPrice));
    const c = generateSyntheticMarket({ seed: 8, properties: 10, horizonDays: 5 });
    expect(c.nights.map((n) => n.realizedPrice)).not.toEqual(a.nights.map((n) => n.realizedPrice));
  });

  it('compara MAPE, % abaixo da base e distribuição de multiplicadores', async () => {
    const report = await runEngineComparison();
    if (process.env.PRICING_BACKTEST_PRINT === '1') {
      console.log(`\n${formatComparisonReport(report)}\n${JSON.stringify(report, null, 2)}`);
    }

    // Determinismo do relatório inteiro.
    const again = await runEngineComparison();
    expect(again).toEqual(report);

    // v1 nunca recomenda abaixo da base; v2 recomenda.
    expect(report.v1.pctBelowBase).toBe(0);
    expect(report.v1.distribution.min).toBeGreaterThanOrEqual(1);
    expect(report.v2.pctBelowBase).toBeGreaterThan(20);
    // v2 respeita o guardrail default (-20% / +50%).
    expect(report.v2.distribution.min).toBeGreaterThanOrEqual(0.8 - 1e-9);
    expect(report.v2.distribution.max).toBeLessThanOrEqual(1.5 + 1e-9);

    // Neste mercado sintético o v2 erra menos que o v1 e que "não mexer".
    expect(report.v2.mapePercent).toBeLessThan(report.v1.mapePercent);
    expect(report.v2.mapePercent).toBeLessThan(report.naive.mapePercent);
    // Em noites com evento, o v1 (só soma, LLM sem teto) erra muito mais.
    expect(report.v2.mapeEventNightsPercent).toBeLessThan(report.v1.mapeEventNightsPercent);
  });
});
