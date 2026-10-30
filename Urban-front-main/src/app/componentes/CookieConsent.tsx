"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "./useConsent";
import { DialogSurface } from "./ui/DialogSurface";
import styles from "./CookieConsent.module.css";

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
        className={[
          styles.cookieBanner,
          hasHostBottomNav ? styles.cookieBannerHostNav : "",
          fontsSettled ? "" : styles.cookieBannerHidden,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.cookieBannerBody}>
          <div className={styles.cookieBannerCopy}>
            <p className={styles.cookieBannerTitle}>
              Privacidade e cookies
            </p>
            <p className={styles.cookieBannerText}>
              Usamos cookies essenciais para o funcionamento da plataforma e, com seu
              consentimento, cookies opcionais de analytics e marketing para entender o
              uso e melhorar o produto. Veja detalhes na{" "}
              <a
                href="/privacidade"
                className={styles.cookieBannerLink}
              >
                Politica de Privacidade
              </a>.
            </p>
          </div>

          <div className={styles.cookieButtonRow}>
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
          className={styles.preferencesBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <DialogSurface
            onClose={() => setIsOpen(false)}
            aria-labelledby="cookie-preferences-title"
            className={styles.preferencesDialog}
          >
            <header className={styles.preferencesHeader}>
              <h2 id="cookie-preferences-title" className={styles.preferencesTitle}>
                Preferencias de cookies
              </h2>
              <button
                type="button"
                aria-label="Fechar preferencias"
                onClick={() => setIsOpen(false)}
                className={styles.iconButton}
              >
                x
              </button>
            </header>

            <div className={styles.preferencesBody}>
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

            <footer className={styles.preferencesFooter}>
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
    <button type="button" onClick={onClick} className={buttonClassName(variant)}>
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
      <label className={styles.toggleLabel}>
        <span>{label}</span>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked)}
          className={styles.toggleInput}
        />
      </label>
      <p className={styles.toggleDescription}>
        {description}
      </p>
    </div>
  );
}

function buttonClassName(variant: "ghost" | "outline" | "primary" | "light" | "save"): string {
  if (variant === "primary" || variant === "save") {
    return `${styles.cookieButton} ${styles.cookieButtonPrimary}`;
  }
  if (variant === "outline") return `${styles.cookieButton} ${styles.cookieButtonOutline}`;
  if (variant === "ghost") return `${styles.cookieButton} ${styles.cookieButtonGhost}`;
  return styles.cookieButton;
}
