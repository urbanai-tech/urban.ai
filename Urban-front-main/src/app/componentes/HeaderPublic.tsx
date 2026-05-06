"use client";

import React, { useState } from "react";
import NextLink from "next/link";

/**
 * Header do site PÚBLICO (myurbanai.com).
 *
 * Estilo manifesto editorial: dark #080A0F, Inter minimalista, accent #E8500A
 * apenas no CTA. Sem logo grande — Urban AI é a tipografia.
 *
 * Os CTAs apontam pro subdomain do app (`app.myurbanai.com/`).
 */
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "/"
    : "https://app.myurbanai.com/");

const NAV = [
  { label: "Manifesto", href: "/" },
  { label: "Preços", href: "/precos" },
  { label: "Lançamento", href: "/lancamento" },
  { label: "Contato", href: "/contato" },
];

export default function HeaderPublic() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="urban-manifesto"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(8, 10, 15, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
        }}
      >
        {/* Logo — Bebas Neue tipo wordmark */}
        <NextLink
          href="/"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <span
            className="urban-display"
            style={{
              fontSize: 28,
              letterSpacing: 0,
              fontWeight: 400,
              color: "#FFFFFF",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            URBAN
          </span>
          <span
            className="urban-display"
            style={{
              fontSize: 28,
              letterSpacing: 0,
              fontWeight: 400,
              color: "#E8500A",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            AI
          </span>
        </NextLink>

        {/* Nav desktop */}
        <nav
          style={{
            display: "none",
            alignItems: "center",
            gap: 36,
          }}
          className="urban-nav-desktop"
        >
          {NAV.map((item) => (
            <NextLink
              key={item.href}
              href={item.href}
              style={{
                fontSize: 12,
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: 500,
                color: "rgba(255,255,255,0.65)",
                textDecoration: "none",
                transition: "color 150ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)";
              }}
            >
              {item.label}
            </NextLink>
          ))}
        </nav>

        {/* CTAs desktop */}
        <div style={{ display: "none", alignItems: "center", gap: 16 }} className="urban-cta-desktop">
          <a
            href={APP_URL}
            style={{
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 500,
              color: "rgba(255,255,255,0.65)",
              textDecoration: "none",
              padding: "8px 4px",
            }}
          >
            Entrar
          </a>
          <a
            href={`${APP_URL}create`.replace(/\/+create/, "/create")}
            style={{
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 700,
              color: "#080A0F",
              background: "#E8500A",
              padding: "12px 22px",
              textDecoration: "none",
            }}
          >
            Criar conta
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu"
          className="urban-mobile-toggle"
          style={{
            display: "flex",
            height: 40,
            width: 40,
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.20)",
            color: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            {open ? (
              <path
                d="M5 5L15 15M5 15L15 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <>
                <path d="M3 7H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 13H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: 72,
            left: 0,
            right: 0,
            background: "#080A0F",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {NAV.map((item) => (
            <NextLink
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                padding: "16px 0",
                fontSize: 14,
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: 500,
                color: "rgba(255,255,255,0.85)",
                textDecoration: "none",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {item.label}
            </NextLink>
          ))}
          <a
            href={APP_URL}
            style={{
              marginTop: 16,
              padding: "16px 0",
              fontSize: 14,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 500,
              color: "rgba(255,255,255,0.65)",
              textDecoration: "none",
            }}
          >
            Entrar
          </a>
          <a
            href={`${APP_URL}create`.replace(/\/+create/, "/create")}
            style={{
              marginTop: 12,
              padding: "16px 24px",
              fontSize: 14,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 700,
              textAlign: "center",
              background: "#E8500A",
              color: "#080A0F",
              textDecoration: "none",
            }}
          >
            Criar conta
          </a>
        </div>
      )}

      {/* Responsive helpers — usa media query inline via <style> */}
      <style jsx>{`
        @media (min-width: 768px) {
          :global(.urban-nav-desktop) {
            display: flex !important;
          }
          :global(.urban-cta-desktop) {
            display: flex !important;
          }
          :global(.urban-mobile-toggle) {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
