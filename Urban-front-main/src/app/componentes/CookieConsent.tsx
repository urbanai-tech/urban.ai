"use client";

import React, { useState } from "react";
import { useConsent } from "./useConsent";

export function CookieConsent() {
  const { undecided, acceptAll, rejectAll, setPreferences, state } = useConsent();
  const [isOpen, setIsOpen] = useState(false);
  const [analyticsPref, setAnalyticsPref] = useState(state.analytics);
  const [marketingPref, setMarketingPref] = useState(state.marketing);

  if (!undecided) return null;

  return (
    <>
      <div
        role="region"
        aria-label="Consentimento de cookies"
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 9999,
          maxWidth: 390,
          padding: 16,
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.16)",
          background: "#080A0F",
          color: "#fff",
          boxShadow: "0 18px 50px rgba(0,0,0,0.38)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ flex: 1, color: "rgba(255,255,255,0.70)", fontSize: 12 }}>
            <p style={{ margin: "0 0 4px", color: "#fff", fontWeight: 700 }}>
              Privacidade e cookies
            </p>
            <p style={{ margin: 0, lineHeight: 1.55 }}>
              Usamos cookies essenciais para o funcionamento da plataforma e, com seu
              consentimento, cookies opcionais de analytics e marketing para entender o
              uso e melhorar o produto. Veja detalhes na{" "}
              <a
                href="/privacidade"
                style={{ color: "#FF8A4C", textDecoration: "underline", textUnderlineOffset: 2 }}
              >
                Politica de Privacidade
              </a>.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <CookieButton
              variant="ghost"
              onClick={() => {
                setAnalyticsPref(state.analytics);
                setMarketingPref(state.marketing);
                setIsOpen(true);
              }}
            >
              Personalizar
            </CookieButton>
            <CookieButton variant="outline" onClick={rejectAll}>
              Apenas essenciais
            </CookieButton>
            <CookieButton variant="primary" onClick={acceptAll}>
              Aceitar todos
            </CookieButton>
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgba(8,10,15,0.52)",
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-preferences-title"
            style={{
              width: "100%",
              maxWidth: 520,
              borderRadius: 12,
              background: "#fff",
              color: "#0E1116",
              boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
              overflow: "hidden",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "20px 22px",
                borderBottom: "1px solid rgba(14,17,22,0.10)",
              }}
            >
              <h2 id="cookie-preferences-title" style={{ margin: 0, fontSize: 18 }}>
                Preferencias de cookies
              </h2>
              <button
                type="button"
                aria-label="Fechar preferencias"
                onClick={() => setIsOpen(false)}
                style={iconButtonStyle}
              >
                x
              </button>
            </header>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 22 }}>
              <CookieToggle
                label="Essenciais"
                description="Necessarios para login, seguranca e funcionamento basico. Nao podem ser desativados."
                checked
                disabled
              />
              <CookieToggle
                label="Analytics"
                description="Google Analytics 4 para entender quais funcionalidades sao usadas e priorizar melhorias. IP anonimizado."
                checked={analyticsPref}
                onChange={setAnalyticsPref}
              />
              <CookieToggle
                label="Marketing"
                description="Meta Pixel para medir eficacia de campanhas e oferecer conteudo relevante em redes sociais."
                checked={marketingPref}
                onChange={setMarketingPref}
              />
            </div>

            <footer
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                padding: "16px 22px",
                borderTop: "1px solid rgba(14,17,22,0.10)",
              }}
            >
              <CookieButton variant="light" onClick={() => setIsOpen(false)}>
                Cancelar
              </CookieButton>
              <CookieButton
                variant="save"
                onClick={() => {
                  setPreferences({
                    analytics: analyticsPref,
                    marketing: marketingPref,
                  });
                  setIsOpen(false);
                }}
              >
                Salvar preferencias
              </CookieButton>
            </footer>
          </section>
        </div>
      )}

      <style>{`
        @media (max-width: 767px) {
          [aria-label="Consentimento de cookies"] {
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            max-width: none !important;
            border-radius: 0 !important;
            padding: 12px !important;
          }
        }
      `}</style>
    </>
  );
}

function CookieButton({
  variant,
  onClick,
  children,
}: {
  variant: "ghost" | "outline" | "primary" | "light" | "save";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} style={buttonStyle(variant)}>
      {children}
    </button>
  );
}

function CookieToggle({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          fontWeight: 700,
        }}
      >
        <span>{label}</span>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked)}
          style={{ width: 18, height: 18, accentColor: "#E8500A" }}
        />
      </label>
      <p style={{ margin: "6px 0 0", color: "rgba(14,17,22,0.62)", fontSize: 13, lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  );
}

function buttonStyle(variant: "ghost" | "outline" | "primary" | "light" | "save"): React.CSSProperties {
  const base: React.CSSProperties = {
    minHeight: 32,
    padding: "0 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 650,
    cursor: "pointer",
  };

  if (variant === "primary") {
    return { ...base, background: "#E8500A", color: "#080A0F", border: "1px solid #E8500A" };
  }
  if (variant === "outline") {
    return {
      ...base,
      background: "transparent",
      color: "#fff",
      border: "1px solid rgba(255,255,255,0.24)",
    };
  }
  if (variant === "ghost") {
    return {
      ...base,
      background: "transparent",
      color: "rgba(255,255,255,0.82)",
      border: "1px solid transparent",
    };
  }
  if (variant === "save") {
    return { ...base, background: "#0E1116", color: "#fff", border: "1px solid #0E1116" };
  }
  return { ...base, background: "transparent", color: "#0E1116", border: "1px solid transparent" };
}

const iconButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "1px solid rgba(14,17,22,0.12)",
  borderRadius: 8,
  background: "#fff",
  color: "#0E1116",
  cursor: "pointer",
};
