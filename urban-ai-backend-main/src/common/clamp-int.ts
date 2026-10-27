/**
 * Converte um valor vindo de query string (ou de outro chamador) em inteiro
 * dentro de [min, max]. Valores ausentes, não numéricos ou infinitos (por
 * exemplo `parseInt('abc', 10)`, que dá `NaN`) viram `fallback`.
 *
 * Existe porque `Math.max(1, Math.min(90, NaN))` é `NaN`: sem este tratamento,
 * `?page=abc` chega ao banco como `OFFSET NaN` e vira erro 500.
 */
export function clampInt(
  value: unknown,
  { min, max, fallback }: { min: number; max: number; fallback: number },
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) {
    return Math.min(max, Math.max(min, fallback));
  }
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
