"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";

/**
 * /forbidden — pagina 403 amigavel.
 *
 * Usada quando guards (admin/PaymentCheck/AuthGuard) decidem que o usuario
 * nao tem permissao. Manifesto editorial dark, consistente com 404/erro.
 */
export default function ForbiddenPage() {
  const router = useRouter();

  return (
    <main
      className="urban-manifesto"
      style={{
        minHeight: "100vh",
        background: "#080A0F",
        color: "#FFFFFF",
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
            color: "#E8500A",
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
            fontSize: "clamp(64px, 14vw, 180px)",
            lineHeight: 0.9,
            letterSpacing: "-1.5px",
            fontWeight: 400,
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          VOCÊ NÃO TEM
          <br />
          <span style={{ color: "#E8500A" }}>PERMISSÃO AQUI.</span>
        </h1>
        <p
          style={{
            marginTop: 40,
            fontSize: 18,
            fontWeight: 300,
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.65)",
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
              background: "#E8500A",
              color: "#080A0F",
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
              border: "1px solid rgba(255,255,255,0.20)",
              color: "#FFFFFF",
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
