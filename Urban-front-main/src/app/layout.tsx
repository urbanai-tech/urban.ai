import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { StagingBanner } from "./componentes/StagingBanner";

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
        <Providers>
          {children}

        </Providers>
      </body>
    </html>
  );
}
