"use client";

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
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: "#f59e0b",
        color: "#1f2937",
        textAlign: "center",
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.05em",
        padding: "4px 12px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {label} · dados aqui não são reais · não compartilhar com clientes
    </div>
  );
}
