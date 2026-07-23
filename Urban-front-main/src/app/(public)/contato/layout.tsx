import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd, buildSeoMetadata, contactPageJsonLd } from "../../lib/seo";

export const metadata: Metadata = buildSeoMetadata({
  title: "Contato - Urban AI",
  description:
    "Fale com a Urban AI sobre produto, planos, integrações, suporte, parcerias ou privacidade.",
  path: "/contato",
});

export default function ContatoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <JsonLd id="contact-jsonld" data={contactPageJsonLd("/contato")} />
      {children}
    </>
  );
}
