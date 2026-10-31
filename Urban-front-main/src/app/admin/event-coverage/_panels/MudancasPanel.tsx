"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  fetchEventChanges,
  type EventChangeRow,
  type EventChangeType,
  type EventChangesReport,
} from "../../../service/api";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminMetricCard,
  AdminPageLoading,
  AdminSelect,
  AdminTable,
  Icons,
  type AdminTableColumn,
} from "../../_components";
import {
  changeStackBars,
  changeTypeMeta,
  describeChange,
  formatSpDateTime,
  histogramBars,
  seriesTotals,
  shortDay,
} from "../coverage-domain";

const CHART_WIDTH = 600;
const CHART_HEIGHT = 120;
const CHART_LABEL_EVERY = 5;

const WINDOWS = [7, 30, 90] as const;

const TYPE_FILTERS: Array<{ value: string; label: string; types?: EventChangeType[] }> = [
  { value: "all", label: "Todas as mudanças" },
  { value: "rescheduled", label: "Remarcados e adiados", types: ["rescheduled", "postponed"] },
  { value: "cancelled", label: "Cancelados", types: ["cancelled"] },
  { value: "possibly_cancelled", label: "Possivelmente cancelados", types: ["possibly_cancelled", "reappeared"] },
  { value: "venue_url", label: "Local ou link mudou", types: ["venue_changed", "url_changed"] },
  { value: "first_seen", label: "Eventos novos", types: ["first_seen"] },
];

/**
 * Aba "Mudanças": o que mudou nos eventos entre ingestões. Remarcados, cancelados declarados pela
 * fonte e "possivelmente cancelados" (evento futuro que sumiu da fonte; nunca é apagado), mais a
 * série diária de eventos novos e de mudanças. Dados de GET /admin/event-coverage/changes.
 */
