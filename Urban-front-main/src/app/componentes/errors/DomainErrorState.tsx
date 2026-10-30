"use client";

import { useEffect } from "react";
import { recoverFromKeyboard } from "./error-recovery";
import styles from "./DomainErrorState.module.css";

export type ErrorDomain = "public" | "host" | "admin";

const content: Record<
  ErrorDomain,
  { eyebrow: string; title: string; body: string; homeHref: string; homeLabel: string }
> = {
  public: {
    eyebrow: "NÃO FOI POSSÍVEL CARREGAR",
    title: "Vamos tentar novamente?",
    body: "Esta página encontrou uma falha temporária. Tente recarregar o conteúdo ou volte ao início.",
    homeHref: "/",
    homeLabel: "Voltar ao início",
  },
  host: {
    eyebrow: "SUA OPERAÇÃO ESTÁ SEGURA",
    title: "Não conseguimos carregar esta área.",
    body: "Os seus dados não foram alterados. Tente novamente ou retorne ao dashboard para continuar.",
    homeHref: "/dashboard",
    homeLabel: "Ir ao dashboard",
  },
  admin: {
    eyebrow: "FALHA OPERACIONAL",
    title: "Esta seção do admin não respondeu.",
    body: "Nenhuma ação foi aplicada. Tente novamente ou volte à visão geral para seguir com a operação.",
    homeHref: "/admin",
    homeLabel: "Voltar ao admin",
  },
};

export function DomainErrorState({
  domain,
  error,
  reset,
}: {
  domain: ErrorDomain;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const copy = content[domain];

  useEffect(() => {
    console.error(`[urban-ai:${domain}] route error`, error);
  }, [domain, error]);

  return (
    <div
      data-error-domain={domain}
      role="alert"
      aria-live="assertive"
      className={`${styles.root} ${styles[domain]}`}
    >
      <section
        aria-labelledby={`${domain}-error-title`}
        className={`${styles.panel} ${domain === "admin" ? styles.panelStart : ""}`}
      >
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 id={`${domain}-error-title`} className={styles.title}>
          {copy.title}
        </h1>
        <p className={styles.body}>{copy.body}</p>
        {error.digest && <p className={styles.reference}>Referência: {error.digest}</p>}
        <div className={`${styles.actions} ${domain === "admin" ? styles.actionsStart : ""}`}>
          <button
            className={`urban-domain-error-action ${styles.retryButton}`}
            type="button"
            autoFocus
            onClick={reset}
            onKeyDown={(event) => recoverFromKeyboard(event, reset)}
          >
            Tentar novamente
          </button>
          <a
            className={`urban-domain-error-action ${styles.homeLink}`}
            href={copy.homeHref}
          >
            {copy.homeLabel}
          </a>
        </div>
      </section>
      <style jsx>{`
        .urban-domain-error-action:focus-visible {
          outline: 3px solid var(--err-accent);
          outline-offset: 4px;
        }
      `}</style>
    </div>
  );
}
