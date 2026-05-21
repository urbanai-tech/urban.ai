import React from "react";
import HeaderPublic from "../componentes/HeaderPublic";
import FooterPublic from "../componentes/FooterPublic";

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
      <HeaderPublic />
      <main style={{ flex: 1 }}>{children}</main>
      <FooterPublic />
    </div>
  );
}
