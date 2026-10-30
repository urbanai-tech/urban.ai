import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// A Content-Security-Policy é gerada por requisição em src/middleware.ts
// (nonce + strict-dynamic; report-only por padrão, CSP_ENFORCE=true bloqueia).
// Aqui ficam só os headers de segurança estáticos.

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.usegalileo.ai',
      },
    ],
  },
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  eslint: {
    // O lint estrito roda separadamente com zero warnings; o build também não
    // deve ignorar erros detectados pela integração do Next.
    ignoreDuringBuilds: false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
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

  // Mantém error tracking e performance tracing, mas evita que recursos de
  // Session Replay (não usados pelo produto) entrem no bundle compartilhado.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },
});
