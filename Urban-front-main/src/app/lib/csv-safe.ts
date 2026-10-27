/**
 * Células de CSV seguras para planilhas. Valores que começam com =, +, -, @, TAB ou CR
 * são interpretados como fórmula pelo Excel/Sheets (injeção de fórmula): recebem um
 * apóstrofo na frente, e o campo é sempre entre aspas. Coberto por scripts/csv-safe.test.mjs.
 */
export function neutralizeSpreadsheetFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${neutralizeSpreadsheetFormula(text).replace(/"/g, '""')}"`;
}
