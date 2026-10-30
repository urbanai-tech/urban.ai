import React from "react";
import HeaderPublic from "../componentes/HeaderPublic";
import FooterPublic from "../componentes/FooterPublic";
import { JsonLd, publicBaseJsonLd } from "../lib/seo";
import styles from "./layout.module.css";

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
    <div className={styles.shell}>
      <JsonLd id="urban-public-base-jsonld" data={publicBaseJsonLd()} />
      <HeaderPublic />
      <div className={styles.content}>{children}</div>
      <FooterPublic />
    </div>
  );
}
