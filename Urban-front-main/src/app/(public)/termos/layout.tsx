import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildSeoMetadata } from "../../lib/seo";

export const metadata: Metadata = buildSeoMetadata({
  title: "Termos de Uso - Urban AI",
  description:
    "Termos de Uso da Urban AI para acesso e uso da plataforma de inteligência de mercado e precificação dinâmica.",
  path: "/termos",
});

export default function TermosLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
