import "../app.css";
import type { Metadata } from "next";
import { appTitle } from "../lib/pageTitle";

/**
 * Relatório do proprietário (ADR 0027): rota PÚBLICA por token, sem login e sem o shell do anfitrião.
 * Nunca indexável (meta + X-Robots-Tag no middleware + robots.txt) e sem enviar o endereço
 * (que contém o token) como referrer para outros sites.
 */
export const metadata: Metadata = {
  title: appTitle("Relatório do proprietário"),
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function OwnerReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
