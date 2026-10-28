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
import styles from "./event-radar-detail.module.css";

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
      className={styles.decisionLayout}
    >
      <div className={styles.contentBlock}>
        <p className={`urban-admin-eyebrow-muted ${styles.decisionEyebrow}`}>
          DECISAO OPERACIONAL
        </p>
        <div className={styles.decisionBadges}>
          <AdminBadge kind={kind}>{decision}</AdminBadge>
          <AdminBadge kind={confidenceKind(event.confidence)}>{confidenceLabel(event.confidence)}</AdminBadge>
          <AdminBadge kind={evidenceReady ? "success" : "warn"}>
            {evidenceReady ? "Evidência rastreável" : "Leitura não auditada"}
          </AdminBadge>
          <AdminBadge kind={dataStatusKind(dataStatus)}>{dataStatusLabel(dataStatus)}</AdminBadge>
        </div>
        <p className={styles.decisionText}>
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
        className={styles.metricGrid}
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
    <div className={styles.detailStack}>
      {detail.contractMode === "contract-fallback" && (
        <div
          className={styles.fallbackNotice}
        >
          Detalhe em fallback contratual. Dados brutos, inteligência e impacto em imóveis devem ser substituídos por
          snapshots reais quando Lia/Nico expuserem os endpoints.
        </div>
      )}

      <EventDecisionHero detail={detail} />

      <section>
        <p className={`urban-admin-eyebrow-muted ${styles.sectionEyebrow}`}>
          RESUMO
        </p>
        <div className={styles.summaryBadges}>
          <AdminBadge kind={confidenceKind(event.confidence)}>{confidenceLabel(event.confidence)}</AdminBadge>
          <AdminBadge kind={event.geocodeStatus === "ok" ? "success" : "warn"}>Geo {event.geocodeStatus}</AdminBadge>
          <AdminBadge kind={event.enrichmentStatus === "ok" ? "success" : "warn"}>Enrich {event.enrichmentStatus}</AdminBadge>
          <AdminBadge kind={event.sourceStatus === "fresh" ? "success" : "neutral"}>Source {event.sourceStatus}</AdminBadge>
          <AdminBadge kind={dataStatusKind(dataStatus)}>{dataStatusLabel(dataStatus)}</AdminBadge>
          <AdminBadge kind={jobRunId ? "neutral" : "warn"}>{jobRunId ? `job ${shortTrace(jobRunId)}` : "sem jobRunId"}</AdminBadge>
        </div>
        <p className={styles.interpretationText}>
          {detail.intelligence.interpretation}
        </p>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className={styles.sourceLink}
          >
            Abrir fonte do evento <Icons.ExternalLink size={12} />
          </a>
        )}
      </section>

      <section className={styles.economicsGrid}>
        <MetricBlock label="Score demanda" value={event.demandScore ?? "—"} />
        <MetricBlock label="Potencial receita" value={formatCents(event.revenuePotentialCents)} />
        <MetricBlock label="Raio demanda" value={event.demandRadiusKm ? `${event.demandRadiusKm} km` : "—"} />
        <MetricBlock label="Público esperado" value={event.expectedAttendance ? integer.format(event.expectedAttendance) : "—"} />
        <MetricBlock label="Imóveis impactados" value={detail.operation.affectedPropertiesCount} />
        <MetricBlock label="Recomendações" value={detail.operation.recommendationsGenerated} />
      </section>

      <section>
        <p className={`urban-admin-eyebrow-muted ${styles.sectionEyebrow}`}>
          DADOS BRUTOS
        </p>
        <div className={styles.rawDataGrid}>
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
        <p className={`urban-admin-eyebrow-muted ${styles.sectionEyebrow}`}>
          DRIVERS
        </p>
        {detail.intelligence.drivers.length > 0 ? (
          <div className={styles.driverList}>
            {detail.intelligence.drivers.map((driver) => (
              <div key={driver.key} className={styles.driverCard}>
                <div className={styles.driverHeader}>
                  <strong className={styles.driverLabel}>{driver.label}</strong>
                  <span className={styles.driverWeight}>
                    {driver.weight}
                  </span>
                </div>
                <p className={styles.driverExplanation}>
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
        <p className={`urban-admin-eyebrow-muted ${styles.sectionEyebrow}`}>
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
          <p className={`urban-admin-eyebrow-muted ${styles.sectionEyebrow}`}>
            RISCOS E QUALIDADE
          </p>
          <div className={styles.riskBadges}>
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
        <div className={styles.contentBlock}>
          <p className={styles.propertyName}>{row.propertyName}</p>
          <p className={styles.propertyMeta}>
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
    <div className={styles.statusBadges}>
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
    <div className={styles.evidenceStack}>
      <div>
        <AdminBadge kind={dataStatusKind(event.dataStatus)}>{dataStatusLabel(event.dataStatus)}</AdminBadge>
      </div>
      <code className={styles.evidenceJobRun}>
        {event.jobRunId ? `job ${shortTrace(event.jobRunId)}` : "sem jobRunId"}
      </code>
      <span className={styles.evidenceModel}>
        {event.modelVersion ?? "sem modelVersion"}
      </span>
    </div>
  );
}

export function ScoreCell({ value }: { value: number | null }) {
  if (value === null) return <span className={styles.scoreEmpty}>—</span>;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={styles.scoreCell}>
      <span style={{ fontFamily: "monospace", fontWeight: 700, color: scoreColor(value), fontSize: 13 }}>
        {value}
      </span>
      <div className={styles.scoreTrack}>
        <div style={{ width: `${pct}%`, height: "100%", background: scoreColor(value) }} />
      </div>
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.contentBlock}>
      <p className={styles.miniStatLabel}>
        {label}
      </p>
      <p className={styles.miniStatValue}>
        {value}
      </p>
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.metricBlock}>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p className={styles.metricValue}>
        {value}
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className={styles.detailRowLabel}>
        {label}
      </p>
      <p className={styles.detailRowValue}>
        {value}
      </p>
    </div>
  );
}
