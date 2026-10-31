"use client";

import React, { useRef } from "react";
import styles from "./AdminTabs.module.css";

export interface AdminTabItem<T extends string> {
  id: T;
  label: string;
}

/** ids estáveis para ligar a aba ao seu painel (aria-controls / aria-labelledby). */
export const adminTabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const adminPanelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/**
 * Abas do admin (padrão WAI-ARIA tabs): `tablist` com tabulação em "roving tabindex", setas
 * esquerda/direita, Home e End trocam a aba ativa. O painel fica a cargo de quem usa, com
 * `<AdminTabPanel>`.
 */
export function AdminTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
}: {
  tabs: Array<AdminTabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusTab(index: number) {
    const next = (index + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(tabs.length - 1);
    }
  }

  return (
    <div role="tablist" aria-label={label} className={styles.list}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={adminTabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={adminPanelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminTabPanel({
  idPrefix,
  tabId,
  children,
}: {
  idPrefix: string;
  tabId: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={adminPanelId(idPrefix, tabId)}
      aria-labelledby={adminTabId(idPrefix, tabId)}
      tabIndex={0}
      className={styles.panel}
    >
      {children}
    </div>
  );
}
