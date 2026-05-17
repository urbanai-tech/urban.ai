/**
 * Tracking helper — Sentry user context + custom events.
 *
 * Fecha o gap J7 do roadmap ("eventos custom de produto + tags por componente").
 * Sentry init ja esta em `instrumentation.ts` (com APP_ENV separando prod/staging).
 * Este modulo adiciona contexto de usuario e eventos de produto.
 *
 * Uso tipico:
 *   import { setSentryUser, trackEvent } from "@/app/service/tracking";
 *   // apos login bem-sucedido:
 *   setSentryUser({ id: user.id, email: user.email, role: user.role });
 *   // apos action critica:
 *   trackEvent("recommendation_applied", { propertyId, deltaPercent });
 *
 * Falha silenciosa em todos os casos — tracking nunca quebra a aplicacao.
 */

type SentryLike = {
  setUser?: (user: Record<string, unknown> | null) => void;
  setTag?: (key: string, value: string) => void;
  captureMessage?: (msg: string, opts?: Record<string, unknown>) => void;
  addBreadcrumb?: (breadcrumb: Record<string, unknown>) => void;
};

let _sentry: SentryLike | null = null;

async function getSentry(): Promise<SentryLike | null> {
  if (_sentry !== null) return _sentry;
  if (typeof window === "undefined") return null;
  try {
    // Import dinamico — Sentry/nextjs ja esta no bundle via instrumentation.ts.
    const mod = await import("@sentry/nextjs");
    _sentry = mod as unknown as SentryLike;
    return _sentry;
  } catch {
    return null;
  }
}

export type AppUser = {
  id: string;
  email?: string;
  role?: string;
  /** Plano ativo ('starter' | 'profissional' | etc) — sem dados sensiveis. */
  plan?: string;
};

/**
 * Define o usuario corrente no Sentry + tags basicas.
 * Chame apos login/refresh do /auth/me.
 */
export async function setSentryUser(user: AppUser): Promise<void> {
  const sentry = await getSentry();
  if (!sentry) return;
  try {
    sentry.setUser?.({
      id: user.id,
      email: user.email,
      // Nao envia dado sensivel — so id + email pra correlacao em prod.
      role: user.role,
    });
    if (user.role) sentry.setTag?.("user.role", user.role);
    if (user.plan) sentry.setTag?.("user.plan", user.plan);
  } catch {
    /* swallow */
  }
}

/**
 * Limpa contexto Sentry — chame ao deslogar.
 */
export async function clearSentryUser(): Promise<void> {
  const sentry = await getSentry();
  if (!sentry) return;
  try {
    sentry.setUser?.(null);
  } catch {
    /* swallow */
  }
}

/**
 * Eventos custom de produto. Vao pro Sentry como `captureMessage` com tag
 * `kind: 'product_event'`, e tambem disparam window.gtag/fbq se configurados.
 *
 * Use pra rastrear: signup, login, accept, apply, register_real_price,
 * upgrade_clicked, stays_connected, etc.
 */
export async function trackEvent(
  name: string,
  properties: Record<string, string | number | boolean | null | undefined> = {},
): Promise<void> {
  // Sentry breadcrumb (debug) + captureMessage (visibilidade em eventos)
  const sentry = await getSentry();
  if (sentry) {
    try {
      sentry.addBreadcrumb?.({
        category: "product",
        type: "info",
        level: "info",
        message: name,
        data: properties,
      });
      // captureMessage so para milestones — evita ruido excessivo
      if (PRODUCT_MILESTONES.has(name)) {
        sentry.captureMessage?.(`[product] ${name}`, {
          level: "info",
          tags: { product_event: name },
          extra: properties,
        });
      }
    } catch {
      /* swallow */
    }
  }

  // GA4
  if (typeof window !== "undefined") {
    const w = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      fbq?: (...args: unknown[]) => void;
    };
    try {
      w.gtag?.("event", name, properties);
    } catch {
      /* swallow */
    }
    // Meta Pixel — so eventos padrao (Lead, CompleteRegistration etc) ou custom event
    if (META_PIXEL_STANDARD_EVENTS.has(name)) {
      try {
        w.fbq?.("track", name, properties);
      } catch {
        /* swallow */
      }
    }
  }
}

/**
 * Conjunto de eventos que entram como captureMessage no Sentry (milestones).
 * Outros eventos so viram breadcrumbs (visiveis apenas se houver erro depois).
 */
const PRODUCT_MILESTONES = new Set<string>([
  "signup_completed",
  "first_property_added",
  "first_recommendation_applied",
  "stays_connected",
  "subscription_activated",
  "subscription_cancelled",
  "trial_started",
  "trial_expired",
]);

/**
 * Eventos padrao Meta Pixel — outros sao tratados como custom (passa para
 * fbq("trackCustom", ...)).
 */
const META_PIXEL_STANDARD_EVENTS = new Set<string>([
  "Lead",
  "CompleteRegistration",
  "Subscribe",
  "ViewContent",
  "InitiateCheckout",
  "Purchase",
]);
