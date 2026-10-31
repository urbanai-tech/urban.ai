"use client";

import React from "react";
import styles from "./SkipLink.module.css";

/**
 * SkipLink — link "Pular para conteúdo principal" invisível até receber foco.
 *
 * WCAG 2.4.1 (Bypass Blocks). Renderize logo após a abertura do `<body>` ou no
 * topo do shell autenticado. O `targetId` precisa existir como `id=` num
 * elemento focável ou tabindex=-1 (geralmente o `<main>` da página).
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
      className={focused ? `${styles.skipLink} ${styles.skipLinkFocused}` : styles.skipLink}
    >
      Pular para conteúdo principal
    </a>
  );
}
