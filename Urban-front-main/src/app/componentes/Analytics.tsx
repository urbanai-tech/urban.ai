"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { isAnalyticsAllowedPath, scrubPath, scrubUrl } from "../lib/privacy-scrub";
import { readConsentSync, useConsent } from "./useConsent";
import styles from "./Analytics.module.css";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    __urbanGaReady?: boolean;
    __urbanFbqReady?: boolean;
  }
}

const GA_READY_EVENT = "urban-ga-ready";
const FBQ_READY_EVENT = "urban-fbq-ready";

/** URL/path atuais já sem token/e-mail/fragmento — única forma que sai para GA4/Pixel. */
function scrubbedLocation() {
  return {
    page_location: scrubUrl(
      window.location.origin + window.location.pathname + window.location.search,
    ),
    page_path: scrubPath(window.location.pathname),
  };
}

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsValue>;

type TouchAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referralCode?: string;
  gclid?: string;
  fbclid?: string;
  referrerHost?: string;
  capturedAt: string;
};

export type MarketingAttribution = {
  firstTouch: TouchAttribution | null;
  lastTouch: TouchAttribution | null;
};

const ATTRIBUTION_STORAGE_KEY = "urban-ai-attribution-v1";
const SOURCE_MAX_LENGTH = 64;

function sanitizeParams(params: AnalyticsParams = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function readUrlAttribution(): TouchAttribution | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const search = url.searchParams;
  const referrer = document.referrer ? new URL(document.referrer) : null;
  const referrerHost =
    referrer && referrer.host !== window.location.host ? referrer.host : undefined;

  const touch: TouchAttribution = {
    utmSource: search.get("utm_source") || undefined,
    utmMedium: search.get("utm_medium") || undefined,
    utmCampaign: search.get("utm_campaign") || undefined,
    utmTerm: search.get("utm_term") || undefined,
    utmContent: search.get("utm_content") || undefined,
    referralCode: search.get("ref") || search.get("referral") || undefined,
    gclid: search.get("gclid") || undefined,
    fbclid: search.get("fbclid") || undefined,
    referrerHost,
    capturedAt: new Date().toISOString(),
  };

  const hasAttribution = Object.entries(touch).some(
    ([key, value]) => key !== "capturedAt" && !!value,
  );

  return hasAttribution ? touch : null;
}

export function readStoredAttribution(): MarketingAttribution {
  if (typeof window === "undefined") {
    return { firstTouch: null, lastTouch: null };
  }

  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return { firstTouch: null, lastTouch: null };
    const parsed = JSON.parse(raw) as MarketingAttribution;
    return {
      firstTouch: parsed.firstTouch ?? null,
      lastTouch: parsed.lastTouch ?? null,
    };
  } catch {
    return { firstTouch: null, lastTouch: null };
  }
}

export function captureAttribution(): MarketingAttribution {
  if (typeof window === "undefined") {
    return { firstTouch: null, lastTouch: null };
  }

  const stored = readStoredAttribution();
  const current = readUrlAttribution();
  if (!current) return stored;

  const next = {
    firstTouch: stored.firstTouch ?? current,
    lastTouch: current,
  };

  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sem persistencia, a atribuicao da sessão atual ainda e usada.
  }

  return next;
}

export function compactWaitlistSource(
  baseSource: string,
  attribution: MarketingAttribution = captureAttribution(),
) {
  const touch = attribution.lastTouch ?? attribution.firstTouch;
  const parts = [
    baseSource || "unknown",
    touch?.utmSource,
    touch?.utmMedium,
    touch?.utmCampaign,
    touch?.referrerHost ? `referrer-${touch.referrerHost}` : undefined,
  ]
    .filter(Boolean)
    .map((part) =>
      String(part)
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean);

  const compact = parts.join("|") || "unknown";
  return compact.slice(0, SOURCE_MAX_LENGTH);
}

export function getReferralCode(attribution: MarketingAttribution = captureAttribution()) {
  return attribution.lastTouch?.referralCode ?? attribution.firstTouch?.referralCode;
}

export function attributionEventParams(attribution: MarketingAttribution) {
  const touch = attribution.lastTouch ?? attribution.firstTouch;
  return sanitizeParams({
    utm_source: touch?.utmSource,
    utm_medium: touch?.utmMedium,
    utm_campaign: touch?.utmCampaign,
    utm_term: touch?.utmTerm,
    utm_content: touch?.utmContent,
    referral_code: touch?.referralCode,
    referrer_host: touch?.referrerHost,
  });
}

export function trackAnalyticsEvent(
  eventName: string,
  params: AnalyticsParams = {},
  options: { metaEventName?: string } = {},
) {
  if (typeof window === "undefined") return;

  // GA4/Pixel só em rotas públicas de marketing (nunca em auth/app).
  if (!isAnalyticsAllowedPath(window.location.pathname)) return;

  const consent = readConsentSync();
  const cleanParams = sanitizeParams(params);

  if (consent.analytics) {
    window.gtag?.("event", eventName, { ...cleanParams, ...scrubbedLocation() });
  }

  if (consent.marketing && options.metaEventName) {
    window.fbq?.("track", options.metaEventName, cleanParams);
  }
}

