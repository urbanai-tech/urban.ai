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
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[var(--accent-primary)] focus:text-white focus:rounded-md focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
    >
      Pular para conteudo principal
    </a>
  );
}
