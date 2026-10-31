"use client";

import { useEffect, useState } from "react";
import { fetchAdminFunnel, type AdminProductFunnel } from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminMetricCard,
  AdminEmptyState,
  AdminPageLoading,
  AdminButton,
  Icons,
} from "../_components";
import styles from "./page.module.css";
import { decimal } from "../../lib/format";

/**
 * /admin/funnel — funil de produto Urban AI.
 *
 * REESCRITO do zero (era lista vertical de cards — agora é SVG funil real
 * com trapézios decrescentes, número Archivo (display) dentro de cada estágio,
 * % drop-off entre eles).
 *
 * Estágios:
 *  1. Signups (30d)
 *  2. Onboarded com Airbnb host ID
 *  3. Análises geradas
 *  4. Sugestões aceitas
 *  5. Preço real aplicado
 *  6. Assinaturas ativas
 *  7. Modo automático
 */
export default function AdminFunnelPage() {
  const [data, setData] = useState<AdminProductFunnel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminFunnel()
      .then(setData)
      .catch((err: unknown) => {
        const e = err as { response?: { status?: number }; message?: string };
        const status = e?.response?.status;
        setError(
          status === 401 || status === 403 ? "Acesso negado." : e?.message || "Erro",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminPageLoading showTable={false} />;

  if (error || !data) {
    return (
      <div className={styles.pageContainer}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar funil"
          body={error ?? "Resposta vazia."}
          icon={<Icons.AlertCircle size={32} />}
        />
      </div>
    );
  }

  const stages = [
    {
      key: "signups",
      label: "Signups",
      value: data.stages.signups,
      desc: `Novas contas criadas nos últimos ${data.windowDays} dias.`,
    },
    {
      key: "onboardedWithAirbnbId",
      label: "Com Airbnb host ID",
      value: data.stages.onboardedWithAirbnbId,
      desc: "Completaram o onboarding informando o host ID do Airbnb.",
    },
    {
      key: "analysesGenerated",
      label: "Análises geradas",
      value: data.stages.analysesGenerated,
      desc: "Usuário rodou pelo menos uma análise de evento.",
    },
    {
      key: "suggestionsAccepted",
      label: "Sugestões aceitas",
      value: data.stages.suggestionsAccepted,
      desc: "Anfitrião clicou 'aceitar' em pelo menos uma recomendação.",
    },
    {
      key: "appliedPriceCaptured",
      label: "Preço real aplicado",
      value: data.stages.appliedPriceCaptured,
      desc: "Ground truth do MAPE — anfitrião registrou o preço aplicado.",
    },
    {
      key: "activeSubscriptions",
      label: "Assinaturas ativas",
      value: data.stages.activeSubscriptions,
      desc: "Plano pago, assinatura corrente.",
    },
    {
      key: "operationModeAuto",
      label: "Modo automático",
      value: data.stages.operationModeAuto,
      desc: "Push de preço automático via integração Stays habilitado.",
    },
  ];

  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow={`ADMIN · FUNIL DE PRODUTO — ÚLTIMOS ${data.windowDays}D`}
        title="Jornada do anfitrião"
        subtitle="Cada etapa mostra quantos usuários chegaram nela. O drop-off entre etapas é onde está a maior alavanca de conversão."
      />

      {/* === Taxas-chave === */}
      <section className={styles.section}>
        <div
          className={styles.metricGrid}
        >
          <AdminMetricCard
            label="Taxa de aceite"
            value={`${data.rates.acceptanceRatePercent}%`}
            sub="sugestões aceitas / análises geradas"
            variant="hero"
            accent
          />
          <AdminMetricCard
            label="Taxa de aplicação"
            value={`${data.rates.applicationRatePercent}%`}
            sub="preço aplicado / aceitas (ground truth do MAPE)"
            variant="hero"
          />
        </div>
      </section>

      {/* === Funil real SVG === */}
      <section className={styles.section}>
        <p className={`urban-admin-eyebrow ${styles.stagesEyebrow}`}>
          ETAPAS — TRAPÉZIOS DECRESCENTES
        </p>
        <FunnelChart stages={stages} max={max} />
      </section>

      <section className={styles.leverageSection}>
        <p className={`urban-admin-eyebrow ${styles.leverageEyebrow}`}>
          PRÓXIMA ALAVANCA
        </p>
        <NextLeverage stages={stages} />
      </section>

      <footer
        className={styles.pageFooter}
      >
        <p className={styles.footerText}>
          <strong className={styles.emphasis}>Janela:</strong>{" "}
          {data.windowDays} dias. Valores absolutos contam usuários distintos
          em cada etapa, não eventos. % entre etapas é a taxa de avanço.
        </p>
      </footer>
    </div>
  );
}

type Stage = { key: string; label: string; value: number; desc: string };

function FunnelChart({ stages, max }: { stages: Stage[]; max: number }) {
  // Largura: stage i ocupa (value/max) × 100% da largura total
  // Trapézios entre stages adjacentes — uso SVG simples
  const stageHeight = 96;
  const gap = 6;
  const totalHeight = stages.length * (stageHeight + gap);

  return (
    <AdminCard variant="subtle" className={styles.funnelCard}>
      <div
        className={styles.funnelLayout}
      >
        {/* SVG funil */}
        <div className={styles.funnelChartWrap}>
          <svg
            viewBox={`0 0 100 ${totalHeight}`}
            preserveAspectRatio="none"
            className={styles.funnelSvg}
            style={{ "--funnel-h": `${totalHeight}px` } as React.CSSProperties}
          >
            {stages.map((s, i) => {
              const prev = i === 0 ? max : stages[i - 1].value;
              const widthCurrent = (s.value / max) * 100;
              const widthPrev = (prev / max) * 100;

              const xPrevL = (100 - widthPrev) / 2;
              const xPrevR = xPrevL + widthPrev;
              const xCurrL = (100 - widthCurrent) / 2;
              const xCurrR = xCurrL + widthCurrent;

              const y0 = i * (stageHeight + gap);
              const y1 = y0 + stageHeight;

              return (
                <g key={s.key}>
                  <polygon
                    points={`${xPrevL},${y0} ${xPrevR},${y0} ${xCurrR},${y1} ${xCurrL},${y1}`}
                    fill="var(--admin-accent)"
                    fillOpacity={0.85 - i * 0.06}
                  />
                </g>
              );
            })}
          </svg>

          {/* Labels sobrepostos */}
          <div
            className={styles.stageLabels}
          >
            {stages.map((s, i) => {
              const pctOfMax = decimal((s.value / max) * 100);
              return (
                <div
                  key={s.key}
                  className={styles.stageLabel}
                >
                  <p
                    className={styles.stageLabelTitle}
                  >
                    {String(i + 1).padStart(2, "0")} · {s.label}
                  </p>
                  <p
                    className={`urban-admin-display-md ${styles.stageLabelValue}`}
                  >
                    {s.value.toLocaleString("pt-BR")}
                  </p>
                  <p
                    className={styles.stageLabelPercent}
                  >
                    {pctOfMax}% do topo
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lista lateral com drop-off entre etapas */}
        <ol
          className={styles.stageList}
        >
          {stages.map((s, i) => {
            const prev = i === 0 ? null : stages[i - 1];
            const drop = prev && prev.value > 0
              ? decimal((1 - s.value / prev.value) * 100)
              : null;
            const advance = prev && prev.value > 0
              ? decimal((s.value / prev.value) * 100)
              : null;
            return (
              <li
                key={s.key}
                className={styles.stageItem}
              >
                <p
                  className={styles.stageItemTitle}
                >
                  {String(i + 1).padStart(2, "0")} {s.label}
                </p>
                <p
                  className={styles.stageItemDesc}
                >
                  {s.desc}
                </p>
                {prev && (
                  <p
                    className={styles.stageItemAdvance}
                  >
                    Avanço: <strong className={styles.emphasisAccent}>{advance}%</strong>{" "}
                    · Drop-off: <strong className={styles.emphasisMuted}>{drop}%</strong>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </AdminCard>
  );
}

function NextLeverage({ stages }: { stages: Stage[] }) {
  // Calcula a etapa com maior drop-off — onde investir esforço
  let biggestDrop = { from: "", to: "", percent: 0, lost: 0 };
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1];
    const cur = stages[i];
    if (prev.value === 0) continue;
    const dropPct = (1 - cur.value / prev.value) * 100;
    if (dropPct > biggestDrop.percent) {
      biggestDrop = {
        from: prev.label,
        to: cur.label,
        percent: dropPct,
        lost: prev.value - cur.value,
      };
    }
  }

  if (biggestDrop.percent === 0) {
    return (
      <AdminEmptyState
        title="Sem drop-off significativo"
        body="Volume de cada etapa está consistente. Mantenha o ritmo."
      />
    );
  }

  return (
    <AdminCard variant="accent">
      <p
        className={styles.leverageText}
      >
        Maior perda da janela: entre{" "}
        <strong className={styles.emphasis}>{biggestDrop.from}</strong>{" "}
        e{" "}
        <strong className={styles.emphasis}>{biggestDrop.to}</strong>{" "}
        — perdemos{" "}
        <strong className={styles.emphasisAccent}>
          {biggestDrop.lost.toLocaleString("pt-BR")}
        </strong>{" "}
        usuários ({decimal(biggestDrop.percent)}% de drop-off). Foque aqui
        para a próxima iteração de produto.
      </p>
      <div className={styles.leverageActions}>
        <AdminButton variant="secondary" as="a" href="/admin/dashboard" rightIcon={<Icons.ArrowRight size={11} />}>
          Ver dashboard executivo
        </AdminButton>
        <AdminButton variant="ghost" as="a" href="/admin/roi" rightIcon={<Icons.ArrowRight size={11} />}>
          Ver ROI por imóvel
        </AdminButton>
      </div>
    </AdminCard>
  );
}
