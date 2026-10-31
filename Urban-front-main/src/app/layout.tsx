import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";

// Fontes auto-hospedadas (OFL, src/fonts/*): o build não depende do download do
// Google Fonts (que derrubava o CI de forma intermitente) e o navegador não faz
// request de terceiros. next/font/local gera o @font-face com fallback de
// métrica ajustada, então a troca de fonte não desloca o layout.
//
// Preload: só a Archivo, que é a fonte do conteúdo principal (LCP) do site
// público e do app. Poppins (cabeçalho/rodapé públicos, 6 pesos) e Bebas (só
// títulos legais) carregam sob demanda para não disputar banda com o LCP.
const bebas = localFont({
  src: [{ path: "../fonts/bebas-neue/bebas-neue-latin-400-normal.woff2", weight: "400", style: "normal" }],
  display: "swap",
  preload: false,
  variable: "--font-bebas",
});
// Marca (2026-10-26): Archivo (OFL) com eixo de largura é o substituto livre
// da Artegra Sans Extended (licença comercial, sem uso web confirmado). Os
// tokens --font-brand/--font-display apontam para a Artegra primeiro; ela só
// existe se NEXT_PUBLIC_BRAND_FONTS_URL carregar um CSS de host licenciado.
const archivo = localFont({
  src: [{ path: "../fonts/archivo/archivo-latin-wdth100-125-normal.woff2", weight: "100 900", style: "normal" }],
  declarations: [{ prop: "font-stretch", value: "100% 125%" }],
  display: "swap",
  variable: "--font-archivo",
});
const BRAND_FONTS_URL = process.env.NEXT_PUBLIC_BRAND_FONTS_URL;
const poppins = localFont({
  // next/font exige literais: um item por peso usado (300–800).
  src: [
    { path: "../fonts/poppins/poppins-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../fonts/poppins/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/poppins/poppins-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/poppins/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/poppins/poppins-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/poppins/poppins-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--font-poppins",
});
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
      className={`font-press ${bebas.variable} ${poppins.variable} ${archivo.variable}${HAS_ENVIRONMENT_BANNER ? " has-environment-banner" : ""}`}
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
