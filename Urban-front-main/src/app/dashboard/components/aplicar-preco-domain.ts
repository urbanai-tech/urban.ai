/**
 * Regras puras do fluxo "Vou aplicar este preço" (sem React).
 *
 * Conceitos distintos, de propósito:
 *  - aceitar = intenção (`alterarAceitoSugestao`);
 *  - preço aplicado = resultado informado pelo anfitrião
 *    (`registrarPrecoAplicadoSugestao`, origem `manual_dashboard`).
 * A Urban AI NÃO altera o preço no Airbnb nesse fluxo: quem aplica é o anfitrião.
 */

export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

/** Mesma faixa de sanidade do backend (0,2x a 5x dos preços de referência). */
export const APPLIED_PRICE_MIN_FACTOR = 0.2;
export const APPLIED_PRICE_MAX_FACTOR = 5;
export const APPLIED_PRICE_ABSOLUTE_MAX = 99_999_999.99;

export const AIRBNB_STEPS: readonly string[] = [
  "Abra o Airbnb e entre em Calendário.",
  "Selecione a data indicada acima.",
  "Em preço por noite, digite o valor e salve.",
  "Volte aqui e confirme o preço que você aplicou.",
];

/** Converte "R$ 1.350,50", "1350,5" ou "450.5" em número. NaN se não der. */
export function parseBrlInput(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return Number.NaN;
  if (typeof value === "number") return value;
  const cleaned = value.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!cleaned) return Number.NaN;
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }
  return Number(cleaned);
}

/** "R$ 450" ou "R$ 450,50" (sem centavos quando o valor é inteiro). */
export function formatBrl(value: number): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Valor para colar no Airbnb: "450" ou "450,50", sem símbolo nem milhar. */
export function formatPlainPrice(value: number): string {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",");
}

/** Dia de calendário (YYYY-MM-DD) no fuso de São Paulo; null se a data é inválida. */
export function saoPauloDayKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "sáb., 9 de jun. de 2026" no calendário de São Paulo. */
export function formatSaoPauloDay(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export type AppliedPriceCheck =
  | { ok: true; value: number }
  | { ok: false; message: string };

/**
 * Valida o preço digitado antes de enviar. O backend repete a checagem
 * (é a fonte da verdade); aqui só evitamos o round-trip e damos a mensagem.
 */
export function checkAppliedPrice(
  input: string | number,
  references: Array<number | null | undefined>,
): AppliedPriceCheck {
  const value = parseBrlInput(input);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: "Informe um preço maior que zero." };
  }
  if (value > APPLIED_PRICE_ABSOLUTE_MAX) {
    return { ok: false, message: "Esse valor é alto demais. Confira o preço digitado." };
  }
  const valid = references.filter(
    (ref): ref is number => typeof ref === "number" && Number.isFinite(ref) && ref > 0,
  );
  if (valid.length > 0) {
    const min = Math.min(...valid) * APPLIED_PRICE_MIN_FACTOR;
    const max = Math.max(...valid) * APPLIED_PRICE_MAX_FACTOR;
    if (value < min || value > max) {
      return {
        ok: false,
        message: `Esse valor está fora do esperado (entre ${formatBrl(Math.ceil(min))} e ${formatBrl(Math.floor(max))}). Confira o preço digitado.`,
      };
    }
  }
  return { ok: true, value: Math.round(value * 100) / 100 };
}
