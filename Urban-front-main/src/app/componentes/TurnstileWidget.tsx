"use client";

import { useCallback, useEffect, useRef } from "react";
import Script from "next/script";
import styles from "./TurnstileWidget.module.css";

/**
 * Site key pública do Cloudflare Turnstile. Vazia = captcha desligado: nenhum
 * script é carregado e nenhum widget é renderizado (o backend também só exige o
 * token quando `TURNSTILE_SECRET_KEY` está definida).
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      language?: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Widget Turnstile. `onToken` recebe o token (ou `null` quando expira/erra).
 * Incrementar `resetKey` reinicia o desafio (o token é de uso único).
 */
export function TurnstileWidget({
  onToken,
  resetKey = 0,
}: {
  onToken: (token: string | null) => void;
  resetKey?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const renderWidget = useCallback(() => {
    const api = window.turnstile;
    const container = containerRef.current;
    if (!api || !container || widgetIdRef.current !== null) return;
    widgetIdRef.current = api.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "auto",
      language: "pt-br",
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    });
  }, []);

  useEffect(() => {
    // O script pode já estar carregado (outra instância, navegação client-side).
    renderWidget();
    return () => {
      if (widgetIdRef.current !== null) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  useEffect(() => {
    if (resetKey > 0 && widgetIdRef.current !== null) {
      window.turnstile?.reset(widgetIdRef.current);
      onTokenRef.current(null);
    }
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <>
      <Script src={TURNSTILE_SCRIPT_SRC} strategy="lazyOnload" onReady={renderWidget} />
      <div ref={containerRef} className={styles.container} />
    </>
  );
}
