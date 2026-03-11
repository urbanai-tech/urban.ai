import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['cdn.usegalileo.ai'],
  },
  output: 'standalone',
  eslint: {
    // ⚠️ Ignora erros de ESLint no build (temporário)
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
