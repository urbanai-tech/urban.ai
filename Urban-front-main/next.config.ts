import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    domains: ['cdn.usegalileo.ai'],
  },
  output: 'standalone',
  eslint: {
    // ⚠️ Ignora erros de ESLint no build (temporário)
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/copilot/:path*',
        destination: 'http://200.142.105.90:31806/copilot/:path*',
      },
      {
        source: '/ws/:path*',
        destination: 'http://200.142.105.90:31806/ws/:path*',
      },
      {
        source: '/assets/:path*',
        destination: 'http://200.142.105.90:31806/assets/:path*',
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
