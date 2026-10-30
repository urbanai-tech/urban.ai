import type { ReactNode } from "react";
import type { AdminEventRadarHeatmapResponse, AdminEventRadarResponse } from "../../service/api";
import { AdminBadge, AdminButton, Icons, type AdminBadgeKind } from "../_components";
import { integer, scoreColor, topHeatmapCell } from "./event-radar-domain";
import styles from "./event-radar-summary.module.css";

export function ContractBanner({ endpointGaps }: { endpointGaps: string[] }) {
  return (
    <section
      className={styles.fallbackBanner}
    >
      <Icons.AlertTriangle size={16} className={styles.warningIcon} />
      <div>
        <p className={styles.fallbackTitle}>
          Usando fallback contratual do front.
        </p>
        <p className={styles.fallbackText}>
          A tela já está navegável, mas os dados econômicos são adaptados de `/admin/events/analytics` e
          `/admin/events/list` até o backend expor os endpoints reais.
        </p>
        {endpointGaps.length > 0 && (
          <p className={styles.fallbackGaps}>
            Gaps: {endpointGaps.join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}

export function RadarCommandStrip({
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
      className={styles.summaryGrid}
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
      className={styles.statCard}
    >
      <span
        className={`${styles.statIcon} ${
          kind === "error" ? styles.statIconError : kind === "warn" ? styles.statIconWarn : ""
        }`}
      >
        {icon}
      </span>
      <div className={styles.statBody}>
        <p className={`urban-admin-eyebrow-muted ${styles.statLabel}`}>
          {label}
        </p>
        <p
          className={styles.statValue}
          title={String(value)}
        >
          {value}
        </p>
        <div className={styles.statBadge}>
          <AdminBadge kind={kind}>{detail}</AdminBadge>
        </div>
      </div>
    </div>
  );
}

export function KpiHealthFooter({
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
      className={styles.healthGrid}
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
    <div
      className={styles.healthCard}
      style={{ "--score-color": scoreColor(clamped), "--pct": `${clamped}%` } as React.CSSProperties}
    >
      <div className={styles.healthHeader}>
        <p className="urban-admin-eyebrow-muted">{label}</p>
        <span className={styles.healthPercent}>{clamped}%</span>
      </div>
      <div className={styles.healthTrack}>
        <div className={styles.healthFill} />
      </div>
      <div className={styles.healthBadge}>
        <AdminBadge kind={kind}>{detail}</AdminBadge>
      </div>
    </div>
  );
}

function HealthCounter({ label, value, kind }: { label: string; value: number; kind: AdminBadgeKind }) {
  return (
    <div className={styles.healthCard}>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p className={styles.healthCounterValue}>
        {integer.format(value)}
      </p>
      <AdminBadge kind={kind}>{value > 0 ? "ação pendente" : "sem bloqueio"}</AdminBadge>
    </div>
  );
}

export function FilterStatusStrip({
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
      className={styles.statusLine}
      aria-live="polite"
    >
      <span className={styles.label}>
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

