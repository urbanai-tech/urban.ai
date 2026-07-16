import type { AdminEventRadarDetail, AdminEventRadarEvent } from "../../service/api";
import {
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminTable,
  Icons,
  type AdminBadgeKind,
  type AdminTableColumn,
} from "../_components";
import {
  actionKind,
  actionLabel,
  confidenceKind,
  confidenceLabel,
  dataStatusKind,
  dataStatusLabel,
  formatCents,
  formatDateTime,
  formatMultiplier,
  formatPriceRange,
  formatProbability,
  integer,
  isEnterpriseEvidenceReady,
  scoreColor,
  shortTrace,
  uniqueList,
} from "./event-radar-domain";

function EventDecisionHero({ detail }: { detail: AdminEventRadarDetail }) {
  const event = detail.event;
  const topImpact = [...detail.propertyImpact].sort(
    (a, b) => (b.propertyCaptureScore ?? -1) - (a.propertyCaptureScore ?? -1),
  )[0];
  const hasPricingGap = (event.demandScore ?? 0) >= 75 && detail.operation.recommendationsGenerated === 0;
  const dataStatus = detail.intelligence.dataStatus ?? event.dataStatus;
  const jobRunId = detail.intelligence.jobRunId ?? event.jobRunId;
  const evidenceReady = isEnterpriseEvidenceReady(detail);
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
          <AdminBadge kind={evidenceReady ? "success" : "warn"}>
            {evidenceReady ? "Evidência rastreável" : "Leitura não auditada"}
          </AdminBadge>
          <AdminBadge kind={dataStatusKind(dataStatus)}>{dataStatusLabel(dataStatus)}</AdminBadge>
        </div>
        <p style={{ margin: "12px 0 0", color: "var(--admin-text-muted)", fontSize: 12, lineHeight: 1.6, overflowWrap: "anywhere" }}>
          {hasPricingGap
            ? "Evento forte sem recomendação gerada: tratar antes de perder janela de demanda."
            : topImpact
              ? `Maior captura: ${topImpact.propertyName} (${topImpact.propertyCaptureScore ?? "-"}).`
              : "Sem imóvel ranqueado ainda para este evento."}
          {" "}
          {jobRunId ? `Trace: ${shortTrace(jobRunId)}.` : "Sem jobRunId persistido para auditoria forte."}
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

export function EventDetail({ detail }: { detail: AdminEventRadarDetail }) {
  const event = detail.event;
  const sourceUrl = event.officialUrl ?? event.crawledUrl;
  const dataStatus = detail.intelligence.dataStatus ?? event.dataStatus;
  const jobRunId = detail.intelligence.jobRunId ?? event.jobRunId;
  const dataQualityFlags = uniqueList([
    ...event.dataQualityFlags,
    ...(detail.intelligence.dataQualityFlags ?? []),
  ]);
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
          <AdminBadge kind={dataStatusKind(dataStatus)}>{dataStatusLabel(dataStatus)}</AdminBadge>
          <AdminBadge kind={jobRunId ? "neutral" : "warn"}>{jobRunId ? `job ${shortTrace(jobRunId)}` : "sem jobRunId"}</AdminBadge>
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
          <DetailRow label="Data status" value={dataStatusLabel(dataStatus)} />
          <DetailRow label="Job run" value={jobRunId ?? "—"} />
          <DetailRow label="Model" value={detail.intelligence.modelVersion ?? event.modelVersion ?? "—"} />
          <DetailRow label="Metric" value={detail.intelligence.metricVersion ?? event.metricVersion ?? "—"} />
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

      {(event.riskFlags.length > 0 || dataQualityFlags.length > 0) && (
        <section>
          <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 12 }}>
            RISCOS E QUALIDADE
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {event.riskFlags.map((flag) => (
              <AdminBadge key={flag} kind="error">{flag}</AdminBadge>
            ))}
            {dataQualityFlags.map((flag) => (
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

export function DetailActions({
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

export function OperationalStatus({ event }: { event: AdminEventRadarEvent }) {
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

export function EvidenceStatus({ event }: { event: AdminEventRadarEvent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <div>
        <AdminBadge kind={dataStatusKind(event.dataStatus)}>{dataStatusLabel(event.dataStatus)}</AdminBadge>
      </div>
      <code style={{ color: "var(--admin-text-dim)", fontSize: 11, overflowWrap: "anywhere" }}>
        {event.jobRunId ? `job ${shortTrace(event.jobRunId)}` : "sem jobRunId"}
      </code>
      <span style={{ color: "var(--admin-text-muted)", fontSize: 11, overflowWrap: "anywhere" }}>
        {event.modelVersion ?? "sem modelVersion"}
      </span>
    </div>
  );
}

export function ScoreCell({ value }: { value: number | null }) {
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

export function MiniStat({ label, value }: { label: string; value: string | number }) {
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
