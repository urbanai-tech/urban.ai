"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminEventRadar,
  fetchAdminEventRadarBlindSpots,
  fetchAdminEventRadarDetail,
  fetchAdminEventRadarHeatmap,
  recomputeAdminEventIntelligence,
  type AdminEventRadarBlindSpot,
  type AdminEventRadarBlindSpotsResponse,
  type AdminEventRadarDetail,
  type AdminEventRadarEvent,
  type AdminEventRadarFilters,
  type AdminEventRadarHeatmapMetric,
  type AdminEventRadarHeatmapResponse,
  type AdminEventRadarResponse,
  type EventRadarConfidence,
} from "../../service/api";
import { formatLocalDate } from "../../lib/date";
import {
  AdminBadge,
  AdminButton,
  AdminDrawer,
  AdminEmptyState,
  AdminInput,
  AdminMetricCard,
  AdminPageLoading,
  AdminSectionHeader,
  AdminSelect,
  AdminTable,
  Icons,
  type AdminTableColumn,
  useAdminToast,
} from "../_components";
import {
  GEO_OPS_FOCUS_OPTIONS,
  HEATMAP_METRICS,
  confidenceKind,
  confidenceLabel,
  formatCents,
  formatDate,
  formatDateTime,
  integer,
  modeColor,
  prioritizeEvents,
  severityKind,
  uniqueList,
  type GeoOpsFocus,
} from "./event-radar-domain";
import {
  ContractBanner,
  FilterStatusStrip,
  KpiHealthFooter,
  RadarCommandStrip,
} from "./event-radar-summary";
import { BlindSpotOpsSummary, GeoOpsHeatmapPanel } from "./event-radar-geo";
import {
  DetailActions,
  EventDetail,
  EvidenceStatus,
  OperationalStatus,
  ScoreCell,
} from "./event-radar-detail";

