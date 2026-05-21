import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildSeoMetadata } from "../../lib/seo";

export const metadata: Metadata = buildSeoMetadata({
  title: "Politica de Privacidade - Urban AI",
  description:
    "Politica de Privacidade da Urban AI, com informacoes sobre tratamento de dados, LGPD, seguranca e contato de privacidade.",
  path: "/privacidade",
});

export default function PrivacidadeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
