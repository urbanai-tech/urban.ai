import React from "react";
import HeaderPublic from "../componentes/HeaderPublic";
import FooterPublic from "../componentes/FooterPublic";
import { JsonLd, publicBaseJsonLd } from "../lib/seo";
import { getPublicPricing } from "../lib/publicPlans";
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
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Mesmos planos do checkout (cache de 1 h; fallback se a API falhar).
  const pricing = await getPublicPricing();

  return (
    <div className={styles.shell}>
      <JsonLd id="urban-public-base-jsonld" data={publicBaseJsonLd(pricing)} />
      <HeaderPublic />
      <div className={styles.content}>{children}</div>
      <FooterPublic />
    </div>
  );
}
