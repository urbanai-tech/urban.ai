/**
 * Backtesting de qualidade do motor de pricing (F6.1 Tier 3).
 *
 * MAPE — Mean Absolute Percentage Error — é a métrica padrão para regressão
 * de preço/demanda. Quanto menor, melhor. Roadmap define **MAPE ≤ 15%** como
 * gate para promover XGBoost a primário em produção.
 *
 *   MAPE = mean(|y_pred - y_real| / y_real) × 100
 *
 * Função pura: recebe pares (predicted, actual) e devolve o erro %. Pode ser
 * chamada em qualquer contexto — script offline, endpoint admin, cron de
 * qualidade, dashboard.
 */

export interface BacktestPair {
  predicted: number;
  actual: number;
}

export interface BacktestResult {
  mapePercent: number;
  rmse: number;
  /** Quantos pares foram efetivamente considerados (descarta actual<=0). */
  sampleSize: number;
  /** Quantos foram descartados por actual<=0 (não dá para dividir). */
  discarded: number;
  /** Erro mediano absoluto, em valor. Útil quando há outliers. */
  medianAbsoluteError: number;
}

/**
 * Calcula MAPE + RMSE + erro mediano sobre uma lista de pares.
 * Pares com actual<=0 são descartados (MAPE indefinido nesse caso).
 */
export function calculateBacktest(pairs: BacktestPair[]): BacktestResult {
  let totalAbsPercentError = 0;
  let totalSquaredError = 0;
  let used = 0;
  let discarded = 0;
  const absErrors: number[] = [];

  for (const { predicted, actual } of pairs) {
    if (!Number.isFinite(actual) || actual <= 0) {
      discarded++;
      continue;
    }
    const absErr = Math.abs(predicted - actual);
    const pctErr = absErr / actual;

    totalAbsPercentError += pctErr;
    totalSquaredError += absErr * absErr;
    absErrors.push(absErr);
    used++;
  }

  if (used === 0) {
    return {
      mapePercent: NaN,
      rmse: NaN,
      sampleSize: 0,
      discarded,
      medianAbsoluteError: NaN,
    };
  }

  const sorted = [...absErrors].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return {
    mapePercent: (totalAbsPercentError / used) * 100,
    rmse: Math.sqrt(totalSquaredError / used),
    sampleSize: used,
    discarded,
    medianAbsoluteError: median,
  };
}

/**
 * Helper: dado um conjunto de imóveis com (precoSugerido, precoRealReservado),
 * retorna se o motor está dentro do gate de qualidade.
 *
 * Threshold default 15% conforme F6.1 do roadmap.
 */
export function meetsQualityGate(
  pairs: BacktestPair[],
  thresholdPercent = 15,
): { passes: boolean; mape: number; sampleSize: number } {
  const result = calculateBacktest(pairs);
  return {
    passes: Number.isFinite(result.mapePercent) && result.mapePercent <= thresholdPercent,
    mape: result.mapePercent,
    sampleSize: result.sampleSize,
  };
}