export default function MudancasPanel() {
  const [days, setDays] = useState<number>(30);
  const [filter, setFilter] = useState("all");
  const [data, setData] = useState<EventChangesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const types = TYPE_FILTERS.find((f) => f.value === filter)?.types;
      setData(await fetchEventChanges({ days, types, limit: 100 }));
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e?.response?.status;
      setError(status === 401 || status === 403 ? "Acesso negado." : e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  }, [days, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <AdminPageLoading />;

  if (error || !data) {
    return (
      <AdminEmptyState
        eyebrow="Erro"
        title="Falha ao carregar as mudanças"
        body={error ?? "Sem dados."}
        icon={<Icons.AlertCircle size={32} />}
        action={
          <AdminButton variant="primary" onClick={load}>
            Tentar novamente
          </AdminButton>
        }
      />
    );
  }

  const { summary, series } = data;
  const totals = seriesTotals(series);
  const newBars = histogramBars(
    series.map((d) => ({ date: d.date, count: d.firstSeen })),
    CHART_WIDTH,
    CHART_HEIGHT,
  );
  const changeBars = changeStackBars(series, CHART_WIDTH, CHART_HEIGHT);
  const labelEvery = series.length > 40 ? 10 : CHART_LABEL_EVERY;

  const columns: AdminTableColumn<EventChangeRow>[] = [
    {
      key: "type",
      header: "Mudança",
      width: 210,
      render: (r) => {
        const meta = changeTypeMeta(r.changeType);
        return <AdminBadge kind={meta.badge}>{meta.label}</AdminBadge>;
      },
    },
    {
      key: "event",
      header: "Evento",
      render: (r) => (
        <div>
          <p className="ec-event-name">{r.eventName ?? "(evento removido)"}</p>
          <p className="ec-muted">Data do evento: {formatSpDateTime(r.eventDate)}</p>
        </div>
      ),
    },
    {
      key: "detail",
      header: "O que mudou",
      render: (r) => <span className="ec-muted">{describeChange(r)}</span>,
    },
    {
      key: "source",
      header: "Fonte",
      width: 160,
      render: (r) => <span className="ec-source-name">{r.source ?? "—"}</span>,
    },
    {
      key: "detectedAt",
      header: "Detectado em",
      width: 140,
      render: (r) => <span className="ec-muted">{formatSpDateTime(r.detectedAt)}</span>,
    },
  ];

  return (
    <>
      <section className="ec-section" aria-label="Resumo das mudanças">
        <div className="ec-toolbar">
          <AdminSelect
            label="Janela"
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
            shellClassName="ec-select-shell"
          >
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                Últimos {w} dias
              </option>
            ))}
          </AdminSelect>
          <AdminButton
            variant="secondary"
            onClick={load}
            disabled={loading}
            leftIcon={<Icons.RefreshCw size={12} />}
          >
            {loading ? "Atualizando…" : "Atualizar"}
          </AdminButton>
        </div>
        <AdminCard>
          <div className="ec-kpis ec-kpis-flat">
            <AdminMetricCard label="Eventos novos" value={summary.firstSeen} />
            <AdminMetricCard label="Remarcados" value={summary.rescheduled + summary.postponed} />
            <AdminMetricCard label="Cancelados" value={summary.cancelled} />
            <AdminMetricCard
              label="Possivelmente cancelados"
              value={summary.possiblyCancelled}
              sub={`sumiram da fonte há ${data.config.possiblyCancelledDays}+ dias`}
            />
          </div>
          <p className="ec-muted">
            Local ou link mudou: {summary.venueChanged + summary.urlChanged} · Reapareceram: {summary.reappeared}.
            {!data.config.enabled && " O registro de histórico está desligado (EVENT_HISTORY_ENABLED)."}
            {data.config.enabled && !data.config.applyReschedule &&
              " Remarcações são registradas, mas a data do evento só é atualizada com EVENT_HISTORY_APPLY_RESCHEDULE."}
          </p>
        </AdminCard>
      </section>

      <section className="ec-section" aria-label="Eventos novos por dia">
        <p className="urban-admin-eyebrow ec-section-title">EVENTOS NOVOS POR DIA</p>
        <AdminCard>
          <div className="ec-chart-wrap">
            <svg
              className="ec-chart"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 16}`}
              role="img"
              aria-label={`Eventos novos por dia nos últimos ${series.length} dias, total ${totals.firstSeen}`}
            >
              {newBars.map((b, i) => (
                <g key={b.date}>
                  <rect
                    className={b.count > 0 ? "ec-bar" : "ec-bar-empty"}
                    x={b.x}
                    y={b.count > 0 ? b.y : CHART_HEIGHT - 1}
                    width={b.width}
                    height={b.count > 0 ? b.height : 1}
                  >
                    <title>{`${shortDay(b.date)}: ${b.count} novo(s)`}</title>
                  </rect>
                  {i % labelEvery === 0 && (
                    <text className="ec-axis-label" x={b.x} y={CHART_HEIGHT + 12}>
                      {shortDay(b.date)}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </AdminCard>
      </section>

      <section className="ec-section" aria-label="Remarcados e cancelados por dia">
        <p className="urban-admin-eyebrow ec-section-title">REMARCADOS E CANCELADOS POR DIA</p>
        <AdminCard>
          <div className="ec-chart-wrap">
            <svg
              className="ec-chart"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 16}`}
              role="img"
              aria-label={`Mudanças por dia nos últimos ${series.length} dias: ${totals.rescheduled} remarcados, ${totals.cancelled} cancelados, ${totals.possiblyCancelled} possivelmente cancelados`}
            >
              {changeBars.map((b, i) => (
                <g key={b.date}>
                  {b.segments.length === 0 && (
                    <rect className="ec-bar-empty" x={b.x} y={CHART_HEIGHT - 1} width={b.width} height={1}>
                      <title>{`${shortDay(b.date)}: nenhuma mudança`}</title>
                    </rect>
                  )}
                  {b.segments.map((s) => (
                    <rect
                      key={s.key}
                      className={
                        s.key === "rescheduled"
                          ? "ec-bar-resched"
                          : s.key === "cancelled"
                            ? "ec-bar-cancel"
                            : "ec-bar-possible"
                      }
                      x={b.x}
                      y={s.y}
                      width={b.width}
                      height={s.height}
                    >
                      <title>{`${shortDay(b.date)}: ${s.count} ${
                        s.key === "rescheduled"
                          ? "remarcado(s)"
                          : s.key === "cancelled"
                            ? "cancelado(s)"
                            : "possivelmente cancelado(s)"
                      }`}</title>
                    </rect>
                  ))}
                  {i % labelEvery === 0 && (
                    <text className="ec-axis-label" x={b.x} y={CHART_HEIGHT + 12}>
                      {shortDay(b.date)}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
          <ul className="ec-legend" aria-label="Legenda">
            <li>
              <span className="ec-swatch ec-swatch-resched" aria-hidden="true" /> Remarcados ({totals.rescheduled})
            </li>
            <li>
              <span className="ec-swatch ec-swatch-cancel" aria-hidden="true" /> Cancelados ({totals.cancelled})
            </li>
            <li>
              <span className="ec-swatch ec-swatch-possible" aria-hidden="true" /> Possivelmente cancelados (
              {totals.possiblyCancelled})
            </li>
          </ul>
        </AdminCard>
      </section>

      <section className="ec-section" aria-label="Mudanças recentes">
        <p className="urban-admin-eyebrow ec-section-title">MUDANÇAS RECENTES</p>
        <div className="ec-toolbar">
          <AdminSelect
            label="Tipo"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            shellClassName="ec-select-shell"
          >
            {TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </AdminSelect>
        </div>
        <AdminTable
          columns={columns}
          rows={data.recent}
          rowKey={(r) => r.id}
          minWidth={860}
          empty={
            <AdminEmptyState
              eyebrow="Sem mudanças"
              title="Nenhuma mudança nesta janela"
              body="Quando uma fonte remarcar, cancelar ou deixar de listar um evento futuro, ele aparece aqui. Eventos nunca são apagados."
            />
          }
        />
      </section>

      <section aria-label="Como ler">
        <AdminCard variant="subtle">
          <p className="ec-muted">
            Remarcação, local e link são comparados só entre envios da mesma fonte; cancelamento vale quando a fonte
            informa o status. &ldquo;Possivelmente cancelado&rdquo; é um aviso: o evento segue na base e volta a
            &ldquo;reapareceu&rdquo; se a fonte o listar de novo. Fontes de curadoria manual e fontes inteiras paradas não
            geram esse aviso (veja{" "}
            <Link className="ec-link" href="/admin/collectors-health">
              coletores
            </Link>
            ). Atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR")}.
          </p>
        </AdminCard>
      </section>
    </>
  );
}
