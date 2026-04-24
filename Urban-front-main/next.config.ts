import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// URL base do Chainlit Copilot — nunca deve vir hardcoded.
// Em dev/local: http://localhost:8000 (ou o que estiver no .env.local)
// Em staging/prod: configurar NEXT_PUBLIC_CHAINLIT_URL no Railway.
const COPILOT_URL = process.env.NEXT_PUBLIC_CHAINLIT_URL;

const nextConfig: NextConfig = {
  images: {
    domains: ['cdn.usegalileo.ai'],
  },
  output: 'standalone',
  eslint: {
    // Build falha em ERROS do lint (rules-of-hooks, etc). Warnings (unused
    // vars, exhaustive-deps, etc) são permitidos até o saneamento completo
    // descrito em docs/runbooks/eslint-debt.md.
    ignoreDuringBuilds: false,
  },
  async rewrites() {
    if (!COPILOT_URL) {
      // Sem copilot configurado, o rewrite é omitido — 404 natural em vez de crash.
      return [];
    }
    return [
      {
        source: '/copilot/:path*',
        destination: `${COPILOT_URL}/copilot/:path*`,
      },
      {
        source: '/ws/:path*',
        destination: `${COPILOT_URL}/ws/:path*`,
      },
      {
        source: '/assets/:path*',
        destination: `${COPILOT_URL}/assets/:path*`,
      }
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Organização e projeto Sentry
  org: "urbanai-ff",
  project: "javascript-nextjs",

  // Silencia logs do Sentry durante o build
  silent: !process.env.CI,

  // Desabilita upload de source maps (evita falha de build sem SENTRY_AUTH_TOKEN)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  // Desabilita telemetria do Sentry
  telemetry: false,
});
