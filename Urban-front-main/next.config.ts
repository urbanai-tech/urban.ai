import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// URL base do Chainlit Copilot — nunca deve vir hardcoded.
// Em dev/local: http://localhost:8000 (ou o que estiver no .env.local)
// Em staging/prod: configurar NEXT_PUBLIC_CHAINLIT_URL no Railway.
const COPILOT_URL = process.env.NEXT_PUBLIC_CHAINLIT_URL;

const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self' https://*.stripe.com",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

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
          { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicyReportOnly },
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

  // Mantém error tracking e performance tracing, mas evita que recursos de
  // Session Replay (não usados pelo produto) entrem no bundle compartilhado.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },
});
