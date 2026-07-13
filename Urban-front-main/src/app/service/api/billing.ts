import { api } from "./client";
import { Subscription } from "../../componentes/Subscription";


export type BillingCycle = 'monthly' | 'quarterly' | 'semestral' | 'annual';

export async function createCheckoutSession(
  planId: string,
  billingCycle: BillingCycle = 'monthly',
  quantity: number = 1,
): Promise<{ sessionId: string }> {
  try {
    const { data } = await api.post<{ sessionId: string }>("/payments/create-checkout-session", {
      plan: planId,
      billingCycle,
      quantity,
    });
    return data;
  } catch (error) {
    console.error("Erro ao criar sessão de checkout:", error);
    throw error;
  }
}

export async function fetchSubscription(): Promise<Subscription> {
  try {
    const { data } = await api.get<Subscription>("/payments/getSubscription");
    return data;
  } catch (error) {
    console.error("Erro ao buscar subscription:", error);
    throw error;
  }
}

export async function cancelSubscription(): Promise<void> {
  try {
    await api.delete("/payments/cancelSubscription");
  } catch (error) {
    console.error("Erro ao cancelar subscription:", error);
    throw error;
  }
}

export async function createBillingPortalSession(): Promise<{ url: string }> {
  try {
    const { data } = await api.post<{ url: string }>("/payments/billing-portal-session");
    return data;
  } catch (error) {
    console.error("Erro ao criar sessão do portal de billing:", error);
    throw error;
  }
}


export const getPagamentosDoUsuario = async () => {
  try {
    const { data } = await api.get('/payments/me'); // rota do controller
    return data;
  } catch (error) {
    console.error('Erro ao buscar pagamentos do usuário:', error);
    throw error;
  }
};

/**
 * Consulta de Planos Dinâmicos.
 *
 * Os campos `price` / `priceAnnual` são legados (toggle binário).
 * Os campos `priceMonthly|Quarterly|Semestral|AnnualNew` são da matriz F6.5
 * (cobrança por imóvel × 4 ciclos com desconto progressivo).
 */
export interface Plan {
  id: string;
  name: string;
  title: string;
  // Legados
  price: string;
  priceAnnual?: string;
  originalPrice?: string;
  originalPriceAnnual?: string;
  stripePriceId?: string;
  stripePriceIdAnnual?: string;
  // F6.5
  priceMonthly?: string;
  priceQuarterly?: string;
  priceSemestral?: string;
  priceAnnualNew?: string;
  originalPriceMonthly?: string;
  originalPriceQuarterly?: string;
  originalPriceSemestral?: string;
  originalPriceAnnualNew?: string;
  discountQuarterlyPercent?: number;
  discountSemestralPercent?: number;
  discountAnnualPercent?: number;
  // Display
  period: string;
  propertyLimit?: number | null;
  minProperties?: number | null;
  maxProperties?: number | null;
  maxCheckoutQuantity?: number | null;
  selfServiceEnabled?: boolean;
  sortOrder?: number;
  features: string[];
  isCustomPrice?: boolean;
  highlightBadge?: string;
  discountBadge?: string;
  isActive: boolean;
}

export const getPlans = async (): Promise<Plan[]> => {
  try {
    const { data } = await api.get<Plan[]>('/plans');
    return data;
  } catch (error) {
    console.error('Erro ao buscar planos:', error);
    throw error;
  }
};

/**
 * F6.5 — quota de imóveis contratados vs. ativos. O Paywall usa para decidir
 * se o anfitrião pode adicionar mais um imóvel ou precisa fazer upsell.
 */
export interface ListingsQuota {
  contratados: number;
  ativos: number;
  podeAdicionar: boolean;
}

export const fetchListingsQuota = async (): Promise<ListingsQuota> => {
  const { data } = await api.get<ListingsQuota>('/payments/listings-quota');
  return data;
};
