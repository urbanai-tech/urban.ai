"use client";

import { useEffect, useState } from "react";
import { OwnerReportView } from "../../componentes/OwnerReportView";
import { AppButton, AppEmptyState, AppPageShell, Icons } from "../../componentes/ui";
import { publicReportErrorMessage, type PublicOwnerReportResponse } from "../../lib/owner-report";
import styles from "./page.module.css";

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: PublicOwnerReportResponse }
  | { kind: "error"; status: number | null; code: string | null };

/**
 * Leitura pública do relatório. Usa `fetch` puro (sem cookies, sem o cliente axios do app): o
 * proprietário não tem conta, e uma resposta 401/403 nunca deve redirecionar para o login.
 * A busca é feita no navegador (e não no servidor) para a página nunca guardar dados em cache
 * de servidor e para o mock de API dos testes funcionar.
 */
export default function PublicOwnerReport({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
    setState({ kind: "loading" });
    fetch(`${base}/owner-reports/public/${encodeURIComponent(token)}`, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) {
          setState({ kind: "ready", data: (await response.json()) as PublicOwnerReportResponse });
          return;
        }
        const body = (await response.json().catch(() => null)) as { code?: string } | null;
        setState({ kind: "error", status: response.status, code: body?.code ?? null });
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === "AbortError") return;
        setState({ kind: "error", status: null, code: null });
      });
    return () => controller.abort();
  }, [token, attempt]);

  if (state.kind === "loading") {
    return (
      <AppPageShell maxWidth={920}>
        <main id="owner-report-main">
          <p role="status" className={styles.loading}>
            Abrindo o relatório…
          </p>
        </main>
      </AppPageShell>
    );
  }

  if (state.kind === "error") {
    const message = publicReportErrorMessage(state.status, state.code);
    const retryable = state.status === null || state.status >= 500 || state.status === 429;
    return (
      <AppPageShell maxWidth={920}>
        <main id="owner-report-main">
          <AppEmptyState
            headingAs="h1"
            eyebrow="RELATÓRIO MY URBAN"
            title={message.title}
            body={message.body}
            icon={<Icons.AlertCircle size={32} />}
            action={
              retryable ? (
                <AppButton variant="primary" onClick={() => setAttempt((value) => value + 1)}>
                  Tentar de novo
                </AppButton>
              ) : undefined
            }
          />
        </main>
      </AppPageShell>
    );
  }

  const { report, meta } = state.data;
  return (
    <AppPageShell maxWidth={920}>
      <div className={styles.actions}>
        <AppButton variant="secondary" size="sm" leftIcon={<Icons.FileText size={14} />} onClick={() => window.print()}>
          Imprimir ou salvar em PDF
        </AppButton>
      </div>
      <main id="owner-report-main">
        <OwnerReportView report={report} generatedAt={meta.generatedAt} expiresAt={meta.expiresAt} notice={meta.notice} />
      </main>
    </AppPageShell>
  );
}
