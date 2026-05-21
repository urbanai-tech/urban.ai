import React from "react";
import HeaderPublic from "../componentes/HeaderPublic";
import FooterPublic from "../componentes/FooterPublic";
import { JsonLd, publicBaseJsonLd } from "../lib/seo";

/**
 * Layout do site público (myurbanai.com).
 *
 * Aplica-se a:
 *  - / (landing institucional principal — via rewrite do middleware)
 *  - /landing (rota interna usada pelo rewrite)
 *  - /lancamento, /sobre, /termos, /privacidade, /contato, /precos
 *
 * Não tem auth check — qualquer visitante acessa.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
      }}
    >
      <JsonLd id="urban-public-base-jsonld" data={publicBaseJsonLd()} />
      <HeaderPublic />
      <div style={{ flex: 1 }}>{children}</div>
      <FooterPublic />
    </div>
  );
}
