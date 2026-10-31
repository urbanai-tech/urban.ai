"use client";

import Link from "next/link";
import type {
  EventChangesSummary,
  EventCoverageReport,
  EventCoverageSource,
  EventLeadTime,
} from "../../../service/api";
import {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminMetricCard,
  AdminTable,
  type AdminTableColumn,
} from "../../_components";
import { statusLabel } from "../../_lib/status-labels";
import {
  buildHints,
  formatDays,
  formatSinceIngest,
  histogramBars,
  progressPct,
  shortDay,
  sourceHealthMeta,
  statusMeta,
} from "../coverage-domain";

const CHART_WIDTH = 600;
const CHART_HEIGHT = 120;
const CHART_LABEL_EVERY = 5;

/**
 * Aba "Cobertura": número principal contra a meta, lead time e mudanças (resumo), histograma
 * diário, saúde por fonte e dicas do que fazer. Dados de GET /admin/event-coverage; lead time e
 * mudanças vêm dos endpoints irmãos e, se falharem, aparecem como "—" sem derrubar a aba.
 */
export default function CoberturaPanel({
  data,
  leadTime,
  changes,
  onOpenTab,
}: {
  data: EventCoverageReport;
  leadTime: EventLeadTime | null;
  changes: EventChangesSummary | null;
  onOpenTab: (tab: "qualidade" | "mudancas") => void;
}) {
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
      width: 170,
      render: (s) => (
        <span className="ec-muted">
          {s.health === "never_delivered"
            ? `nunca entregou (${s.daysWaiting ?? "?"} d de espera)`
            : formatSinceIngest(s.hoursSinceLastIngest)}
        </span>
      ),
    },
    {
      key: "window",
      header: "Janela",
      width: 90,
      align: "right",
      render: (s) => <span className="ec-muted">{s.windowHours} h</span>,
    },
  ];

  const medianLabel = leadTime ? formatDays(leadTime.overall.medianDays) : "—";
  const changeWindow = changes?.windowDays ?? 30;

  return (
    <>
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

      <section className="ec-section" aria-label="Lead time e mudanças">
        <p className="urban-admin-eyebrow ec-section-title">ANTECEDÊNCIA E MUDANÇAS</p>
        <AdminCard>
          <div className="ec-kpis ec-kpis-flat">
            <AdminMetricCard
              label="Lead time mediano"
              value={medianLabel}
              sub={leadTime ? `meta ${leadTime.targetMedianDays} d · ${leadTime.overall.count} eventos` : undefined}
            />
            <AdminMetricCard label={`Remarcados (${changeWindow} d)`} value={changes ? changes.rescheduled + changes.postponed : "—"} />
            <AdminMetricCard label={`Cancelados (${changeWindow} d)`} value={changes ? changes.cancelled : "—"} />
            <AdminMetricCard
              label={`Possivelmente cancelados (${changeWindow} d)`}
              value={changes ? changes.possiblyCancelled : "—"}
            />
          </div>
          <p className="ec-muted">
            Lead time é a antecedência entre a primeira vez que o evento entrou e a data dele.{" "}
            <button type="button" className="ec-link ec-link-button" onClick={() => onOpenTab("qualidade")}>
              Ver distribuição
            </button>{" "}
            ·{" "}
            <button type="button" className="ec-link ec-link-button" onClick={() => onOpenTab("mudancas")}>
              Ver mudanças
            </button>
          </p>
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
              ? data.scope.regions.map((r) => `${r.name} (${statusLabel(r.status)})`).join(", ")
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
    </>
  );
}
