"use client";

import { useEffect, useState } from "react";
import { getProfileById } from "@/app/service/api/auth";

/**
 * O anfitrião está no modo automático (Stays)? Aproximação no nível do usuário
 * (`operationMode === "auto"`): o modo efetivo por imóvel (herdar/automático)
 * só é resolvido no backend. Na dúvida (erro, sem perfil) devolve `false`,
 * ou seja, o fluxo manual honesto em que o anfitrião aplica no Airbnb.
 * Uma única consulta por sessão de página, compartilhada entre os cards.
 */
let cached: Promise<boolean> | null = null;

function loadStaysAutoMode(): Promise<boolean> {
  cached ??= getProfileById()
    .then((profile) => profile?.operationMode === "auto")
    .catch(() => {
      cached = null;
      return false;
    });
  return cached;
}

export function useStaysAutoMode(override?: boolean): boolean {
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    if (override !== undefined) return;
    let active = true;
    loadStaysAutoMode().then((value) => {
      if (active) setAuto(value);
    });
    return () => {
      active = false;
    };
  }, [override]);

  return override ?? auto;
}
