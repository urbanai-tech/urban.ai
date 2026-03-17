import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Percentual de sessões com replay gravado (1% em produção)
  replaysSessionSampleRate: 0.01,

  // Quando ocorrer erro, gravar 100% das sessões afetadas
  replaysOnErrorSampleRate: 1.0,

  // Percentual de traces coletados
  tracesSampleRate: 0.1,

  // Desabilitar em desenvolvimento para não poluir o Sentry
  enabled: process.env.NODE_ENV === "production",

  integrations: [
    Sentry.replayIntegration(),
  ],
});
