"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchEventCoverage, type EventCoverageReport, type EventCoverageSource } from "../../service/api";
import {
  AdminBadge,
  AdminButton,
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
  buildHints,
  formatPct,
  formatSinceIngest,
  histogramBars,
  progressPct,
  shortDay,
  sourceHealthMeta,
  statusMeta,
} from "./coverage-domain";
import "./event-coverage.css";

const CHART_WIDTH = 600;
const CHART_HEIGHT = 120;
const CHART_LABEL_EVERY = 5;

/**
 * /admin/event-coverage — "os dados de eventos já são vendáveis?" (roadmap D6).
 *
 * Número principal vs. meta (padrão: 100 eventos futuros em 30 dias em SP),
 * histograma diário, tabela por fonte com selos de saúde, lacunas de
 * geocoding/categoria e dicas do que fazer. Dados de GET /admin/event-coverage.
 */
export default function EventCoveragePage() {
  const [data, setData] = useState<EventCoverageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchEventCoverage());
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e?.response?.status;
      setError(status === 401 || status === 403 ? "Acesso negado." : e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <AdminPageLoading />;

  if (error || !data) {
    return (
      <div className="ec-error">
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar"
          body={error ?? "Sem dados."}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AdminButton variant="primary" onClick={load}>
              Tentar novamente
            </AdminButton>
          }
        />
      </div>
    );
  }

  const status = statusMeta(data.status);
  const hints = buildHints(data.reasons);
  const bars = histogramBars(data.histogram, CHART_WIDTH, CHART_HEIGHT);
  const target = data.target.events30d;

  const columns: AdminTableColumn<EventCoverageSource>[] = [
    {
      key: "source",
      header: "Fonte",
      render: (s) => <span className="ec-source-name">{s.source}</span>,
    },
    {
      key: "health",
      header: "Saúde",
      width: 190,
      render: (s) => {
        const meta = sourceHealthMeta(s.health);
        return <AdminBadge kind={meta.badge}>{meta.label}</AdminBadge>;
      },
    },
    {
      key: "events30d",
      header: "Eventos 30 d",
      width: 120,
      align: "right",
      render: (s) => <span className="ec-num">{s.events30d.toLocaleString("pt-BR")}</span>,
    },
    {
      key: "lastIngest",
      header: "Último ingest",
      width: 150,
      render: (s) => <span className="ec-muted">{formatSinceIngest(s.hoursSinceLastIngest)}</span>,
    },
    {
      key: "window",
      header: "Janela",
      width: 90,
      align: "right",
      render: (s) => <span className="ec-muted">{s.windowHours} h</span>,
    },
  ];

  return (
    <div className="ec-page">
      <AdminSectionHeader
        eyebrow="ADMIN · MOTOR DE EVENTOS"
        title="Cobertura de eventos"
        subtitle="Eventos canônicos, ativos e futuros em São Paulo, contados em dias de São Paulo, contra a meta de venda."
        actions={
          <AdminButton
            variant="secondary"
            onClick={load}
            disabled={loading}
            leftIcon={<Icons.RefreshCw size={12} />}
          >
            {loading ? "Atualizando…" : "Atualizar"}
          </AdminButton>
        }
      />

      <section className="ec-section" aria-label="Resumo da cobertura">
        <AdminCard variant="accent">
          <div className="ec-headline">
            <div className="ec-headline-main">
              <p className="urban-admin-eyebrow">PRÓXIMOS 30 DIAS</p>
              <div className="ec-headline-value">
                <span className="ec-headline-number">{data.counts.next30d.toLocaleString("pt-BR")}</span>
                <span className="ec-headline-target">de {target.toLocaleString("pt-BR")} (meta)</span>
              </div>
              <progress
                className="ec-progress"
                value={progressPct(data.counts.next30d, target)}
                max={100}
                aria-label={`${progressPct(data.counts.next30d, target)}% da meta de ${target} eventos`}
              />
              <div>
                <AdminBadge kind={status.badge}>{status.label}</AdminBadge>
              </div>
              <p className="ec-muted">{status.summary}</p>
              <p className="ec-muted">
                De fontes saudáveis: {data.counts.next30dFromHealthySources.toLocaleString("pt-BR")}.
              </p>
            </div>
            <div className="ec-kpis">
              <AdminMetricCard label="Próximos 7 dias" value={data.counts.next7d} />
              <AdminMetricCard label="Próximos 30 dias" value={data.counts.next30d} accent />
              <AdminMetricCard label="Próximos 90 dias" value={data.counts.next90d} />
            </div>
          </div>
        </AdminCard>
      </section>

      <section className="ec-section" aria-label="Eventos por dia">
        <p className="urban-admin-eyebrow ec-section-title">EVENTOS POR DIA · PRÓXIMOS 30 DIAS</p>
        <AdminCard>
          <div className="ec-chart-wrap">
            <svg
              className="ec-chart"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 16}`}
              role="img"
              aria-label={`Histograma de eventos por dia nos próximos 30 dias, total ${data.counts.next30d}`}
            >
              {bars.map((b, i) => (
                <g key={b.date}>
                  <rect
                    className={b.count > 0 ? "ec-bar" : "ec-bar-empty"}
                    x={b.x}
                    y={b.count > 0 ? b.y : CHART_HEIGHT - 1}
                    width={b.width}
                    height={b.count > 0 ? b.height : 1}
                  >
                    <title>{`${shortDay(b.date)}: ${b.count} evento(s)`}</title>
                  </rect>
                  {i % CHART_LABEL_EVERY === 0 && (
                    <text className="ec-axis-label" x={b.x} y={CHART_HEIGHT + 12}>
                      {shortDay(b.date)}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
          <p className="ec-muted">
            Dias sem barra não têm nenhum evento: buracos na agenda reduzem as recomendações para os anfitriões.
          </p>
        </AdminCard>
      </section>

      <section className="ec-section" aria-label="Por fonte">
        <p className="urban-admin-eyebrow ec-section-title">POR FONTE</p>
        <AdminTable
          columns={columns}
          rows={data.sources}
          rowKey={(s) => s.source}
          empty={<AdminEmptyState eyebrow="Sem dados" title="Nenhuma fonte de eventos encontrada" />}
        />
      </section>

      <section className="ec-section" aria-label="Qualidade dos dados">
        <p className="urban-admin-eyebrow ec-section-title">QUALIDADE · PRÓXIMOS 30 DIAS</p>
        <AdminCard>
          <div className="ec-quality">
            <div className="ec-quality-item">
              <p className="urban-admin-eyebrow-muted">Com coordenadas</p>
              <span className="ec-quality-value">{formatPct(data.quality.geocodedPct)}</span>
              <p className="ec-muted">
                {data.quality.missingGeocode30d} sem lat/lng (mínimo {data.target.minGeocodedPct}%).
              </p>
            </div>
            <div className="ec-quality-item">
              <p className="urban-admin-eyebrow-muted">Com categoria</p>
              <span className="ec-quality-value">{formatPct(data.quality.withCategoryPct)}</span>
              <p className="ec-muted">{data.quality.missingCategory30d} sem categoria.</p>
            </div>
            <div className="ec-quality-item">
              <p className="urban-admin-eyebrow-muted">Duplicatas em revisão</p>
              <span className="ec-quality-value">{data.duplicatesPendingReview.total}</span>
              <p className="ec-muted">
                {data.duplicatesPendingReview.high} de alta confiança.{" "}
                <Link className="ec-link" href="/admin/events/dedup">
                  Revisar
                </Link>
              </p>
            </div>
          </div>
        </AdminCard>
      </section>

      <section className="ec-section" aria-label="O que fazer">
        <p className="urban-admin-eyebrow ec-section-title">O QUE FAZER</p>
        {hints.length === 0 ? (
          <AdminCard variant="subtle">
            <p className="ec-muted">Nada a fazer: meta atingida com fontes saudáveis e dados completos.</p>
          </AdminCard>
        ) : (
          <ul className="ec-hints">
            {hints.map((h) => (
              <li key={h.key}>
                <AdminCard variant="subtle">
                  <div className="ec-hint">
                    <div className="ec-hint-head">
                      <AdminBadge
                        kind={h.severity === "critical" ? "error" : h.severity === "warning" ? "warn" : "neutral"}
                      >
                        {h.severity === "critical" ? "Crítico" : h.severity === "warning" ? "Atenção" : "Info"}
                      </AdminBadge>
                      <p className="ec-hint-title">{h.title}</p>
                    </div>
                    <p className="ec-muted">{h.body}</p>
                    <div className="ec-hint-actions">
                      {h.href && (
                        <Link className="ec-link" href={h.href}>
                          {h.hrefLabel ?? "Abrir"}
                        </Link>
                      )}
                      {h.runbook && <span className="ec-code">Runbook: {h.runbook}</span>}
                    </div>
                  </div>
                </AdminCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Escopo e outras opções">
        <AdminCard variant="subtle">
          <p className="ec-muted">
            Escopo: {data.scope.description} Regiões ativas:{" "}
            {data.scope.regions.length > 0
              ? data.scope.regions.map((r) => `${r.name} (${r.status})`).join(", ")
              : "nenhuma"}
            . Sem eventos suficientes de forma automática, use o{" "}
            <Link className="ec-link" href="/admin/events/import">
              import por CSV
            </Link>{" "}
            ou o{" "}
            <Link className="ec-link" href="/admin/events/new">
              cadastro manual
            </Link>
            . Atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR")}.
          </p>
        </AdminCard>
      </section>
    </div>
  );
}
