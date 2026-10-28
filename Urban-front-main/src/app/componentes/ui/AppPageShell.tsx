"use client";

import React from "react";
import styles from "./AppPageShell.module.css";

/**
 * Wrapper de página autenticada. Coloca a classe `.urban-app` no container
 * (ativa todos os tokens CSS variables) + max-width + padding consistente.
 *
 * Use no topo das paginas migradas pro novo design system:
 *   <AppPageShell>
 *     <AppSectionHeader ... />
 *     ...
 *   </AppPageShell>
 *
 * O layout de `app/<rota>/layout.tsx` continua sendo quem cria o Flex com
 * SideBar — esse shell só estiliza o conteúdo da página em si.
 */
export function AppPageShell({
  children,
  maxWidth = 1280,
  style,
  className,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  style?: React.CSSProperties;
  /** Classe extra aplicada ao container interno (o mesmo que recebe `style`). */
  className?: string;
}) {
  return (
    <div className={`urban-app ${styles.shell}`}>
      <div
        className={["urban-app-shell-inner", styles.inner, className].filter(Boolean).join(" ")}
        style={{ maxWidth, ...style }}
      >
        {children}
      </div>
    </div>
  );
}
