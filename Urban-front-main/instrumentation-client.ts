type SentrySdk = typeof import("@sentry/nextjs");
type RouterTransitionArgs = Parameters<
  SentrySdk["captureRouterTransitionStart"]
>;

const appEnv =
  process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";
const sentryEnabled = appEnv === "production" || appEnv === "staging";

let sentryPromise: Promise<SentrySdk> | undefined;
const pendingErrors: unknown[] = [];

function initializeSentry(): Promise<SentrySdk> {
  sentryPromise ??= import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      // Traces: 10% em prod, 100% em staging para debug.
      tracesSampleRate: appEnv === "production" ? 0.1 : 1.0,
      enabled: sentryEnabled,
      environment: appEnv,
    });

    for (const error of pendingErrors.splice(0)) {
      Sentry.captureException(error);
    }
    return Sentry;
  });
  return sentryPromise;
}

if (typeof window !== "undefined" && sentryEnabled) {
  // O SDK sai do caminho crítico. Até ele carregar, os erros globais ficam em
  // memória e são enviados imediatamente após a inicialização.
  const bufferError = (event: ErrorEvent) => {
    pendingErrors.push(event.error ?? event.message);
  };
  const bufferRejection = (event: PromiseRejectionEvent) => {
    pendingErrors.push(event.reason);
  };
  window.addEventListener("error", bufferError);
  window.addEventListener("unhandledrejection", bufferRejection);

  const scheduleInitialization = () => {
    const start = () => {
      void initializeSentry().finally(() => {
        window.removeEventListener("error", bufferError);
        window.removeEventListener("unhandledrejection", bufferRejection);
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(start, { timeout: 2000 });
    } else {
      globalThis.setTimeout(start, 0);
    }
  };

  if (document.readyState === "complete") scheduleInitialization();
  else window.addEventListener("load", scheduleInitialization, { once: true });
}

export function onRouterTransitionStart(...args: RouterTransitionArgs) {
  if (!sentryEnabled) return;
  void initializeSentry().then((Sentry) => {
    Sentry.captureRouterTransitionStart(...args);
  });
}
