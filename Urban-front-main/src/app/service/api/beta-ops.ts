import { api } from "./client";

// ================== Beta pago: cobrança assistida, resultados e v1 x v2 ==================

export type BillingHostStatus =
  | "alpha"
  | "trialing"
  | "trial_expired"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "expired"
  | "none"
  | "inactive";

export interface AdminBillingHost {
  userId: string;
  name: string;
  email: string;
  createdAt: string | null;
  status: BillingHostStatus;
  statusLabel: string;
  entitled: boolean;
  entitlementReason: string;
  trialDaysLeft: number | null;
  periodEnd: string | null;
  graceEndsAt: string | null;
  planName: string | null;
  billingCycle: string | null;
  listingsContratados: number | null;
  periodStart: string | null;
  lastBillingEventAt: string | null;
  hasStripeCustomer: boolean;
  needsAttention: boolean;
  attentionReason: string | null;
  suggestedLink: "portal" | "checkout";
}

export interface AdminBillingHostsResponse {
  generatedAt: string;
  summary: {
    total: number;
    needsAttention: number;
    byStatus: Record<BillingHostStatus, number>;
  };
  hosts: AdminBillingHost[];
  truncated: boolean;
}

export interface SendBillingLinkResult {
  ok: true;
  kind: "portal" | "checkout";
  checkoutPlan: string | null;
  sentTo: string;
}

export const fetchAdminBillingHosts = (params: { status?: string; search?: string } = {}) =>
  api
    .get<AdminBillingHostsResponse>("/admin/billing/hosts", { params })
    .then((r) => r.data);

export const sendAdminBillingLink = (userId: string, kind: "auto" | "portal" | "checkout" = "auto") =>
  api
    .post<SendBillingLinkResult>(`/admin/billing/hosts/${userId}/send-link`, { kind })
    .then((r) => r.data);

export interface AdminOutcomeComparisonRow {
  analysisId: string;
  property: string;
  host: string;
  eventName: string;
  eventDate: string | null;
  v1Price: number | null;
  v2Price: number | null;
  v2Version: string | null;
  appliedPrice: number;
  v2VsV1Percent: number | null;
  appliedVsV1Percent: number | null;
  closer: "v1" | "v2" | "tie" | null;
  outcome: "booked" | "not_booked" | "blocked" | "unknown";
  revenue: number | null;
  nights: number | null;
}

export interface AdminOutcomesComparison {
  generatedAt: string;
  minSample: number;
  summary: {
    n: number;
    nWithV2: number;
    booked: number;
    notBooked: number;
    blocked: number;
    unknown: number;
    nWithRevenue: number;
    recordedRevenue: number | null;
    meanDistanceV1Percent: number | null;
    meanDistanceV2Percent: number | null;
    closerToV1: number;
    closerToV2: number;
    ties: number;
  };
  conclusions: { available: false; reason: string } | { available: true; text: string };
  appliedTotal: number;
  appliedWithoutOutcome: number;
  truncated: boolean;
  rows: AdminOutcomeComparisonRow[];
}

export const fetchAdminOutcomesComparison = () =>
  api.get<AdminOutcomesComparison>("/admin/outcomes/comparison").then((r) => r.data);

/** Item de "resultados pendentes": mesmo formato de `eventos-analisados-com-price` (EventItem). */
export interface PendingOutcomeItem {
  idAnalise: string;
  id: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  cidade: string;
  estado: string;
  precoSugerido: string | number;
  seuPrecoAtual?: string | number;
  diferencaPercentual: string;
  recomendacao?: string;
  motivo_ia?: string | null;
  precoAplicado?: string | number | null;
  aplicadoEm?: string | null;
  origemAplicacao?: string | null;
  status?: string;
  aceito: boolean;
  propertyId: string | null;
  propertyTitle: string | null;
}

export const fetchPendingOutcomes = () =>
  api
    .get<{ total: number; data: PendingOutcomeItem[] }>("/sugestoes-preco/resultados-pendentes")
    .then((r) => r.data);
