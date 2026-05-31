import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildSeoMetadata } from "../../lib/seo";

export const metadata: Metadata = buildSeoMetadata({
  title: "Política de Privacidade - Urban AI",
  description:
    "Política de Privacidade da Urban AI, com informações sobre tratamento de dados, LGPD, segurança e contato de privacidade.",
  path: "/privacidade",
});

export default function PrivacidadeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
