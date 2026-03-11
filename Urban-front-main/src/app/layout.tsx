import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Urban ai",
  description: "create Lumina Lab",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="font-press">
      <body cz-shortcut-listen="true">
        <Providers>
          {children}
          
        </Providers>
      </body>
    </html>
  );
}