export default function AdminEventRadarPage() {
  const [radar, setRadar] = useState<AdminEventRadarResponse | null>(null);
  const [heatmap, setHeatmap] = useState<AdminEventRadarHeatmapResponse | null>(null);
  const [blindSpots, setBlindSpots] = useState<AdminEventRadarBlindSpotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(() => toInputDate(new Date()));
  const [to, setTo] = useState(() => toInputDate(addDays(new Date(), 30)));
  const [scope, setScope] = useState<"in" | "out" | "all">("in");
  const [confidence, setConfidence] = useState<EventRadarConfidence | "all">("all");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [heatmapMetric, setHeatmapMetric] = useState<AdminEventRadarHeatmapMetric>("demand");
  const [geoOpsFocus, setGeoOpsFocus] = useState<GeoOpsFocus>("all");
  const [selected, setSelected] = useState<AdminEventRadarEvent | null>(null);
  const [detail, setDetail] = useState<AdminEventRadarDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const toast = useAdminToast();

  const filters = useMemo<AdminEventRadarFilters>(
    () => ({
      from,
      to,
      scope,
      confidence,
      category: category || undefined,
      source: source || undefined,
      search: search.trim() || undefined,
    }),
    [category, confidence, from, scope, search, source, to],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [radarData, heatmapData, blindSpotData] = await Promise.all([
        fetchAdminEventRadar(filters),
        fetchAdminEventRadarHeatmap({ ...filters, metric: heatmapMetric }),
        fetchAdminEventRadarBlindSpots(filters),
      ]);
      setRadar(radarData);
      setHeatmap(heatmapData);
      setBlindSpots(blindSpotData);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; userMessage?: string; message?: string };
      setError(
        e?.response?.status === 401 || e?.response?.status === 403
          ? "Acesso negado. Você precisa ser admin."
          : e?.userMessage || e?.message || "Erro ao carregar radar de demanda.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters, heatmapMetric]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(event: AdminEventRadarEvent) {
    setSelected(event);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await fetchAdminEventRadarDetail(event.id, event));
    } catch (err: unknown) {
      const e = err as { userMessage?: string; message?: string };
      toast.error(e?.userMessage || e?.message || "Não foi possível abrir o detalhe do evento.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleRecompute() {
    if (!detail) return;
    setRecomputing(true);
    try {
      const result = await recomputeAdminEventIntelligence(detail.event.id);
      toast.success(result.jobRunId ? `Reprocessamento agendado: ${result.jobRunId}` : "Reprocessamento agendado.");
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; userMessage?: string; message?: string };
      toast.error(
        e?.response?.status === 404
          ? "Endpoint de reprocessamento ainda não foi exposto pelo backend."
          : e?.userMessage || e?.message || "Falha ao reprocessar evento.",
      );
    } finally {
      setRecomputing(false);
    }
  }

  function resetFilters() {
    setFrom(toInputDate(new Date()));
    setTo(toInputDate(addDays(new Date(), 30)));
    setScope("in");
    setConfidence("all");
    setCategory("");
    setSource("");
    setSearch("");
    setHeatmapMetric("demand");
    setGeoOpsFocus("all");
  }

  if (loading && !radar) return <AdminPageLoading />;

  if (error || !radar) {
    return (
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "40px 32px" }}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar Radar de Demanda"
          body={error ?? "Resposta vazia."}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AdminButton variant="primary" onClick={load} leftIcon={<Icons.RefreshCw size={12} />}>
              Tentar novamente
            </AdminButton>
          }
        />
      </div>
    );
  }

  const endpointGaps = uniqueList([
    ...(radar.endpointGaps ?? []),
    ...(heatmap?.endpointGaps ?? []),
    ...(blindSpots?.endpointGaps ?? []),
  ]);
  const activeFilterCount = [
    scope !== "in",
    confidence !== "all",
    !!category,
    !!source,
    !!search.trim(),
    heatmapMetric !== "demand",
    geoOpsFocus !== "all",
  ].filter(Boolean).length;
  const prioritizedEvents = prioritizeEvents(radar.events);
  const highPriorityEvents = prioritizedEvents.filter((event) => (event.demandScore ?? 0) >= 75);
  const pricingGapEvents = prioritizedEvents.filter(
    (event) => (event.demandScore ?? 0) >= 75 && event.recommendationsGenerated === 0,
  );
  const dataRiskEvents = prioritizedEvents.filter(
    (event) => event.riskFlags.length > 0 || event.dataQualityFlags.length > 0,
  );
  const highSeverityBlindSpots = blindSpots?.items.filter((spot) => spot.severity === "high").length ?? 0;

  const eventColumns: AdminTableColumn<AdminEventRadarEvent>[] = [
    {
      key: "event",
      header: "Evento",
      render: (event) => (
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              maxWidth: 360,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 600,
              color: "var(--admin-text)",
            }}
            title={event.name}
          >
            {event.name}
          </p>
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--admin-text-muted)" }}>
            {formatDate(event.startsAt)} · {event.city}/{event.state}
          </p>
        </div>
      ),
    },
    {
      key: "score",
      header: "Score",
      width: 90,
      align: "center",
      render: (event) => <ScoreCell value={event.demandScore} />,
    },
    {
      key: "revenue",
      header: "Potencial",
      width: 130,
      align: "right",
      render: (event) => (
        <span style={{ fontFamily: "monospace", color: "var(--admin-text)" }}>
          {formatCents(event.revenuePotentialCents)}
        </span>
      ),
    },
    {
      key: "context",
      header: "Categoria/source",
      render: (event) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 12, color: "var(--admin-text)" }}>{event.category ?? "Sem categoria"}</span>
          <code style={{ fontSize: 11, color: "var(--admin-text-dim)" }}>{event.source ?? "sem source"}</code>
        </div>
      ),
    },
    {
      key: "impact",
      header: "Impacto",
      width: 150,
      align: "right",
      render: (event) => (
        <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
          <strong style={{ color: "var(--admin-text)" }}>{event.affectedPropertiesCount}</strong> imóveis
          <br />
          <strong style={{ color: "var(--admin-accent)" }}>{event.recommendationsGenerated}</strong> recs
        </div>
      ),
    },
    {
      key: "confidence",
      header: "Confiança",
      width: 120,
      render: (event) => (
        <AdminBadge kind={confidenceKind(event.confidence)}>
          {confidenceLabel(event.confidence)}
        </AdminBadge>
      ),
    },
    {
      key: "evidence",
      header: "Dados",
      width: 170,
      render: (event) => <EvidenceStatus event={event} />,
    },
    {
      key: "ops",
      header: "Status",
      width: 210,
      render: (event) => <OperationalStatus event={event} />,
    },
    {
      key: "action",
      header: "",
      width: 36,
      align: "right",
      render: () => <Icons.ChevronRight size={14} style={{ color: "var(--admin-text-dim)" }} />,
    },
  ];

  const blindSpotColumns: AdminTableColumn<AdminEventRadarBlindSpot>[] = [
    {
      key: "severity",
      header: "Sev.",
      width: 90,
      render: (spot) => <AdminBadge kind={severityKind(spot.severity)}>{spot.severity}</AdminBadge>,
    },
    {
      key: "spot",
      header: "Blind spot",
      render: (spot) => (
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, color: "var(--admin-text)", overflowWrap: "anywhere" }}>{spot.title}</p>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--admin-text-muted)", overflowWrap: "anywhere" }}>
            {spot.eventName ?? spot.city ?? "Sem evento vinculado"} · {spot.blockedBy}
          </p>
        </div>
      ),
    },
    {
      key: "potential",
      header: "Potencial",
      width: 120,
      align: "right",
      render: (spot) => (
        <span style={{ fontFamily: "monospace", color: "var(--admin-text)" }}>
          {formatCents(spot.revenuePotentialCents)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Ação recomendada",
      render: (spot) => (
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)", overflowWrap: "anywhere" }}>
          {spot.recommendedAction}
        </span>
      ),
    },
  ];

  return (
    <div
      className="admin-event-radar-page"
      style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 32px", overflowX: "hidden" }}
    >
      <AdminSectionHeader
        eyebrow="ADMIN · EVENT INTELLIGENCE"
        title="Radar de Demanda"
        subtitle="Demanda potencial, heatmap operacional, blind spots e impacto em imóveis para priorizar onde o motor de eventos gera ou perde receita."
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AdminButton variant="ghost" as="a" href="/admin/events" rightIcon={<Icons.ArrowRight size={11} />}>
              Eventos
            </AdminButton>
            <AdminButton variant="ghost" as="a" href="/admin/coverage" rightIcon={<Icons.ArrowRight size={11} />}>
              Cobertura
            </AdminButton>
            <AdminButton variant="ghost" as="a" href="/admin/collectors-health" rightIcon={<Icons.ArrowRight size={11} />}>
              Coletores
            </AdminButton>
            <AdminButton variant="secondary" onClick={load} disabled={loading} leftIcon={<Icons.RefreshCw size={12} />}>
            {loading ? "Atualizando…" : "Atualizar"}
            </AdminButton>
          </div>
        }
      />

      {radar.contractMode === "contract-fallback" && (
        <ContractBanner endpointGaps={endpointGaps} />
      )}

      <RadarCommandStrip
        radar={radar}
        heatmap={heatmap}
        highPriorityEvents={highPriorityEvents.length}
        pricingGapEvents={pricingGapEvents.length}
        dataRiskEvents={dataRiskEvents.length}
        highSeverityBlindSpots={highSeverityBlindSpots}
        endpointGaps={endpointGaps.length}
      />

      <section style={{ marginBottom: 36 }}>
        <div
          className="admin-event-radar-filters"
          style={{
            display: "grid",
            gridTemplateColumns: "var(--event-radar-filters-grid, repeat(auto-fit, minmax(150px, 1fr)))",
            gap: 12,
            alignItems: "end",
            padding: 12,
            border: "1px solid var(--admin-divider)",
            borderRadius: 2,
          }}
        >
          <AdminInput label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <AdminInput label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <AdminSelect label="Escopo" value={scope} onChange={(e) => setScope(e.target.value as "in" | "out" | "all")}>
            <option value="in">Dentro da cobertura</option>
            <option value="out">Fora da cobertura</option>
            <option value="all">Todos</option>
          </AdminSelect>
          <AdminSelect label="Confiança" value={confidence} onChange={(e) => setConfidence(e.target.value as EventRadarConfidence | "all")}>
            <option value="all">Todas</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </AdminSelect>
          <AdminSelect label="Categoria" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todas</option>
            {radar.categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </AdminSelect>
          <AdminSelect label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Todos</option>
            {radar.sources.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </AdminSelect>
          <AdminInput
            label="Busca"
            placeholder="Evento, cidade, venue…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftAddon={<Icons.Search size={12} />}
          />
          <AdminSelect
            label="Heatmap"
            value={heatmapMetric}
            onChange={(e) => setHeatmapMetric(e.target.value as AdminEventRadarHeatmapMetric)}
          >
            {HEATMAP_METRICS.map((metric) => (
              <option key={metric.value} value={metric.value}>
              {metric.label}
              </option>
            ))}
          </AdminSelect>
          <AdminSelect
            label="Foco Geo Ops"
            value={geoOpsFocus}
            onChange={(e) => setGeoOpsFocus(e.target.value as GeoOpsFocus)}
            data-testid="admin-event-radar-geo-focus"
          >
            {GEO_OPS_FOCUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AdminSelect>
          <FilterStatusStrip
            activeFilterCount={activeFilterCount}
            eventsCount={radar.events.length}
            prioritizedCount={prioritizedEvents.length}
            loading={loading}
            onReset={resetFilters}
          />
        </div>
      </section>

      <section style={{ marginBottom: 48 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 18 }}>
          KPIs DO RADAR
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 28,
            borderTop: "1px solid var(--admin-divider)",
            borderBottom: "1px solid var(--admin-divider)",
          }}
        >
          <AdminMetricCard
            label="Demanda potencial"
            value={integer.format(radar.kpis.demandPotentialScore)}
            sub="score somado"
            accent
          />
          <AdminMetricCard
            label="Receita influenciada"
            value={formatCents(radar.kpis.revenuePotentialCents)}
            sub="potencial estimado"
          />
          <AdminMetricCard
            label="Alto potencial"
            value={radar.kpis.highPotentialEvents}
            status={radar.kpis.highPotentialEvents > 0 ? "warn" : undefined}
          />
          <AdminMetricCard label="Imóveis impactados" value={radar.kpis.affectedProperties} />
          <AdminMetricCard label="Recomendações" value={radar.kpis.recommendationsGenerated} />
          <AdminMetricCard
            label="Alta demanda sem preço"
            value={radar.kpis.highPotentialWithoutRecommendation}
            status={radar.kpis.highPotentialWithoutRecommendation > 0 ? "error" : undefined}
          />
          <AdminMetricCard label="Confiança média" value={`${radar.kpis.averageConfidencePercent}%`} />
          <AdminMetricCard label="Cobertura ponderada" value={`${radar.kpis.weightedCoveragePercent}%`} />
        </div>
        <KpiHealthFooter
          pricingGapEvents={pricingGapEvents.length}
          dataRiskEvents={dataRiskEvents.length}
          weightedCoveragePercent={radar.kpis.weightedCoveragePercent}
          averageConfidencePercent={radar.kpis.averageConfidencePercent}
        />
      </section>

      <section
        className="admin-event-radar-main-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "var(--event-radar-main-grid, minmax(0, 1.55fr) minmax(320px, 0.9fr))",
          gap: 24,
          marginBottom: 48,
        }}
      >
        <div>
          <header
            className="admin-event-radar-section-header"
            style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 16 }}
          >
            <div>
              <p className="urban-admin-eyebrow">TABELA PRIORIZADA</p>
              <h2 style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 600, color: "var(--admin-text)" }}>
                {prioritizedEvents.length} eventos por potencial
              </h2>
            </div>
            <p
              style={{
                margin: 0,
                alignSelf: "end",
                fontSize: 12,
                color: "var(--admin-text-muted)",
                overflowWrap: "anywhere",
              }}
            >
              Clique na linha para abrir detalhe operacional.
            </p>
          </header>
          <AdminTable
            columns={eventColumns}
            rows={prioritizedEvents}
            rowKey={(row) => row.id}
            onRowClick={openDetail}
            maxHeight={560}
            minWidth={1080}
            empty={<AdminEmptyState title="Nenhum evento nesse filtro" body="Amplie o período, escopo ou fonte." />}
          />
        </div>

        <div>
          <header style={{ marginBottom: 16 }}>
            <p className="urban-admin-eyebrow">HEATMAP ADMIN</p>
            <h2 style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 600, color: "var(--admin-text)" }}>
              Células por cidade
            </h2>
          </header>
          <GeoOpsHeatmapPanel
            heatmap={heatmap}
            metric={heatmapMetric}
            focus={geoOpsFocus}
            events={prioritizedEvents}
            blindSpots={blindSpots?.items ?? []}
          />
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <p className="urban-admin-eyebrow">BLIND SPOTS</p>
            <h2 style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 600, color: "var(--admin-text)" }}>
              Bloqueios com ação clara
            </h2>
          </div>
          {blindSpots && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <AdminBadge kind="error">High {blindSpots.summary.high}</AdminBadge>
              <AdminBadge kind="warn">Medium {blindSpots.summary.medium}</AdminBadge>
              <AdminBadge kind="neutral">Low {blindSpots.summary.low}</AdminBadge>
            </div>
          )}
        </header>
        {blindSpots && <BlindSpotOpsSummary blindSpots={blindSpots.items} />}
        <AdminTable
          columns={blindSpotColumns}
          rows={blindSpots?.items ?? []}
          rowKey={(row) => row.id}
          onRowClick={(spot) => {
            const event = radar.events.find((item) => item.id === spot.eventId);
            if (event) openDetail(event);
          }}
          minWidth={900}
          empty={
            <AdminEmptyState
              title="Sem blind spots nesse recorte"
              body="O motor não encontrou bloqueios relevantes para os filtros atuais."
            />
          }
        />
      </section>

      <footer
        style={{
          paddingTop: 20,
          borderTop: "1px solid var(--admin-divider)",
          fontSize: 12,
          color: "var(--admin-text-muted)",
          lineHeight: 1.6,
        }}
      >
        Snapshot em {formatDateTime(radar.generatedAt)} · modo{" "}
        <strong style={{ color: modeColor(radar.contractMode) }}>{radar.contractMode}</strong>. O objetivo desta
        tela é priorizar operação: corrigir dados que travam pricing, abrir cobertura onde há demanda e reprocessar
        eventos com maior potencial financeiro.
      </footer>

      <AdminDrawer
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setDetail(null);
        }}
        eyebrow="DETALHE OPERACIONAL"
        title={detail?.event.name ?? selected?.name ?? "Evento"}
        width={760}
        footer={
          <DetailActions
            detail={detail}
            recomputing={recomputing}
            onRecompute={handleRecompute}
          />
        }
      >
        {detailLoading && (
          <p style={{ margin: 0, color: "var(--admin-text-muted)", fontSize: 13 }}>
            Carregando detalhe…
          </p>
        )}
        {!detailLoading && detail && <EventDetail detail={detail} />}
        {!detailLoading && selected && !detail && (
          <AdminEmptyState
            title="Detalhe indisponível"
            body="Não foi possível carregar o detalhe agora. Tente novamente ou use a listagem de eventos."
          />
        )}
      </AdminDrawer>
      <style jsx>{`
        .admin-event-radar-page {
          --event-radar-main-grid: minmax(0, 1.55fr) minmax(320px, 0.9fr);
          --event-radar-command-grid: repeat(4, minmax(0, 1fr));
          --event-radar-health-grid: repeat(4, minmax(0, 1fr));
          --event-radar-hotspots-grid: repeat(3, minmax(0, 1fr));
          --event-radar-geo-ops-grid: repeat(4, minmax(0, 1fr));
          --event-radar-geo-lists-grid: repeat(2, minmax(0, 1fr));
          --event-radar-detail-hero-grid: minmax(0, 1.2fr) minmax(0, 0.8fr);
          --event-radar-filters-grid: repeat(auto-fit, minmax(150px, 1fr));
          --event-radar-heatmap-grid: repeat(auto-fit, minmax(150px, 1fr));
        }

        @media (max-width: 1180px) {
          .admin-event-radar-page {
            --event-radar-main-grid: 1fr;
            --event-radar-command-grid: repeat(2, minmax(0, 1fr));
            --event-radar-health-grid: repeat(2, minmax(0, 1fr));
            --event-radar-hotspots-grid: repeat(3, minmax(0, 1fr));
            --event-radar-geo-ops-grid: repeat(2, minmax(0, 1fr));
            --event-radar-detail-hero-grid: 1fr;
          }
        }

        @media (max-width: 767px) {
          .admin-event-radar-page {
            --event-radar-command-grid: 1fr;
            --event-radar-health-grid: 1fr;
            --event-radar-hotspots-grid: 1fr;
            --event-radar-geo-ops-grid: 1fr;
            --event-radar-geo-lists-grid: 1fr;
            --event-radar-filters-grid: 1fr;
            --event-radar-heatmap-grid: 1fr;
          }

          .admin-event-radar-section-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .admin-geo-ops-radar-map-canvas {
            min-height: 240px !important;
          }
        }
      `}</style>
    </div>
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toInputDate(date: Date) {
  return formatLocalDate(date);
}
