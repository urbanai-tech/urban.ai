import { BillingCycle, Plan } from '../entities/plan.entity';

export const BILLING_CYCLES: BillingCycle[] = ['monthly', 'quarterly', 'semestral', 'annual'];

export type StripePriceIdSource = 'plan-entity' | 'env-fallback' | 'missing';

export interface StripePriceIdResolution {
  priceId: string | null;
  source: StripePriceIdSource;
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === 'string' && BILLING_CYCLES.includes(value as BillingCycle);
}

export function resolveStripePriceId(
  plan: Partial<Plan> | null | undefined,
  cycle: BillingCycle,
  planNameFallback?: string,
): StripePriceIdResolution {
  const fromEntity = getPlanEntityPriceId(plan, cycle);
  if (fromEntity) return { priceId: fromEntity, source: 'plan-entity' };

  const fromEnv = getEnvPriceId(plan?.name || planNameFallback, cycle);
  if (fromEnv) return { priceId: fromEnv, source: 'env-fallback' };

  return { priceId: null, source: 'missing' };
}

export function getEnvPriceId(planName: string | undefined, cycle: BillingCycle): string | null {
  const keys = getEnvKeys(planName, cycle);
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function getEnvKeys(planName: string | undefined, cycle: BillingCycle): string[] {
  const planPrefix = normalizePlanEnvPrefix(planName);
  const planScopedKeys = planPrefix ? getPlanScopedKeys(planPrefix, cycle) : [];
  const legacyGlobalKeys =
    cycle === 'monthly' ? ['MENSAL_PLAN'] : cycle === 'annual' ? ['ANUAL_PLAN'] : [];

  return [...planScopedKeys, ...legacyGlobalKeys];
}

function normalizePlanEnvPrefix(planName: string | undefined): string | null {
  const normalized = planName
    ?.toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || null;
}

function getPlanEntityPriceId(plan: Partial<Plan> | null | undefined, cycle: BillingCycle): string | null {
  if (!plan) return null;

  const value = (() => {
    switch (cycle) {
      case 'monthly':
        return plan.stripePriceIdMonthly || plan.stripePriceId;
      case 'quarterly':
        return plan.stripePriceIdQuarterly;
      case 'semestral':
        return plan.stripePriceIdSemestral;
      case 'annual':
        return plan.stripePriceIdAnnualNew || plan.stripePriceIdAnnual;
    }
  })();

  return value?.trim() || null;
}

function getPlanScopedKeys(planPrefix: string, cycle: BillingCycle): string[] {
  switch (cycle) {
    case 'monthly':
      return [`${planPrefix}_PRICE_MONTHLY`, `${planPrefix}_MENSAL_PLAN`];
    case 'quarterly':
      return [`${planPrefix}_PRICE_QUARTERLY`];
    case 'semestral':
      return [`${planPrefix}_PRICE_SEMESTRAL`];
    case 'annual':
      return [`${planPrefix}_PRICE_ANNUAL`, `${planPrefix}_ANUAL_PLAN`];
  }
}
