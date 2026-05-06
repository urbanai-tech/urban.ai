"use client";

import React from "react";
import NextLink from "next/link";

/**
 * Footer público Urban AI.
 *
 * Estilo manifesto editorial: dark #080A0F, Inter 400 letter-spacing 2-3px,
 * sem cards de 4 colunas estilo SaaS. Tipografia editorial, accent #E8500A
 * apenas em hover/destaque.
 */
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "/"
    : "https://app.myurbanai.com/");

const COL_PRODUTO = [
  { label: "Manifesto", href: "/" },
  { label: "Preços", href: "/precos" },
  { label: "Lançamento", href: "/lancamento" },
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
        background: "#080A0F",
        borderTop: "1px solid rgba(255,255,255,0.08)",
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
            fontSize: "clamp(80px, 18vw, 280px)",
            lineHeight: 0.85,
            letterSpacing: "-2px",
            fontWeight: 400,
            textTransform: "uppercase",
            color: "#FFFFFF",
            marginBottom: 80,
            wordBreak: "break-word",
          }}
        >
          URBAN<span style={{ color: "#E8500A" }}>·</span>AI
        </div>

        {/* Grid de links */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 48,
            paddingBottom: 64,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
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
                color: "rgba(255,255,255,0.45)",
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
              color: "rgba(255,255,255,0.45)",
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
              color: "rgba(255,255,255,0.20)",
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
          color: "rgba(255,255,255,0.45)",
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
            <li key={it.href}>
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
            <li key={it.href}>
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
  color: "rgba(255,255,255,0.85)",
  textDecoration: "none",
  letterSpacing: 0,
  transition: "color 150ms",
};

function hoverIn(e: React.MouseEvent<HTMLAnchorElement>) {
  (e.currentTarget as HTMLElement).style.color = "#E8500A";
}
function hoverOut(e: React.MouseEvent<HTMLAnchorElement>) {
  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
}
