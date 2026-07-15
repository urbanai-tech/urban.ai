// IMPORTANT: instrument.ts must be imported first for Sentry to work properly.
import * as Sentry from '@sentry/nestjs';
import { redactObservabilityData, resolveObservabilityRuntime } from './common/observability';

// APP_ENV distinguishes prod/staging even when NODE_ENV=production in both.
const runtime = resolveObservabilityRuntime();
const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: runtime.environment === 'production' ? 0.1 : 1.0,
    environment: runtime.environment,
    release: runtime.release === 'unknown' ? undefined : runtime.release,
    beforeSend: (event) => redactObservabilityData(event),
  });
}
