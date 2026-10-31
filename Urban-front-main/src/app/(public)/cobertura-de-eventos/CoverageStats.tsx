"use client";

import { useEffect, useState } from "react";
import { describeCoverage, parsePublicCoverage, type PublicCoverage } from "./coverage-domain";
import styles from "./page.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

/**
 * Números da cobertura. O servidor entrega o resumo já renderizado (SEO, sem pisca); no
 * navegador, uma leitura do mesmo endpoint cacheado atualiza se a medição do dia mudou.
 * Falha de rede mantém o que veio do servidor — nunca zera nem inventa número.
 */
export default function CoverageStats({ initial }: { initial: PublicCoverage | null }) {
  const [data, setData] = useState<PublicCoverage | null>(initial);

  useEffect(() => {
    if (!API_URL) return;
    const controller = new AbortController();
    fetch(`${API_URL}/public/event-coverage`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const parsed = parsePublicCoverage(payload);
        if (parsed) setData(parsed);
      })
      .catch(() => {
        // Mantém os dados do servidor.
      });
    return () => controller.abort();
  }, []);

  const view = describeCoverage(data);
  const measured = data?.status === "measured";

  return (
    <div className={styles.stats} data-testid="coverage-stats" data-status={measured ? "measured" : "measuring"}>
      <div className={styles.featured}>
        <p className="public-kicker">Recall nos grandes eventos de SP · último mês</p>
        <p className={styles.bigNumber} aria-live="polite">
          {view.recallLabel}
        </p>
        <p className={styles.headline}>{view.headline}</p>
        <p className={styles.note}>{view.note}</p>
        {!measured && (
          <div className={styles.progress}>
            <progress value={view.progressPct} max={100} aria-label={`${view.progressPct}% das 4 semanas de medição`} />
            <span>{view.progressPct}% das {data?.minWeeks ?? 4} semanas de medição</span>
          </div>
        )}
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Eventos acompanhados</dt>
          <dd>{view.eventsLabel}</dd>
        </div>
        <div>
          <dt>Venues cobertos</dt>
          <dd>{view.venuesLabel}</dd>
        </div>
        <div>
          <dt>Data da medição</dt>
          <dd>{view.dateLabel}</dd>
        </div>
      </dl>
    </div>
  );
}
