"use client";

import React from "react";
import { PRIVACY_UPDATED_AT, privacyBlocks } from "../legalContent";

export default function Privacidade() {
  return (
    <main className="urban-manifesto urban-public-page">
      <section className="public-section">
        <div className="public-container public-legal-shell">
          <article className="urban-legal-panel public-legal-document">
            <p className="public-kicker">Privacidade e dados</p>
            <h1>Política de Privacidade</h1>
            <p style={{ margin: "0 0 32px", fontSize: 14 }}>
              Última atualização: {PRIVACY_UPDATED_AT}
            </p>
            <LegalDocument blocks={privacyBlocks} />
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