export function trackWaitlistSignup(params: AnalyticsParams = {}) {
  trackAnalyticsEvent("waitlist_signup", params, { metaEventName: "Lead" });
  trackAnalyticsEvent("sign_up", { method: "waitlist", ...params });
}

/**
 * GA4 + Meta Pixel — com gating LGPD via useConsent.
 *
 * Controlado por env vars:
 *   NEXT_PUBLIC_GA4_ID        — "G-XXXXXXXXXX" (desabilitado se vazio)
 *   NEXT_PUBLIC_META_PIXEL_ID — "1234567890123456" (desabilitado se vazio)
 *
 * Em ambientes staging e development, só ativa se NEXT_PUBLIC_APP_ENV="production"
 * para evitar poluir os relatórios com tráfego sintético.
 *
 * Gating de consent:
 *   - GA4 só carrega quando `state.analytics === true`
 *   - Meta Pixel só carrega quando `state.marketing === true`
 *
 * Antes do user consentir, NENHUM script de telemetria opcional é injetado
 * — alinhado à LGPD art. 7º (consentimento explícito para tratamento não
 * essencial).
 *
 * Gating de rota: GA4/Pixel só carregam e só enviam page_view em rotas públicas
 * de marketing (`isAnalyticsAllowedPath`). Rotas de auth/app (ex.:
 * `/reset-password/<token>`, `/confirm-email/<email>`) nunca são enviadas, e o
 * `page_location`/`page_path` do GA4 passam por `scrubUrl`/`scrubPath`.
 * Os page_views são manuais (`send_page_view: false`) para controlar a URL.
 */
export function Analytics() {
  const appEnv =
    process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";
  const isProd = appEnv === "production";

  const gaId = process.env.NEXT_PUBLIC_GA4_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  const { state, loaded } = useConsent();
  const pathname = usePathname();
  const routeAllowed = isAnalyticsAllowedPath(pathname);

  useEffect(() => {
    if (!loaded) return;
    captureAttribution();
  }, [loaded]);

  // Liga/desliga GA4 e Pixel conforme a rota (scripts carregados numa rota
  // pública continuam vivos após navegação client-side para rotas privadas).
  useEffect(() => {
    if (!isProd || !loaded) return;

    if (gaId) {
      (window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] = !routeAllowed;
    }

    const sendGaPageView = () => {
      if (!routeAllowed || !state.analytics) return;
      window.gtag?.("event", "page_view", {
        ...scrubbedLocation(),
        page_title: document.title,
      });
    };
    const sendPixelPageView = () => {
      if (!routeAllowed || !state.marketing) return;
      // O Pixel lê a URL sozinho: se há algo sensível na URL, não envia.
      const href = window.location.origin + window.location.pathname + window.location.search;
      if (scrubUrl(href) !== href) return;
      window.fbq?.("track", "PageView");
    };

    const cleanups: Array<() => void> = [];
    if (gaId && state.analytics) {
      if (window.__urbanGaReady) sendGaPageView();
      else {
        window.addEventListener(GA_READY_EVENT, sendGaPageView, { once: true });
        cleanups.push(() => window.removeEventListener(GA_READY_EVENT, sendGaPageView));
      }
    }
    if (pixelId && state.marketing) {
      if (window.__urbanFbqReady) sendPixelPageView();
      else {
        window.addEventListener(FBQ_READY_EVENT, sendPixelPageView, { once: true });
        cleanups.push(() => window.removeEventListener(FBQ_READY_EVENT, sendPixelPageView));
      }
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [isProd, loaded, routeAllowed, pathname, gaId, pixelId, state.analytics, state.marketing]);

  // Em dev/staging, ou enquanto consent ainda não carregou do localStorage,
  // não carrega nada. Após `loaded=true`, o gating por categoria toma efeito.
  if (!isProd) return null;
  if (!loaded) return null;
  // Nunca injeta os scripts a partir de uma rota privada/de auth.
  if (!routeAllowed) return null;

  return (
    <>
      {gaId && state.analytics && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              window.gtag = window.gtag || function(){window.dataLayer.push(arguments);}
              window.gtag('js', new Date());
              window.gtag('config', '${gaId}', { anonymize_ip: true, send_page_view: false });
              window.__urbanGaReady = true;
              window.dispatchEvent(new Event('${GA_READY_EVENT}'));
            `}
          </Script>
        </>
      )}

      {pixelId && state.marketing && (
        <>
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq.disablePushState = true;
              fbq('init', '${pixelId}');
              window.__urbanFbqReady = true;
              window.dispatchEvent(new Event('${FBQ_READY_EVENT}'));
            `}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              className={styles.pixelHidden}
              alt=""
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
    </>
  );
}
