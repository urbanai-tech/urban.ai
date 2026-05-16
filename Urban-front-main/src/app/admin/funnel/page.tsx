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

/**
 * /admin/funnel — funil de produto Urban AI.
 *
 * REESCRITO do zero (era lista vertical de cards — agora é SVG funil real
 * com trapézios decrescentes, número Bebas Neue dentro de cada estágio,
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
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
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
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow={`ADMIN · FUNIL DE PRODUTO — ÚLTIMOS ${data.windowDays}D`}
        title="Jornada do anfitrião"
        subtitle="Cada etapa mostra quantos usuários chegaram nela. O drop-off entre etapas é onde está a maior alavanca de conversão."
      />

      {/* === Taxas-chave === */}
      <section style={{ marginBottom: 48 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 32,
            borderTop: "1px solid var(--admin-divider)",
            borderBottom: "1px solid var(--admin-divider)",
          }}
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
      <section style={{ marginBottom: 48 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 24 }}>
          ETAPAS — TRAPÉZIOS DECRESCENTES
        </p>
        <FunnelChart stages={stages} max={max} />
      </section>

      <section style={{ marginBottom: 32 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 16 }}>
          PRÓXIMA ALAVANCA
        </p>
        <NextLeverage stages={stages} />
      </section>

      <footer
        style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: "1px solid var(--admin-divider)",
          fontSize: 12,
          color: "var(--admin-text-muted)",
          lineHeight: 1.55,
        }}
      >
        <p style={{ margin: 0 }}>
          <strong style={{ color: "var(--admin-text)" }}>Janela:</strong>{" "}
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
    <AdminCard variant="subtle" style={{ padding: 32 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
          gap: 32,
          alignItems: "stretch",
        }}
      >
        {/* SVG funil */}
        <div style={{ position: "relative" }}>
          <svg
            viewBox={`0 0 100 ${totalHeight}`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: totalHeight, display: "block" }}
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
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {stages.map((s, i) => {
              const pctOfMax = ((s.value / max) * 100).toFixed(1);
              return (
                <div
                  key={s.key}
                  style={{
                    height: stageHeight,
                    marginBottom: gap,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    pointerEvents: "none",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: "var(--admin-bg)",
                      fontWeight: 700,
                      margin: 0,
                      opacity: 0.8,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")} · {s.label}
                  </p>
                  <p
                    className="urban-admin-display-md"
                    style={{
                      color: "var(--admin-bg)",
                      marginTop: 4,
                      fontWeight: 400,
                    }}
                  >
                    {s.value.toLocaleString("pt-BR")}
                  </p>
                  <p
                    style={{
                      fontSize: 10,
                      color: "var(--admin-bg)",
                      opacity: 0.7,
                      margin: 0,
                      fontWeight: 500,
                    }}
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
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {stages.map((s, i) => {
            const prev = i === 0 ? null : stages[i - 1];
            const drop = prev && prev.value > 0
              ? ((1 - s.value / prev.value) * 100).toFixed(1)
              : null;
            const advance = prev && prev.value > 0
              ? ((s.value / prev.value) * 100).toFixed(1)
              : null;
            return (
              <li
                key={s.key}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid var(--admin-divider)",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "var(--admin-text-muted)",
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  {String(i + 1).padStart(2, "0")} {s.label}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--admin-text-muted)",
                    margin: "4px 0 0",
                    lineHeight: 1.4,
                  }}
                >
                  {s.desc}
                </p>
                {prev && (
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "var(--admin-text-dim)",
                    }}
                  >
                    Avanço: <strong style={{ color: "var(--admin-accent)" }}>{advance}%</strong>{" "}
                    · Drop-off: <strong style={{ color: "var(--admin-text-muted)" }}>{drop}%</strong>
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
        style={{
          fontSize: 14,
          color: "var(--admin-text-muted)",
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        Maior perda da janela: entre{" "}
        <strong style={{ color: "var(--admin-text)" }}>{biggestDrop.from}</strong>{" "}
        e{" "}
        <strong style={{ color: "var(--admin-text)" }}>{biggestDrop.to}</strong>{" "}
        — perdemos{" "}
        <strong style={{ color: "var(--admin-accent)" }}>
          {biggestDrop.lost.toLocaleString("pt-BR")}
        </strong>{" "}
        usuários ({biggestDrop.percent.toFixed(1)}% de drop-off). Foque aqui
        para a próxima iteração de produto.
      </p>
      <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
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
