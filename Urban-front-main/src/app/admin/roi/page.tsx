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
import styles from "./page.module.css";

type RoiLeaderboardRow = AdminRoiOverview["leaderboard"][number];

const WINDOWS = [30, 90, 180, 365] as const;

/**
 * /admin/roi — ROI agregado dos anfitriões (admin).
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Hero KPI: "Receita atribuida a IA" em Archivo (display) gigante.
 *  - KPIs em grid plano (sem cards coloridos verde/azul/amber).
 *  - Janela 30/90/180/365 vira SegmentedControl.
 *  - Tabela top anfitriões com AdminTable + confiança via AdminBadge.
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
      <div className={styles.errorContainer}>
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
      header: "Anfitrião",
      render: (row) => (
        <div>
          <p
            className={styles.primaryText}
          >
            {row.user.username}
          </p>
          <p className={styles.userEmail}>
            {row.user.email}
          </p>
          <p className={styles.listingsCount}>
            {row.activeListings} {row.activeListings === 1 ? "imóvel ativo" : "imóveis ativos"}
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
            className={styles.attributedValue}
          >
            {fmt(row.money.totalAttributedCents)}
          </p>
          <p
            className={styles.cellSubtext}
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
            className={styles.roiMultiple}
          >
            {row.money.roiMultiple ? `${row.money.roiMultiple.toFixed(1)}x` : "—"}
          </p>
          <p
            className={styles.cellSubtext}
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
        <span className={styles.costCell}>
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
            className={styles.activityCount}
          >
            {row.activity.applied}/{row.activity.recommendations}
          </p>
          <p
            className={styles.activityNights}
          >
            {row.activity.impactedNights} noites
          </p>
        </div>
      ),
    },
    {
      key: "confidence",
      header: "Confiança",
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
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN · ROI"
        title="ROI dos anfitriões"
        subtitle="Dinheiro atribuído ao My Urban, custo da assinatura e retorno por usuário."
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
      <section className={styles.windowSection}>
        <header
          className={styles.windowHeader}
        >
          <p className={`urban-admin-eyebrow ${styles.windowEyebrow}`}>
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
      <section className={styles.kpiSection}>
        <AdminCard variant="accent" className={styles.heroCard}>
          <div
            className={styles.heroGrid}
          >
            <div>
              <p className="urban-admin-eyebrow">RECEITA ATRIBUIDA A IA</p>
              <p
                className={`urban-admin-display-hero ${styles.heroAttributed} ${
                  data.totals.totalAttributedCents > 0 ? "" : styles.heroAttributedEmpty
                }`}
              >
                {fmt(data.totals.totalAttributedCents)}
              </p>
              <p
                className={styles.heroCaption}
              >
                {fmt(data.totals.confirmedIncrementalCents)} confirmado ·{" "}
                {data.totals.users} usuários no ranking ·{" "}
                {data.totals.impactedNights.toLocaleString("pt-BR")} noites
                impactadas.
              </p>
            </div>
            <div className={styles.summaryBox}>
              <p className="urban-admin-eyebrow-muted">ROI médio</p>
              <p
                className={`urban-admin-display-md ${styles.roiAverageValue}`}
              >
                {data.totals.roiMultiple
                  ? `${data.totals.roiMultiple.toFixed(1)}x`
                  : "—"}
              </p>
              <p
                className={styles.summaryCaption}
              >
                {data.totals.roiPercent != null
                  ? `${data.totals.roiPercent.toFixed(0)}% liquido`
                  : "sem custo"}
              </p>
            </div>
            <div className={styles.summaryBox}>
              <p className="urban-admin-eyebrow-muted">Valor liquido</p>
              <p
                className={`urban-admin-display-md ${styles.netValue} ${
                  data.totals.netValueCents >= 0 ? styles.netValuePositive : styles.netValueNegative
                }`}
              >
                {fmt(data.totals.netValueCents)}
              </p>
              <p className={styles.summaryCaption}>
                Custo: {fmt(data.totals.subscriptionCostCents)}
              </p>
            </div>
          </div>
        </AdminCard>
      </section>

      {/* === KPIs adicionais === */}
      <section className={styles.kpiSection}>
        <p className={`urban-admin-eyebrow ${styles.kpiEyebrow}`}>
          INDICADORES
        </p>
        <div
          className={styles.kpiGrid}
        >
          <AdminMetricCard
            label="Confirmado"
            value={fmt(data.totals.confirmedIncrementalCents)}
            sub="com reserva/receita real"
          />
          <AdminMetricCard
            label="Em acompanhamento"
            value={fmt(data.totals.projectedIncrementalCents)}
            sub="preço aplicado, aguardando reserva"
          />
          <AdminMetricCard
            label="Potencial perdido"
            value={fmt(data.totals.potentialLostCents)}
            sub="sugestões não aplicadas"
          />
          <AdminMetricCard
            label="Anfitriões com ROI+"
            value={data.totals.usersWithPositiveRoi}
            sub={`de ${data.totals.users} usuários`}
            accent={data.totals.usersWithPositiveRoi > 0}
          />
        </div>
      </section>

      {/* === Leaderboard + regras === */}
      <section
        className={styles.leaderboardGrid}
      >
        <div>
          <p className={`urban-admin-eyebrow ${styles.leaderboardEyebrow}`}>
            TOP ANFITRIOES
          </p>
          <AdminTable
            columns={leaderboardColumns}
            rows={data.leaderboard}
            rowKey={(r) => r.user.id}
            empty={
              <AdminEmptyState
                title="Sem dados de ROI no período"
                body="Aguardando recomendações aplicadas com reserva confirmada."
              />
            }
          />
        </div>

        <AdminCard variant="subtle">
          <AdminCardHeader title="Como o painel calcula" />
          <div className={styles.rulesList}>
            <Rule
              title="Dinheiro gerado"
              body="Diferença positiva entre preço aplicado e preço anterior, multiplicada pelas noites impactadas."
            />
            <Rule
              title="Confirmado"
              body="Quando há reserva ou receita real vinculada a recomendação aplicada."
            />
            <Rule
              title="Em acompanhamento"
              body="Quando o preço foi aplicado, mas ainda falta confirmar se virou reserva."
            />
            <Rule
              title="Potencial perdido"
              body="Valor das recomendações com aumento positivo que não foram aceitas ou aplicadas."
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
        className={styles.primaryText}
      >
        {title}
      </p>
      <p
        className={styles.ruleBody}
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
      className={styles.segmentedControl}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            className={`${styles.segmentedButton} ${active ? styles.segmentedButtonActive : ""}`}
          >
            {renderLabel(opt)}
          </button>
        );
      })}
    </div>
  );
}
