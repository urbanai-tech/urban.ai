"use client";

import React from "react";
import NextLink from "next/link";

/**
 * Footer público Urban AI.
 *
 * Estilo manifesto editorial: dark var(--theme-public-bg), Inter 400 letter-spacing 2-3px,
 * sem cards de 4 colunas estilo SaaS. Tipografia editorial, accent var(--theme-public-accent)
 * apenas em hover/destaque.
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.myurbanai.com/";

const COL_PRODUTO = [
  { label: "Manifesto", href: "/" },
  { label: "Preços", href: "/precos" },
  { label: "Lançamento", href: "/lancamento" },
  { label: "Guias de pricing", href: "/precificacao-dinamica-airbnb" },
  { label: "Entrar", href: APP_URL, external: true },
];

const COL_EMPRESA = [
  { label: "Sobre", href: "/sobre" },
  { label: "Contato", href: "/contato" },
];

const COL_LEGAL = [
  { label: "Termos de uso", href: "/termos" },
  { label: "Privacidade · LGPD", href: "/privacidade" },
];

export default function FooterPublic() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="urban-manifesto"
      style={{
        background: "var(--theme-public-bg)",
        borderTop: "1px solid var(--theme-public-soft)",
        marginTop: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "100px 24px 48px",
        }}
      >
        {/* Wordmark gigante */}
        <div
          className="urban-display"
          style={{
            fontSize: "clamp(56px, 18vw, 240px)",
            lineHeight: 0.85,
            letterSpacing: 0,
            fontWeight: 400,
            textTransform: "uppercase",
            color: "var(--theme-public-text)",
            marginBottom: 80,
            overflowWrap: "anywhere",
          }}
        >
          URBAN<span style={{ color: "var(--theme-public-accent)" }}>·</span>AI
        </div>

        {/* Grid de links */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 48,
            paddingBottom: 64,
            borderBottom: "1px solid var(--theme-public-soft)",
          }}
        >
          <FooterColumn title="PRODUTO" items={COL_PRODUTO} />
          <FooterColumn title="EMPRESA" items={COL_EMPRESA} />
          <FooterColumn title="LEGAL" items={COL_LEGAL} />
          <div>
            <p
              style={{
                fontSize: 11,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "var(--theme-public-muted)",
                fontWeight: 600,
                margin: "0 0 24px",
              }}
            >
              CONTATO
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              <li>
                <a
                  href="mailto:contato@myurbanai.com"
                  style={footerLinkStyle}
                  onMouseEnter={hoverIn}
                  onMouseLeave={hoverOut}
                >
                  contato@myurbanai.com
                </a>
              </li>
              <li>
                <a
                  href="mailto:privacidade@myurbanai.com"
                  style={footerLinkStyle}
                  onMouseEnter={hoverIn}
                  onMouseLeave={hoverOut}
                >
                  privacidade@myurbanai.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div
          style={{
            paddingTop: 48,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <p
            style={{
              fontSize: 11,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "var(--theme-public-muted)",
              fontWeight: 500,
              margin: 0,
            }}
          >
            © {year} URBAN AI · TODOS OS DIREITOS RESERVADOS
          </p>
          <p
            style={{
              fontSize: 11,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "var(--theme-public-muted)",
              fontWeight: 500,
              margin: 0,
            }}
          >
            FEITO EM SÃO PAULO
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <p
        style={{
          fontSize: 11,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "var(--theme-public-muted)",
          fontWeight: 600,
          margin: "0 0 24px",
        }}
      >
        {title}
      </p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {items.map((it) =>
          it.external ? (
            <li key={`${it.label}-${it.href}`}>
              <a
                href={it.href}
                style={footerLinkStyle}
                onMouseEnter={hoverIn}
                onMouseLeave={hoverOut}
              >
                {it.label}
              </a>
            </li>
          ) : (
            <li key={`${it.label}-${it.href}`}>
              <NextLink
                href={it.href}
                style={footerLinkStyle}
                onMouseEnter={hoverIn}
                onMouseLeave={hoverOut}
              >
                {it.label}
              </NextLink>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

const footerLinkStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 400,
  color: "var(--theme-public-text)",
  textDecoration: "none",
  letterSpacing: 0,
  overflowWrap: "anywhere",
  transition: "color 150ms",
};

function hoverIn(e: React.MouseEvent<HTMLAnchorElement>) {
  (e.currentTarget as HTMLElement).style.color = "var(--theme-public-accent)";
}
function hoverOut(e: React.MouseEvent<HTMLAnchorElement>) {
  (e.currentTarget as HTMLElement).style.color = "var(--theme-public-text)";
}
