import { api } from "./client";
import { asArray } from "../../lib/api-normalize";
import type { OwnerReportPayload } from "../../lib/owner-report";

/**
 * Proprietários e relatório mensal (ADR 0027). Tudo autenticado e escopado ao anfitrião:
 * a API responde 404 para proprietário/imóvel/link de outra conta.
 */
export type OwnerConsentInfo = { version: string; text: string };

export type PropertyOwner = {
  id: string;
  name: string;
  email: string;
  monthlyReportEnabled: boolean;
  /** O proprietário pediu para não receber (só ele desfaz). */
  unsubscribed: boolean;
  consent: { version: string; acceptedAt: string };
  properties: Array<{ id: string; title: string; location: string | null }>;
  lastReport: { period: string; emailStatus: string; emailSentAt: string | null } | null;
};

export type OwnerReportLinkInfo = {
  id: string;
  origin: "host" | "email";
  state: "valid" | "expired" | "revoked";
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  createdAt: string;
};

export type OwnerReportListItem = {
  period: string;
  generatedAt: string;
  emailStatus: "pending" | "sending" | "sent" | "failed" | string;
  emailSentAt: string | null;
  links: OwnerReportLinkInfo[];
};

export type PropertyOwnerInput = {
  name: string;
  email: string;
  propertyIds: string[];
  monthlyReportEnabled?: boolean;
  consentAccepted?: boolean;
  consentVersion?: string;
};

export async function fetchOwnerConsent(): Promise<OwnerConsentInfo> {
  const { data } = await api.get<OwnerConsentInfo>("/property-owners/consent");
  return data;
}

export async function fetchPropertyOwners(): Promise<PropertyOwner[]> {
  const { data } = await api.get<PropertyOwner[]>("/property-owners");
  return asArray<PropertyOwner>(data);
}

export async function createPropertyOwner(input: PropertyOwnerInput): Promise<PropertyOwner> {
  const { data } = await api.post<PropertyOwner>("/property-owners", input);
  return data;
}

export async function updatePropertyOwner(
  id: string,
  input: Partial<PropertyOwnerInput>,
): Promise<PropertyOwner> {
  const { data } = await api.patch<PropertyOwner>(`/property-owners/${encodeURIComponent(id)}`, input);
  return data;
}

export async function deletePropertyOwner(id: string): Promise<void> {
  await api.delete(`/property-owners/${encodeURIComponent(id)}`);
}

export async function fetchOwnerReports(ownerId: string): Promise<OwnerReportListItem[]> {
  const { data } = await api.get<OwnerReportListItem[]>(
    `/property-owners/${encodeURIComponent(ownerId)}/reports`,
  );
  return asArray<OwnerReportListItem>(data);
}

export async function previewOwnerReport(ownerId: string, period: string): Promise<OwnerReportPayload> {
  const { data } = await api.get<OwnerReportPayload>(
    `/property-owners/${encodeURIComponent(ownerId)}/reports/${encodeURIComponent(period)}/preview`,
  );
  return data;
}

/** O token só existe nesta resposta: o servidor guarda apenas o hash. */
export async function createOwnerReportLink(
  ownerId: string,
  period: string,
  ttlDays?: number,
): Promise<{ url: string; expiresAt: string; period: string }> {
  const { data } = await api.post<{ url: string; expiresAt: string; period: string }>(
    `/property-owners/${encodeURIComponent(ownerId)}/reports/${encodeURIComponent(period)}/links`,
    ttlDays ? { ttlDays } : {},
  );
  return data;
}

export async function revokeOwnerReportLink(ownerId: string, linkId: string): Promise<void> {
  await api.post(
    `/property-owners/${encodeURIComponent(ownerId)}/links/${encodeURIComponent(linkId)}/revoke`,
  );
}

export async function revokeAllOwnerReportLinks(ownerId: string): Promise<{ revoked: number }> {
  const { data } = await api.post<{ revoked: number }>(
    `/property-owners/${encodeURIComponent(ownerId)}/links/revoke-all`,
  );
  return data;
}

export async function sendOwnerReportNow(
  ownerId: string,
  period: string,
): Promise<{ status: "sent" | "already_sent" | "failed" | "skipped" | "not_claimed" }> {
  const { data } = await api.post<{ status: "sent" | "already_sent" | "failed" | "skipped" | "not_claimed" }>(
    `/property-owners/${encodeURIComponent(ownerId)}/reports/${encodeURIComponent(period)}/send`,
  );
  return data;
}
