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
import styles from "./page.module.css";

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
    <div className={styles.boxM0xautoP40x32}>
      <AdminSectionHeader
        eyebrow="ADMIN - SEO / SGO / GEO"
        title="Governança de busca e AI Search"
        subtitle="Painel dedicado para indexação, citabilidade em mecanismos generativos e backlog técnico de descoberta orgânica."
        actions={
          <AdminBadge kind="accent">
            Atualizado {adminSeoPanelData.lastUpdatedLabel}
          </AdminBadge>
        }
      />

      <section className={styles.sectionMb56}>
        <p className={`urban-admin-eyebrow ${styles.eyebrowMb24}`}>
          OPERAÇÃO DE MEDIÇÃO
        </p>

        <div
          className={styles.gridColsAutoGap24}
        >
          <AdminCard variant="accent">
            <div className={styles.rowBetweenStart}>
              <div className={styles.boxMinw0}>
                <div className={styles.rowCenteredWrap}>
                  <p className="urban-admin-eyebrow">{completion.label}</p>
                  <AdminBadge kind="accent">{completion.status}</AdminBadge>
                </div>
                <p className={styles.textTextMutedFs13}>
                  {completion.detail}
                </p>
              </div>
              <div className={styles.boxRightAlignedNoShrink}>
                <strong className={styles.strongTextFs56}>
                  {completion.value}%
                </strong>
                <span className={styles.labelTextMutedFs11}>
                  geral
                </span>
              </div>
            </div>

            <div className={styles.boxBgSurfaceElevatedMt22}>
              <div
                style={{
                  width: `${completion.value}%`,
                  height: "100%",
                  background: "var(--admin-accent)",
                }}
              />
            </div>

            <div className={styles.gridColsAuto180Gap14}>
              <ScoreMeta label="Formula" value={completion.formula} />
              <ScoreMeta label="Fonte atual" value={completion.trace.source} />
              <ScoreMeta label="Cadencia" value={completion.trace.cadence} />
              <ScoreMeta label="Atualizado" value={completion.trace.lastUpdatedLabel} />
            </div>

            <div className={styles.gridColsAuto170Gap12}>
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
            <div className={styles.stackGap14}>
              {integrationRoadmap.map((integration) => (
                <IntegrationRow key={integration.name} {...integration} />
              ))}
            </div>
          </AdminCard>
        </div>

        <AdminCard variant="subtle" className={styles.flushCard}>
          <div className={styles.boxP20x20x0}>
            <AdminCardHeader
              eyebrow="INDICADORES OPERACIONAIS"
              title="Fonte, status e cadência por medição"
            />
          </div>
          <div className={styles.boxScroll}>
            <table className={styles.tableW100pctMinw980}>
              <thead>
                <tr>
                  {["Indicador", "Valor", "Fonte atual", "Cadencia", "Status integração", "Atualizado / próxima"].map((header) => (
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
        className={styles.gridColsAutoGap24Mb56}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader
            eyebrow="STATUS TÉCNICO"
            title="Fundacao de rastreamento"
          />
          <div className={styles.gridColsAuto220Gap14}>
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
          <div className={styles.stackGap14}>
            {crawlerPolicy.map((policy) => (
              <PolicyRow key={policy.agent} {...policy} />
            ))}
          </div>
        </AdminCard>
      </section>

      <section className={styles.sectionMb56}>
        <header className={styles.headerMb20}>
          <p className="urban-admin-eyebrow">READINESS 100%</p>
          <h2 className={styles.headingTextFs20}>
            Conectores prontos para dados reais
          </h2>
        </header>

        <AdminCard variant="subtle" className={styles.flushCard}>
          <div className={styles.boxScroll}>
            <table className={styles.tableW100pctMinw960}>
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

      <section className={styles.sectionMb56}>
        <header className={styles.headerMb20}>
          <p className="urban-admin-eyebrow">MATRIZ AI SEARCH</p>
          <h2 className={styles.headingTextFs20}>
            Perguntas que a Urban precisa responder melhor que o mercado
          </h2>
        </header>

        <AdminCard variant="subtle" className={styles.flushCard}>
          <div className={styles.boxScroll}>
            <table className={styles.tableW100pctMinw860}>
              <thead>
                <tr>
                  {["Cluster", "Pergunta", "Intenção", "Ativo fonte", "Readiness"].map((header) => (
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
        className={styles.gridColsAutoGap242}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader
            eyebrow="BACKLOG P0 / P1 / P2"
            title="Fila priorizada"
          />
          <div className={styles.stackGap12}>
            {backlog.map((item) => (
              <BacklogRow key={item.title} {...item} />
            ))}
          </div>
        </AdminCard>

        <div className={styles.gridGap16}>
          {actionCards.map((card) => {
            const Icon = actionIconMap[card.icon];

            return (
              <AdminCard key={card.title} variant="default">
                <div className={styles.rowStartGap14}>
                  <div
                    className={styles.rowJustifyCenterCentered}
                  >
                    <Icon size={18} />
                  </div>
                  <div className={styles.boxMinw0Flex1}>
                    <h3 className={styles.subheadingTextFs15}>
                      {card.title}
                    </h3>
                    <p className={styles.textTextMutedFs13M8x0x16Lh1_55}>
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

      <section className={styles.sectionMt56}>
        <AdminCard variant="accent">
          <AdminCardHeader
            eyebrow="CHECKPOINTS PARA 100%"
            title={`Lacunas que ainda seguram o score em ${completion.value}%`}
            actions={<AdminBadge kind="warn">{completion.remaining.length} pendencias</AdminBadge>}
          />

          <div className={styles.gridColsAuto220Gap12}>
            {completion.remaining.map((item) => (
              <div key={item} className={styles.rowStartGap8}>
                <AdminStatusDot kind="warn" size={7} />
                <span className={styles.labelTextMutedFs12}>
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
      <p className={`urban-admin-eyebrow-muted ${styles.eyebrowMutedMb6}`}>
        {label}
      </p>
      <p className={styles.textTextFs12}>
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
      className={styles.boxBgSurfaceP12}
    >
      <div className={styles.rowCenteredGap8}>
        <AdminStatusDot kind={status} size={7} />
        <span className={styles.labelTextMutedFs11Lh1_35}>
          {label}
        </span>
      </div>
      <strong className={styles.strongTextFs20}>
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
      className={styles.gridColsGap14}
    >
      <div>
        <div className={styles.rowCenteredGap8}>
          <AdminStatusDot kind={statusKind} size={8} />
          <span className={styles.labelTextFs13}>
            {name}
          </span>
        </div>
        <p className={`urban-admin-eyebrow-muted ${styles.eyebrowMutedMt8}`}>
          {trace.cadence}
        </p>
        <p className={`urban-admin-eyebrow-muted ${styles.eyebrowMutedMt6}`}>
          {trace.lastUpdatedLabel}
        </p>
      </div>
      <div>
        <p className={styles.textTextMutedFs12}>
          {purpose}
        </p>
        <AdminBadge kind={integrationBadgeKind(trace.integrationStatus)} className={styles.traceBadge}>
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
        <div className={styles.rowCenteredGap8}>
          <AdminStatusDot kind={status} size={8} />
          <span>{name}</span>
        </div>
        <p className={styles.textTextMutedFs12W400M6x0x0Lh1_45}>
          {provider}
        </p>
      </td>
      <td style={tdStyle}>
        <AdminBadge kind={status}>{readiness}</AdminBadge>
      </td>
      <td style={tdStyle}>
        <div className={styles.rowWrapGap6}>
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
        <div className={styles.rowCenteredGap8}>
          <AdminStatusDot kind={status} size={8} />
          <span>{label}</span>
        </div>
        <p className={styles.textTextMutedFs12W400M6x0x0Lh1_45}>
          {detail}
        </p>
      </td>
      <td style={tdStyle}>
        <strong className={styles.strongTextFs18}>
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </strong>
      </td>
      <td style={tdStyle}>
        {trace.source}
      </td>
      <td style={tdStyle}>{trace.cadence}</td>
      <td style={tdStyle}>
        <AdminBadge kind={integrationBadgeKind(trace.integrationStatus)}>{trace.integrationStatusLabel}</AdminBadge>
        <p className={styles.textTextMutedFs11}>
          {statusLabel}
        </p>
      </td>
      <td style={tdStyle}>
        <span className={styles.labelMb8}>{trace.lastUpdatedLabel}</span>
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
      className={styles.boxBgSurfaceP16}
    >
      <div className={styles.rowCenteredGap8}>
        <AdminStatusDot kind={status} size={8} />
        <p className="urban-admin-eyebrow-muted">{label}</p>
      </div>
      <p className={styles.textTextFs15}>
        {value}
      </p>
      <p className={styles.textTextMutedFs12}>
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
    <div className={styles.gridColsGap142}>
      <div className={styles.rowCenteredGap8}>
        <AdminStatusDot kind={status} size={8} />
        <span className={styles.labelTextFs12}>
          {agent}
        </span>
      </div>
      <div>
        <p className={styles.textTextFs13}>
          {policy}
        </p>
        <p className={styles.textTextMutedFs12M4x0x0Lh1_5}>
          {scope}
        </p>
      </div>
    </div>
  );
}

function Readiness({ value }: { value: number }) {
  const kind: AdminSeoStatusKind = value >= 75 ? "success" : value >= 60 ? "warn" : "error";
  return (
    <div className={styles.rowCenteredGap10}>
      <div className={styles.boxBgDividerH3}>
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
      <span className={styles.labelTextFs12W600Mono}>
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
      className={styles.gridColsGap14P14x0Bordered}
    >
      <AdminBadge kind={badgeKind}>{priority}</AdminBadge>
      <div className={styles.boxMinw0}>
        <p className={styles.textTextFs14}>
          {title}
        </p>
        <p className={styles.textTextMutedFs12M5x0x0Lh1_5}>
          {impact}
        </p>
      </div>
      <div className={styles.boxRightAligned}>
        <p className={`urban-admin-eyebrow-muted ${styles.eyebrowMutedMb5}`}>
          {owner}
        </p>
        <span className={styles.labelTextMutedFs112}>
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
