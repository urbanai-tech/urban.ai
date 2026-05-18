import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { StagingBanner } from "./componentes/StagingBanner";
import { Analytics } from "./componentes/Analytics";
import { CookieConsent } from "./componentes/CookieConsent";
import { PwaInstaller } from "./componentes/PwaInstaller";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.myurbanai.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  applicationName: "Urban AI",
  title: "Urban AI",
  description: "Precificacao dinamica para anfitrioes com IA, calendario urbano e operacao assistida.",
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
    url: APP_URL,
    siteName: "Urban AI",
    title: "Urban AI",
    description: "Precificacao dinamica para anfitrioes com IA, calendario urbano e operacao assistida.",
    images: [{ url: "/pwa-icon-512.png", width: 512, height: 512, alt: "Urban AI" }],
  },
  twitter: {
    card: "summary",
    title: "Urban AI",
    description: "Precificacao dinamica para anfitrioes com IA, calendario urbano e operacao assistida.",
    images: ["/pwa-icon-512.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#E8500A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="font-press">
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
