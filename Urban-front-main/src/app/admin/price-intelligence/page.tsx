"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminAirbnbPricingAttemptHealth,
  fetchAdminPriceIntelligenceHealth,
  type AdminAirbnbPricingAttemptHealth,
  type AdminJobRunResponse,
  type AdminPriceIntelligenceHealth,
} from "../../service/api";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminEmptyState,
  AdminMetricCard,
  AdminPageLoading,
  AdminSectionHeader,
  AdminStatusDot,
  AdminTable,
  Icons,
  type AdminBadgeKind,
  type AdminStatusKind,
  type AdminTableColumn,
} from "../_components";
import styles from "./page.module.css";

const integer = new Intl.NumberFormat("pt-BR");

export default function AdminPriceIntelligencePage() {
  const [data, setData] = useState<AdminPriceIntelligenceHealth | null>(null);
  const [airbnbAttempts, setAirbnbAttempts] = useState<AdminAirbnbPricingAttemptHealth | null>(null);
  const [airbnbAttemptsError, setAirbnbAttemptsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [healthResult, attemptsResult] = await Promise.allSettled([
        fetchAdminPriceIntelligenceHealth(),
        fetchAdminAirbnbPricingAttemptHealth(24),
      ]);

      if (healthResult.status === "rejected") throw healthResult.reason;

      setData(healthResult.value);
      setError(null);

      if (attemptsResult.status === "fulfilled") {
        setAirbnbAttempts(attemptsResult.value);
        setAirbnbAttemptsError(null);
      } else {
        setAirbnbAttempts(null);
        const e = attemptsResult.reason as { userMessage?: string; message?: string };
        setAirbnbAttemptsError(e?.userMessage || e?.message || "Erro ao carregar tentativas Airbnb.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; userMessage?: string; message?: string };
      setError(
        e?.response?.status === 401 || e?.response?.status === 403
          ? "Acesso negado. Você precisa ser admin."
          : e?.userMessage || e?.message || "Erro ao carregar saúde de Price Intelligence.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const propertyColumns = useMemo<AdminTableColumn<ProblematicPropertyRow>[]>(
    () => [
      {
        key: "property",
        header: "Imóvel",
        render: (row) => (
          <div className={styles.cellContent}>
            <p className={styles.propertyTitle}>
              {row.title || row.listId || row.addressId || "Sem identificação"}
            </p>
            <p className={styles.propertySubtitle}>
              {[row.city, row.state].filter(Boolean).join(", ") || row.userEmail || "Localidade não informada"}
            </p>
          </div>
        ),
      },
      {
        key: "severity",
        header: "Severidade",
        width: 130,
        render: (row) => (
          <AdminBadge kind={badgeFromSeverity(row.severity)}>
            {severityLabel(row.severity)}
          </AdminBadge>
        ),
      },
      {
        key: "issue",
        header: "Problema",
        render: (row) => (
          <span className={styles.issueText}>
            {row.issue}
          </span>
        ),
      },
      {
        key: "signals",
        header: "Sinais",
        width: 220,
        render: (row) => (
          <div className={styles.signalsCell}>
            <SmallMuted>Snapshot: {formatDate(row.lastSnapshotAt)}</SmallMuted>
            <SmallMuted>Obs.: {formatDate(row.lastObservationAt)}</SmallMuted>
            <SmallMuted>
              Pendentes: {integer.format(row.suggestionsPending)} / falhas:{" "}
              {integer.format(row.failedSuggestions)}
            </SmallMuted>
          </div>
        ),
      },
    ],
    [],
  );

  const jobColumns = useMemo<AdminTableColumn<AdminJobRunResponse>[]>(
    () => [
      {
        key: "name",
        header: "Job",
        render: (row) => (
          <code className={styles.jobName}>{row.name}</code>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: 120,
        render: (row) => (
          <AdminBadge
            kind={row.status === "success" ? "success" : row.status === "error" ? "error" : "warn"}
          >
            {row.status}
          </AdminBadge>
        ),
      },
      {
        key: "startedAt",
        header: "Inicio",
        width: 180,
        render: (row) => <SmallMuted>{formatDate(row.startedAt)}</SmallMuted>,
      },
      {
        key: "duration",
        header: "Duração",
        align: "right",
        width: 120,
        render: (row) => <SmallMuted>{formatDuration(row.durationMs)}</SmallMuted>,
      },
    ],
    [],
  );

  if (loading) return <AdminPageLoading />;

  if (error || !data) {
    return (
      <div className={styles.pageContainer}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar Price Intelligence"
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

  const healthKind = statusFromHealth(data.health);
  const alerts = data.alerts ?? [];
  const recentJobs = data.jobs.recent ?? [];
  const jobMetrics = data.jobs.byName ?? [];
  const problematicProperties = data.problematicProperties ?? [];
  const failures = data.failuresByType ?? [];
  const shortcuts = data.shortcuts?.length
    ? data.shortcuts
    : defaultShortcuts;
  const airbnbAttemptStatus = airbnbAttempts ? statusFromHealth(airbnbAttempts.health) : "warn";

  return (
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN / PRICE INTELLIGENCE"
        title="Saúde do motor de preços"
        subtitle={
          <span>
            Janela de {data.windowDays} dias / última leitura:{" "}
            <strong className={styles.strongLabel}>
              {formatDate(data.generatedAt)}
            </strong>
          </span>
        }
        actions={
          <AdminButton variant="secondary" onClick={load} leftIcon={<Icons.RefreshCw size={12} />}>
            Atualizar
          </AdminButton>
        }
      />

      <section
        style={{
          padding: "20px 24px",
          borderLeft: `3px solid ${healthColor(data.health)}`,
          background: "var(--admin-surface)",
          marginBottom: 32,
        }}
      >
        <div className={styles.healthHeader}>
          <div className={styles.healthSummary}>
            <AdminStatusDot kind={healthKind} size={14} pulse={data.health !== "green"} />
            <div>
              <p className="urban-admin-eyebrow-muted">SAÚDE GERAL</p>
              <p className={styles.healthLabel}>
                {healthLabel(data.health)}
              </p>
            </div>
          </div>
          {alerts.length === 0 && <AdminBadge kind="success">Sem alertas ativos</AdminBadge>}
        </div>

        {alerts.length > 0 && (
          <ul className={styles.alertList}>
            {alerts.map((alert, index) => (
              <li key={`${alert.message}-${index}`} className={styles.alertItem}>
                <span className={styles.alertDot}>
                  <AdminStatusDot kind={statusFromSeverity(alert.severity)} size={7} />
                </span>
                <span className={styles.alertMessage}>
                  {alert.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className={styles.metricsGrid}
      >
        <AdminMetricCard
          label="Snapshots"
          value={integer.format(data.snapshots.total)}
          sub={`${integer.format(data.snapshots.last24h)} nas últimas 24h`}
          status={data.snapshots.last24h > 0 ? "success" : "warn"}
          accent
        />
        <AdminMetricCard
          label="Observações"
          value={integer.format(data.observations.total)}
          sub={`${integer.format(data.observations.distinctListings)} imóveis com histórico`}
          status={data.observations.trainingReady > 0 ? "success" : "warn"}
        />
        <AdminMetricCard
          label="Sugestões verificadas"
          value={`${formatPercent(data.suggestions.verifiedPercent)}`}
          sub={`${integer.format(data.suggestions.verified)} de ${integer.format(data.suggestions.total)}`}
          status={data.suggestions.failedVerification > 0 ? "warn" : "success"}
        />
        <AdminMetricCard
          label="Tempo médio jobs"
          value={formatDuration(data.jobs.avgDurationMs)}
          sub={`${integer.format(data.jobs.failedLast24h)} falhas nas últimas 24h`}
          status={data.jobs.failedLast24h > 0 ? "error" : "success"}
        />
        <AdminMetricCard
          label="Scraper Airbnb"
          value={airbnbAttempts ? `${integer.format(airbnbAttempts.summary.successes)}/${integer.format(airbnbAttempts.summary.total)}` : "--"}
          sub={
            airbnbAttempts
              ? `${integer.format(airbnbAttempts.summary.failures)} falhas / ${formatDuration(airbnbAttempts.summary.avgDurationMs)} médio`
              : airbnbAttemptsError || "Sem leitura das tentativas"
          }
          status={airbnbAttempts ? airbnbAttemptStatus : "warn"}
        />
      </section>

      <section
        className={styles.suggestionsJobsGrid}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader eyebrow="SUGESTÕES" title="Verificação e aplicação" />
          <div className={styles.suggestionStats}>
            <InlineStat label="Futuras" value={integer.format(data.suggestions.future)} />
            <InlineStat label="Aceitas" value={integer.format(data.suggestions.accepted)} />
            <InlineStat label="Aplicadas" value={integer.format(data.suggestions.applied)} />
            <InlineStat label="Pendentes" value={integer.format(data.suggestions.pendingVerification)} />
          </div>
        </AdminCard>

        <AdminCard variant="subtle">
          <AdminCardHeader eyebrow="JOBS" title="Fila operacional" />
          <div className={styles.statusList}>
            <StatusLine label="Rodando" value={integer.format(data.jobs.running)} kind={data.jobs.running > 0 ? "accent" : "neutral"} />
            <StatusLine
              label="Na fila"
              value={data.jobs.queueAvailable === false ? "Indisponível" : integer.format(data.jobs.queued)}
              kind={data.jobs.queueAvailable === false ? "warn" : data.jobs.queued > 0 ? "warn" : "neutral"}
            />
            <StatusLine label="Último sucesso" value={formatDate(data.jobs.lastSuccessAt)} kind={data.jobs.lastSuccessAt ? "success" : "warn"} />
            <StatusLine label="Último run" value={data.jobs.lastRun ? `${data.jobs.lastRun.name} / ${data.jobs.lastRun.status}` : "Sem execuções"} kind={data.jobs.lastRun?.status === "error" ? "error" : "neutral"} />
            {data.jobs.queueAvailable === false && (
              <p className={styles.queueNote}>
                {data.jobs.queueUnavailableReason || "Fila real ainda não implementada para este pipeline."}
              </p>
            )}
          </div>
        </AdminCard>
      </section>

      <section className={styles.section}>
        <AdminCard variant={airbnbAttempts?.health === "green" ? "subtle" : "accent"}>
          <AdminCardHeader eyebrow="AIRBNB" title="Saúde das cotações headless" />
          {airbnbAttemptsError ? (
            <QuietEmpty>{airbnbAttemptsError}</QuietEmpty>
          ) : !airbnbAttempts ? (
            <QuietEmpty>Nenhuma leitura de tentativa retornada.</QuietEmpty>
          ) : (
            <div className={styles.airbnbBody}>
              <div className={styles.airbnbStats}>
                <InlineStat label="Tentativas 24h" value={integer.format(airbnbAttempts.summary.total)} />
                <InlineStat label="Sucessos" value={integer.format(airbnbAttempts.summary.successes)} />
                <InlineStat label="Falhas" value={integer.format(airbnbAttempts.summary.failures)} />
                <InlineStat label="Pendentes" value={integer.format(airbnbAttempts.summary.openPending)} />
                <InlineStat label="Tempo médio" value={formatDuration(airbnbAttempts.summary.avgDurationMs)} />
              </div>

              <div className={styles.airbnbColumns}>
                <div className={styles.barRows}>
                  <StatusLine
                    label="Schema"
                    value={airbnbAttempts.schema.available ? "Disponível" : "Indisponível"}
                    kind={airbnbAttempts.schema.available ? "success" : "error"}
                  />
                  <StatusLine
                    label="Última tentativa"
                    value={formatDate(airbnbAttempts.summary.latestAttemptAt)}
                    kind={airbnbAttempts.summary.latestAttemptAt ? "neutral" : "warn"}
                  />
                  <StatusLine
                    label="Stale pendente"
                    value={integer.format(airbnbAttempts.summary.stalePending)}
                    kind={airbnbAttempts.summary.stalePending > 0 ? "error" : "success"}
                  />
                  {airbnbAttempts.schema.error && <QuietEmpty>{airbnbAttempts.schema.error}</QuietEmpty>}
                </div>

                <div className={styles.barRows}>
                  {airbnbAttempts.sources.length === 0 ? (
                    <QuietEmpty>Sem tentativas por fonte na janela.</QuietEmpty>
                  ) : (
                    airbnbAttempts.sources.map((source) => (
                      <BarRow
                        key={source.source}
                        label={source.source}
                        value={source.total}
                        max={Math.max(...airbnbAttempts.sources.map((item) => item.total), 1)}
                        sub={`${integer.format(source.successes)} ok / ${integer.format(source.failures)} falhas / ${formatDuration(source.avgDurationMs)}`}
                      />
                    ))
                  )}
                </div>
              </div>

              {airbnbAttempts.failuresByReason.length > 0 && (
                <div className={styles.barRows}>
                  <p className={`urban-admin-eyebrow-muted ${styles.failuresEyebrow}`}>FALHAS AIRBNB POR MOTIVO</p>
                  {airbnbAttempts.failuresByReason.slice(0, 5).map((failure) => (
                    <BarRow
                      key={failure.reason}
                      label={failure.reason}
                      value={failure.count}
                      max={Math.max(...airbnbAttempts.failuresByReason.map((item) => item.count), 1)}
                      sub={`Última: ${formatDate(failure.lastSeenAt)} / ${formatDuration(failure.avgDurationMs)}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </AdminCard>
      </section>

      <section
        className={styles.jobsSchemaGrid}
      >
        <AdminCard>
          <AdminCardHeader eyebrow="JOBS" title="Métricas por nome" />
          {jobMetrics.length === 0 ? (
            <QuietEmpty>Nenhuma métrica por job retornada.</QuietEmpty>
          ) : (
            <div className={styles.statusList}>
              {jobMetrics.map((job) => (
                <JobMetricRow key={job.name} job={job} />
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard variant={data.schema?.ok ? "subtle" : "accent"}>
          <AdminCardHeader eyebrow="SCHEMA" title="Migrations operacionais" />
          {data.schema ? (
            <div className={styles.statusList}>
              <StatusLine
                label="Status"
                value={data.schema.ok ? "Completo" : "Ação necessária"}
                kind={data.schema.ok ? "success" : "error"}
              />
              <StatusLine label="Checado em" value={formatDate(data.schema.checkedAt)} kind="neutral" />
              {data.schema.checkError && (
                <QuietEmpty>{data.schema.checkError}</QuietEmpty>
              )}
              {data.schema.missing.length > 0 && (
                <ul className={styles.missingList}>
                  {data.schema.missing.slice(0, 8).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <QuietEmpty>Backend ainda não retornou diagnóstico de schema.</QuietEmpty>
          )}
        </AdminCard>
      </section>

      <section
        className={styles.failuresShortcutsGrid}
      >
        <AdminCard>
          <AdminCardHeader eyebrow="FALHAS" title="Falhas por tipo" />
          {failures.length === 0 ? (
            <QuietEmpty>Nenhuma falha agrupada na janela.</QuietEmpty>
          ) : (
            <div className={styles.barRows}>
              {failures.map((failure) => (
                <BarRow
                  key={failure.type}
                  label={failure.type}
                  value={failure.count}
                  max={Math.max(...failures.map((item) => item.count), 1)}
                  sub={`Última: ${formatDate(failure.lastSeenAt)}`}
                />
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard>
          <AdminCardHeader eyebrow="ATALHOS" title="Ações rápidas" />
          <div className={styles.shortcutGrid}>
            {shortcuts.map((shortcut) => (
              <a
                key={`${shortcut.href}-${shortcut.label}`}
                href={shortcut.href}
                className={styles.shortcutLink}
              >
                <span>
                  <span className={styles.shortcutLabel}>
                    {shortcut.label}
                  </span>
                  {shortcut.description && (
                    <span className={styles.shortcutHint}>
                      {shortcut.description}
                    </span>
                  )}
                </span>
                <Icons.ArrowRight size={14} className={styles.arrowIcon} />
              </a>
            ))}
          </div>
        </AdminCard>
      </section>

      <section className={styles.section}>
        <AdminCardHeader eyebrow="IMÓVEIS" title="Imóveis problemáticos" />
        <AdminTable
          columns={propertyColumns}
          rows={problematicProperties}
          rowKey={(row, index) => row.addressId || row.listId || String(index)}
          empty={<QuietEmpty>Nenhum imóvel problemático retornado.</QuietEmpty>}
          minWidth={860}
        />
      </section>

      <section>
        <AdminCardHeader eyebrow="HISTÓRICO" title="Runs recentes de Price Intelligence" />
        <AdminTable
          columns={jobColumns}
          rows={recentJobs}
          rowKey={(row, index) => row.id || `${row.name}-${index}`}
          empty={<QuietEmpty>Nenhum job recente retornado.</QuietEmpty>}
          minWidth={760}
        />
      </section>

      {(data.endpointGaps?.length ?? 0) > 0 && (
        <section className={styles.gapsSection}>
          <AdminCard variant="accent">
            <AdminCardHeader eyebrow="CONTRATO" title="Gaps reportados pelo backend" />
            <ul className={styles.gapsList}>
              {data.endpointGaps?.map((gap) => <li key={gap}>{gap}</li>)}
            </ul>
          </AdminCard>
        </section>
      )}
    </div>
  );
}

type ProblematicPropertyRow = AdminPriceIntelligenceHealth["problematicProperties"][number];

const defaultShortcuts: AdminPriceIntelligenceHealth["shortcuts"] = [
  { label: "Qualidade", href: "/admin/quality", description: "MAPE, ocupação e ground truth." },
  { label: "Jobs do sistema", href: "/admin/jobs", description: "Executar snapshots e recomputações." },
  { label: "Config. de preços", href: "/admin/pricing-config", description: "Regras e parâmetros operacionais." },
  { label: "Radar de demanda", href: "/admin/event-radar", description: "Eventos que alimentam sugestões." },
];

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.inlineStat}>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p className={styles.inlineStatValue}>
        {value}
      </p>
    </div>
  );
}

function StatusLine({ label, value, kind }: { label: string; value: string; kind: AdminStatusKind }) {
  return (
    <div className={styles.statusLine}>
      <span className={styles.statusLineLabel}>
        <AdminStatusDot kind={kind} size={7} />
        {label}
      </span>
      <span className={styles.statusLineValue}>{value}</span>
    </div>
  );
}

function BarRow({ label, value, max, sub }: { label: string; value: number; max: number; sub: string }) {
  const width = `${Math.max(6, Math.round((value / max) * 100))}%`;
  return (
    <div>
      <div className={styles.barRowHeader}>
        <span className={styles.barRowLabel}>{label}</span>
        <span className={styles.smallMuted}>{integer.format(value)}</span>
      </div>
      <div className={styles.barTrack}>
        <div style={{ width, height: "100%", background: "var(--admin-accent)" }} />
      </div>
      <p className={styles.subText}>{sub}</p>
    </div>
  );
}

function JobMetricRow({
  job,
}: {
  job: NonNullable<AdminPriceIntelligenceHealth["jobs"]["byName"]>[number];
}) {
  const statusKind =
    job.lastStatus === "error"
      ? "error"
      : job.lastStatus === "success"
        ? "success"
        : job.lastStatus === "running"
          ? "accent"
          : "warn";

  return (
    <div
      className={styles.jobMetricRow}
    >
      <div className={styles.cellContent}>
        <code className={styles.jobName}>{job.name}</code>
        <p className={styles.subText}>
          Último: {formatDate(job.lastRunAt)}
        </p>
        {job.lastErrorMessage && (
          <p className={styles.jobError}>
            {job.lastErrorMessage}
          </p>
        )}
      </div>
      <AdminBadge kind={statusKind === "success" ? "success" : statusKind === "error" ? "error" : "warn"}>
        {job.lastStatus || "sem run"}
      </AdminBadge>
      <SmallMuted>{integer.format(job.successes)} ok</SmallMuted>
      <SmallMuted>{integer.format(job.failures)} falhas</SmallMuted>
      <SmallMuted>{job.successRate === null ? "--" : formatPercent(job.successRate)}</SmallMuted>
      <SmallMuted>{formatDuration(job.avgDurationMs)}</SmallMuted>
    </div>
  );
}

function SmallMuted({ children }: { children: React.ReactNode }) {
  return <span className={styles.smallMuted}>{children}</span>;
}

function QuietEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.quietEmpty}>
      {children}
    </div>
  );
}

function healthLabel(health: AdminPriceIntelligenceHealth["health"]) {
  if (health === "green") return "Motor saudável";
  if (health === "amber") return "Atenção em alguns pontos";
  return "Problemas críticos";
}

function statusFromHealth(health: AdminPriceIntelligenceHealth["health"]): AdminStatusKind {
  if (health === "green") return "success";
  if (health === "amber") return "warn";
  return "error";
}

function healthColor(health: AdminPriceIntelligenceHealth["health"]) {
  if (health === "green") return "var(--admin-success)";
  if (health === "amber") return "var(--admin-warning)";
  return "var(--admin-danger)";
}

function statusFromSeverity(severity: "red" | "amber" | "info"): AdminStatusKind {
  if (severity === "red") return "error";
  if (severity === "amber") return "warn";
  return "accent";
}

function badgeFromSeverity(severity: "red" | "amber" | "info"): AdminBadgeKind {
  if (severity === "red") return "error";
  if (severity === "amber") return "warn";
  return "accent";
}

function severityLabel(severity: "red" | "amber" | "info") {
  if (severity === "red") return "crítico";
  if (severity === "amber") return "atenção";
  return "info";
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("pt-BR");
}

function formatDuration(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  if (value < 1000) return `${Math.round(value)}ms`;
  if (value < 60_000) return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}s`;
  return `${(value / 60_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}min`;
}
