"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminPriceIntelligenceHealth,
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

const integer = new Intl.NumberFormat("pt-BR");

export default function AdminPriceIntelligencePage() {
  const [data, setData] = useState<AdminPriceIntelligenceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetchAdminPriceIntelligenceHealth();
      setData(response);
      setError(null);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; userMessage?: string; message?: string };
      setError(
        e?.response?.status === 401 || e?.response?.status === 403
          ? "Acesso negado. Voce precisa ser admin."
          : e?.userMessage || e?.message || "Erro ao carregar saude de Price Intelligence.",
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
        header: "Imovel",
        render: (row) => (
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--admin-text)" }}>
              {row.title || row.listId || row.addressId || "Sem identificacao"}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--admin-text-muted)" }}>
              {[row.city, row.state].filter(Boolean).join(", ") || row.userEmail || "Localidade nao informada"}
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
          <span style={{ color: "var(--admin-text-muted)", lineHeight: 1.5 }}>
            {row.issue}
          </span>
        ),
      },
      {
        key: "signals",
        header: "Sinais",
        width: 220,
        render: (row) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
          <code style={{ fontSize: 12, color: "var(--admin-text)" }}>{row.name}</code>
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
        header: "Duracao",
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
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "40px 32px" }}>
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

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN / PRICE INTELLIGENCE"
        title="Saude do motor de precos"
        subtitle={
          <span>
            Janela de {data.windowDays} dias / ultima leitura:{" "}
            <strong style={{ color: "var(--admin-text)" }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <AdminStatusDot kind={healthKind} size={14} pulse={data.health !== "green"} />
            <div>
              <p className="urban-admin-eyebrow-muted">SAUDE GERAL</p>
              <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 600 }}>
                {healthLabel(data.health)}
              </p>
            </div>
          </div>
          {alerts.length === 0 && <AdminBadge kind="success">Sem alertas ativos</AdminBadge>}
        </div>

        {alerts.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 10 }}>
            {alerts.map((alert, index) => (
              <li key={`${alert.message}-${index}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ paddingTop: 6 }}>
                  <AdminStatusDot kind={statusFromSeverity(alert.severity)} size={7} />
                </span>
                <span style={{ fontSize: 13, color: "var(--admin-text-muted)", lineHeight: 1.55 }}>
                  {alert.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 24,
          marginBottom: 48,
        }}
      >
        <AdminMetricCard
          label="Snapshots"
          value={integer.format(data.snapshots.total)}
          sub={`${integer.format(data.snapshots.last24h)} nas ultimas 24h`}
          status={data.snapshots.last24h > 0 ? "success" : "warn"}
          accent
        />
        <AdminMetricCard
          label="Observacoes"
          value={integer.format(data.observations.total)}
          sub={`${integer.format(data.observations.distinctListings)} imoveis com historico`}
          status={data.observations.trainingReady > 0 ? "success" : "warn"}
        />
        <AdminMetricCard
          label="Sugestoes verificadas"
          value={`${formatPercent(data.suggestions.verifiedPercent)}`}
          sub={`${integer.format(data.suggestions.verified)} de ${integer.format(data.suggestions.total)}`}
          status={data.suggestions.failedVerification > 0 ? "warn" : "success"}
        />
        <AdminMetricCard
          label="Tempo medio jobs"
          value={formatDuration(data.jobs.avgDurationMs)}
          sub={`${integer.format(data.jobs.failedLast24h)} falhas nas ultimas 24h`}
          status={data.jobs.failedLast24h > 0 ? "error" : "success"}
        />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
          gap: 24,
          marginBottom: 48,
        }}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader eyebrow="SUGESTOES" title="Verificacao e aplicacao" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
            <InlineStat label="Futuras" value={integer.format(data.suggestions.future)} />
            <InlineStat label="Aceitas" value={integer.format(data.suggestions.accepted)} />
            <InlineStat label="Aplicadas" value={integer.format(data.suggestions.applied)} />
            <InlineStat label="Pendentes" value={integer.format(data.suggestions.pendingVerification)} />
          </div>
        </AdminCard>

        <AdminCard variant="subtle">
          <AdminCardHeader eyebrow="JOBS" title="Fila operacional" />
          <div style={{ display: "grid", gap: 12 }}>
            <StatusLine label="Rodando" value={integer.format(data.jobs.running)} kind={data.jobs.running > 0 ? "accent" : "neutral"} />
            <StatusLine
              label="Na fila"
              value={data.jobs.queueAvailable === false ? "Indisponivel" : integer.format(data.jobs.queued)}
              kind={data.jobs.queueAvailable === false ? "warn" : data.jobs.queued > 0 ? "warn" : "neutral"}
            />
            <StatusLine label="Ultimo sucesso" value={formatDate(data.jobs.lastSuccessAt)} kind={data.jobs.lastSuccessAt ? "success" : "warn"} />
            <StatusLine label="Ultimo run" value={data.jobs.lastRun ? `${data.jobs.lastRun.name} / ${data.jobs.lastRun.status}` : "Sem execucoes"} kind={data.jobs.lastRun?.status === "error" ? "error" : "neutral"} />
            {data.jobs.queueAvailable === false && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--admin-text-muted)", lineHeight: 1.5 }}>
                {data.jobs.queueUnavailableReason || "Fila real ainda nao implementada para este pipeline."}
              </p>
            )}
          </div>
        </AdminCard>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(300px, 0.7fr)",
          gap: 24,
          marginBottom: 48,
        }}
      >
        <AdminCard>
          <AdminCardHeader eyebrow="JOBS" title="Metricas por nome" />
          {jobMetrics.length === 0 ? (
            <QuietEmpty>Nenhuma metrica por job retornada.</QuietEmpty>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {jobMetrics.map((job) => (
                <JobMetricRow key={job.name} job={job} />
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard variant={data.schema?.ok ? "subtle" : "accent"}>
          <AdminCardHeader eyebrow="SCHEMA" title="Migrations operacionais" />
          {data.schema ? (
            <div style={{ display: "grid", gap: 12 }}>
              <StatusLine
                label="Status"
                value={data.schema.ok ? "Completo" : "Acao necessaria"}
                kind={data.schema.ok ? "success" : "error"}
              />
              <StatusLine label="Checado em" value={formatDate(data.schema.checkedAt)} kind="neutral" />
              {data.schema.checkError && (
                <QuietEmpty>{data.schema.checkError}</QuietEmpty>
              )}
              {data.schema.missing.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--admin-text-muted)", fontSize: 12, lineHeight: 1.7 }}>
                  {data.schema.missing.slice(0, 8).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <QuietEmpty>Backend ainda nao retornou diagnostico de schema.</QuietEmpty>
          )}
        </AdminCard>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 0.8fr) minmax(0, 1.2fr)",
          gap: 24,
          marginBottom: 48,
        }}
      >
        <AdminCard>
          <AdminCardHeader eyebrow="FALHAS" title="Falhas por tipo" />
          {failures.length === 0 ? (
            <QuietEmpty>Nenhuma falha agrupada na janela.</QuietEmpty>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {failures.map((failure) => (
                <BarRow
                  key={failure.type}
                  label={failure.type}
                  value={failure.count}
                  max={Math.max(...failures.map((item) => item.count), 1)}
                  sub={`Ultima: ${formatDate(failure.lastSeenAt)}`}
                />
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard>
          <AdminCardHeader eyebrow="ATALHOS" title="Acoes rapidas" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
            {shortcuts.map((shortcut) => (
              <a
                key={`${shortcut.href}-${shortcut.label}`}
                href={shortcut.href}
                style={{
                  border: "1px solid var(--admin-divider)",
                  borderRadius: 2,
                  padding: 16,
                  color: "var(--admin-text)",
                  textDecoration: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                    {shortcut.label}
                  </span>
                  {shortcut.description && (
                    <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--admin-text-muted)", lineHeight: 1.45 }}>
                      {shortcut.description}
                    </span>
                  )}
                </span>
                <Icons.ArrowRight size={14} style={{ color: "var(--admin-accent)", flexShrink: 0 }} />
              </a>
            ))}
          </div>
        </AdminCard>
      </section>

      <section style={{ marginBottom: 48 }}>
        <AdminCardHeader eyebrow="IMOVEIS" title="Imoveis problematicos" />
        <AdminTable
          columns={propertyColumns}
          rows={problematicProperties}
          rowKey={(row, index) => row.addressId || row.listId || String(index)}
          empty={<QuietEmpty>Nenhum imovel problematico retornado.</QuietEmpty>}
          minWidth={860}
        />
      </section>

      <section>
        <AdminCardHeader eyebrow="HISTORICO" title="Runs recentes de Price Intelligence" />
        <AdminTable
          columns={jobColumns}
          rows={recentJobs}
          rowKey={(row, index) => row.id || `${row.name}-${index}`}
          empty={<QuietEmpty>Nenhum job recente retornado.</QuietEmpty>}
          minWidth={760}
        />
      </section>

      {(data.endpointGaps?.length ?? 0) > 0 && (
        <section style={{ marginTop: 32 }}>
          <AdminCard variant="accent">
            <AdminCardHeader eyebrow="CONTRATO" title="Gaps reportados pelo backend" />
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--admin-text-muted)", fontSize: 13, lineHeight: 1.7 }}>
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
  { label: "Qualidade", href: "/admin/quality", description: "MAPE, ocupacao e ground truth." },
  { label: "Jobs do sistema", href: "/admin/jobs", description: "Executar snapshots e recomputacoes." },
  { label: "Config. de precos", href: "/admin/pricing-config", description: "Regras e parametros operacionais." },
  { label: "Radar de demanda", href: "/admin/event-radar", description: "Eventos que alimentam sugestoes." },
];

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderTop: "1px solid var(--admin-divider)", paddingTop: 14 }}>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 600, color: "var(--admin-text)" }}>
        {value}
      </p>
    </div>
  );
}

function StatusLine({ label, value, kind }: { label: string; value: string; kind: AdminStatusKind }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--admin-text-muted)", fontSize: 13 }}>
        <AdminStatusDot kind={kind} size={7} />
        {label}
      </span>
      <span style={{ color: "var(--admin-text)", fontSize: 13, fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function BarRow({ label, value, max, sub }: { label: string; value: number; max: number; sub: string }) {
  const width = `${Math.max(6, Math.round((value / max) * 100))}%`;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "var(--admin-text)" }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>{integer.format(value)}</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width, height: "100%", background: "var(--admin-accent)" }} />
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--admin-text-dim)" }}>{sub}</p>
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
      style={{
        border: "1px solid var(--admin-divider)",
        borderRadius: 2,
        padding: 14,
        display: "grid",
        gridTemplateColumns: "minmax(180px, 1fr) repeat(4, minmax(72px, auto))",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <code style={{ fontSize: 12, color: "var(--admin-text)" }}>{job.name}</code>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--admin-text-dim)" }}>
          Ultimo: {formatDate(job.lastRunAt)}
        </p>
        {job.lastErrorMessage && (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--admin-danger)", lineHeight: 1.4 }}>
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
  return <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>{children}</span>;
}

function QuietEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "var(--admin-text-muted)", fontSize: 13, lineHeight: 1.55 }}>
      {children}
    </div>
  );
}

function healthLabel(health: AdminPriceIntelligenceHealth["health"]) {
  if (health === "green") return "Motor saudavel";
  if (health === "amber") return "Atencao em alguns pontos";
  return "Problemas criticos";
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
  if (severity === "red") return "critico";
  if (severity === "amber") return "atencao";
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
