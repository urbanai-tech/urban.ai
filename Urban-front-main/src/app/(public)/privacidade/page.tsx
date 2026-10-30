"use client";

import React from "react";
import { PRIVACY_UPDATED_AT, privacyBlocks } from "../legalContent";
import styles from "./page.module.css";

export default function Privacidade() {
  return (
    <main className="urban-manifesto urban-public-page">
      <section className="public-section">
        <div className="public-container public-legal-shell">
          <article className="urban-legal-panel public-legal-document">
            <p className="public-kicker">Privacidade e dados</p>
            <h1>Política de Privacidade</h1>
            <p className={styles.updatedAt}>
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
    <div className={styles.document}>
      {blocks.map((block, index) => {
        if (block.kind === "title") {
          return (
            <p key={index} className={styles.documentTitle}>
              {block.text}
            </p>
          );
        }

        if (block.kind === "section") {
          return (
            <section key={index} className={index === 1 ? `${styles.documentSection} ${styles.documentSectionFirst}` : styles.documentSection}>
              {index > 1 && <hr className={styles.documentDivider} />}
              <h2>{block.text}</h2>
            </section>
          );
        }

        return (
          <p key={index} className={styles.documentParagraph}>
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
