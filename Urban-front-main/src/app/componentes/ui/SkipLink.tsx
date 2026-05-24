"use client";

import React from "react";

/**
 * SkipLink — link "Pular para conteudo principal" invisivel ate receber foco.
 *
 * WCAG 2.4.1 (Bypass Blocks). Renderize logo apos a abertura do `<body>` ou no
 * topo do shell autenticado. O `targetId` precisa existir como `id=` num
 * elemento focavel ou tabindex=-1 (geralmente o `<main>` da pagina).
 *
 * Uso:
 *   <SkipLink />              // pula pra #main-content
 *   <SkipLink targetId="x" />  // pula pra #x
 */
export function SkipLink({ targetId = "main-content" }: { targetId?: string }) {
  const [focused, setFocused] = React.useState(false);

  return (
    <a
      href={`#${targetId}`}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        position: focused ? "absolute" : "fixed",
        top: focused ? 8 : 0,
        left: focused ? 8 : 0,
        zIndex: 9999,
        width: focused ? "auto" : 1,
        height: focused ? "auto" : 1,
        padding: focused ? "8px 16px" : 0,
        overflow: focused ? "visible" : "hidden",
        clip: focused ? "auto" : "rect(0 0 0 0)",
        whiteSpace: "nowrap",
        borderRadius: 6,
        background: "var(--app-accent)",
        color: "#FFFFFF",
        textDecoration: "none",
        fontSize: 14,
        fontWeight: 650,
        outline: focused ? "2px solid #FFFFFF" : "none",
        outlineOffset: 2,
      }}
    >
      Pular para conteudo principal
    </a>
  );
}
