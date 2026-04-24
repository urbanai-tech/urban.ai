// Import with `const Sentry = require("@sentry/nestjs");` if you are using CJS
import * as Sentry from "@sentry/nestjs";

// APP_ENV distingue prod/staging mesmo quando NODE_ENV=production em ambos.
const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://c4160e39973396028c9f3f40c68a56be@o4511057021370368.ingest.us.sentry.io/4511057040113664",

  // Envia PII básico (ex: IP) para correlação de erros por usuário
  sendDefaultPii: true,

  // Traces: 10% em prod, 100% em staging/dev para debugging
  tracesSampleRate: appEnv === "production" ? 0.1 : 1.0,

  environment: appEnv,
});
