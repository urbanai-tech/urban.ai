"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "../../service/api";
import { decideAdminGate } from "../../lib/admin-gate";

type GateState = "checking" | "allowed" | "retry";

/**
 * Gate de papel para /admin/*: só monta o shell administrativo depois de
 * confirmar `role === "admin"` em GET /auth/me (mesma fonte do SideBar).
 * Não-admin vai para /forbidden antes de qualquer shell/consulta admin.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "/admin";
  const [state, setState] = useState<GateState>("checking");

  const check = useCallback(async () => {
    setState("checking");
    let decision;
    try {
      const { data } = await api.get("/auth/me");
      decision = decideAdminGate({ ok: true, role: data?.role });
    } catch (error) {
      decision = decideAdminGate({
        ok: false,
        status: (error as { response?: { status?: number } })?.response?.status ?? null,
      });
    }

    if (decision.kind === "allow") setState("allowed");
    else if (decision.kind === "forbidden") router.replace(`/forbidden?from=${encodeURIComponent(pathname)}`);
    else if (decision.kind === "login") router.replace(`/?next=${encodeURIComponent(pathname)}`);
    else setState("retry");
  }, [router, pathname]);

  useEffect(() => {
    void check();
    // Verifica uma vez por montagem do layout admin (navegar entre páginas admin não remonta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "allowed") return <>{children}</>;

  if (state === "retry") {
    return (
      <div role="alert" className="funnel-gate">
        <div>
          <p>Não conseguimos confirmar seu acesso agora. Tente novamente.</p>
          <button type="button" onClick={() => void check()}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="funnel-gate">
      Verificando acesso…
    </div>
  );
}
