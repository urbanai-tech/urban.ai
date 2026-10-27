"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";

/**
 * /forbidden — página 403 amigável.
 *
 * Usada quando guards (admin/PaymentCheck/AuthGuard) decidem que o usuário
 * não tem permissão. Editorial, segue o tema (claro/escuro), consistente com 404/erro.
 */
export default function ForbiddenPage() {
  const router = useRouter();

  return (
    <main
      className="urban-manifesto"
      style={{
        minHeight: "100vh",
        background: "var(--theme-public-bg)",
        color: "var(--theme-public-text)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        className="urban-glow"
        style={{
          width: 700,
          height: 700,
          top: "-30%",
          left: "50%",
          transform: "translateX(-50%)",
          position: "absolute",
        }}
        aria-hidden
      />
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 680 }}>
        <p
          style={{
            fontSize: 12,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "var(--theme-public-accent)",
            fontWeight: 600,
            margin: 0,
            marginBottom: 32,
          }}
        >
          ERRO 403 — ACESSO NEGADO
        </p>
        <h1
          className="urban-display"
          style={{
            fontSize: "clamp(36px, 9vw, 104px)",
            lineHeight: 0.9,
            letterSpacing: "-1.5px",
            fontWeight: 700,
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          VOCÊ NÃO TEM
          <br />
          <span style={{ color: "var(--theme-public-accent)" }}>PERMISSÃO AQUI.</span>
        </h1>
        <p
          style={{
            marginTop: 40,
            fontSize: 18,
            fontWeight: 300,
            lineHeight: 1.7,
            color: "var(--theme-public-muted)",
          }}
        >
          Essa área é restrita. Se você acredita que deveria ter acesso, fale
          com a equipe ou volte pro painel.
        </p>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            gap: 16,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              padding: "18px 32px",
              background: "var(--theme-public-accent)",
              color: "var(--theme-public-accent-contrast)",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: "uppercase",
              border: "none",
              cursor: "pointer",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            ← Voltar
          </button>
          <NextLink
            href="/painel"
            style={{
              padding: "18px 32px",
              border: "1px solid var(--theme-public-strong)",
              color: "var(--theme-public-text)",
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: "uppercase",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Ir pro painel
          </NextLink>
        </div>
      </div>
    </main>
  );
}
