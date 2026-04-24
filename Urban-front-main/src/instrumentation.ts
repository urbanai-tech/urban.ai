import * as Sentry from "@sentry/nextjs";

const appEnv =
  process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";
const enabled = appEnv === "production" || appEnv === "staging";
const tracesSampleRate = appEnv === "production" ? 0.1 : 1.0;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate,
      enabled,
      environment: appEnv,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate,
      enabled,
      environment: appEnv,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
