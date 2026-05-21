"use client";

import React from "react";

type AuthFlowShellProps = {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  asideEyebrow?: string;
  asideTitle?: React.ReactNode;
  asideSubtitle?: React.ReactNode;
};

export function AuthFlowShell({
  eyebrow,
  title,
  subtitle,
  children,
  asideEyebrow = "URBAN AI",
  asideTitle = (
    <>
      Precifique pelo{" "}
      <br />
      movimento da cidade.
    </>
  ),
  asideSubtitle = "Fluxos simples, seguros e consistentes para anfitrioes que operam com dados.",
}: AuthFlowShellProps) {
  return (
    <main
      className="urban-app"
      data-auth-shell
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1fr)",
        background: "var(--app-bg)",
      }}
    >
      <section
        data-auth-aside
        aria-hidden="true"
        style={{
          position: "relative",
          minHeight: "100vh",
          overflow: "hidden",
          background: "#080A0F",
          color: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/urbanai_only.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.46,
            filter: "saturate(0.9)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(8,10,15,0.22) 0%, rgba(8,10,15,0.84) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "32px 48px 44px",
          }}
        >
          <BrandMark inverse />
          <div>
            <p
              style={{
                margin: "0 0 18px",
                color: "#E8500A",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              {asideEyebrow}
            </p>
            <h2
              className="urban-app-display"
              style={{
                margin: 0,
                maxWidth: 520,
                color: "#fff",
                fontSize: "clamp(56px, 7vw, 104px)",
                lineHeight: 0.9,
                fontWeight: 400,
                letterSpacing: 0,
                textTransform: "uppercase",
              }}
            >
              {asideTitle}
            </h2>
            <p
              style={{
                margin: "28px 0 0",
                maxWidth: 420,
                color: "rgba(255,255,255,0.68)",
                fontSize: 16,
                lineHeight: 1.65,
              }}
            >
              {asideSubtitle}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 24,
              borderTop: "1px solid rgba(255,255,255,0.12)",
              paddingTop: 20,
              color: "rgba(255,255,255,0.46)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            <span>Beta privado</span>
            <span>Sao Paulo</span>
          </div>
        </div>
      </section>

      <section
        data-auth-content
        style={{
          minWidth: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 520 }}>
          <div data-auth-mobile-brand style={{ display: "none", marginBottom: 28 }}>
            <BrandMark />
          </div>

          <p className="urban-app-eyebrow" style={{ marginBottom: 12 }}>
            {eyebrow}
          </p>
          <h1
            className="urban-app-display-md"
            style={{
              maxWidth: 520,
              letterSpacing: 0,
              textTransform: "uppercase",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                margin: "14px 0 28px",
                maxWidth: 480,
                color: "var(--app-text-muted)",
                fontSize: 14,
                lineHeight: 1.65,
              }}
            >
              {subtitle}
            </p>
          )}

          {children}
        </div>
      </section>

      <style>{`
        @media (max-width: 899px) {
          .urban-app[data-auth-shell] {
            grid-template-columns: 1fr !important;
          }

          .urban-app[data-auth-shell] [data-auth-aside] {
            display: none !important;
          }

          .urban-app[data-auth-shell] [data-auth-mobile-brand] {
            display: flex !important;
          }

          .urban-app[data-auth-shell] [data-auth-content] {
            padding: 32px 16px !important;
          }
        }
      `}</style>
    </main>
  );
}

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span
        className="urban-app-display"
        style={{
          color: inverse ? "#fff" : "var(--app-text)",
          fontSize: 28,
          lineHeight: 1,
          fontWeight: 400,
          letterSpacing: 0,
          textTransform: "uppercase",
        }}
      >
        Urban
      </span>
      <span
        className="urban-app-display"
        style={{
          color: inverse ? "#E8500A" : "var(--app-accent)",
          fontSize: 28,
          lineHeight: 1,
          fontWeight: 400,
          letterSpacing: 0,
          textTransform: "uppercase",
        }}
      >
        AI
      </span>
    </div>
  );
}
