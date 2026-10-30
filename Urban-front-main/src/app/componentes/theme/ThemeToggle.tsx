"use client";

import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_OPTIONS, type ThemePreference } from "./constants";
import { useTheme } from "./ThemeProvider";
import styles from "./ThemeToggle.module.css";

const iconFor: Record<ThemePreference, React.ReactNode> = {
  system: <Monitor size={14} aria-hidden />,
  light: <Sun size={14} aria-hidden />,
  dark: <Moon size={14} aria-hidden />,
};

export function ThemeToggle({
  compact = false,
  showLabels = !compact,
  style,
}: {
  compact?: boolean;
  showLabels?: boolean;
  style?: React.CSSProperties;
}) {
  const { preference, setTheme, resolvedTheme, isHydrated } = useTheme();

  return (
    <div
      role="group"
      aria-label={`Tema visual atual: ${resolvedTheme === "dark" ? "escuro" : "claro"}`}
      className={styles.toggleGroup}
      style={{
        border:
          "1px solid var(--theme-toggle-border, var(--app-divider-strong, var(--admin-divider-strong, rgba(127, 127, 127, 0.24))))",
        background:
          "var(--theme-toggle-bg, var(--app-surface-elevated, var(--admin-surface-elevated, rgba(255, 255, 255, 0.04))))",
        ...style,
      }}
    >
      {THEME_OPTIONS.map((option) => {
        const active = preference === option.value;
        const labelsVisible = showLabels && !compact;
        return (
          <button
            key={option.value}
            type="button"
            disabled={!isHydrated}
            aria-pressed={active}
            aria-label={`Usar tema ${option.label.toLowerCase()}`}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={[
              styles.toggleButton,
              compact && styles.toggleButtonCompact,
              labelsVisible && styles.toggleButtonLabels,
              active && styles.toggleButtonActive,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {iconFor[option.value]}
            {labelsVisible && (
              <span className={styles.toggleLabel}>{option.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
