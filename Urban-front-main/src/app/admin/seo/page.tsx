"use client";

import type { CSSProperties } from "react";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminSectionHeader,
  AdminStatusDot,
  Icons,
} from "../_components";
import {
  adminSeoPanelData,
  type AdminSeoActionIcon,
  type AdminSeoBacklogItem,
  type AdminSeoConnectorReadinessItem,
  type AdminSeoCrawlerPolicy,
  type AdminSeoIntegrationRoadmapItem,
  type AdminSeoIntegrationStatus,
  type AdminSeoOperationalMetric,
  type AdminSeoScoreBreakdownItem,
  type AdminSeoStatusKind,
  type AdminSeoTechnicalStatusItem,
} from "../../lib/admin-seo-panel";

const {
  completion,
  scoreBreakdown,
  integrationRoadmap,
  connectorReadiness,
  operationalMetrics,
  technicalStatus,
  crawlerPolicy,
  aiSearchQuestions,
  backlog,
  actionCards,
} = adminSeoPanelData;

const actionIconMap: Record<AdminSeoActionIcon, typeof Icons.FileText> = {
  "file-text": Icons.FileText,
  check: Icons.Check,
  search: Icons.Search,
};

export default function AdminSeoPage() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN - SEO / SGO / GEO"
        title="Governanca de busca e AI Search"
        subtitle="Painel dedicado para indexacao, citabilidade em mecanismos generativos e backlog tecnico de descoberta organica."
        actions={
          <AdminBadge kind="accent">
            Atualizado {adminSeoPanelData.lastUpdatedLabel}
          </AdminBadge>
        }
      />

      <section style={{ marginBottom: 56 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 24 }}>
          OPERACAO DE MEDICAO
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 24,
            marginBottom: 24,
          }}
        >
          <AdminCard variant="accent">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <p className="urban-admin-eyebrow">{completion.label}</p>
                  <AdminBadge kind="accent">{completion.status}</AdminBadge>
                </div>
                <p style={{ margin: "12px 0 0", color: "var(--admin-text-muted)", fontSize: 13, lineHeight: 1.55 }}>
                  {completion.detail}
                </p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <strong style={{ display: "block", color: "var(--admin-text)", fontSize: 56, lineHeight: 0.95, fontWeight: 700 }}>
                  {completion.value}%
                </strong>
                <span style={{ color: "var(--admin-text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>
                  geral
                </span>
              </div>
            </div>

            <div style={{ marginTop: 22, height: 6, background: "rgba(255, 255, 255, 0.1)" }}>
              <div
                style={{
                  width: `${completion.value}%`,
                  height: "100%",
                  background: "var(--admin-accent)",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 22 }}>
              <ScoreMeta label="Formula" value={completion.formula} />
              <ScoreMeta label="Fonte atual" value={completion.trace.source} />
              <ScoreMeta label="Cadencia" value={completion.trace.cadence} />
              <ScoreMeta label="Atualizado" value={completion.trace.lastUpdatedLabel} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 20 }}>
              {scoreBreakdown.map((item) => (
                <ScoreBreakdown key={item.label} {...item} />
              ))}
            </div>
          </AdminCard>

          <AdminCard variant="subtle">
            <AdminCardHeader
              eyebrow="PROXIMAS INTEGRACOES"
              title="Da estimativa manual para dado real"
              actions={<AdminBadge kind="warn">Instrumentar</AdminBadge>}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {integrationRoadmap.map((integration) => (
                <IntegrationRow key={integration.name} {...integration} />
              ))}
            </div>
          </AdminCard>
        </div>

        <AdminCard variant="subtle" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 20px 0" }}>
            <AdminCardHeader
              eyebrow="INDICADORES OPERACIONAIS"
              title="Fonte, status e cadencia por medicao"
            />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr>
                  {["Indicador", "Valor", "Fonte atual", "Cadencia", "Status integracao", "Atualizado / proxima"].map((header) => (
                    <th key={header} style={thStyle}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {operationalMetrics.map((metric) => (
                  <OperationalMetricRow key={metric.label} {...metric} />
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 24,
          marginBottom: 56,
        }}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader
            eyebrow="STATUS TECNICO"
            title="Fundacao de rastreamento"
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {technicalStatus.map((item) => (
              <StatusTile key={item.label} {...item} />
            ))}
          </div>
        </AdminCard>

        <AdminCard variant="accent">
          <AdminCardHeader
            eyebrow="CRAWLER POLICY"
            title="Politica operacional"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {crawlerPolicy.map((policy) => (
              <PolicyRow key={policy.agent} {...policy} />
            ))}
          </div>
        </AdminCard>
      </section>

      <section style={{ marginBottom: 56 }}>
        <header style={{ marginBottom: 20 }}>
          <p className="urban-admin-eyebrow">READINESS 100%</p>
          <h2 style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 600, color: "var(--admin-text)", letterSpacing: -0.3 }}>
            Conectores prontos para dados reais
          </h2>
        </header>

        <AdminCard variant="subtle" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
              <thead>
                <tr>
                  {["Conector", "Readiness", "Variaveis", "Endpoint seguro", "Nota"].map((header) => (
                    <th key={header} style={thStyle}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {connectorReadiness.map((connector) => (
                  <ConnectorReadinessRow key={connector.name} {...connector} />
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      </section>

      <section style={{ marginBottom: 56 }}>
        <header style={{ marginBottom: 20 }}>
          <p className="urban-admin-eyebrow">MATRIZ AI SEARCH</p>
          <h2 style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 600, color: "var(--admin-text)", letterSpacing: -0.3 }}>
            Perguntas que a Urban precisa responder melhor que o mercado
          </h2>
        </header>

        <AdminCard variant="subtle" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead>
                <tr>
                  {["Cluster", "Pergunta", "Intencao", "Ativo fonte", "Readiness"].map((header) => (
                    <th key={header} style={thStyle}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aiSearchQuestions.map((row) => (
                  <tr key={row.question}>
                    <td style={tdStyle}>
                      <AdminBadge kind="neutral">{row.cluster}</AdminBadge>
                    </td>
                    <td style={{ ...tdStyle, color: "var(--admin-text)", fontWeight: 600 }}>
                      {row.question}
                    </td>
                    <td style={tdStyle}>{row.intent}</td>
                    <td style={tdStyle}>{row.asset}</td>
                    <td style={tdStyle}>
                      <Readiness value={row.readiness} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 24,
        }}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader
            eyebrow="BACKLOG P0 / P1 / P2"
            title="Fila priorizada"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {backlog.map((item) => (
              <BacklogRow key={item.title} {...item} />
            ))}
          </div>
        </AdminCard>

        <div style={{ display: "grid", gap: 16 }}>
          {actionCards.map((card) => {
            const Icon = actionIconMap[card.icon];

            return (
              <AdminCard key={card.title} variant="default">
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      border: "1px solid rgba(232, 80, 10, 0.35)",
                      borderRadius: 2,
                      color: "var(--admin-accent)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--admin-text)" }}>
                      {card.title}
                    </h3>
                    <p style={{ margin: "8px 0 16px", fontSize: 13, lineHeight: 1.55, color: "var(--admin-text-muted)" }}>
                      {card.body}
                    </p>
                    <AdminButton variant="secondary" size="sm" rightIcon={<Icons.ArrowRight size={12} />}>
                      {card.cta}
                    </AdminButton>
                  </div>
                </div>
              </AdminCard>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 56 }}>
        <AdminCard variant="accent">
          <AdminCardHeader
            eyebrow="CHECKPOINTS PARA 100%"
            title={`Lacunas que ainda seguram o score em ${completion.value}%`}
            actions={<AdminBadge kind="warn">{completion.remaining.length} pendencias</AdminBadge>}
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 20 }}>
            {completion.remaining.map((item) => (
              <div key={item} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <AdminStatusDot kind="warn" size={7} />
                <span style={{ color: "var(--admin-text-muted)", fontSize: 12, lineHeight: 1.5 }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </AdminCard>
      </section>
    </div>
  );
}

function ScoreMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ margin: 0, color: "var(--admin-text)", fontSize: 12, lineHeight: 1.45 }}>
        {value}
      </p>
    </div>
  );
}

function ScoreBreakdown({
  label,
  value,
  status,
}: AdminSeoScoreBreakdownItem) {
  return (
    <div
      style={{
        border: "1px solid var(--admin-divider)",
        borderRadius: 2,
        padding: 12,
        background: "rgba(255, 255, 255, 0.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AdminStatusDot kind={status} size={7} />
        <span style={{ color: "var(--admin-text-muted)", fontSize: 11, lineHeight: 1.35 }}>
          {label}
        </span>
      </div>
      <strong style={{ display: "block", marginTop: 8, color: "var(--admin-text)", fontSize: 20, lineHeight: 1 }}>
        {value}
      </strong>
    </div>
  );
}

function IntegrationRow({
  name,
  purpose,
  status,
  statusKind,
  trace,
}: AdminSeoIntegrationRoadmapItem) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(130px, 0.45fr) minmax(0, 1fr)",
        gap: 14,
        paddingBottom: 14,
        borderBottom: "1px solid var(--admin-divider)",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AdminStatusDot kind={statusKind} size={8} />
          <span style={{ color: "var(--admin-text)", fontSize: 13, fontWeight: 600 }}>
            {name}
          </span>
        </div>
        <p className="urban-admin-eyebrow-muted" style={{ marginTop: 8 }}>
          {trace.cadence}
        </p>
        <p className="urban-admin-eyebrow-muted" style={{ marginTop: 6 }}>
          {trace.lastUpdatedLabel}
        </p>
      </div>
      <div>
        <p style={{ margin: 0, color: "var(--admin-text-muted)", fontSize: 12, lineHeight: 1.5 }}>
          {purpose}
        </p>
        <AdminBadge kind={integrationBadgeKind(trace.integrationStatus)} style={{ marginTop: 8 }}>
          {status}
        </AdminBadge>
      </div>
    </div>
  );
}

function ConnectorReadinessRow({
  name,
  provider,
  envKeys,
  safeStatusEndpoint,
  readiness,
  status,
  note,
}: AdminSeoConnectorReadinessItem) {
  return (
    <tr>
      <td style={{ ...tdStyle, color: "var(--admin-text)", fontWeight: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AdminStatusDot kind={status} size={8} />
          <span>{name}</span>
        </div>
        <p style={{ margin: "6px 0 0", color: "var(--admin-text-muted)", fontSize: 12, lineHeight: 1.45, fontWeight: 400 }}>
          {provider}
        </p>
      </td>
      <td style={tdStyle}>
        <AdminBadge kind={status}>{readiness}</AdminBadge>
      </td>
      <td style={tdStyle}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {envKeys.map((envKey) => (
            <AdminBadge key={envKey} kind="neutral">
              {envKey}
            </AdminBadge>
          ))}
        </div>
      </td>
      <td style={tdStyle}>{safeStatusEndpoint}</td>
      <td style={tdStyle}>{note}</td>
    </tr>
  );
}

function OperationalMetricRow({
  label,
  value,
  detail,
  status,
  statusLabel,
  trace,
}: AdminSeoOperationalMetric) {
  return (
    <tr>
      <td style={{ ...tdStyle, color: "var(--admin-text)", fontWeight: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AdminStatusDot kind={status} size={8} />
          <span>{label}</span>
        </div>
        <p style={{ margin: "6px 0 0", color: "var(--admin-text-muted)", fontSize: 12, lineHeight: 1.45, fontWeight: 400 }}>
          {detail}
        </p>
      </td>
      <td style={tdStyle}>
        <strong style={{ color: "var(--admin-text)", fontSize: 18, lineHeight: 1 }}>
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </strong>
      </td>
      <td style={tdStyle}>
        {trace.source}
      </td>
      <td style={tdStyle}>{trace.cadence}</td>
      <td style={tdStyle}>
        <AdminBadge kind={integrationBadgeKind(trace.integrationStatus)}>{trace.integrationStatusLabel}</AdminBadge>
        <p style={{ margin: "8px 0 0", color: "var(--admin-text-muted)", fontSize: 11 }}>
          {statusLabel}
        </p>
      </td>
      <td style={tdStyle}>
        <span style={{ display: "block", marginBottom: 8 }}>{trace.lastUpdatedLabel}</span>
        {trace.nextIntegrationLabel && (
          <AdminBadge kind={status === "success" ? "accent" : "warn"}>
            {trace.nextIntegrationLabel}
          </AdminBadge>
        )}
      </td>
    </tr>
  );
}

function StatusTile({
  label,
  value,
  detail,
  status,
}: AdminSeoTechnicalStatusItem) {
  return (
    <div
      style={{
        border: "1px solid var(--admin-divider)",
        borderRadius: 2,
        padding: 16,
        background: "rgba(255, 255, 255, 0.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AdminStatusDot kind={status} size={8} />
        <p className="urban-admin-eyebrow-muted">{label}</p>
      </div>
      <p style={{ margin: "10px 0 4px", color: "var(--admin-text)", fontSize: 15, fontWeight: 600 }}>
        {value}
      </p>
      <p style={{ margin: 0, color: "var(--admin-text-muted)", fontSize: 12, lineHeight: 1.5 }}>
        {detail}
      </p>
    </div>
  );
}

function PolicyRow({
  agent,
  policy,
  scope,
  status,
}: AdminSeoCrawlerPolicy) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(130px, 0.75fr) minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AdminStatusDot kind={status} size={8} />
        <span style={{ color: "var(--admin-text)", fontSize: 12, fontWeight: 600 }}>
          {agent}
        </span>
      </div>
      <div>
        <p style={{ margin: 0, color: "var(--admin-text)", fontSize: 13, fontWeight: 600 }}>
          {policy}
        </p>
        <p style={{ margin: "4px 0 0", color: "var(--admin-text-muted)", fontSize: 12, lineHeight: 1.5 }}>
          {scope}
        </p>
      </div>
    </div>
  );
}

function Readiness({ value }: { value: number }) {
  const kind: AdminSeoStatusKind = value >= 75 ? "success" : value >= 60 ? "warn" : "error";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 130 }}>
      <div style={{ flex: 1, height: 3, background: "var(--admin-divider)" }}>
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background:
              kind === "success"
                ? "var(--admin-success)"
                : kind === "warn"
                  ? "var(--admin-warning)"
                  : "var(--admin-danger)",
          }}
        />
      </div>
      <span style={{ color: "var(--admin-text)", fontSize: 12, fontWeight: 600, fontFamily: "monospace" }}>
        {value}
      </span>
    </div>
  );
}

function BacklogRow({
  priority,
  title,
  owner,
  impact,
  status,
}: AdminSeoBacklogItem) {
  const badgeKind = priority === "P0" ? "error" : priority === "P1" ? "warn" : "neutral";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "56px minmax(0, 1fr) 120px",
        gap: 14,
        padding: "14px 0",
        borderBottom: "1px solid var(--admin-divider)",
      }}
    >
      <AdminBadge kind={badgeKind}>{priority}</AdminBadge>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, color: "var(--admin-text)", fontSize: 14, fontWeight: 600 }}>
          {title}
        </p>
        <p style={{ margin: "5px 0 0", color: "var(--admin-text-muted)", fontSize: 12, lineHeight: 1.5 }}>
          {impact}
        </p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 5 }}>
          {owner}
        </p>
        <span style={{ color: "var(--admin-text-muted)", fontSize: 11 }}>
          {status}
        </span>
      </div>
    </div>
  );
}

function integrationBadgeKind(
  status: AdminSeoIntegrationStatus,
): AdminSeoStatusKind {
  const map: Record<AdminSeoIntegrationStatus, AdminSeoStatusKind> = {
    connected: "success",
    manual: "neutral",
    instrumenting: "warn",
    planned: "neutral",
    blocked: "error",
  };

  return map[status];
}

const thStyle: CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--admin-divider)",
  color: "var(--admin-text-muted)",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  textAlign: "left",
};

const tdStyle: CSSProperties = {
  padding: "16px",
  borderBottom: "1px solid var(--admin-divider)",
  color: "var(--admin-text-muted)",
  fontSize: 13,
  verticalAlign: "top",
};
