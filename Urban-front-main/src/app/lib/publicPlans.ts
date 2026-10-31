/**
 * Preços do site público com fonte única: os mesmos planos que o checkout lê
 * (`GET /plans`, editáveis em /admin/pricing-config). Roda no servidor, com
 * cache de dados e, se a API falhar ou vier fora do formato, cai nos valores
 * de referência abaixo (os mesmos publicados antes desta fonte única).
 */

export type PublicPlanKey = "starter" | "profissional";

export type PublicPlanPrices = {
  monthly: number;
  quarterly: number;
  semestral: number;
  annual: number;
};

export type PublicPricing = {
  starter: PublicPlanPrices;
  profissional: PublicPlanPrices;
  /** "api" quando veio do backend; "fallback" quando usou os valores de referência. */
  source: "api" | "fallback";
};

export const FALLBACK_PUBLIC_PRICING: PublicPricing = {
  starter: { monthly: 149, quarterly: 129, semestral: 109, annual: 97 },
  profissional: { monthly: 99, quarterly: 85, semestral: 72, annual: 67 },
  source: "fallback",
};

// Preços mudam raramente; 1 h evita uma ida à API a cada visita.
export const PUBLIC_PRICING_REVALIDATE_SECONDS = 3600;
const FETCH_TIMEOUT_MS = 4000;

function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type RawPlan = Record<string, unknown>;

function pricesOf(plan: RawPlan | undefined): PublicPlanPrices | null {
  if (!plan) return null;
  const monthly = parsePrice(plan.priceMonthly ?? plan.price);
  const quarterly = parsePrice(plan.priceQuarterly);
  const semestral = parsePrice(plan.priceSemestral);
  const annual = parsePrice(plan.priceAnnualNew ?? plan.priceAnnual);
  if (monthly === null || quarterly === null || semestral === null || annual === null) return null;
  return { monthly, quarterly, semestral, annual };
}

/** Converte a resposta de `/plans`; devolve null se faltar algum plano/ciclo. */
export function parsePublicPricing(payload: unknown): PublicPricing | null {
  if (!Array.isArray(payload)) return null;
  const active = payload.filter(
    (item): item is RawPlan => typeof item === "object" && item !== null && (item as RawPlan).isActive !== false,
  );
  const starter = pricesOf(active.find((plan) => plan.name === "starter"));
  const profissional = pricesOf(active.find((plan) => plan.name === "profissional"));
  if (!starter || !profissional) return null;
  return { starter, profissional, source: "api" };
}

export async function getPublicPricing(): Promise<PublicPricing> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!base) return FALLBACK_PUBLIC_PRICING;

  try {
    const response = await fetch(`${base}/plans`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: PUBLIC_PRICING_REVALIDATE_SECONDS },
    });
    if (!response.ok) return FALLBACK_PUBLIC_PRICING;
    return parsePublicPricing(await response.json()) ?? FALLBACK_PUBLIC_PRICING;
  } catch {
    return FALLBACK_PUBLIC_PRICING;
  }
}

/** "99" para inteiros, "99,90" quando houver centavos (pt-BR). */
export function formatPublicPrice(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",");
}

/** Valor para o JSON-LD (ponto decimal, como schema.org espera). */
export function jsonLdPrice(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
