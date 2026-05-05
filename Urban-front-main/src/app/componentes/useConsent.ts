"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Hook de consentimento para cookies / telemetria — alinhado à LGPD.
 *
 * Modelo: 3 categorias.
 *  - essential: SEMPRE true (cookies de sessão/CSRF/auth — sem eles nada
 *    funciona, dispensam consentimento).
 *  - analytics: GA4. Default: false. Só carrega se usuário disse sim.
 *  - marketing: Meta Pixel + retargeting. Default: false.
 *
 * Persistência: localStorage. Chave única `urban-ai-consent-v1` para que
 * mudanças futuras de schema possam invalidar versões antigas (bumping pra
 * v2 força novo banner).
 *
 * O hook expõe `loaded` para que componentes esperem antes de tomar decisão
 * (evita FOUC do banner em users que já consentiram).
 */
export type ConsentCategory = "essential" | "analytics" | "marketing";

export interface ConsentState {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  /** Timestamp ISO da última decisão. Útil para auditoria LGPD. */
  decidedAt: string | null;
  /** Versão do schema deste consent (incrementar quando categorias mudarem). */
  version: 1;
}

const STORAGE_KEY = "urban-ai-consent-v1";
const SCHEMA_VERSION = 1 as const;

const DEFAULT_STATE: ConsentState = {
  essential: true,
  analytics: false,
  marketing: false,
  decidedAt: null,
  version: SCHEMA_VERSION,
};

export function useConsent() {
  const [state, setState] = useState<ConsentState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);

  // Carrega do localStorage uma vez no client. SSR sempre cai no default.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ConsentState;
        if (parsed && parsed.version === SCHEMA_VERSION) {
          setState({
            essential: true,
            analytics: !!parsed.analytics,
            marketing: !!parsed.marketing,
            decidedAt: parsed.decidedAt ?? null,
            version: SCHEMA_VERSION,
          });
        }
      }
    } catch (_err) {
      // localStorage indisponível (modo privado iOS, e.g.) — segue com default.
    } finally {
      setLoaded(true);
    }
  }, []);

  const persist = useCallback((next: ConsentState) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // Notifica outras abas / componentes (Analytics.tsx escuta este event)
      window.dispatchEvent(new CustomEvent("urban-ai:consent-change", { detail: next }));
    } catch (_err) {
      // Silently ignore — sem persistência, o próximo refresh volta a perguntar
    }
  }, []);

  const acceptAll = useCallback(() => {
    persist({
      essential: true,
      analytics: true,
      marketing: true,
      decidedAt: new Date().toISOString(),
      version: SCHEMA_VERSION,
    });
  }, [persist]);

  const rejectAll = useCallback(() => {
    persist({
      essential: true,
      analytics: false,
      marketing: false,
      decidedAt: new Date().toISOString(),
      version: SCHEMA_VERSION,
    });
  }, [persist]);

  const setPreferences = useCallback(
    (input: { analytics: boolean; marketing: boolean }) => {
      persist({
        essential: true,
        analytics: input.analytics,
        marketing: input.marketing,
        decidedAt: new Date().toISOString(),
        version: SCHEMA_VERSION,
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_err) {}
    setState(DEFAULT_STATE);
    window.dispatchEvent(new CustomEvent("urban-ai:consent-change", { detail: DEFAULT_STATE }));
  }, []);

  /** True quando o usuário ainda não decidiu (devemos mostrar o banner). */
  const undecided = loaded && state.decidedAt === null;

  return {
    state,
    loaded,
    undecided,
    acceptAll,
    rejectAll,
    setPreferences,
    reset,
  };
}

/**
 * Helper SSR-safe pra ler o consent state SEM hook.
 * Útil em código que dispara fora do React tree (ex: instrumentação custom).
 */
export function readConsentSync(): ConsentState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed && parsed.version === SCHEMA_VERSION) {
      return {
        essential: true,
        analytics: !!parsed.analytics,
        marketing: !!parsed.marketing,
        decidedAt: parsed.decidedAt ?? null,
        version: SCHEMA_VERSION,
      };
    }
  } catch (_err) {}
  return DEFAULT_STATE;
}
