// Import with `const Sentry = require("@sentry/nestjs");` if you are using CJS
import * as Sentry from "@sentry/nestjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://c4160e39973396028c9f3f40c68a56be@o4511057021370368.ingest.us.sentry.io/4511057040113664",

  // Envia PII básico (ex: IP) para correlação de erros por usuário
  sendDefaultPii: true,

  // Percentual de traces coletados (10% em produção é um bom ponto de partida)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Identifica o ambiente
  environment: process.env.NODE_ENV || "development",
});
