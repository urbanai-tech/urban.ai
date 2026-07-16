import type { ReactNode } from "react";
import type { AdminEventRadarHeatmapResponse, AdminEventRadarResponse } from "../../service/api";
import { AdminBadge, AdminButton, Icons, type AdminBadgeKind } from "../_components";
import { integer, scoreColor, topHeatmapCell } from "./event-radar-domain";

export function ContractBanner({ endpointGaps }: { endpointGaps: string[] }) {
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

