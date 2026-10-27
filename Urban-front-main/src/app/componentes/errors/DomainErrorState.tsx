"use client";

import { useEffect } from "react";
import { recoverFromKeyboard } from "./error-recovery";

export type ErrorDomain = "public" | "host" | "admin";

const content: Record<
  ErrorDomain,
  { eyebrow: string; title: string; body: string; homeHref: string; homeLabel: string }
> = {
  public: {
    eyebrow: "NÃO FOI POSSÍVEL CARREGAR",
    title: "Vamos tentar novamente?",
    body: "Esta página encontrou uma falha temporária. Tente recarregar o conteúdo ou volte ao início.",
    homeHref: "/",
    homeLabel: "Voltar ao início",
  },
  host: {
    eyebrow: "SUA OPERAÇÃO ESTÁ SEGURA",
    title: "Não conseguimos carregar esta área.",
    body: "Os seus dados não foram alterados. Tente novamente ou retorne ao dashboard para continuar.",
    homeHref: "/dashboard",
    homeLabel: "Ir ao dashboard",
  },
  admin: {
    eyebrow: "FALHA OPERACIONAL",
    title: "Esta seção do admin não respondeu.",
    body: "Nenhuma ação foi aplicada. Tente novamente ou volte à visão geral para seguir com a operação.",
    homeHref: "/admin",
    homeLabel: "Voltar ao admin",
  },
};

const palettes: Record<ErrorDomain, { background: string; surface: string; text: string; muted: string; accent: string; accentContrast: string; border: string }> = {
  public: {
    background: "var(--theme-public-bg)",
    surface: "var(--theme-public-surface)",
    text: "var(--theme-public-text)",
    muted: "var(--theme-public-muted)",
    accent: "var(--theme-public-accent)",
    accentContrast: "var(--theme-public-accent-contrast)",
    border: "var(--theme-public-strong)",
  },
  host: {
    background: "var(--theme-page-bg)",
    surface: "var(--theme-public-surface)",
    text: "var(--theme-page-text)",
    muted: "var(--theme-public-muted)",
    accent: "var(--theme-public-accent)",
    accentContrast: "var(--theme-public-accent-contrast)",
    border: "var(--theme-public-strong)",
  },
  admin: {
    background: "var(--theme-admin-bg)",
    surface: "var(--theme-admin-surface)",
    text: "var(--theme-admin-text)",
    muted: "var(--theme-admin-text-muted)",
    accent: "var(--theme-admin-accent)",
    accentContrast: "var(--theme-admin-accent-contrast)",
    border: "var(--theme-admin-divider-strong)",
  },
};

export function DomainErrorState({
  domain,
  error,
  reset,
}: {
  domain: ErrorDomain;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const copy = content[domain];
  const palette = palettes[domain];

  useEffect(() => {
    console.error(`[urban-ai:${domain}] route error`, error);
  }, [domain, error]);

  return (
    <div
      data-error-domain={domain}
      role="alert"
      aria-live="assertive"
      style={{
        minHeight: domain === "admin" ? 480 : domain === "public" ? "min(70vh, 720px)" : "100vh",
        display: "grid",
        placeItems: "center",
        padding: "clamp(32px, 7vw, 80px) 20px",
        background: palette.background,
        color: palette.text,
      }}
    >
      <section
        aria-labelledby={`${domain}-error-title`}
        style={{
          width: "min(100%, 680px)",
          padding: "clamp(28px, 6vw, 56px)",
          border: `1px solid ${palette.border}`,
          background: palette.surface,
          textAlign: domain === "admin" ? "left" : "center",
        }}
      >
        <p style={{ margin: 0, color: palette.accent, fontSize: 12, fontWeight: 700, letterSpacing: 2.4 }}>
          {copy.eyebrow}
        </p>
        <h1
          id={`${domain}-error-title`}
          style={{ margin: "18px 0 0", fontSize: "clamp(30px, 6vw, 56px)", lineHeight: 1.05, textWrap: "balance" }}
        >
          {copy.title}
        </h1>
        <p style={{ margin: "20px 0 0", color: palette.muted, fontSize: 16, lineHeight: 1.7 }}>
          {copy.body}
        </p>
        {error.digest && (
          <p style={{ margin: "14px 0 0", color: palette.muted, fontFamily: "monospace", fontSize: 11 }}>
            Referência: {error.digest}
          </p>
        )}
        <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: domain === "admin" ? "flex-start" : "center" }}>
          <button
            className="urban-domain-error-action"
            type="button"
            autoFocus
            onClick={reset}
            onKeyDown={(event) => recoverFromKeyboard(event, reset)}
            style={{
              minHeight: 48,
              padding: "12px 20px",
              border: `1px solid ${palette.accent}`,
              background: palette.accent,
              color: palette.accentContrast,
              font: "inherit",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
          <a
            className="urban-domain-error-action"
            href={copy.homeHref}
            style={{
              minHeight: 48,
              padding: "12px 20px",
              border: `1px solid ${palette.border}`,
              color: palette.text,
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {copy.homeLabel}
          </a>
        </div>
      </section>
      <style jsx>{`
        .urban-domain-error-action:focus-visible {
          outline: 3px solid ${palette.accent};
          outline-offset: 4px;
        }
      `}</style>
    </div>
  );
}
