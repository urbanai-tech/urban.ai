/**
 * Skeletons admin Urban AI — substitui as 11 strings cruas "Carregando…" das
 * telas admin antigas. Mostra esqueleto da estrutura final para reduzir
 * flicker em auto-refresh e contar pra UX percebida.
 *
 * Animação shimmer em globals.css `.urban-admin-skeleton`.
 */
import React from "react";

type Variant = "kpi" | "kpiHero" | "table" | "chart" | "card" | "text";

function Bar({
  width,
  height = 12,
  style,
}: {
  width: number | string;
  height?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="urban-admin-skeleton"
      style={{ width, height, ...style }}
    />
  );
}

export function AdminLoadingSkeleton({
  variant = "kpi",
  count = 1,
  columns,
  style,
}: {
  variant?: Variant;
  count?: number;
  columns?: number;
  style?: React.CSSProperties;
}) {
  if (variant === "kpiHero") {
    return (
      <div style={{ padding: "32px 0", ...style }}>
        <Bar width={120} height={11} />
        <div style={{ height: 20 }} />
        <Bar width={"60%"} height={72} />
        <div style={{ height: 12 }} />
        <Bar width={"35%"} height={12} />
      </div>
    );
  }

  if (variant === "kpi") {
    const cols = columns ?? Math.min(count, 4);
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
          gap: 32,
          ...style,
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 14, padding: "24px 0" }}>
            <Bar width={100} height={10} />
            <Bar width={"70%"} height={40} />
            <Bar width={"45%"} height={10} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "table") {
    const cols = columns ?? 5;
    return (
      <div style={style}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 16,
            paddingBottom: 12,
            borderBottom: "1px solid var(--admin-divider)",
          }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Bar key={i} width={"60%"} height={10} />
          ))}
        </div>
        {Array.from({ length: count }).map((_, r) => (
          <div
            key={r}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 16,
              padding: "16px 0",
              borderBottom: "1px solid var(--admin-divider)",
            }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Bar key={c} width={c === 0 ? "85%" : "60%"} height={14} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, ...style }}>
        <Bar width={180} height={11} />
        <Bar width={"100%"} height={160} style={{ marginTop: 8 }} />
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, ...style }}>
        <Bar width={"60%"} height={14} />
        <Bar width={"100%"} height={10} />
        <Bar width={"85%"} height={10} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, ...style }}>
      {Array.from({ length: count }).map((_, i) => (
        <Bar key={i} width={i % 2 === 0 ? "70%" : "55%"} height={12} />
      ))}
    </div>
  );
}

/**
 * Full-page loading state com header skeleton + bloco de KPIs + tabela.
 * Use em vez de `<p>Carregando…</p>` no topo de páginas admin.
 */
export function AdminPageLoading({
  showHeader = true,
  showKpis = true,
  showTable = true,
}: {
  showHeader?: boolean;
  showKpis?: boolean;
  showTable?: boolean;
}) {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      {showHeader && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            paddingBottom: 24,
            borderBottom: "1px solid var(--admin-divider)",
            marginBottom: 32,
          }}
        >
          <Bar width={100} height={10} />
          <Bar width={320} height={48} />
          <Bar width={420} height={12} />
        </div>
      )}
      {showKpis && <AdminLoadingSkeleton variant="kpi" count={4} columns={4} />}
      {showTable && (
        <div style={{ marginTop: 48 }}>
          <AdminLoadingSkeleton variant="table" count={6} columns={5} />
        </div>
      )}
    </div>
  );
}
