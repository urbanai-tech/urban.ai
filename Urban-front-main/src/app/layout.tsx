import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { StagingBanner } from "./componentes/StagingBanner";
import { Analytics } from "./componentes/Analytics";

export const metadata: Metadata = {
  title: "Urban ai",
  description: "create Lumina Lab",
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
    <html lang="en" className="font-press">
      <body cz-shortcut-listen="true">
        <StagingBanner />
        <Analytics />
        <Providers>
          {children}

        </Providers>
      </body>
    </html>
  );
}
