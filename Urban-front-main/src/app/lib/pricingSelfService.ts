import type { BillingCycle, Plan } from "../service/api";

export const BILLING_CYCLE_META: Record<
  BillingCycle,
  { label: string; months: number; shortLabel: string }
> = {
  monthly: { label: "Mensal", months: 1, shortLabel: "mes" },
  quarterly: { label: "Trimestral", months: 3, shortLabel: "3 meses" },
  semestral: { label: "Semestral", months: 6, shortLabel: "6 meses" },
  annual: { label: "Anual", months: 12, shortLabel: "ano" },
};

export const BILLING_CYCLES = Object.keys(BILLING_CYCLE_META) as BillingCycle[];

export function parsePlanPrice(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function priceForCycle(plan: Plan, cycle: BillingCycle): number {
  const raw =
    cycle === "monthly"
      ? plan.priceMonthly
      : cycle === "quarterly"
        ? plan.priceQuarterly
        : cycle === "semestral"
          ? plan.priceSemestral
          : plan.priceAnnualNew;
  return parsePlanPrice(raw);
}

export function discountForCycle(plan: Plan, cycle: BillingCycle): number {
  if (cycle === "quarterly") return plan.discountQuarterlyPercent ?? 0;
  if (cycle === "semestral") return plan.discountSemestralPercent ?? 0;
  if (cycle === "annual") return plan.discountAnnualPercent ?? 0;
  return 0;
}

export function minProperties(plan: Plan): number {
  return Math.max(1, Number(plan.minProperties ?? 1));
}

export function maxProperties(plan: Plan): number | null {
  const value = plan.maxProperties ?? plan.propertyLimit ?? null;
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function maxCheckoutQuantity(plan: Plan): number | null {
  const value = plan.maxCheckoutQuantity ?? maxProperties(plan);
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isSelfServicePlan(plan: Plan): boolean {
  return plan.isActive && !plan.isCustomPrice && plan.selfServiceEnabled !== false;
}

export function planMatchesQuantity(plan: Plan, quantity: number): boolean {
  const min = minProperties(plan);
  const max = maxProperties(plan);
  const checkoutMax = maxCheckoutQuantity(plan);
  if (quantity < min) return false;
  if (max !== null && quantity > max) return false;
  if (checkoutMax !== null && quantity > checkoutMax) return false;
  return true;
}

export function sortPricingPlans(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => {
    const sortA = a.sortOrder ?? 0;
    const sortB = b.sortOrder ?? 0;
    if (sortA !== sortB) return sortA - sortB;
    return minProperties(a) - minProperties(b);
  });
}

export function selectPlanForQuantity(plans: Plan[], quantity: number): Plan | null {
  return (
    sortPricingPlans(plans).find(
      (plan) => isSelfServicePlan(plan) && planMatchesQuantity(plan, quantity),
    ) ?? null
  );
}

export function firstSelfServicePlan(plans: Plan[]): Plan | null {
  return sortPricingPlans(plans).find(isSelfServicePlan) ?? null;
}

export function formatQuantityRange(plan: Plan): string {
  const min = minProperties(plan);
  const max = maxProperties(plan);
  if (max === null) return `${min}+ imoveis`;
  if (min === max) return `${min} imovel`;
  return `${min} a ${max} imoveis`;
}

export function calculatePricingQuote(plan: Plan, quantity: number, cycle: BillingCycle) {
  const pricePerPropertyMonthly = priceForCycle(plan, cycle);
  const monthsInCycle = BILLING_CYCLE_META[cycle].months;
  const monthlyEquivalentTotal = pricePerPropertyMonthly * quantity;
  const cycleTotal = monthlyEquivalentTotal * monthsInCycle;
  const discountPercent = discountForCycle(plan, cycle);

  return {
    planName: plan.name,
    planTitle: plan.title,
    cycle,
    quantity,
    pricePerPropertyMonthly,
    monthlyEquivalentTotal,
    cycleTotal,
    monthsInCycle,
    discountPercent,
    rangeLabel: formatQuantityRange(plan),
    selfService: isSelfServicePlan(plan),
  };
}

export function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
