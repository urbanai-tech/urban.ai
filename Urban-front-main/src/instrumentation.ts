import * as Sentry from "@sentry/nextjs";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import {
  scrubBreadcrumb,
  scrubSentryEvent,
} from "./app/lib/privacy-scrub";

type TransactionEvent = Parameters<
  NonNullable<Sentry.NodeOptions["beforeSendTransaction"]>
>[0];

const appEnv =
  process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";
const enabled = appEnv === "production" || appEnv === "staging";
const tracesSampleRate = appEnv === "production" ? 0.1 : 1.0;

// Mesmo scrub do client: /reset-password/<token> e /confirm-email/<email> não
// podem chegar ao Sentry via request.url, breadcrumbs ou transaction.
const privacyOptions = {
  sendDefaultPii: false,
  beforeSend: (event: ErrorEvent) => scrubSentryEvent(event),
  beforeSendTransaction: (event: TransactionEvent) => scrubSentryEvent(event),
  beforeBreadcrumb: (breadcrumb: Breadcrumb) => scrubBreadcrumb(breadcrumb),
};

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate,
      enabled,
      environment: appEnv,
      ...privacyOptions,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate,
      enabled,
      environment: appEnv,
      ...privacyOptions,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
