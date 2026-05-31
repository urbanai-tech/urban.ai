"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchAdminEventRadar,
  fetchAdminEventRadarBlindSpots,
  fetchAdminEventRadarDetail,
  fetchAdminEventRadarHeatmap,
  recomputeAdminEventIntelligence,
  type AdminEventRadarBlindSpot,
  type AdminEventRadarBlindSpotsResponse,
  type AdminEventRadarContractMode,
  type AdminEventRadarDetail,
  type AdminEventRadarEvent,
  type AdminEventRadarFilters,
  type AdminEventRadarHeatmapCell,
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
import type { AdminBadgeKind } from "../_components";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat("pt-BR");

const HEATMAP_METRICS: Array<{ value: AdminEventRadarHeatmapMetric; label: string }> = [
  { value: "demand", label: "Demanda" },
  { value: "revenue", label: "Receita" },
  { value: "events", label: "Eventos" },
  { value: "properties", label: "Imóveis" },
  { value: "blind_spots", label: "Blind spots" },
  { value: "coverage", label: "Cobertura" },
];

type GeoOpsFocus = "all" | "hotspots" | "coverage_gaps" | "missing_geo" | "revenue";

const GEO_OPS_FOCUS_OPTIONS: Array<{ value: GeoOpsFocus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "hotspots", label: "Hotspots" },
  { value: "coverage_gaps", label: "Gaps cobertura" },
  { value: "missing_geo", label: "Sem geo" },
  { value: "revenue", label: "Maior receita" },
];

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

        @média (max-width: 1180px) {
          .admin-event-radar-page {
            --event-radar-main-grid: 1fr;
            --event-radar-command-grid: repeat(2, minmax(0, 1fr));
            --event-radar-health-grid: repeat(2, minmax(0, 1fr));
            --event-radar-hotspots-grid: repeat(3, minmax(0, 1fr));
            --event-radar-geo-ops-grid: repeat(2, minmax(0, 1fr));
            --event-radar-detail-hero-grid: 1fr;
          }
        }

        @média (max-width: 767px) {
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

function ContractBanner({ endpointGaps }: { endpointGaps: string[] }) {
  return (
    <section
      style={{
        marginBottom: 28,
        padding: "14px 16px",
        border: "1px solid rgba(245, 181, 71, 0.3)",
        borderRadius: 2,
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 12,
        color: "var(--admin-text-muted)",
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      <Icons.AlertTriangle size={16} style={{ color: "var(--admin-warning)", marginTop: 2 }} />
      <div>
        <p style={{ margin: 0, color: "var(--admin-warning)", fontWeight: 600 }}>
          Usando fallback contratual do front.
        </p>
        <p style={{ margin: "4px 0 0" }}>
          A tela já está navegável, mas os dados econômicos são adaptados de `/admin/events/analytics` e
          `/admin/events/list` até o backend expor os endpoints reais.
        </p>
        {endpointGaps.length > 0 && (
          <p style={{ margin: "8px 0 0", fontFamily: "monospace", fontSize: 11, overflowWrap: "anywhere" }}>
            Gaps: {endpointGaps.join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}

function RadarCommandStrip({
  radar,
  heatmap,
  highPriorityEvents,
  pricingGapEvents,
  dataRiskEvents,
  highSeverityBlindSpots,
  endpointGaps,
}: {
  radar: AdminEventRadarResponse;
  heatmap: AdminEventRadarHeatmapResponse | null;
  highPriorityEvents: number;
  pricingGapEvents: number;
  dataRiskEvents: number;
  highSeverityBlindSpots: number;
  endpointGaps: number;
}) {
  const topCell = topHeatmapCell(heatmap);
  const modeKind: AdminBadgeKind = radar.contractMode === "backend" ? "success" : "warn";

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "var(--event-radar-command-grid, repeat(4, minmax(0, 1fr)))",
        gap: 12,
        marginBottom: 28,
      }}
      aria-label="Resumo operacional do radar"
    >
      <CommandTile
        icon={<Icons.Activity size={16} />}
        label="Modo de dados"
        value={radar.contractMode === "backend" ? "Backend" : "Fallback"}
        detail={endpointGaps > 0 ? `${endpointGaps} gaps` : "contrato completo"}
        kind={modeKind}
      />
      <CommandTile
        icon={<Icons.Zap size={16} />}
        label="Alta prioridade"
        value={highPriorityEvents}
        detail={pricingGapEvents > 0 ? `${pricingGapEvents} sem pricing` : "pricing coberto"}
        kind={pricingGapEvents > 0 ? "error" : highPriorityEvents > 0 ? "warn" : "neutral"}
      />
      <CommandTile
        icon={<Icons.MapPin size={16} />}
        label="Hotspot"
        value={topCell?.label ?? "Sem célula"}
        detail={topCell ? `${integer.format(topCell.eventDemandScore)} score` : "ajuste filtros"}
        kind={topCell ? "warn" : "neutral"}
      />
      <CommandTile
        icon={<Icons.AlertTriangle size={16} />}
        label="Bloqueios"
        value={highSeverityBlindSpots}
        detail={`${dataRiskEvents} eventos com flags`}
        kind={highSeverityBlindSpots > 0 ? "error" : dataRiskEvents > 0 ? "warn" : "success"}
      />
    </section>
  );
}

function CommandTile({
  icon,
  label,
  value,
  detail,
  kind,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  kind: AdminBadgeKind;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: "14px 16px",
        border: "1px solid var(--admin-divider)",
        borderRadius: 2,
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 12,
        alignItems: "start",
      }}
    >
      <span
        style={{
          color: kind === "error" ? "var(--admin-danger)" : kind === "warn" ? "var(--admin-warning)" : "var(--admin-accent)",
          lineHeight: 0,
          marginTop: 1,
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 8 }}>
          {label}
        </p>
        <p
          style={{
            margin: 0,
            color: "var(--admin-text)",
            fontSize: 16,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={String(value)}
        >
          {value}
        </p>
        <div style={{ marginTop: 8 }}>
          <AdminBadge kind={kind}>{detail}</AdminBadge>
        </div>
      </div>
    </div>
  );
}

function KpiHealthFooter({
  pricingGapEvents,
  dataRiskEvents,
  weightedCoveragePercent,
  averageConfidencePercent,
}: {
  pricingGapEvents: number;
  dataRiskEvents: number;
  weightedCoveragePercent: number;
  averageConfidencePercent: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "var(--event-radar-health-grid, repeat(4, minmax(0, 1fr)))",
        gap: 12,
        marginTop: 16,
      }}
    >
      <HealthMeter
        label="Cobertura"
        value={weightedCoveragePercent}
        detail={weightedCoveragePercent >= 70 ? "saudável" : "atenção em malha"}
      />
      <HealthMeter
        label="Confiança"
        value={averageConfidencePercent}
        detail={averageConfidencePercent >= 70 ? "sinal consistente" : "validar fontes"}
      />
      <HealthCounter
        label="Gaps de pricing"
        value={pricingGapEvents}
        kind={pricingGapEvents > 0 ? "error" : "success"}
      />
      <HealthCounter
        label="Flags de dados"
        value={dataRiskEvents}
        kind={dataRiskEvents > 0 ? "warn" : "success"}
      />
    </div>
  );
}

function HealthMeter({ label, value, detail }: { label: string; value: number; detail: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const kind: AdminBadgeKind = clamped >= 70 ? "success" : clamped >= 45 ? "warn" : "error";

  return (
    <div style={{ minWidth: 0, border: "1px solid var(--admin-divider)", borderRadius: 2, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <p className="urban-admin-eyebrow-muted">{label}</p>
        <span style={{ color: "var(--admin-text)", fontFamily: "monospace", fontSize: 13 }}>{clamped}%</span>
      </div>
      <div style={{ height: 4, marginTop: 10, background: "var(--admin-divider)", overflow: "hidden" }}>
        <div style={{ width: `${clamped}%`, height: "100%", background: scoreColor(clamped) }} />
      </div>
      <div style={{ marginTop: 10 }}>
        <AdminBadge kind={kind}>{detail}</AdminBadge>
      </div>
    </div>
  );
}

function HealthCounter({ label, value, kind }: { label: string; value: number; kind: AdminBadgeKind }) {
  return (
    <div style={{ minWidth: 0, border: "1px solid var(--admin-divider)", borderRadius: 2, padding: 12 }}>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p style={{ margin: "9px 0 8px", color: "var(--admin-text)", fontFamily: "monospace", fontSize: 18 }}>
        {integer.format(value)}
      </p>
      <AdminBadge kind={kind}>{value > 0 ? "ação pendente" : "sem bloqueio"}</AdminBadge>
    </div>
  );
}

function FilterStatusStrip({
  activeFilterCount,
  eventsCount,
  prioritizedCount,
  loading,
  onReset,
}: {
  activeFilterCount: number;
  eventsCount: number;
  prioritizedCount: number;
  loading: boolean;
  onReset: () => void;
}) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        paddingTop: 4,
        borderTop: "1px solid var(--admin-divider)",
        color: "var(--admin-text-muted)",
        fontSize: 12,
      }}
      aria-live="polite"
    >
      <span style={{ overflowWrap: "anywhere" }}>
        {loading ? "Atualizando recorte…" : `${prioritizedCount} de ${eventsCount} eventos priorizados`}
        {activeFilterCount > 0
          ? ` · ${activeFilterCount} filtro${activeFilterCount > 1 ? "s" : ""} ativo${activeFilterCount > 1 ? "s" : ""}`
          : ""}
      </span>
      {activeFilterCount > 0 && (
        <AdminButton variant="ghost" size="sm" onClick={onReset} leftIcon={<Icons.Close size={11} />}>
          Limpar filtros
        </AdminButton>
      )}
    </div>
  );
}

function _HeatmapPanel({
  heatmap,
  metric,
}: {
  heatmap: AdminEventRadarHeatmapResponse | null;
  metric: AdminEventRadarHeatmapMetric;
}) {
  if (!heatmap || heatmap.cells.length === 0) {
    return (
      <AdminEmptyState
        title="Sem células para o heatmap"
        body="Ajuste os filtros para visualizar demanda por região."
      />
    );
  }

  const max = Math.max(...heatmap.cells.map((cell) => heatmapValue(cell, metric)), 1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
      {heatmap.cells.map((cell) => {
        const value = heatmapValue(cell, metric);
        const intensity = Math.max(0.12, Math.min(0.75, value / max));
        return (
          <div
            key={cell.cellId}
            style={{
              minHeight: 132,
              padding: 14,
              border: "1px solid var(--admin-divider)",
              borderRadius: 2,
              background: `rgba(232, 80, 10, ${intensity * 0.28})`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--admin-text)",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={cell.label}
              >
                {cell.label}
              </p>
              <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--admin-text-muted)" }}>
                {cell.dominantCategory ?? "categoria mista"}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
              <MiniStat label="Score" value={cell.eventDemandScore} />
              <MiniStat label="Eventos" value={cell.eventsCount} />
              <MiniStat label="Imóveis" value={cell.affectedPropertiesCount} />
              <MiniStat label="Cobertura" value={`${cell.coverageScore}%`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GeoOpsHeatmapPanel({
  heatmap,
  metric,
  focus,
  events,
  blindSpots,
}: {
  heatmap: AdminEventRadarHeatmapResponse | null;
  metric: AdminEventRadarHeatmapMetric;
  focus: GeoOpsFocus;
  events: AdminEventRadarEvent[];
  blindSpots: AdminEventRadarBlindSpot[];
}) {
  if (!heatmap || heatmap.cells.length === 0) {
    return (
      <AdminEmptyState
        title="Sem células para o heatmap"
        body="Ajuste os filtros para visualizar demanda por região."
      />
    );
  }

  const missingGeoEvents = events.filter(isEventMissingGeo);
  const revenueEvents = [...events]
    .filter((event) => (event.revenuePotentialCents ?? 0) > 0)
    .sort((a, b) => (b.revenuePotentialCents ?? 0) - (a.revenuePotentialCents ?? 0));
  const max = Math.max(...heatmap.cells.map((cell) => heatmapValue(cell, metric)), 1);
  const revenueMax = Math.max(...heatmap.cells.map((cell) => cell.revenuePotentialCents), 0);
  const opsCells = heatmap.cells.map((cell) => {
    const value = heatmapValue(cell, metric);
    const missingGeoCount = missingGeoEvents.filter((event) => eventMatchesCell(event, cell)).length;
    const regionBlindSpots = blindSpots.filter((spot) => blindSpotMatchesCell(spot, cell)).length;
    const action = heatmapOperationalAction(cell, missingGeoCount, regionBlindSpots, revenueMax);

    return {
      cell,
      value,
      intensity: Math.max(0.12, Math.min(0.75, value / max)),
      missingGeoCount,
      regionBlindSpots,
      action,
      tags: heatmapFocusTags(cell, value, max, missingGeoCount, regionBlindSpots, revenueMax),
    };
  });
  const filteredCells = focus === "all" ? opsCells : opsCells.filter((item) => item.tags.includes(focus));
  const topCells = [...opsCells].sort((a, b) => b.value - a.value).slice(0, 3);
  const hotCells = opsCells.filter((item) => item.tags.includes("hotspots")).length;
  const coverageGapCells = opsCells.filter((item) => item.tags.includes("coverage_gaps")).length;
  const revenueCellCount = opsCells.filter((item) => item.tags.includes("revenue")).length;
  const topOpportunityRevenue = revenueEvents
    .slice(0, 5)
    .reduce((sum, event) => sum + (event.revenuePotentialCents ?? 0), 0);

  return (
    <div data-testid="admin-geo-ops-heatmap" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        data-testid="admin-geo-ops-summary"
        style={{
          display: "grid",
          gridTemplateColumns: "var(--event-radar-geo-ops-grid, repeat(4, minmax(0, 1fr)))",
          gap: 10,
        }}
      >
        <GeoOpsStat
          label="Hotspots"
          value={hotCells}
          detail={topCells[0]?.cell.label ?? "sem região quente"}
          kind={hotCells > 0 ? "warn" : "neutral"}
          testId="geo-ops-hotspots"
        />
        <GeoOpsStat
          label="Gaps cobertura"
          value={coverageGapCells}
          detail="malha ou confiança baixa"
          kind={coverageGapCells > 0 ? "error" : "success"}
          testId="geo-ops-coverage-gaps"
        />
        <GeoOpsStat
          label="Eventos sem geo"
          value={missingGeoEvents.length}
          detail="travam heatmap e pricing"
          kind={missingGeoEvents.length > 0 ? "error" : "success"}
          testId="geo-ops-missing-geo"
        />
        <GeoOpsStat
          label="Receita top 5"
          value={formatCents(topOpportunityRevenue)}
          detail={`${revenueCellCount} regiões com upside`}
          kind={revenueCellCount > 0 ? "accent" : "neutral"}
          testId="geo-ops-revenue-opportunities"
        />
      </div>

      <div
        style={{
          padding: "12px 14px",
          border: "1px solid var(--admin-divider)",
          borderRadius: 2,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "var(--admin-text)", fontSize: 13, fontWeight: 600 }}>
            Métrica: {metricLabel(metric)} / foco: {geoOpsFocusLabel(focus)}
          </p>
          <p style={{ margin: "5px 0 0", color: "var(--admin-text-muted)", fontSize: 12, overflowWrap: "anywhere" }}>
            {filteredCells.length} de {opsCells.length} células visíveis. Cores indicam intensidade; badge indica a próxima ação operacional.
          </p>
        </div>
        <div
          aria-hidden
          style={{
            width: 96,
            height: 8,
            background: "linear-gradient(90deg, rgba(232,80,10,0.06), rgba(232,80,10,0.36))",
            border: "1px solid var(--admin-divider)",
          }}
        />
      </div>

      {filteredCells.length > 0 && (
        <GeoOpsRadarMap items={filteredCells} metric={metric} max={max} />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "var(--event-radar-hotspots-grid, repeat(3, minmax(0, 1fr)))",
          gap: 10,
        }}
      >
        {topCells.map((item, index) => (
          <div
            key={`${item.cell.cellId}-top`}
            data-testid="admin-geo-hotspot-card"
            style={{
              minWidth: 0,
              padding: "10px 12px",
              border: "1px solid var(--admin-divider)",
              borderRadius: 2,
            }}
          >
            <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 7 }}>
              Hotspot {index + 1}
            </p>
            <p
              style={{
                margin: 0,
                color: "var(--admin-text)",
                fontSize: 13,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={item.cell.label}
            >
              {item.cell.label}
            </p>
            <p style={{ margin: "6px 0 0", color: "var(--admin-text-muted)", fontSize: 11, overflowWrap: "anywhere" }}>
              {formatHeatmapValue(item.value, metric)} - {item.cell.eventsCount} eventos - {item.action.label}
            </p>
            <GeoCellMeta cell={item.cell} compact />
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "var(--event-radar-geo-lists-grid, repeat(2, minmax(0, 1fr)))",
          gap: 10,
        }}
      >
        <GeoOpsEventList
          title="Maior receita potencial"
          events={revenueEvents.slice(0, 3)}
          mode="revenue"
          testId="admin-geo-revenue-list"
        />
        <GeoOpsEventList
          title="Eventos sem geo"
          events={missingGeoEvents.slice(0, 3)}
          mode="geo"
          testId="admin-geo-missing-geo-list"
        />
      </div>

      <HeatmapLegend metric={metric} />

      {filteredCells.length === 0 ? (
        <AdminEmptyState
          title="Sem células nesse foco"
          body="Troque o foco Geo Ops ou amplie os filtros para ver regiões operacionais."
        />
      ) : (
        <div
          className="admin-event-radar-heatmap-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "var(--event-radar-heatmap-grid, repeat(auto-fit, minmax(150px, 1fr)))",
            gap: 10,
          }}
        >
          {filteredCells.map((item) => (
            <div
              key={item.cell.cellId}
              data-testid="admin-geo-ops-cell"
              data-cell-id={item.cell.cellId}
              title={`${item.cell.label}: ${metricLabel(metric)} ${formatHeatmapValue(item.value, metric)}`}
              style={{
                minHeight: 158,
                padding: 14,
                border: "1px solid var(--admin-divider)",
                borderTop: `3px solid rgba(232, 80, 10, ${Math.max(0.3, item.intensity)})`,
                borderRadius: 2,
                background: `rgba(232, 80, 10, ${item.intensity * 0.24})`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
                minWidth: 0,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <p className="urban-admin-eyebrow-muted">Valor</p>
                  <span style={{ color: "var(--admin-accent)", fontFamily: "monospace", fontSize: 12 }}>
                    {formatHeatmapValue(item.value, metric)}
                  </span>
                </div>
                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: 13,
                    color: "var(--admin-text)",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={item.cell.label}
                >
                  {item.cell.label}
                </p>
                <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--admin-text-muted)", overflowWrap: "anywhere" }}>
                  {item.cell.dominantCategory ?? "categoria mista"}
                </p>
                <GeoCellMeta cell={item.cell} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <AdminBadge kind={item.action.kind}>{item.action.label}</AdminBadge>
                {item.missingGeoCount > 0 && <AdminBadge kind="error">geo {item.missingGeoCount}</AdminBadge>}
                {item.regionBlindSpots > 0 && <AdminBadge kind="warn">spots {item.regionBlindSpots}</AdminBadge>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                <MiniStat label="Score" value={item.cell.eventDemandScore} />
                <MiniStat label="Eventos" value={item.cell.eventsCount} />
                <MiniStat label="Imóveis" value={item.cell.affectedPropertiesCount} />
                <MiniStat label="Cobertura" value={`${item.cell.coverageScore}%`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GeoOpsRadarMap({
  items,
  metric,
  max,
}: {
  items: Array<{
    cell: AdminEventRadarHeatmapCell;
    value: number;
    intensity: number;
    missingGeoCount: number;
    action: { label: string; detail: string; kind: AdminBadgeKind };
  }>;
  metric: AdminEventRadarHeatmapMetric;
  max: number;
}) {
  const geoItems = items.filter((item) => adminCellHasGeo(item.cell));
  const missingCenterCount = items.length - geoItems.length;
  const bounds = getAdminCellBounds(geoItems.map((item) => item.cell));

  return (
    <div
      data-testid="admin-geo-ops-radar-map"
      style={{
        border: "1px solid var(--admin-divider)",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        className="admin-geo-ops-radar-map-canvas"
        style={{
          minHeight: 300,
          position: "relative",
          background:
            "linear-gradient(0deg, rgba(14,17,22,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(14,17,22,0.035) 1px, transparent 1px), var(--admin-surface-muted)",
          backgroundSize: "32px 32px",
        }}
      >
        <AdminRadarOverlay />
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, flexWrap: "wrap", maxWidth: "calc(100% - 24px)" }}>
          <AdminBadge kind="accent">{geoItems.length} células no radar</AdminBadge>
          {missingCenterCount > 0 && <AdminBadge kind="warn">{missingCenterCount} sem centro</AdminBadge>}
        </div>

        {geoItems.length === 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 58,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              color: "var(--admin-text-muted)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Nenhuma célula com centro geográfico neste foco.
          </div>
        ) : (
          geoItems.map((item) => {
            const left = projectAdminCell(item.cell.centerLng as number, bounds.minLng, bounds.maxLng);
            const top = 100 - projectAdminCell(item.cell.centerLat as number, bounds.minLat, bounds.maxLat);
            const size = Math.max(54, Math.min(118, 48 + Math.max(0.12, item.value / max) * 64));

            return (
              <div
                key={`radar-${item.cell.cellId}`}
                data-testid="admin-geo-ops-radar-cell"
                data-cell-code={adminCellCode(item.cell)}
                title={`${item.cell.label}: ${formatHeatmapValue(item.value, metric)} - ${adminCellCode(item.cell)}`}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: `${top}%`,
                  width: size,
                  height: size,
                  transform: "translate(-50%, -50%)",
                  borderRadius: "50%",
                  border: `1px solid rgba(232, 80, 10, ${Math.max(0.28, item.intensity)})`,
                  background: `rgba(232, 80, 10, ${Math.max(0.10, item.intensity * 0.26)})`,
                  color: "var(--admin-accent)",
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  padding: 8,
                  boxShadow: "0 14px 30px rgba(14, 17, 22, 0.14)",
                }}
              >
                <span style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 800, lineHeight: 1 }}>
                  {formatHeatmapValue(item.value, metric)}
                </span>
                <span style={{ marginTop: 3, fontSize: 9, fontWeight: 700, lineHeight: 1.2 }}>
                  {item.action.label}
                </span>
              </div>
            );
          })
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
          padding: 12,
          borderTop: "1px solid var(--admin-divider)",
        }}
      >
        {items.slice(0, 3).map((item) => (
          <div key={`radar-meta-${item.cell.cellId}`} style={{ minWidth: 0 }}>
            <p style={{ margin: 0, color: "var(--admin-text)", fontSize: 12, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.cell.label}
            </p>
            <p style={{ margin: "4px 0 0", color: "var(--admin-text-muted)", fontSize: 11, overflowWrap: "anywhere" }}>
              {adminCellCode(item.cell)} - {item.missingGeoCount > 0 ? `${item.missingGeoCount} sem geo` : item.action.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminRadarOverlay() {
  return (
    <>
      {[34, 56, 78].map((size) => (
        <span
          key={size}
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${size}%`,
            aspectRatio: "1 / 1",
            transform: "translate(-50%, -50%)",
            border: "1px solid var(--admin-divider)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
      ))}
      <span aria-hidden style={{ position: "absolute", left: 38, right: 38, top: "50%", height: 1, background: "var(--admin-divider)" }} />
      <span aria-hidden style={{ position: "absolute", top: 38, bottom: 38, left: "50%", width: 1, background: "var(--admin-divider)" }} />
    </>
  );
}

function GeoCellMeta({ cell, compact }: { cell: AdminEventRadarHeatmapCell; compact?: boolean }) {
  return (
    <p style={{ margin: compact ? "6px 0 0" : "5px 0 0", fontSize: 10, color: "var(--admin-text-muted)", overflowWrap: "anywhere" }}>
      <span style={{ textTransform: "uppercase", fontWeight: 700 }}>{adminCellKind(cell)}</span>{" "}
      <span style={{ fontFamily: "monospace" }}>{adminCellCode(cell)}</span>
      {!adminCellHasGeo(cell) ? " - sem centro geo" : ""}
    </p>
  );
}

function GeoOpsStat({
  label,
  value,
  detail,
  kind,
  testId,
}: {
  label: string;
  value: string | number;
  detail: string;
  kind: AdminBadgeKind;
  testId: string;
}) {
  return (
    <div data-testid={testId} style={{ minWidth: 0, border: "1px solid var(--admin-divider)", borderRadius: 2, padding: 12 }}>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p
        style={{
          margin: "9px 0 8px",
          color: "var(--admin-text)",
          fontFamily: "monospace",
          fontSize: 18,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={String(value)}
      >
        {value}
      </p>
      <AdminBadge kind={kind} style={{ maxWidth: "100%" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</span>
      </AdminBadge>
    </div>
  );
}

function GeoOpsEventList({
  title,
  events,
  mode,
  testId,
}: {
  title: string;
  events: AdminEventRadarEvent[];
  mode: "revenue" | "geo";
  testId: string;
}) {
  return (
    <div data-testid={testId} style={{ minWidth: 0, border: "1px solid var(--admin-divider)", borderRadius: 2, padding: 12 }}>
      <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 10 }}>
        {title}
      </p>
      {events.length === 0 ? (
        <p style={{ margin: 0, color: "var(--admin-text-muted)", fontSize: 12 }}>
          Nenhum item neste recorte.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {events.map((event) => (
            <div key={`${mode}-${event.id}`} style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  color: "var(--admin-text)",
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={event.name}
              >
                {event.name}
              </p>
              <p style={{ margin: "4px 0 0", color: "var(--admin-text-muted)", fontSize: 11, overflowWrap: "anywhere" }}>
                {event.city}/{event.state} - {mode === "revenue" ? formatCents(event.revenuePotentialCents) : event.geocodeStatus}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlindSpotOpsSummary({ blindSpots }: { blindSpots: AdminEventRadarBlindSpot[] }) {
  const geo = blindSpots.filter((spot) => spot.kind === "missing_geocode" || spot.kind === "venue_gap").length;
  const pricing = blindSpots.filter((spot) => spot.kind === "no_pricing").length;
  const source = blindSpots.filter(
    (spot) => spot.kind === "missing_official_link" || spot.kind === "stale_source" || spot.kind === "duplicate_risk",
  ).length;
  const coverage = blindSpots.filter(
    (spot) => spot.kind === "low_coverage" || spot.kind === "out_of_scope_high_potential",
  ).length;
  const revenueAtRisk = blindSpots.reduce((sum, spot) => sum + (spot.revenuePotentialCents ?? 0), 0);

  return (
    <div
      data-testid="admin-geo-blindspot-summary"
      style={{
        display: "grid",
        gridTemplateColumns: "var(--event-radar-geo-ops-grid, repeat(4, minmax(0, 1fr)))",
        gap: 10,
        marginBottom: 14,
      }}
    >
      <GeoOpsStat label="Geo/dado" value={geo} detail="corrigir localização" kind={geo > 0 ? "error" : "success"} testId="geo-blindspots-geo" />
      <GeoOpsStat label="Pricing" value={pricing} detail="gerar recomendação" kind={pricing > 0 ? "error" : "success"} testId="geo-blindspots-pricing" />
      <GeoOpsStat label="Fonte" value={source} detail="validar crawler/link" kind={source > 0 ? "warn" : "success"} testId="geo-blindspots-source" />
      <GeoOpsStat label="Receita travada" value={formatCents(revenueAtRisk)} detail={`${coverage} gaps cobertura`} kind={coverage > 0 ? "warn" : "neutral"} testId="geo-blindspots-revenue" />
    </div>
  );
}

function _HeatmapPanelV2({
  heatmap,
  metric,
}: {
  heatmap: AdminEventRadarHeatmapResponse | null;
  metric: AdminEventRadarHeatmapMetric;
}) {
  if (!heatmap || heatmap.cells.length === 0) {
    return (
      <AdminEmptyState
        title="Sem células para o heatmap"
        body="Ajuste os filtros para visualizar demanda por região."
      />
    );
  }

  const max = Math.max(...heatmap.cells.map((cell) => heatmapValue(cell, metric)), 1);
  const hotCells = heatmap.cells.filter((cell) => heatmapValue(cell, metric) >= max * 0.66).length;
  const lowCoverageCells = heatmap.cells.filter((cell) => cell.coverageScore < 50).length;
  const sortedCells = [...heatmap.cells].sort((a, b) => heatmapValue(b, metric) - heatmapValue(a, metric));
  const topCells = sortedCells.slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          padding: "12px 14px",
          border: "1px solid var(--admin-divider)",
          borderRadius: 2,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "var(--admin-text)", fontSize: 13, fontWeight: 600 }}>
            Métrica: {metricLabel(metric)}
          </p>
          <p style={{ margin: "5px 0 0", color: "var(--admin-text-muted)", fontSize: 12, overflowWrap: "anywhere" }}>
            {hotCells} regiões quentes · {lowCoverageCells} com cobertura baixa
          </p>
        </div>
        <div
          aria-hidden
          style={{
            width: 96,
            height: 8,
            background: "linear-gradient(90deg, rgba(232,80,10,0.06), rgba(232,80,10,0.36))",
            border: "1px solid var(--admin-divider)",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "var(--event-radar-hotspots-grid, repeat(3, minmax(0, 1fr)))",
          gap: 10,
        }}
      >
        {topCells.map((cell, index) => (
          <div
            key={`${cell.cellId}-top`}
            style={{
              minWidth: 0,
              padding: "10px 12px",
              border: "1px solid var(--admin-divider)",
              borderRadius: 2,
            }}
          >
            <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 7 }}>
              Hotspot {index + 1}
            </p>
            <p
              style={{
                margin: 0,
                color: "var(--admin-text)",
                fontSize: 13,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={cell.label}
            >
              {cell.label}
            </p>
            <p style={{ margin: "6px 0 0", color: "var(--admin-text-muted)", fontSize: 11 }}>
              {formatHeatmapValue(heatmapValue(cell, metric), metric)} - {cell.eventsCount} eventos
            </p>
          </div>
        ))}
      </div>

      <HeatmapLegend metric={metric} />

      <div
        className="admin-event-radar-heatmap-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "var(--event-radar-heatmap-grid, repeat(auto-fit, minmax(150px, 1fr)))",
          gap: 10,
        }}
      >
        {heatmap.cells.map((cell) => {
          const value = heatmapValue(cell, metric);
          const intensity = Math.max(0.12, Math.min(0.75, value / max));
          return (
            <div
              key={cell.cellId}
              title={`${cell.label}: ${metricLabel(metric)} ${formatHeatmapValue(value, metric)}`}
              style={{
                minHeight: 132,
                padding: 14,
                border: "1px solid var(--admin-divider)",
                borderTop: `3px solid rgba(232, 80, 10, ${Math.max(0.3, intensity)})`,
                borderRadius: 2,
                background: `rgba(232, 80, 10, ${intensity * 0.28})`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
                minWidth: 0,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <p className="urban-admin-eyebrow-muted">Valor</p>
                  <span style={{ color: "var(--admin-accent)", fontFamily: "monospace", fontSize: 12 }}>
                    {formatHeatmapValue(value, metric)}
                  </span>
                </div>
                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: 13,
                    color: "var(--admin-text)",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={cell.label}
                >
                  {cell.label}
                </p>
                <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--admin-text-muted)", overflowWrap: "anywhere" }}>
                  {cell.dominantCategory ?? "categoria mista"}
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                <MiniStat label="Score" value={cell.eventDemandScore} />
                <MiniStat label="Eventos" value={cell.eventsCount} />
                <MiniStat label="Imóveis" value={cell.affectedPropertiesCount} />
                <MiniStat label="Cobertura" value={`${cell.coverageScore}%`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeatmapLegend({ metric }: { metric: AdminEventRadarHeatmapMetric }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        color: "var(--admin-text-muted)",
        fontSize: 11,
        borderTop: "1px solid var(--admin-divider)",
        paddingTop: 10,
      }}
    >
      <span>frio</span>
      <div
        aria-hidden
        style={{
          flex: 1,
          height: 6,
          background: "linear-gradient(90deg, rgba(232,80,10,0.06), rgba(232,80,10,0.18), rgba(232,80,10,0.42))",
          border: "1px solid var(--admin-divider)",
        }}
      />
      <span>quente por {metricLabel(metric).toLowerCase()}</span>
    </div>
  );
}

function EventDecisionHero({ detail }: { detail: AdminEventRadarDetail }) {
  const event = detail.event;
  const topImpact = [...detail.propertyImpact].sort(
    (a, b) => (b.propertyCaptureScore ?? -1) - (a.propertyCaptureScore ?? -1),
  )[0];
  const hasPricingGap = (event.demandScore ?? 0) >= 75 && detail.operation.recommendationsGenerated === 0;
  const decision =
    event.geocodeStatus !== "ok"
      ? "Corrigir geocoding"
      : hasPricingGap
        ? "Gerar pricing"
        : detail.operation.recommendationsGenerated > 0
          ? "Priorizar receita"
          : "Monitorar";
  const kind: AdminBadgeKind =
    event.geocodeStatus !== "ok" || hasPricingGap ? "error" : detail.operation.recommendationsGenerated > 0 ? "success" : "neutral";

  return (
    <section
      style={{
        border: "1px solid var(--admin-divider)",
        borderRadius: 2,
        padding: 16,
        display: "grid",
        gridTemplateColumns: "var(--event-radar-detail-hero-grid, minmax(0, 1.2fr) minmax(0, 0.8fr))",
        gap: 18,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 10 }}>
          DECISAO OPERACIONAL
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AdminBadge kind={kind}>{decision}</AdminBadge>
          <AdminBadge kind={confidenceKind(event.confidence)}>{confidenceLabel(event.confidence)}</AdminBadge>
        </div>
        <p style={{ margin: "12px 0 0", color: "var(--admin-text-muted)", fontSize: 12, lineHeight: 1.6, overflowWrap: "anywhere" }}>
          {hasPricingGap
            ? "Evento forte sem recomendação gerada: tratar antes de perder janela de demanda."
            : topImpact
              ? `Maior captura: ${topImpact.propertyName} (${topImpact.propertyCaptureScore ?? "-"}).`
              : "Sem imóvel ranqueado ainda para este evento."}
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
          minWidth: 0,
        }}
      >
        <MetricBlock label="Score" value={event.demandScore ?? "-"} />
        <MetricBlock label="Receita" value={formatCents(event.revenuePotentialCents)} />
        <MetricBlock label="Imóveis" value={detail.operation.affectedPropertiesCount} />
        <MetricBlock label="Recs" value={detail.operation.recommendationsGenerated} />
      </div>
    </section>
  );
}

function EventDetail({ detail }: { detail: AdminEventRadarDetail }) {
  const event = detail.event;
  const sourceUrl = event.officialUrl ?? event.crawledUrl;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {detail.contractMode === "contract-fallback" && (
        <div
          style={{
            padding: "12px 14px",
            border: "1px solid rgba(245, 181, 71, 0.3)",
            borderRadius: 2,
            color: "var(--admin-warning)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          Detalhe em fallback contratual. Dados brutos, inteligência e impacto em imóveis devem ser substituídos por
          snapshots reais quando Lia/Nico expuserem os endpoints.
        </div>
      )}

      <EventDecisionHero detail={detail} />

      <section>
        <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 12 }}>
          RESUMO
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <AdminBadge kind={confidenceKind(event.confidence)}>{confidenceLabel(event.confidence)}</AdminBadge>
          <AdminBadge kind={event.geocodeStatus === "ok" ? "success" : "warn"}>Geo {event.geocodeStatus}</AdminBadge>
          <AdminBadge kind={event.enrichmentStatus === "ok" ? "success" : "warn"}>Enrich {event.enrichmentStatus}</AdminBadge>
          <AdminBadge kind={event.sourceStatus === "fresh" ? "success" : "neutral"}>Source {event.sourceStatus}</AdminBadge>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-muted)", lineHeight: 1.6, overflowWrap: "anywhere" }}>
          {detail.intelligence.interpretation}
        </p>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 12,
              color: "var(--admin-accent)",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              overflowWrap: "anywhere",
            }}
          >
            Abrir fonte do evento <Icons.ExternalLink size={12} />
          </a>
        )}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <MetricBlock label="Score demanda" value={event.demandScore ?? "—"} />
        <MetricBlock label="Potencial receita" value={formatCents(event.revenuePotentialCents)} />
        <MetricBlock label="Raio demanda" value={event.demandRadiusKm ? `${event.demandRadiusKm} km` : "—"} />
        <MetricBlock label="Público esperado" value={event.expectedAttendance ? integer.format(event.expectedAttendance) : "—"} />
        <MetricBlock label="Imóveis impactados" value={detail.operation.affectedPropertiesCount} />
        <MetricBlock label="Recomendações" value={detail.operation.recommendationsGenerated} />
      </section>

      <section>
        <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 12 }}>
          DADOS BRUTOS
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <DetailRow label="Data" value={formatDateTime(event.startsAt)} />
          <DetailRow label="Cidade" value={`${event.city}/${event.state}`} />
          <DetailRow label="Categoria" value={event.category ?? "—"} />
          <DetailRow label="Venue" value={event.venueName ?? "—"} />
          <DetailRow label="Source" value={event.source ?? "—"} />
          <DetailRow label="Source ID" value={event.sourceId ?? "—"} />
          <DetailRow label="Dedup hash" value={event.dedupHash ?? "—"} />
          <DetailRow label="Lat/lng" value={event.latitude && event.longitude ? `${event.latitude}, ${event.longitude}` : "—"} />
        </div>
      </section>

      <section>
        <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 12 }}>
          DRIVERS
        </p>
        {detail.intelligence.drivers.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {detail.intelligence.drivers.map((driver) => (
              <div key={driver.key} style={{ border: "1px solid var(--admin-divider)", borderRadius: 2, padding: 12, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, minWidth: 0 }}>
                  <strong style={{ color: "var(--admin-text)", fontSize: 13, overflowWrap: "anywhere" }}>{driver.label}</strong>
                  <span style={{ fontFamily: "monospace", color: "var(--admin-accent)", fontSize: 12 }}>
                    {driver.weight}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--admin-text-muted)", lineHeight: 1.55, overflowWrap: "anywhere" }}>
                  {driver.explanation}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <AdminEmptyState
            title="Sem drivers calculados"
            body="O backend ainda não retornou explicações de score para este evento."
          />
        )}
      </section>

      <section>
        <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 12 }}>
          IMPACTO EM IMÓVEIS
        </p>
        {detail.propertyImpact.length > 0 ? (
          <PropertyImpactTable detail={detail} />
        ) : (
          <AdminEmptyState
            title="Endpoint de impacto ainda pendente"
            body="Aguardando GET /admin/events/:eventId/property-impact para exibir imóveis, hosts, curva de absorção e ação recomendada."
          />
        )}
      </section>

      {(event.riskFlags.length > 0 || event.dataQualityFlags.length > 0) && (
        <section>
          <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 12 }}>
            RISCOS E QUALIDADE
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {event.riskFlags.map((flag) => (
              <AdminBadge key={flag} kind="error">{flag}</AdminBadge>
            ))}
            {event.dataQualityFlags.map((flag) => (
              <AdminBadge key={flag} kind="warn">{flag}</AdminBadge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PropertyImpactTable({ detail }: { detail: AdminEventRadarDetail }) {
  const columns: AdminTableColumn<(typeof detail.propertyImpact)[number]>[] = [
    {
      key: "property",
      header: "Imóvel",
      render: (row) => (
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, color: "var(--admin-text)", overflowWrap: "anywhere" }}>{row.propertyName}</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--admin-text-muted)", overflowWrap: "anywhere" }}>
            {row.hostEmail ?? row.hostUserId ?? row.propertyId}
          </p>
        </div>
      ),
    },
    { key: "capture", header: "Captura", width: 90, align: "center", render: (row) => <ScoreCell value={row.propertyCaptureScore} /> },
    { key: "distance", header: "Dist.", width: 90, align: "right", render: (row) => <span>{row.distanceKm ? `${row.distanceKm} km` : "—"}</span> },
    { key: "current", header: "Atual", width: 100, align: "right", render: (row) => <span>{formatCents(row.currentPriceCents)}</span> },
    { key: "recommended", header: "Recom.", width: 100, align: "right", render: (row) => <span>{formatCents(row.recommendedPriceCents)}</span> },
    {
      key: "range",
      header: "Faixa",
      width: 140,
      align: "right",
      render: (row) => <span>{formatPriceRange(row.minAbsorbablePriceCents, row.maxAbsorbablePriceCents)}</span>,
    },
    {
      key: "multiplier",
      header: "Mult.",
      width: 90,
      align: "right",
      render: (row) => <span>{formatMultiplier(row.recommendedMultiplier)}</span>,
    },
    {
      key: "probability",
      header: "Chance",
      width: 90,
      align: "right",
      render: (row) => <span>{formatProbability(row.bookingProbability)}</span>,
    },
    {
      key: "expected",
      header: "Receita esp.",
      width: 120,
      align: "right",
      render: (row) => <span>{formatCents(row.expectedRevenueCents)}</span>,
    },
    {
      key: "action",
      header: "Ação",
      width: 100,
      render: (row) => <AdminBadge kind={actionKind(row.recommendedAction)}>{actionLabel(row.recommendedAction)}</AdminBadge>,
    },
  ];

  return (
    <AdminTable
      columns={columns}
      rows={detail.propertyImpact}
      rowKey={(row) => row.propertyId}
      minWidth={1120}
    />
  );
}

function DetailActions({
  detail,
  recomputing,
  onRecompute,
}: {
  detail: AdminEventRadarDetail | null;
  recomputing: boolean;
  onRecompute: () => void;
}) {
  const event = detail?.event;
  return (
    <>
      <AdminButton variant="ghost" as="a" href="/admin/jobs" rightIcon={<Icons.ArrowRight size={11} />}>
        Jobs
      </AdminButton>
      <AdminButton variant="ghost" as="a" href="/admin/coverage" rightIcon={<Icons.ArrowRight size={11} />}>
        Cobertura
      </AdminButton>
      <AdminButton
        variant="ghost"
        as="a"
        href={event ? `/admin/events?search=${encodeURIComponent(event.name)}` : "/admin/events"}
        rightIcon={<Icons.ArrowRight size={11} />}
      >
        Editar evento
      </AdminButton>
      <AdminButton
        variant="primary"
        onClick={onRecompute}
        disabled={!detail || recomputing}
        loading={recomputing}
        leftIcon={<Icons.RefreshCw size={12} />}
      >
        {recomputing ? "Reprocessando…" : "Reprocessar"}
      </AdminButton>
    </>
  );
}

function OperationalStatus({ event }: { event: AdminEventRadarEvent }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      <AdminBadge kind={event.geocodeStatus === "ok" ? "success" : event.geocodeStatus === "pending" ? "warn" : "error"}>
        geo {event.geocodeStatus}
      </AdminBadge>
      <AdminBadge kind={event.enrichmentStatus === "ok" ? "success" : event.enrichmentStatus === "failed" ? "error" : "warn"}>
        enrich {event.enrichmentStatus}
      </AdminBadge>
      <AdminBadge kind={event.sourceStatus === "fresh" ? "success" : event.sourceStatus === "stale" ? "warn" : "neutral"}>
        source {event.sourceStatus}
      </AdminBadge>
    </div>
  );
}

function ScoreCell({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "var(--admin-text-dim)" }}>—</span>;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4, minWidth: 58 }}>
      <span style={{ fontFamily: "monospace", fontWeight: 700, color: scoreColor(value), fontSize: 13 }}>
        {value}
      </span>
      <div style={{ height: 2, background: "var(--admin-divider)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: scoreColor(value) }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--admin-text-dim)" }}>
        {label}
      </p>
      <p style={{ margin: "3px 0 0", fontFamily: "monospace", color: "var(--admin-text)", fontSize: 12, overflowWrap: "anywhere" }}>
        {value}
      </p>
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ borderTop: "1px solid var(--admin-divider)", paddingTop: 10, minWidth: 0 }}>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p style={{ margin: "8px 0 0", color: "var(--admin-text)", fontFamily: "monospace", fontSize: 17, overflowWrap: "anywhere" }}>
        {value}
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--admin-text-muted)", fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--admin-text)", fontFamily: "monospace", overflowWrap: "anywhere" }}>
        {value}
      </p>
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

function formatCents(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return money.format(value / 100);
}

function formatPriceRange(min?: number | null, max?: number | null) {
  if (min === null || min === undefined) {
    return max === null || max === undefined ? formatCents(null) : `até ${formatCents(max)}`;
  }
  if (max === null || max === undefined) return `desde ${formatCents(min)}`;
  return `${formatCents(min)} - ${formatCents(max)}`;
}

function formatMultiplier(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}x`;
}

function formatProbability(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function confidenceLabel(confidence: EventRadarConfidence) {
  if (confidence === "high") return "Alta";
  if (confidence === "medium") return "Média";
  return "Baixa";
}

function confidenceKind(confidence: EventRadarConfidence): AdminBadgeKind {
  if (confidence === "high") return "success";
  if (confidence === "medium") return "warn";
  return "neutral";
}

function severityKind(severity: AdminEventRadarBlindSpot["severity"]): AdminBadgeKind {
  if (severity === "high") return "error";
  if (severity === "medium") return "warn";
  return "neutral";
}

function actionKind(action: AdminEventRadarDetail["propertyImpact"][number]["recommendedAction"]): AdminBadgeKind {
  if (action === "apply") return "success";
  if (action === "review") return "warn";
  if (action === "simulate") return "accent";
  return "neutral";
}

function actionLabel(action: AdminEventRadarDetail["propertyImpact"][number]["recommendedAction"]) {
  if (action === "apply") return "Aplicar";
  if (action === "simulate") return "Simular";
  if (action === "review") return "Revisar";
  return "Observar";
}

function scoreColor(score: number) {
  if (score >= 80) return "var(--admin-accent)";
  if (score >= 60) return "var(--admin-warning)";
  return "var(--admin-text-muted)";
}

function geoOpsFocusLabel(focus: GeoOpsFocus) {
  const option = GEO_OPS_FOCUS_OPTIONS.find((item) => item.value === focus);
  return option?.label ?? "Todos";
}

function isEventMissingGeo(event: AdminEventRadarEvent) {
  return event.geocodeStatus !== "ok" || event.latitude === null || event.longitude === null;
}

function adminCellHasGeo(cell: AdminEventRadarHeatmapCell) {
  return typeof cell.centerLat === "number" && Number.isFinite(cell.centerLat) && typeof cell.centerLng === "number" && Number.isFinite(cell.centerLng);
}

function adminCellCode(cell: AdminEventRadarHeatmapCell) {
  return cell.h3Index ?? cell.geohash ?? cell.cellId;
}

function adminCellKind(cell: AdminEventRadarHeatmapCell) {
  if (cell.h3Index) return "H3";
  if (cell.geohash) return "Geohash";
  if (cell.dataStatus === "derived_from_events") return "Derivada";
  return "Célula";
}

function getAdminCellBounds(cells: AdminEventRadarHeatmapCell[]) {
  const lats = cells.map((cell) => cell.centerLat).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const lngs = cells.map((cell) => cell.centerLng).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return {
    minLat: Math.min(...lats, -23.75),
    maxLat: Math.max(...lats, -23.45),
    minLng: Math.min(...lngs, -46.78),
    maxLng: Math.max(...lngs, -46.55),
  };
}

function projectAdminCell(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || max === min) return 50;
  return Math.min(86, Math.max(14, ((value - min) / (max - min)) * 72 + 14));
}

function eventMatchesCell(event: AdminEventRadarEvent, cell: AdminEventRadarHeatmapCell) {
  return sameRegion(event.city, event.state, cell.city, cell.state);
}

function blindSpotMatchesCell(spot: AdminEventRadarBlindSpot, cell: AdminEventRadarHeatmapCell) {
  return sameRegion(spot.city ?? null, null, cell.city, cell.state);
}

function sameRegion(city: string | null | undefined, state: string | null | undefined, cellCity: string, cellState: string) {
  const cityMatch = normalizeRegion(city) === normalizeRegion(cellCity);
  const normalizedState = normalizeRegion(state);
  const stateMatch = !normalizedState || normalizedState === normalizeRegion(cellState);
  return cityMatch && stateMatch;
}

function normalizeRegion(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function heatmapFocusTags(
  cell: AdminEventRadarHeatmapCell,
  value: number,
  max: number,
  missingGeoCount: number,
  regionBlindSpots: number,
  revenueMax: number,
) {
  const tags: GeoOpsFocus[] = [];
  if (value >= max * 0.66 || cell.eventDemandScore >= 75) tags.push("hotspots");
  if (cell.coverageScore < 50 || cell.averageConfidence < 60 || regionBlindSpots > 0) tags.push("coverage_gaps");
  if (missingGeoCount > 0) tags.push("missing_geo");
  if (cell.revenuePotentialCents > 0 && cell.revenuePotentialCents >= Math.max(1, revenueMax * 0.66)) tags.push("revenue");
  return tags;
}

function heatmapOperationalAction(
  cell: AdminEventRadarHeatmapCell,
  missingGeoCount: number,
  regionBlindSpots: number,
  revenueMax: number,
): { label: string; detail: string; kind: AdminBadgeKind } {
  if (missingGeoCount > 0) {
    return { label: "Corrigir geo", detail: `${missingGeoCount} eventos sem lat/lng`, kind: "error" };
  }
  if (cell.coverageScore < 50) {
    return { label: "Abrir cobertura", detail: `${cell.coverageScore}% cobertura`, kind: "warn" };
  }
  if (regionBlindSpots > 0) {
    return { label: "Resolver bloqueios", detail: `${regionBlindSpots} blind spots`, kind: "warn" };
  }
  if (cell.revenuePotentialCents > 0 && cell.revenuePotentialCents >= Math.max(1, revenueMax * 0.66)) {
    return { label: "Priorizar pricing", detail: formatCents(cell.revenuePotentialCents), kind: "accent" };
  }
  if (cell.eventDemandScore >= 75) {
    return { label: "Monitorar oferta", detail: `score ${cell.eventDemandScore}`, kind: "success" };
  }
  return { label: "Observar", detail: "sem ação critica", kind: "neutral" };
}

function heatmapValue(cell: AdminEventRadarHeatmapCell, metric: AdminEventRadarHeatmapMetric) {
  if (metric === "revenue") return cell.revenuePotentialCents;
  if (metric === "events") return cell.eventsCount;
  if (metric === "properties") return cell.affectedPropertiesCount;
  if (metric === "coverage") return 100 - cell.coverageScore;
  if (metric === "blind_spots") return 100 - cell.coverageScore + Math.max(0, 75 - cell.averageConfidence);
  return cell.eventDemandScore;
}

function topHeatmapCell(heatmap: AdminEventRadarHeatmapResponse | null) {
  if (!heatmap?.cells.length) return null;
  return [...heatmap.cells].sort((a, b) => b.eventDemandScore - a.eventDemandScore)[0] ?? null;
}

function metricLabel(metric: AdminEventRadarHeatmapMetric) {
  const found = HEATMAP_METRICS.find((item) => item.value === metric);
  return found?.label ?? metric;
}

function formatHeatmapValue(value: number, metric: AdminEventRadarHeatmapMetric) {
  if (metric === "revenue") return formatCents(value);
  if (metric === "coverage" || metric === "blind_spots") return `${Math.round(value)} pts`;
  return integer.format(value);
}

function prioritizeEvents(events: AdminEventRadarEvent[]) {
  return [...events].sort((a, b) => {
    const scoreDelta = (b.demandScore ?? -1) - (a.demandScore ?? -1);
    if (scoreDelta !== 0) return scoreDelta;
    const revenueDelta = (b.revenuePotentialCents ?? -1) - (a.revenuePotentialCents ?? -1);
    if (revenueDelta !== 0) return revenueDelta;
    const impactDelta = b.affectedPropertiesCount - a.affectedPropertiesCount;
    if (impactDelta !== 0) return impactDelta;
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  });
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function modeColor(mode: AdminEventRadarContractMode) {
  return mode === "backend" ? "var(--admin-success)" : "var(--admin-warning)";
}
