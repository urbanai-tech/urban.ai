import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";

// Fonte auto-hospedada (OFL, src/fonts/archivo): o build nao depende do download
// do Google Fonts (que derrubava o CI de forma intermitente) e o navegador nao
// faz request de terceiros. next/font/local gera o @font-face com fallback de
// metrica ajustada, entao a troca de fonte nao desloca o layout.
//
// Familia unica (DS-10): Archivo, com eixo de largura, e o substituto livre da
// Artegra Sans Extended (licenca comercial, sem uso web confirmado). Poppins e
// Bebas Neue foram removidas: nao fazem parte da marca. Os tokens
// --font-brand/--font-display apontam para a Artegra primeiro; ela so existe
// se NEXT_PUBLIC_BRAND_FONTS_URL carregar um CSS de host licenciado.
const archivo = localFont({
  src: [{ path: "../fonts/archivo/archivo-latin-wdth100-125-normal.woff2", weight: "100 900", style: "normal" }],
  declarations: [{ prop: "font-stretch", value: "100% 125%" }],
  display: "swap",
  variable: "--font-archivo",
});
const BRAND_FONTS_URL = process.env.NEXT_PUBLIC_BRAND_FONTS_URL;
import { RootShell } from "./RootShell";
import { StagingBanner } from "./componentes/StagingBanner";
import { ThemeScript } from "./componentes/theme";
import { APPLE_STARTUP_IMAGES } from "./lib/pwaSplashScreens.generated";
import { NONCE_HEADER } from "./lib/csp";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://myurbanai.com";
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV;
const HAS_ENVIRONMENT_BANNER = Boolean(APP_ENV && APP_ENV !== "production");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "My Urban AI",
  title: "My Urban AI | Precificação dinâmica para Airbnb",
  description: "Precificação dinâmica para anfitriões com IA, calendário urbano e operação assistida.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/pwa-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/pwa-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon-167.png", sizes: "167x167", type: "image/png" },
      { url: "/apple-touch-icon-152.png", sizes: "152x152", type: "image/png" },
      { url: "/apple-touch-icon-120.png", sizes: "120x120", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "My Urban",
    statusBarStyle: "black-translucent",
    startupImage: APPLE_STARTUP_IMAGES.map(({ url, media }) => ({ url, media })),
  },
  other: {
    // Chrome/Android: a meta antiga apple-mobile-web-app-capable está depreciada.
    "mobile-web-app-capable": "yes",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "My Urban AI",
    title: "My Urban AI | Precificação dinâmica para Airbnb",
    description: "Precificação dinâmica para anfitriões com IA, calendário urbano e operação assistida.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "My Urban AI — Precificação dinâmica para Airbnb" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "My Urban AI | Precificação dinâmica para Airbnb",
    description: "Transforme eventos, sazonalidade e sinais do bairro em recomendações de preço explicáveis.",
    images: ["/twitter-image"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F8F5" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nonce da CSP gerado por requisição no middleware. Ler headers() torna a
  // renderização dinâmica — requisito para o nonce valer em cada resposta.
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;

  return (
    <html
      lang="pt-BR"
      className={`font-press ${archivo.variable}${HAS_ENVIRONMENT_BANNER ? " has-environment-banner" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript nonce={nonce} />
        {BRAND_FONTS_URL ? <link rel="stylesheet" href={BRAND_FONTS_URL} /> : null}
      </head>
      <body cz-shortcut-listen="true">
        <StagingBanner />
        <RootShell nonce={nonce}>{children}</RootShell>
      </body>
    </html>
  );
}
