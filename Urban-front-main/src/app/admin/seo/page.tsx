"use client";

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
    <div className={styles.pageContainer}>
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

      <section className={styles.section}>
        <p className={`urban-admin-eyebrow ${styles.sectionEyebrow}`}>
          OPERAÇÃO DE MEDIÇÃO
        </p>

        <div
          className={styles.scoreGrid}
        >
          <AdminCard variant="accent">
            <div className={styles.scoreHeader}>
              <div className={styles.contentColumn}>
                <div className={styles.scoreTitleRow}>
                  <p className="urban-admin-eyebrow">{completion.label}</p>
                  <AdminBadge kind="accent">{completion.status}</AdminBadge>
                </div>
                <p className={styles.scoreDetail}>
                  {completion.detail}
                </p>
              </div>
              <div className={styles.scoreValueBox}>
                <strong className={styles.scoreValue}>
                  {completion.value}%
                </strong>
                <span className={styles.scoreValueLabel}>
                  geral
                </span>
              </div>
            </div>

            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ "--pct": `${completion.value}%` } as React.CSSProperties}
              />
            </div>

            <div className={styles.scoreMetaGrid}>
              <ScoreMeta label="Formula" value={completion.formula} />
              <ScoreMeta label="Fonte atual" value={completion.trace.source} />
              <ScoreMeta label="Cadencia" value={completion.trace.cadence} />
              <ScoreMeta label="Atualizado" value={completion.trace.lastUpdatedLabel} />
            </div>

            <div className={styles.scoreBreakdownGrid}>
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
            <div className={styles.itemList}>
              {integrationRoadmap.map((integration) => (
                <IntegrationRow key={integration.name} {...integration} />
              ))}
            </div>
          </AdminCard>
        </div>

        <AdminCard variant="subtle" className={styles.flushCard}>
          <div className={styles.tableCardHeader}>
            <AdminCardHeader
              eyebrow="INDICADORES OPERACIONAIS"
              title="Fonte, status e cadência por medição"
            />
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.metricsTable}>
              <thead>
                <tr>
                  {["Indicador", "Valor", "Fonte atual", "Cadencia", "Status integração", "Atualizado / próxima"].map((header) => (
                    <th key={header} className={styles.th}>
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
        className={styles.statusPolicyGrid}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader
            eyebrow="STATUS TÉCNICO"
            title="Fundacao de rastreamento"
          />
          <div className={styles.statusTileGrid}>
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
          <div className={styles.itemList}>
            {crawlerPolicy.map((policy) => (
              <PolicyRow key={policy.agent} {...policy} />
            ))}
          </div>
        </AdminCard>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <p className="urban-admin-eyebrow">READINESS 100%</p>
          <h2 className={styles.sectionTitle}>
            Conectores prontos para dados reais
          </h2>
        </header>

        <AdminCard variant="subtle" className={styles.flushCard}>
          <div className={styles.tableScroll}>
            <table className={styles.connectorsTable}>
              <thead>
                <tr>
                  {["Conector", "Readiness", "Variaveis", "Endpoint seguro", "Nota"].map((header) => (
                    <th key={header} className={styles.th}>
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

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <p className="urban-admin-eyebrow">MATRIZ AI SEARCH</p>
          <h2 className={styles.sectionTitle}>
            Perguntas que a Urban precisa responder melhor que o mercado
          </h2>
        </header>

        <AdminCard variant="subtle" className={styles.flushCard}>
          <div className={styles.tableScroll}>
            <table className={styles.aiSearchTable}>
              <thead>
                <tr>
                  {["Cluster", "Pergunta", "Intenção", "Ativo fonte", "Readiness"].map((header) => (
                    <th key={header} className={styles.th}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aiSearchQuestions.map((row) => (
                  <tr key={row.question}>
                    <td className={styles.td}>
                      <AdminBadge kind="neutral">{row.cluster}</AdminBadge>
                    </td>
                    <td className={`${styles.td} ${styles.tdStrong}`}>
                      {row.question}
                    </td>
                    <td className={styles.td}>{row.intent}</td>
                    <td className={styles.td}>{row.asset}</td>
                    <td className={styles.td}>
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
        className={styles.backlogGrid}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader
            eyebrow="BACKLOG P0 / P1 / P2"
            title="Fila priorizada"
          />
          <div className={styles.backlogList}>
            {backlog.map((item) => (
              <BacklogRow key={item.title} {...item} />
            ))}
          </div>
        </AdminCard>

        <div className={styles.actionCardList}>
          {actionCards.map((card) => {
            const Icon = actionIconMap[card.icon];

            return (
              <AdminCard key={card.title} variant="default">
                <div className={styles.actionCardRow}>
                  <div
                    className={styles.actionIcon}
                  >
                    <Icon size={18} />
                  </div>
                  <div className={styles.actionCardBody}>
                    <h3 className={styles.actionCardTitle}>
                      {card.title}
                    </h3>
                    <p className={styles.actionCardText}>
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

      <section className={styles.checkpointsSection}>
        <AdminCard variant="accent">
          <AdminCardHeader
            eyebrow="CHECKPOINTS PARA 100%"
            title={`Lacunas que ainda seguram o score em ${completion.value}%`}
            actions={<AdminBadge kind="warn">{completion.remaining.length} pendencias</AdminBadge>}
          />

          <div className={styles.checkpointGrid}>
            {completion.remaining.map((item) => (
              <div key={item} className={styles.checkpointItem}>
                <AdminStatusDot kind="warn" size={7} />
                <span className={styles.checkpointText}>
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
      <p className={`urban-admin-eyebrow-muted ${styles.scoreMetaLabel}`}>
        {label}
      </p>
      <p className={styles.scoreMetaValue}>
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
      className={styles.breakdownTile}
    >
      <div className={styles.statusRow}>
        <AdminStatusDot kind={status} size={7} />
        <span className={styles.breakdownLabel}>
          {label}
        </span>
      </div>
      <strong className={styles.breakdownValue}>
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
      className={styles.integrationRow}
    >
      <div>
        <div className={styles.statusRow}>
          <AdminStatusDot kind={statusKind} size={8} />
          <span className={styles.integrationName}>
            {name}
          </span>
        </div>
        <p className={`urban-admin-eyebrow-muted ${styles.integrationCadence}`}>
          {trace.cadence}
        </p>
        <p className={`urban-admin-eyebrow-muted ${styles.integrationUpdated}`}>
          {trace.lastUpdatedLabel}
        </p>
      </div>
      <div>
        <p className={styles.detailText}>
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
      <td className={`${styles.td} ${styles.tdStrong}`}>
        <div className={styles.statusRow}>
          <AdminStatusDot kind={status} size={8} />
          <span>{name}</span>
        </div>
        <p className={styles.cellSubtext}>
          {provider}
        </p>
      </td>
      <td className={styles.td}>
        <AdminBadge kind={status}>{readiness}</AdminBadge>
      </td>
      <td className={styles.td}>
        <div className={styles.envKeyList}>
          {envKeys.map((envKey) => (
            <AdminBadge key={envKey} kind="neutral">
              {envKey}
            </AdminBadge>
          ))}
        </div>
      </td>
      <td className={styles.td}>{safeStatusEndpoint}</td>
      <td className={styles.td}>{note}</td>
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
      <td className={`${styles.td} ${styles.tdStrong}`}>
        <div className={styles.statusRow}>
          <AdminStatusDot kind={status} size={8} />
          <span>{label}</span>
        </div>
        <p className={styles.cellSubtext}>
          {detail}
        </p>
      </td>
      <td className={styles.td}>
        <strong className={styles.metricValue}>
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </strong>
      </td>
      <td className={styles.td}>
        {trace.source}
      </td>
      <td className={styles.td}>{trace.cadence}</td>
      <td className={styles.td}>
        <AdminBadge kind={integrationBadgeKind(trace.integrationStatus)}>{trace.integrationStatusLabel}</AdminBadge>
        <p className={styles.metricStatusLabel}>
          {statusLabel}
        </p>
      </td>
      <td className={styles.td}>
        <span className={styles.lastUpdatedLabel}>{trace.lastUpdatedLabel}</span>
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
      className={styles.statusTile}
    >
      <div className={styles.statusRow}>
        <AdminStatusDot kind={status} size={8} />
        <p className="urban-admin-eyebrow-muted">{label}</p>
      </div>
      <p className={styles.statusTileValue}>
        {value}
      </p>
      <p className={styles.detailText}>
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
    <div className={styles.policyRow}>
      <div className={styles.statusRow}>
        <AdminStatusDot kind={status} size={8} />
        <span className={styles.policyAgent}>
          {agent}
        </span>
      </div>
      <div>
        <p className={styles.policyText}>
          {policy}
        </p>
        <p className={styles.policyScope}>
          {scope}
        </p>
      </div>
    </div>
  );
}

function Readiness({ value }: { value: number }) {
  const kind: AdminSeoStatusKind = value >= 75 ? "success" : value >= 60 ? "warn" : "error";
  return (
    <div className={styles.readinessRow}>
      <div className={styles.readinessTrack}>
        <div
          className={`${styles.readinessFill} ${
            kind === "success" ? styles.readinessFillSuccess : kind === "warn" ? styles.readinessFillWarn : ""
          }`}
          style={{ "--pct": `${value}%` } as React.CSSProperties}
        />
      </div>
      <span className={styles.readinessValue}>
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
      className={styles.backlogRow}
    >
      <AdminBadge kind={badgeKind}>{priority}</AdminBadge>
      <div className={styles.contentColumn}>
        <p className={styles.backlogTitle}>
          {title}
        </p>
        <p className={styles.backlogImpact}>
          {impact}
        </p>
      </div>
      <div className={styles.backlogMeta}>
        <p className={`urban-admin-eyebrow-muted ${styles.backlogOwner}`}>
          {owner}
        </p>
        <span className={styles.backlogStatus}>
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
