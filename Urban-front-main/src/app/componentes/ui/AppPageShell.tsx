"use client";

import React from "react";
import { appVar } from "./styles";

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
}: {
  children: React.ReactNode;
  maxWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="urban-app"
      style={{
        background: appVar.bg,
        minHeight: "100%",
        width: "100%",
      }}
    >
      <div
        className="urban-app-shell-inner"
        style={{
          maxWidth,
          margin: "0 auto",
          padding: "40px 32px 80px",
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
