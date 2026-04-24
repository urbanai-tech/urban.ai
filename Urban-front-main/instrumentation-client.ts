import * as Sentry from "@sentry/nextjs";

const appEnv =
  process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Percentual de sessões com replay gravado (1% em produção)
  replaysSessionSampleRate: 0.01,

  // Quando ocorrer erro, gravar 100% das sessões afetadas
  replaysOnErrorSampleRate: 1.0,

  // Traces: 10% em prod, 100% em staging para debug
  tracesSampleRate: appEnv === "production" ? 0.1 : 1.0,

  // Habilitado em production e staging; desabilitado em development para não poluir
  enabled: appEnv === "production" || appEnv === "staging",

  environment: appEnv,

  integrations: [
    Sentry.replayIntegration(),
  ],
});
