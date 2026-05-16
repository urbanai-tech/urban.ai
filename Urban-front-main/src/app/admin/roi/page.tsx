"use client";

import { useEffect, useState } from "react";
import { fetchAdminRoi, type AdminRoiOverview } from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminButton,
  AdminBadge,
  AdminMetricCard,
  AdminTable,
  type AdminTableColumn,
  AdminEmptyState,
  AdminPageLoading,
  Icons,
} from "../_components";
import type { AdminBadgeKind } from "../_components";

type RoiLeaderboardRow = AdminRoiOverview["leaderboard"][number];

const WINDOWS = [30, 90, 180, 365] as const;

/**
 * /admin/roi — ROI agregado dos anfitrioes (admin).
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Hero KPI: "Receita atribuida a IA" em Bebas Neue gigante.
 *  - KPIs em grid plano (sem cards coloridos verde/azul/amber).
 *  - Janela 30/90/180/365 vira SegmentedControl.
 *  - Tabela top anfitrioes com AdminTable + confiança via AdminBadge.
 *  - "Como o painel calcula" em AdminCard subtle.
 *  - "← Voltar" removido (AdminShell tem breadcrumb).
 */
export default function AdminRoiPage() {
  const [data, setData] = useState<AdminRoiOverview | null>(null);
  const [windowDays, setWindowDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(days = windowDays) {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminRoi({ windowDays: days, limit: 50 }));
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e?.response?.status;
      setError(
        status === 401 || status === 403 ? "Acesso negado." : e?.message || "Erro",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(windowDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });

  if (loading && !data) return <AdminPageLoading />;

  if (error || !data) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar"
          body={error ?? "Resposta vazia do backend"}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AdminButton variant="primary" onClick={() => load()}>
              Tentar novamente
            </AdminButton>
          }
        />
      </div>
    );
  }

  const leaderboardColumns: AdminTableColumn<RoiLeaderboardRow>[] = [
    {
      key: "user",
      header: "Anfitriao",
      render: (row) => (
        <div>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--admin-text)",
              margin: 0,
            }}
          >
            {row.user.username}
          </p>
          <p style={{ fontSize: 11, color: "var(--admin-text-muted)", margin: "2px 0 0" }}>
            {row.user.email}
          </p>
          <p style={{ fontSize: 11, color: "var(--admin-text-dim)", margin: "2px 0 0" }}>
            {row.activeListings} imovel(is) ativo(s)
          </p>
        </div>
      ),
    },
    {
      key: "generated",
      header: "Gerado",
      align: "right",
      render: (row) => (
        <div>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--admin-accent)",
              margin: 0,
            }}
          >
            {fmt(row.money.totalAttributedCents)}
          </p>
          <p
            style={{
              fontSize: 10,
              color: "var(--admin-text-muted)",
              margin: "2px 0 0",
              fontFamily: "monospace",
            }}
          >
            {fmt(row.money.projectedIncrementalCents)} acompanhando
          </p>
        </div>
      ),
    },
    {
      key: "roi",
      header: "ROI",
      align: "right",
      width: 110,
      render: (row) => (
        <div>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--admin-text)",
              margin: 0,
            }}
          >
            {row.money.roiMultiple ? `${row.money.roiMultiple.toFixed(1)}x` : "—"}
          </p>
          <p
            style={{
              fontSize: 10,
              color: "var(--admin-text-muted)",
              margin: "2px 0 0",
              fontFamily: "monospace",
            }}
          >
            {row.money.roiPercent != null ? `${row.money.roiPercent.toFixed(0)}%` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "subscription",
      header: "Assinatura",
      align: "right",
      width: 120,
      render: (row) => (
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--admin-text)" }}>
          {fmt(row.subscription.monthlyCostCents)}
        </span>
      ),
    },
    {
      key: "applied",
      header: "Aplicadas",
      align: "right",
      width: 120,
      render: (row) => (
        <div>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: 12,
              color: "var(--admin-text)",
              margin: 0,
            }}
          >
            {row.activity.applied}/{row.activity.recommendations}
          </p>
          <p
            style={{
              fontSize: 10,
              color: "var(--admin-text-muted)",
              margin: "2px 0 0",
            }}
          >
            {row.activity.impactedNights} noites
          </p>
        </div>
      ),
    },
    {
      key: "confidence",
      header: "Confianca",
      align: "right",
      width: 120,
      render: (row) => (
        <AdminBadge kind={confidenceKind(row.dataQuality.confidence)}>
          {row.dataQuality.label}
        </AdminBadge>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · ROI"
        title="ROI dos anfitrioes"
        subtitle="Dinheiro atribuido a Urban AI, custo da assinatura e retorno por usuario."
        actions={
          <AdminButton
            variant="secondary"
            onClick={() => load()}
            disabled={loading}
            leftIcon={<Icons.RefreshCw size={12} />}
          >
            Atualizar
          </AdminButton>
        }
      />

      {/* === Janela de tempo === */}
      <section style={{ marginBottom: 32 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <p className="urban-admin-eyebrow" style={{ margin: 0 }}>
            JANELA DE ANALISE
          </p>
          <SegmentedControl
            value={windowDays}
            options={WINDOWS}
            onChange={(v) => {
              setWindowDays(v);
              load(v);
            }}
            renderLabel={(v) => `${v}d`}
          />
        </header>
      </section>

      {/* === Hero KPI: receita atribuida === */}
      <section style={{ marginBottom: 56 }}>
        <AdminCard variant="accent" style={{ padding: "40px 40px 36px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)",
              gap: 32,
              alignItems: "end",
            }}
          >
            <div>
              <p className="urban-admin-eyebrow">RECEITA ATRIBUIDA A IA</p>
              <p
                className="urban-admin-display-hero"
                style={{
                  marginTop: 12,
                  color:
                    data.totals.totalAttributedCents > 0
                      ? "var(--admin-text)"
                      : "var(--admin-text-muted)",
                }}
              >
                {fmt(data.totals.totalAttributedCents)}
              </p>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 14,
                  color: "var(--admin-text-muted)",
                  lineHeight: 1.55,
                }}
              >
                {fmt(data.totals.confirmedIncrementalCents)} confirmado ·{" "}
                {data.totals.users} usuarios no ranking ·{" "}
                {data.totals.impactedNights.toLocaleString("pt-BR")} noites
                impactadas.
              </p>
            </div>
            <div style={{ borderLeft: "1px solid var(--admin-divider)", paddingLeft: 32 }}>
              <p className="urban-admin-eyebrow-muted">ROI medio</p>
              <p
                className="urban-admin-display-md"
                style={{
                  marginTop: 12,
                  color: "var(--admin-accent)",
                }}
              >
                {data.totals.roiMultiple
                  ? `${data.totals.roiMultiple.toFixed(1)}x`
                  : "—"}
              </p>
              <p
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "var(--admin-text-muted)",
                }}
              >
                {data.totals.roiPercent != null
                  ? `${data.totals.roiPercent.toFixed(0)}% liquido`
                  : "sem custo"}
              </p>
            </div>
            <div style={{ borderLeft: "1px solid var(--admin-divider)", paddingLeft: 32 }}>
              <p className="urban-admin-eyebrow-muted">Valor liquido</p>
              <p
                className="urban-admin-display-md"
                style={{
                  marginTop: 12,
                  color:
                    data.totals.netValueCents >= 0
                      ? "var(--admin-success)"
                      : "var(--admin-danger)",
                }}
              >
                {fmt(data.totals.netValueCents)}
              </p>
              <p style={{ marginTop: 6, fontSize: 12, color: "var(--admin-text-muted)" }}>
                Custo: {fmt(data.totals.subscriptionCostCents)}
              </p>
            </div>
          </div>
        </AdminCard>
      </section>

      {/* === KPIs adicionais === */}
      <section style={{ marginBottom: 56 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 24 }}>
          INDICADORES
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 32,
            borderTop: "1px solid var(--admin-divider)",
            borderBottom: "1px solid var(--admin-divider)",
          }}
        >
          <AdminMetricCard
            label="Confirmado"
            value={fmt(data.totals.confirmedIncrementalCents)}
            sub="com reserva/receita real"
          />
          <AdminMetricCard
            label="Em acompanhamento"
            value={fmt(data.totals.projectedIncrementalCents)}
            sub="preco aplicado, aguardando reserva"
          />
          <AdminMetricCard
            label="Potencial perdido"
            value={fmt(data.totals.potentialLostCents)}
            sub="sugestoes nao aplicadas"
          />
          <AdminMetricCard
            label="Anfitrioes com ROI+"
            value={data.totals.usersWithPositiveRoi}
            sub={`de ${data.totals.users} usuarios`}
            accent={data.totals.usersWithPositiveRoi > 0}
          />
        </div>
      </section>

      {/* === Leaderboard + regras === */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 24,
        }}
      >
        <div>
          <p className="urban-admin-eyebrow" style={{ marginBottom: 16 }}>
            TOP ANFITRIOES
          </p>
          <AdminTable
            columns={leaderboardColumns}
            rows={data.leaderboard}
            rowKey={(r) => r.user.id}
            empty={
              <AdminEmptyState
                title="Sem dados de ROI no periodo"
                body="Aguardando recomendacoes aplicadas com reserva confirmada."
              />
            }
          />
        </div>

        <AdminCard variant="subtle">
          <AdminCardHeader title="Como o painel calcula" />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Rule
              title="Dinheiro gerado"
              body="Diferenca positiva entre preco aplicado e preco anterior, multiplicada pelas noites impactadas."
            />
            <Rule
              title="Confirmado"
              body="Quando ha reserva ou receita real vinculada a recomendacao aplicada."
            />
            <Rule
              title="Em acompanhamento"
              body="Quando o preco foi aplicado, mas ainda falta confirmar se virou reserva."
            />
            <Rule
              title="Potencial perdido"
              body="Valor das recomendacoes com aumento positivo que nao foram aceitas ou aplicadas."
            />
          </div>
        </AdminCard>
      </section>
    </div>
  );
}

function confidenceKind(confidence: "high" | "medium" | "low"): AdminBadgeKind {
  if (confidence === "high") return "success";
  if (confidence === "medium") return "warn";
  return "neutral";
}

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--admin-text)",
          margin: 0,
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: 12,
          color: "var(--admin-text-muted)",
          margin: "4px 0 0",
          lineHeight: 1.55,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  renderLabel: (v: T) => string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        border: "1px solid var(--admin-divider)",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              background: "transparent",
              border: "none",
              borderRight: "1px solid var(--admin-divider)",
              borderBottom: active
                ? "2px solid var(--admin-accent)"
                : "2px solid transparent",
              color: active ? "var(--admin-text)" : "var(--admin-text-muted)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              padding: "8px 14px",
              cursor: "pointer",
              transition: "color 120ms, border-color 120ms",
            }}
          >
            {renderLabel(opt)}
          </button>
        );
      })}
    </div>
  );
}
