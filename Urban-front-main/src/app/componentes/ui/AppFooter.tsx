"use client";

import React from "react";
import NextLink from "next/link";

/**
 * AppFooter — footer minimal pro app autenticado.
 *
 * Substitui o `componentes/Footer.tsx` usado pelo HostShell quando o anfitriao
 * esta autenticado. Estilo: light premium, tipografia editorial sutil, sem
 * 4-coluna SaaS pesado (essas paginas estao no autenticado e nao precisam de
 * navegacao publica/legal completa que o footer publico ja entrega).
 *
 * Estrutura:
 *  - Linha superior: ©  2026 Urban AI · ambiente · status pill
 *  - Direita: links discretos (Termos, Privacidade, Contato, Status do sistema)
 */
export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="urban-app"
      style={{
        marginTop: "auto",
        padding: "32px 32px 28px",
        borderTop: "1px solid var(--app-divider)",
        background: "var(--app-bg)",
        color: "var(--app-text-muted)",
        fontSize: 12,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 4,
            }}
          >
            <span
              className="urban-app-display"
              style={{
                fontSize: 16,
                fontWeight: 400,
                textTransform: "uppercase",
                color: "var(--app-text)",
                lineHeight: 1,
                letterSpacing: 0,
              }}
            >
              URBAN
            </span>
            <span
              className="urban-app-display"
              style={{
                fontSize: 16,
                fontWeight: 400,
                textTransform: "uppercase",
                color: "var(--app-accent)",
                lineHeight: 1,
                letterSpacing: 0,
              }}
            >
              AI
            </span>
          </span>
          <span style={{ color: "var(--app-text-dim)" }}>·</span>
          <span style={{ letterSpacing: 0.5 }}>
            © {year} MP IA TECNOLOGIA · TODOS OS DIREITOS RESERVADOS
          </span>
        </div>

        <nav
          aria-label="Links de rodape"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            flexWrap: "wrap",
            fontSize: 12,
            letterSpacing: 0.3,
          }}
        >
          <FooterLink href="/termos">Termos</FooterLink>
          <FooterLink href="/privacidade">Privacidade</FooterLink>
          <FooterLink href="/contato">Contato</FooterLink>
          <FooterLink href="https://status.myurbanai.com" external>
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
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const baseStyle: React.CSSProperties = {
    color: "var(--app-text-muted)",
    textDecoration: "none",
    borderBottom: "1px solid transparent",
    transition: "color 120ms, border-color 120ms",
    paddingBottom: 2,
  };

  function onEnter(e: React.MouseEvent<HTMLAnchorElement>) {
    e.currentTarget.style.color = "var(--app-accent)";
    e.currentTarget.style.borderBottomColor = "var(--app-accent)";
  }
  function onLeave(e: React.MouseEvent<HTMLAnchorElement>) {
    e.currentTarget.style.color = "var(--app-text-muted)";
    e.currentTarget.style.borderBottomColor = "transparent";
  }

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={baseStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {children}
      </a>
    );
  }

  return (
    <NextLink href={href} style={baseStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
    </NextLink>
  );
}
