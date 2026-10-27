"use client";

import { useEffect, useState } from "react";
import { fetchAdminOutcomesComparison, type AdminOutcomeComparisonRow, type AdminOutcomesComparison } from "../../service/api/beta-ops";
import {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminMetricCard,
  AdminPageLoading,
  AdminSectionHeader,
  AdminTable,
  Icons,
  type AdminTableColumn,
} from "../_components";
import {
  closerLabel,
  formatDayKey,
  formatPlainPercent,
  formatPrice,
  formatSignedPercent,
  outcomeBadgeKind,
  outcomeLabel,
  sampleBanner,
} from "./outcomes-domain";

/**
 * /admin/outcomes — v1 × v2 (sombra) × preço aplicado × resultado.
 * Só entram recomendações em que o anfitrião aplicou um preço E registrou o resultado.
 * Com amostra pequena a tela mostra n e contagens, nunca conclusões. Não é teste A/B.
 */
export default function AdminOutcomesPage() {
  const [data, setData] = useState<AdminOutcomesComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminOutcomesComparison()
      .then(setData)
      .catch((err: unknown) => {
        const e = err as { response?: { status?: number }; message?: string };
        const code = e?.response?.status;
        setError(code === 401 || code === 403 ? "Acesso negado." : e?.message || "Erro ao carregar a comparação.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminPageLoading />;

  if (error || !data) {
    return (
      <div className="beta-ops-page">
        <AdminEmptyState eyebrow="Erro" title="Falha ao carregar" body={error ?? "Sem resposta."} icon={<Icons.AlertCircle size={32} />} />
      </div>
    );
  }

  const { summary } = data;
  const withBoth = summary.closerToV1 + summary.closerToV2 + summary.ties;
  const banner = sampleBanner(withBoth, data.minSample);
  const canShowDistances = data.conclusions.available;

  const columns: AdminTableColumn<AdminOutcomeComparisonRow>[] = [
    {
      key: "event",
      header: "Recomendação",
      render: (row) => (
        <div>
          <p className="font-semibold">{row.eventName}</p>
          <p className="beta-ops-muted">
            {row.property} · {formatDayKey(row.eventDate)}
          </p>
        </div>
      ),
    },
    { key: "v1", header: "Sugestão v1", align: "right", render: (row) => formatPrice(row.v1Price) },
    {
      key: "v2",
      header: "Sombra v2",
      align: "right",
      render: (row) => (
        <div>
          <p>{formatPrice(row.v2Price)}</p>
          {row.v2VsV1Percent !== null && (
            <p className="beta-ops-muted">{formatSignedPercent(row.v2VsV1Percent)} vs v1</p>
          )}
        </div>
      ),
    },
    {
      key: "applied",
      header: "Aplicado",
      align: "right",
      render: (row) => (
        <div>
          <p>{formatPrice(row.appliedPrice)}</p>
          <p className="beta-ops-muted">{formatSignedPercent(row.appliedVsV1Percent)} vs v1</p>
        </div>
      ),
    },
    { key: "closer", header: "Mais perto do aplicado", render: (row) => closerLabel(row.closer) },
    {
      key: "outcome",
      header: "Resultado",
      render: (row) => <AdminBadge kind={outcomeBadgeKind(row.outcome)}>{outcomeLabel(row.outcome)}</AdminBadge>,
    },
    {
      key: "revenue",
      header: "Receita registrada",
      align: "right",
      render: (row) => (
        <div>
          <p>{formatPrice(row.revenue)}</p>
          {row.nights !== null && (
            <p className="beta-ops-muted">
              {row.nights} {row.nights === 1 ? "noite" : "noites"}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="beta-ops-page">
      <AdminSectionHeader
        eyebrow="ADMIN · RESULTADOS"
        title="v1 × v2 × aplicado × resultado"
        subtitle="Compara a sugestão do motor atual (v1), o v2 calculado em sombra, o preço que o anfitrião aplicou e o resultado que ele registrou."
      />

      <AdminCard variant="accent">
        <p className="beta-ops-strong">{banner.text}</p>
        {data.conclusions.available ? (
          <p className="beta-ops-callout-gap">{data.conclusions.text}</p>
        ) : (
          <p className="beta-ops-callout-gap">{data.conclusions.reason}</p>
        )}
      </AdminCard>

      <section className="beta-ops-metrics">
        <AdminMetricCard
          label="Com resultado registrado"
          value={summary.n}
          sub={`${data.appliedWithoutOutcome} aplicadas ainda sem resultado (de ${data.appliedTotal})`}
          variant="md"
        />
        <AdminMetricCard label="Com sugestão v2 guardada" value={summary.nWithV2} variant="md" />
        <AdminMetricCard
          label="Reservou / não reservou"
          value={`${summary.booked} / ${summary.notBooked}`}
          sub={summary.blocked > 0 ? `${summary.blocked} bloqueadas` : undefined}
          variant="md"
        />
        <AdminMetricCard
          label="Receita registrada"
          value={formatPrice(summary.recordedRevenue)}
          sub={`${summary.nWithRevenue} com receita informada`}
          variant="md"
        />
      </section>

      <section className="beta-ops-metrics">
        <AdminMetricCard label="Mais perto: v1" value={summary.closerToV1} variant="sm" />
        <AdminMetricCard label="Mais perto: v2" value={summary.closerToV2} variant="sm" />
        <AdminMetricCard
          label="Distância média v1"
          value={canShowDistances ? formatPlainPercent(summary.meanDistanceV1Percent) : "n pequeno"}
          variant="sm"
        />
        <AdminMetricCard
          label="Distância média v2"
          value={canShowDistances ? formatPlainPercent(summary.meanDistanceV2Percent) : "n pequeno"}
          variant="sm"
        />
      </section>

      <AdminTable
        columns={columns}
        rows={data.rows}
        rowKey={(row) => row.analysisId}
        minWidth={1000}
        empty={
          <AdminEmptyState
            title="Ainda sem resultados registrados"
            body="Quando os anfitriões aplicarem um preço e registrarem o resultado, as recomendações aparecem aqui."
          />
        }
      />

      {data.truncated && (
        <p className="beta-ops-note-tight">Mostrando só as mais recentes; há mais linhas no banco.</p>
      )}
      <p className="beta-ops-note">
        O v2 roda em sombra e nunca é mostrado ao anfitrião; quem decide o preço é ele. “Mais perto do aplicado” mede
        proximidade com o preço praticado, não receita.
      </p>
    </div>
  );
}
