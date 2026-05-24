"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  isThemePreference,
  resolveThemePreference,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./constants";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(THEME_MEDIA_QUERY).matches;
}

function getInitialPreference(): ThemePreference {
  if (typeof document !== "undefined") {
    const current = document.documentElement.dataset.themePreference;
    if (isThemePreference(current)) return current;
  }

  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemePreference(stored)) return stored;
    } catch {
      return "system";
    }
  }

  return "system";
}

function getInitialResolved(preference: ThemePreference): ResolvedTheme {
  if (typeof document !== "undefined") {
    const current = document.documentElement.dataset.theme;
    if (current === "light" || current === "dark") return current;
  }
  return resolveThemePreference(preference, getSystemDark());
}

function writeTheme(preference: ThemePreference, resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved;

  const meta =
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-urban-runtime-theme]') ??
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = resolved === "dark" ? "#080A0F" : "#FAFAFB";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    getInitialPreference(),
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    getInitialResolved(getInitialPreference()),
  );

  const applyPreference = useCallback((nextPreference: ThemePreference) => {
    const nextResolved = resolveThemePreference(nextPreference, getSystemDark());
    setPreference(nextPreference);
    setResolvedTheme(nextResolved);
    writeTheme(nextPreference, nextResolved);
  }, []);

  useEffect(() => {
    applyPreference(preference);

    const media = window.matchMedia?.(THEME_MEDIA_QUERY);
    const handleSystemChange = () => {
      if (preference !== "system") return;
      applyPreference("system");
    };
    media?.addEventListener("change", handleSystemChange);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = isThemePreference(event.newValue) ? event.newValue : "system";
      applyPreference(next);
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      media?.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [applyPreference, preference]);

  const setTheme = useCallback((nextPreference: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    } catch {
      // Keep theme usable in private browsing or restricted storage contexts.
    }
    applyPreference(nextPreference);
  }, [applyPreference]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setTheme }),
    [preference, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
