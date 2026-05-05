"use client";

import { useEffect, useState } from "react";
import { fetchPublicConfig, type PublicConfig } from "../service/api";

/**
 * Hook que carrega `/public-config` do backend e expõe se a aplicação está
 * em modo pré-lançamento (F8).
 *
 * Estados:
 *  - loading=true: ainda buscando config (componentes podem mostrar skeleton)
 *  - loading=false + prelaunch=true: gating ativo, /create vira waitlist
 *  - loading=false + prelaunch=false: comportamento normal de produto
 *  - error: usa fallback `NEXT_PUBLIC_PRELAUNCH_MODE` (build-time)
 *
 * Por que dynamic do server (em vez de só build-time env)?
 *   Pra Gustavo poder ligar/desligar o gating no Railway sem novo build do
 *   front. Mudança fica visível na próxima navegação dos clients.
 */
export function usePrelaunch() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicConfig()
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          // Fallback build-time. Funciona pra dev local enquanto backend
          // está fora do ar.
          const buildFlag = process.env.NEXT_PUBLIC_PRELAUNCH_MODE === "true";
          setConfig({
            prelaunchMode: buildFlag,
            appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
            version: "fallback",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loading,
    error,
    prelaunchMode: config?.prelaunchMode ?? false,
    appEnv: config?.appEnv ?? "development",
    version: config?.version ?? "unknown",
  };
}
