"use client";

import React from "react";
import NextLink from "next/link";
import styles from "./AppFooter.module.css";

const PUBLIC_SITE_URL = (
  process.env.NEXT_PUBLIC_MARKETING_URL ||
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ||
  "https://myurbanai.com"
).replace(/\/$/, "");

/**
 * AppFooter — footer minimal pro app autenticado.
 *
 * Substitui o `componentes/Footer.tsx` usado pelo HostShell quando o anfitrião
 * está autenticado. Estilo: light premium, tipografia editorial sutil, sem
 * 4-coluna SaaS pesado (essas páginas estão no autenticado e não precisam de
 * navegação pública/legal completa que o footer público já entrega).
 *
 * Estrutura:
 *  - Linha superior: ©  2026 Urban AI · ambiente · status pill
 *  - Direita: links discretos (Termos, Privacidade, Contato, Status do sistema)
 */
export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      className={`urban-app ${styles.footerRoot}`}
      data-app-footer
    >
      <div className={styles.footerInner}>
        <div className={styles.footerBrandRow}>
          <span className={styles.footerLogo}>
            <span className={`urban-app-display ${styles.footerLogoPart}`}>
              URBAN
            </span>
            <span
              className={`urban-app-display ${styles.footerLogoPart} ${styles.footerLogoAccent}`}
            >
              AI
            </span>
          </span>
          <span className={styles.footerSeparator}>·</span>
          <span className={styles.footerCopyright}>
            © {year} MP IA TECNOLOGIA · TODOS OS DIREITOS RESERVADOS
          </span>
        </div>

        <nav
          aria-label="Links de rodape"
          className={styles.footerNav}
        >
          <FooterLink href={`${PUBLIC_SITE_URL}/termos`} external>
            Termos
          </FooterLink>
          <FooterLink href={`${PUBLIC_SITE_URL}/privacidade`} external>
            Privacidade
          </FooterLink>
          <FooterLink href={`${PUBLIC_SITE_URL}/contato`} external>
            Contato
          </FooterLink>
          <FooterLink href="https://status.myurbanai.com" external openInNewTab>
            Status do sistema
          </FooterLink>
        </nav>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  external,
  openInNewTab,
  children,
}: {
  href: string;
  external?: boolean;
  openInNewTab?: boolean;
  children: React.ReactNode;
}) {
  const linkClassName = `urban-focus-ring ${styles.footerLink}`;

  if (external) {
    return (
      <a
        href={href}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
        className={linkClassName}
      >
        {children}
      </a>
    );
  }

  return (
    <NextLink
      href={href}
      className={linkClassName}
    >
      {children}
    </NextLink>
  );
}
