"use client";

import { useEffect } from "react";
import NextLink from "next/link";

/**
 * App-wide error boundary. Manifesto editorial dark.
 * Captura erros nao tratados em qualquer rota.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[urban-ai] global error:", error);
  }, [error]);

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
          width: 800,
          height: 800,
          top: "-30%",
          left: "50%",
          transform: "translateX(-50%)",
          position: "absolute",
        }}
        aria-hidden
      />
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 720 }}>
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
          ALGO QUEBROU
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
          ERRO
          <br />
          <span style={{ color: "#E8500A" }}>INESPERADO.</span>
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
          Tivemos um erro tentando carregar esta página. O time já foi notificado.
          Tenta de novo ou volta pra área principal.
        </p>
        {error?.digest && (
          <p
            style={{
              marginTop: 16,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
              fontFamily: "monospace",
            }}
          >
            Ref: {error.digest}
          </p>
        )}
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
            onClick={reset}
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
            Tentar de novo →
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
