import { readConsentSync } from "../componentes/useConsent";

type OrganicAnalyticsValue = string | number | boolean;

export type OrganicAnalyticsProperties = Record<
  string,
  OrganicAnalyticsValue | null | undefined
>;

export const ORGANIC_ANALYTICS_CUSTOM_EVENT = "urban:organic-analytics";
export const GEO_CTA_VIEW_EVENT = "urban_geo_cta_view";
export const HUB_CTA_CLICK_EVENT = "urban_hub_cta_click";

const MAX_STRING_LENGTH = 180;

type DataLayerLike = {
  push?: (payload: Record<string, OrganicAnalyticsValue>) => unknown;
};

export function emitOrganicAnalyticsEvent(
  eventName: string,
  properties: OrganicAnalyticsProperties = {},
) {
  if (typeof window === "undefined") return;

  const payload: Record<string, OrganicAnalyticsValue> = {
    event: eventName,
    emitted_at: new Date().toISOString(),
    ...sanitizeProperties(properties),
  };

  try {
    if (typeof window.CustomEvent === "function") {
      window.dispatchEvent(
        new window.CustomEvent(ORGANIC_ANALYTICS_CUSTOM_EVENT, {
          detail: payload,
        }),
      );
    }
  } catch {
    // Analytics must never affect the public experience.
  }

  try {
    const dataLayer = (window as Window & { dataLayer?: DataLayerLike }).dataLayer;
    if (readConsentSync().analytics && typeof dataLayer?.push === "function") {
      dataLayer.push(payload);
    }
  } catch {
    // dataLayer can be blocked, absent, or replaced by a third-party script.
  }
}

function sanitizeProperties(properties: OrganicAnalyticsProperties) {
  const sanitized: Record<string, OrganicAnalyticsValue> = {};

  Object.entries(properties).forEach(([key, value]) => {
    if (!key || value === null || value === undefined || value === "") return;

    if (typeof value === "string") {
      sanitized[key] = value.trim().slice(0, MAX_STRING_LENGTH);
      return;
    }

    if (typeof value === "number") {
      if (Number.isFinite(value)) sanitized[key] = value;
      return;
    }

    sanitized[key] = value;
  });

  return sanitized;
}
