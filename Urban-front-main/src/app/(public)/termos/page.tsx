"use client";

import React from "react";
import { TERMS_UPDATED_AT, termsBlocks } from "../legalContent";

export default function Termos() {
  return (
    <main className="urban-manifesto urban-public-page">
      <section className="urban-public-section">
        <div className="urban-public-container">
          <article className="urban-legal-panel">
            <h1>Termos de Uso</h1>
            <p style={{ margin: "0 0 32px", fontSize: 14 }}>
              Última atualizacao: {TERMS_UPDATED_AT}
            </p>
            <LegalDocument blocks={termsBlocks} />
          </article>
        </div>
      </section>
    </main>
  );
}

function LegalDocument({
  blocks,
}: {
  blocks: Array<{ kind: "title" | "section" | "paragraph"; text: string }>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16, fontSize: 16, lineHeight: 1.7 }}>
      {blocks.map((block, index) => {
        if (block.kind === "title") {
          return (
            <p key={index} style={{ margin: 0, fontWeight: 700 }}>
              {block.text}
            </p>
          );
        }

        if (block.kind === "section") {
          return (
            <section key={index} style={{ width: "100%", paddingTop: index === 1 ? 0 : 16 }}>
              {index > 1 && <hr style={{ margin: "0 0 16px", border: 0, borderTop: "1px solid var(--theme-public-soft)" }} />}
              <h2>{block.text}</h2>
            </section>
          );
        }

        return (
          <p key={index} style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
