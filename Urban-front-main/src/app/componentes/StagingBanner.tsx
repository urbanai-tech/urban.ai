"use client";

import styles from "./StagingBanner.module.css";

/**
 * Banner fixo que só aparece fora de produção.
 * Lê NEXT_PUBLIC_APP_ENV; se for "staging", "development" ou qualquer valor
 * que não seja "production", renderiza uma faixa amarela no topo da página.
 * Evita confundir staging com produção durante testes manuais.
 */
export function StagingBanner() {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;

  if (!appEnv || appEnv === "production") {
    return null;
  }

  const label = appEnv.toUpperCase();

  return (
    <div
      role="status"
      aria-label={`Ambiente ${label}`}
      className={styles.stagingBanner}
      style={{ backgroundColor: "#f59e0b", color: "#1f2937" }}
    >
      {label} · dados aqui não são reais · não compartilhar com clientes
    </div>
  );
}
