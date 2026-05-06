import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { StagingBanner } from "./componentes/StagingBanner";
import { Analytics } from "./componentes/Analytics";
import { CookieConsent } from "./componentes/CookieConsent";

export const metadata: Metadata = {
  title: "Urban AI",
  description: "Precificação dinâmica para anfitriões — IA + agenda da cidade.",
  icons: {
    icon: "/urlaranja.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="font-press">
      <head>
        {/* Design System Urban AI — Bebas Neue (display) + Inter (body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body cz-shortcut-listen="true">
        <StagingBanner />
        <Providers>
          {children}
          <Analytics />
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
