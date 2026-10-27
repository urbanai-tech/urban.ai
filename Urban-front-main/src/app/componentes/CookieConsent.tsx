"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "./useConsent";
import { DialogSurface } from "./ui/DialogSurface";

export function CookieConsent() {
  const { undecided, acceptAll, rejectAll, setPreferences, state } = useConsent();
  const pathname = usePathname() || "";
  const bannerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hasHostBottomNav, setHasHostBottomNav] = useState(false);
  const [analyticsPref, setAnalyticsPref] = useState(state.analytics);
  const [marketingPref, setMarketingPref] = useState(state.marketing);
  // O banner nasce invisível e só aparece quando as fontes que ele usa já
  // carregaram: a troca de fonte (swap) mudava a altura do banner fixo e virava
  // layout shift (CLS) nas páginas públicas.
  const [fontsSettled, setFontsSettled] = useState(false);
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    if (!undecided) return;

    const root = document.documentElement;
    const banner = bannerRef.current;
    const updateLayoutReservation = () => {
      const hostNavVisible = Boolean(
        document.querySelector<HTMLElement>("[data-host-bottom-nav]") &&
          window.matchMedia("(max-width: 767px)").matches,
      );
      setHasHostBottomNav(hostNavVisible);
      const bannerHeight = banner?.getBoundingClientRect().height ?? 0;
      const navigationOffset = hostNavVisible ? 64 : 0;
      root.style.setProperty(
        "--urban-cookie-consent-space",
        `${Math.ceil(bannerHeight + navigationOffset + 16)}px`,
      );
    };

    root.dataset.cookieConsentOpen = "true";
    updateLayoutReservation();
    const observer = banner ? new ResizeObserver(updateLayoutReservation) : null;
    if (banner) observer?.observe(banner);
    window.addEventListener("resize", updateLayoutReservation);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateLayoutReservation);
      delete root.dataset.cookieConsentOpen;
      root.style.removeProperty("--urban-cookie-consent-space");
    };
  }, [pathname, undecided]);

  useEffect(() => {
    if (!undecided || fontsSettled) return;
    let cancelled = false;
    const show = () => {
      if (!cancelled) setFontsSettled(true);
    };
    const timer = window.setTimeout(show, 3000);
    // Medir força o layout do texto do banner, o que dispara o download dos
    // pesos que ele usa; document.fonts.ready resolve quando todos chegarem.
    bannerRef.current?.getBoundingClientRect();
    if (document.fonts?.ready) document.fonts.ready.then(show, show);
    else show();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [undecided, fontsSettled]);

  if (!undecided) return null;

  return (
    <>
      <div
        ref={bannerRef}
        data-cookie-consent-banner
        data-cookie-surface={isAdmin ? "admin" : hasHostBottomNav ? "host-mobile" : "default"}
        role="region"
        aria-label="Consentimento de cookies"
        style={{
          position: "fixed",
          right: 24,
          bottom: hasHostBottomNav ? "calc(72px + env(safe-area-inset-bottom))" : 24,
          zIndex: 9999,
          visibility: fontsSettled ? "visible" : "hidden",
          maxWidth: 390,
          padding: 16,
          borderRadius: 8,
          border: "1px solid var(--theme-app-divider-strong)",
          background: "var(--theme-app-sheet-bg)",
          color: "var(--theme-app-text)",
          boxShadow: "var(--theme-app-shadow-overlay)",
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ flex: 1, color: "var(--theme-app-text-muted)", fontSize: 12 }}>
            <p style={{ margin: "0 0 4px", color: "var(--theme-app-text)", fontWeight: 700 }}>
              Privacidade e cookies
            </p>
            <p style={{ margin: 0, lineHeight: 1.55 }}>
              Usamos cookies essenciais para o funcionamento da plataforma e, com seu
              consentimento, cookies opcionais de analytics e marketing para entender o
              uso e melhorar o produto. Veja detalhes na{" "}
              <a
                href="/privacidade"
                style={{ color: "var(--theme-app-accent)", textDecoration: "underline", textUnderlineOffset: 2 }}
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
            background: "var(--theme-app-backdrop)",
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <DialogSurface
            onClose={() => setIsOpen(false)}
            aria-labelledby="cookie-preferences-title"
            style={{
              width: "100%",
              maxWidth: 520,
              borderRadius: 12,
              background: "var(--theme-app-sheet-bg)",
              color: "var(--theme-app-text)",
              boxShadow: "var(--theme-app-shadow-overlay)",
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
                borderBottom: "1px solid var(--theme-app-divider)",
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
                description="Necessarios para login, segurança e funcionamento básico. Não podem ser desativados."
                checked
                disabled
              />
              <CookieToggle
                label="Analytics"
                description="Google Analytics 4 para entender quais funcionalidades são usadas e priorizar melhorias. IP anonimizado."
                checked={analyticsPref}
                onChange={setAnalyticsPref}
              />
              <CookieToggle
                label="Marketing"
                description="Meta Pixel para medir eficácia de campanhas e oferecer conteúdo relevante em redes sociais."
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
                borderTop: "1px solid var(--theme-app-divider)",
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
          </DialogSurface>
        </div>
      )}

      <style>{`
        html[data-cookie-consent-open="true"] body {
          padding-bottom: var(--urban-cookie-consent-space, 0px);
        }
        @media (max-width: 767px) {
          [data-cookie-consent-banner] {
            left: 0 !important;
            right: 0 !important;
            max-width: none !important;
            border-radius: 0 !important;
            padding: 12px !important;
          }
          [data-cookie-surface="default"] {
            bottom: env(safe-area-inset-bottom) !important;
            max-height: calc(100dvh - env(safe-area-inset-bottom) - 16px) !important;
          }
          [data-cookie-surface="host-mobile"] {
            bottom: calc(64px + env(safe-area-inset-bottom)) !important;
            /* Nunca passa do topo da tela: rola por dentro quando a tela é baixa. */
            max-height: calc(100dvh - 64px - env(safe-area-inset-bottom) - 16px) !important;
          }
          [data-cookie-surface="admin"] {
            bottom: env(safe-area-inset-bottom) !important;
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
          style={{ width: 18, height: 18, accentColor: "var(--brand-teal)" }}
        />
      </label>
      <p style={{ margin: "6px 0 0", color: "var(--theme-app-text-muted)", fontSize: 13, lineHeight: 1.5 }}>
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
    return { ...base, background: "var(--theme-app-accent)", color: "var(--theme-app-accent-contrast)", border: "1px solid var(--theme-app-accent)" };
  }
  if (variant === "outline") {
    return {
      ...base,
      background: "transparent",
      color: "var(--theme-app-text)",
      border: "1px solid var(--theme-app-divider-strong)",
    };
  }
  if (variant === "ghost") {
    return {
      ...base,
      background: "transparent",
      color: "var(--theme-app-text-muted)",
      border: "1px solid transparent",
    };
  }
  if (variant === "save") {
    return { ...base, background: "var(--theme-app-accent)", color: "var(--theme-app-accent-contrast)", border: "1px solid var(--theme-app-accent)" };
  }
  return { ...base, background: "transparent", color: "var(--theme-app-text)", border: "1px solid transparent" };
}

const iconButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "1px solid var(--theme-app-divider-strong)",
  borderRadius: 8,
  background: "transparent",
  color: "var(--theme-app-text)",
  cursor: "pointer",
};
