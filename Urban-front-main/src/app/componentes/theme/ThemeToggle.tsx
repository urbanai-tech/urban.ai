"use client";

import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_OPTIONS, type ThemePreference } from "./constants";
import { useTheme } from "./ThemeProvider";

const iconFor: Record<ThemePreference, React.ReactNode> = {
  system: <Monitor size={14} aria-hidden />,
  light: <Sun size={14} aria-hidden />,
  dark: <Moon size={14} aria-hidden />,
};

export function ThemeToggle({
  compact = false,
  style,
}: {
  compact?: boolean;
  style?: React.CSSProperties;
}) {
  const { preference, setTheme, resolvedTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label={`Tema visual atual: ${resolvedTheme === "dark" ? "escuro" : "claro"}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        minWidth: 0,
        maxWidth: "100%",
        padding: 3,
        borderRadius: 999,
        border:
          "1px solid var(--theme-toggle-border, var(--app-divider-strong, var(--admin-divider-strong, rgba(127, 127, 127, 0.24))))",
        background:
          "var(--theme-toggle-bg, var(--app-surface-elevated, var(--admin-surface-elevated, rgba(255, 255, 255, 0.04))))",
        color:
          "var(--theme-toggle-muted, var(--app-text-muted, var(--admin-text-muted, currentColor)))",
        boxShadow: "var(--theme-toggle-shadow, none)",
        ...style,
      }}
    >
      {THEME_OPTIONS.map((option) => {
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={option.label}
            onClick={() => setTheme(option.value)}
            style={{
              height: compact ? 28 : 30,
              flex: compact ? "0 0 auto" : "1 1 0",
              minWidth: compact ? 28 : 0,
              padding: compact ? "0 7px" : "0 8px",
              border: "none",
              borderRadius: 999,
              background: active
                ? "var(--theme-toggle-active-bg, var(--app-accent-soft, var(--admin-accent-soft, rgba(232, 80, 10, 0.14))))"
                : "transparent",
              color: active
                ? "var(--theme-toggle-active-text, var(--app-accent, var(--admin-accent, #E8500A)))"
                : "inherit",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              cursor: "pointer",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 11,
              fontWeight: active ? 700 : 600,
              letterSpacing: 0,
              lineHeight: 1,
              transition: "background 120ms, color 120ms",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {iconFor[option.value]}
            {!compact && (
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {option.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
