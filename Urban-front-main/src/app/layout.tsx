import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter, Poppins } from "next/font/google";
import "./globals.css";

// UX-6d (FOUT): fontes self-hospedadas pelo Next em vez de @import do Google
// (render-blocking + display=swap = flash do Bebas). O Next injeta preload +
// fallback com métrica ajustada, então não há mais o "fantasma" no load.
const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-bebas",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-inter",
});
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-poppins",
});
import { Providers } from "./providers";
import { StagingBanner } from "./componentes/StagingBanner";
import { Analytics } from "./componentes/Analytics";
import { CookieConsent } from "./componentes/CookieConsent";
import { PwaInstaller } from "./componentes/PwaInstaller";
import { ThemeScript } from "./componentes/theme";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://myurbanai.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Urban AI",
  title: "Urban AI | Precificação dinâmica para Airbnb e aluguel por temporada",
  description: "Precificação dinâmica para anfitriões com IA, calendário urbano e operação assistida.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/pwa-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/pwa-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Urban AI",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Urban AI",
    title: "Urban AI | Precificação dinâmica para Airbnb",
    description: "Precificação dinâmica para anfitriões com IA, calendário urbano e operação assistida.",
    images: [{ url: "/og-public-launch.png", width: 1536, height: 1024, alt: "Urban AI — A cidade muda. O preço também." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Urban AI | Precificação inteligente para aluguel por temporada",
    description: "Transforme eventos, sazonalidade e sinais do bairro em recomendações de preço explicáveis.",
    images: ["/og-public-launch.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFB" },
    { media: "(prefers-color-scheme: dark)", color: "#080A0F" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`font-press ${bebas.variable} ${inter.variable} ${poppins.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body cz-shortcut-listen="true">
        <StagingBanner />
        <Providers>
          {children}
          <Analytics />
          <CookieConsent />
          <PwaInstaller />
        </Providers>
      </body>
    </html>
  );
}
