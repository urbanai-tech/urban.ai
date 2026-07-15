import { lazy, Suspense } from "react";
import { useSquadSocket } from "@/hooks/useSquadSocket";
import { SquadSelector } from "@/components/SquadSelector";
import { StatusBar } from "@/components/StatusBar";
import { useTheme } from "@/theme/useTheme";

const PhaserGame = lazy(() =>
  import("@/office/PhaserGame").then((module) => ({ default: module.PhaserGame })),
);

export function App() {
  useSquadSocket();
  const theme = useTheme();

  return (
    <div
      data-theme={theme.resolvedTheme}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          height: 40,
          minHeight: 40,
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-sidebar)",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.5,
          color: "var(--text-primary)",
          justifyContent: "space-between",
        }}
      >
        <span>opensquad Dashboard</span>
        <button
          type="button"
          onClick={theme.toggleMode}
          title={`Theme: ${theme.mode}. Switch to ${theme.nextMode}.`}
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-primary)",
            color: "var(--text-secondary)",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1,
            padding: "6px 8px",
            textTransform: "uppercase",
          }}
        >
          {theme.mode}
        </button>
      </header>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <SquadSelector />
        <Suspense
          fallback={
            <div
              role="status"
              aria-live="polite"
              style={{
                flex: 1,
                display: "grid",
                placeItems: "center",
                color: "var(--text-secondary)",
                background: "var(--bg-primary)",
                fontSize: 12,
              }}
            >
              Carregando ambiente visual…
            </div>
          }
        >
          <PhaserGame theme={theme.resolvedTheme} />
        </Suspense>
      </div>

      {/* Footer */}
      <StatusBar />
    </div>
  );
}
