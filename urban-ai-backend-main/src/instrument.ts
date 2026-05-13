// IMPORTANT: instrument.ts must be imported first for Sentry to work properly.
import * as Sentry from '@sentry/nestjs';

// APP_ENV distinguishes prod/staging even when NODE_ENV=production in both.
const appEnv = process.env.APP_ENV || process.env.NODE_ENV || 'development';
const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: true,
    tracesSampleRate: appEnv === 'production' ? 0.1 : 1.0,
    environment: appEnv,
  });
}
