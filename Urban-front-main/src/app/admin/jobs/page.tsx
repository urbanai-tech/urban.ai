"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminJobRuns,
  fetchAdminDatasetDiagnostics,
  fetchGeocoderStatus,
  runAdminDatasetSnapshot,
  runAdminEventProximitySnapshot,
  runAdminGeocoderJob,
  runAdminResetStaleEnrichmentJob,
  type AdminJobRunResponse,
  type GeocoderStatus,
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminButton,
  AdminBadge,
  AdminStatusDot,
  AdminTable,
  type AdminTableColumn,
  AdminEmptyState,
  AdminPageLoading,
  Icons,
} from "../_components";

/**
 * /admin/jobs — Jobs operacionais admin (geocoder, snapshot, reset stale).
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Layout: 2 sections distintas (Jobs operacionais grid + Atalhos lista).
 *  - JobCards: status em bold no topo + dot semântico colorido por estado.
 *  - JSON output em <pre> mantido, dentro de AdminCard com bg sutil.
 *  - alert errors → bloco com border-left danger.
 *  - Tabela histórica usa AdminTable.
 *  - "← Voltar" removido (AdminShell tem breadcrumb).
 */
export default function AdminJobsPage() {
  const [pendingGeocode, setPendingGeocode] = useState<number | null>(null);
  const [geocoderStatus, setGeocoderStatus] = useState<GeocoderStatus | null>(null);
  const [datasetHealth, setDatasetHealth] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<AdminJobRunResponse | null>(null);
  const [history, setHistory] = useState<AdminJobRunResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadStatus() {
    try {
      const status = await fetchGeocoderStatus();
      setPendingGeocode(status.pendingGeocode);
      setGeocoderStatus(status);
      const dataset = await fetchAdminDatasetDiagnostics();
      setDatasetHealth(`${dataset.health} / ${dataset.readiness}`);
      const runs = await fetchAdminJobRuns(8);
      setHistory(runs);
      setError(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || "Erro ao carregar status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function runJob(name: string, handler: () => Promise<AdminJobRunResponse>) {
    if (running) return;
    setRunning(name);
    setResult(null);
    setError(null);
    try {
      const details = await handler();
      setResult(details);
      await loadStatus();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || "Falha ao executar job.");
      await loadStatus();
    } finally {
      setRunning(null);
    }
  }

  const geocoderBlocked = geocoderStatus?.readiness?.configured === false;
  const geocoderLastFailure = geocoderStatus?.lastRun?.failures?.[0]?.reason;
  const geocoderNeedsAttention = Boolean(geocoderBlocked || geocoderLastFailure);
  const geocoderCardStatus = geocoderBlocked
    ? "config pendente"
    : pendingGeocode === null
      ? "carregando"
      : `${pendingGeocode} pendentes`;
  const geocoderCardStatusKind: "error" | "warn" | "success" = geocoderBlocked
    ? "error"
    : geocoderLastFailure
      ? "warn"
      : "success";
  const geocoderCardDescription = geocoderBlocked
    ? geocoderStatus?.readiness?.message ?? "Geocoder sem configuracao."
    : geocoderLastFailure
      ? `Ultimo run falhou: ${geocoderLastFailure}`
      : "Processa eventos importados sem latitude/longitude usando o geocoder do backend.";

  if (loading) return <AdminPageLoading />;

  const historyColumns: AdminTableColumn<AdminJobRunResponse>[] = [
    {
      key: "name",
      header: "Job",
      render: (r) => (
        <code style={{ fontSize: 12, color: "var(--admin-text)" }}>{r.name}</code>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      render: (r) => (
        <AdminBadge
          kind={
            r.status === "success"
              ? "success"
              : r.status === "error"
                ? "error"
                : "warn"
          }
        >
          {r.status}
        </AdminBadge>
      ),
    },
    {
      key: "startedAt",
      header: "Inicio",
      width: 180,
      render: (r) => (
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
          {new Date(r.startedAt).toLocaleString("pt-BR")}
        </span>
      ),
    },
    {
      key: "duration",
      header: "Duracao",
      width: 160,
      align: "right",
      render: (r) => (
        <div style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setResult(r)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--admin-accent)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Ver resultado
          </button>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 12,
              color: "var(--admin-text-muted)",
            }}
          >
            {typeof r.durationMs === "number" ? `${r.durationMs}ms` : "—"}
          </span>
        </div>
      ),
    },
  ];

  const shortcuts = [
    { href: "/admin/events/new", label: "Cadastrar evento manual" },
    { href: "/admin/events/import", label: "Importar CSV de eventos" },
    { href: "/admin/collectors-health", label: "Ver saude dos coletores" },
    { href: "/admin/dashboard", label: "Ver dashboard executivo" },
  ];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · OPERACAO"
        title="Jobs operacionais"
        subtitle="Acoes seguras para operar eventos e readiness sem abrir terminal."
        actions={
          <AdminButton
            variant="secondary"
            onClick={loadStatus}
            leftIcon={<Icons.RefreshCw size={12} />}
          >
            Atualizar status
          </AdminButton>
        }
      />

      {error && (
        <div
          style={{
            marginBottom: 32,
            padding: "14px 18px",
            borderLeft: "2px solid var(--admin-danger)",
            background: "rgba(248, 113, 113, 0.06)",
            fontSize: 13,
            color: "var(--admin-danger)",
            lineHeight: 1.55,
          }}
        >
          {error}
        </div>
      )}

      {geocoderNeedsAttention && (
        <section
          style={{
            marginBottom: 32,
            padding: "14px 18px",
            borderLeft: "2px solid var(--admin-warning)",
            background: "rgba(245, 181, 71, 0.06)",
            fontSize: 13,
            color: "var(--admin-text)",
            lineHeight: 1.55,
          }}
        >
          <p
            style={{
              margin: 0,
              fontWeight: 600,
              color: "var(--admin-warning)",
              fontSize: 12,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            Geocoder precisa de atencao
          </p>
          <p style={{ margin: "6px 0 0", color: "var(--admin-text-muted)" }}>
            {geocoderBlocked ? geocoderStatus?.readiness?.message : geocoderLastFailure}
          </p>
          {(geocoderStatus?.readiness?.nextAction || geocoderStatus?.lastRun?.errorMessage) && (
            <p style={{ margin: "6px 0 0", color: "var(--admin-text-muted)" }}>
              {geocoderStatus?.readiness?.nextAction ?? geocoderStatus?.lastRun?.errorMessage}
            </p>
          )}
        </section>
      )}

      {/* === Jobs operacionais (4 cards de ação) === */}
      <section style={{ marginBottom: 56 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 20 }}>
          JOBS OPERACIONAIS
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          <JobCard
            title="Geocoder de eventos"
            status={geocoderCardStatus}
            statusKind={geocoderCardStatusKind}
            description={geocoderCardDescription}
            disabled={!!running || geocoderBlocked}
            running={running === "geocoder"}
            actionLabel="Rodar geocoder"
            onRun={() => runJob("geocoder", () => runAdminGeocoderJob(50))}
          />

          <JobCard
            title="Reset enrichment stale"
            status="manual"
            statusKind="neutral"
            description="Libera eventos presos com relevancia antiga/zerada para nova tentativa de enriquecimento."
            disabled={!!running}
            running={running === "reset-stale-enrichment"}
            actionLabel="Resetar stale"
            onRun={() => runJob("reset-stale-enrichment", runAdminResetStaleEnrichmentJob)}
          />

          <JobCard
            title="Snapshot de dataset"
            status={datasetHealth ?? "carregando"}
            statusKind="accent"
            description="Captura o preco atual dos imoveis cadastrados para alimentar serie temporal e readiness."
            disabled={!!running}
            running={running === "dataset-snapshot"}
            actionLabel="Rodar snapshot"
            onRun={() => runJob("dataset-snapshot", runAdminDatasetSnapshot)}
          />

          <JobCard
            title="Features de eventos"
            status={datasetHealth ?? "carregando"}
            statusKind="accent"
            description="Gera snapshots de proximidade a eventos por imovel para alimentar o dataset evolutivo."
            disabled={!!running}
            running={running === "event-proximity-snapshot"}
            actionLabel="Gerar features"
            onRun={() => runJob("event-proximity-snapshot", runAdminEventProximitySnapshot)}
          />
        </div>
      </section>

      {/* === Atalhos (links secundários) === */}
      <section style={{ marginBottom: 56 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 20 }}>
          ATALHOS
        </p>
        <AdminCard variant="subtle">
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {shortcuts.map((s, i) => (
              <li
                key={s.href}
                style={{
                  borderBottom:
                    i === shortcuts.length - 1
                      ? "none"
                      : "1px solid var(--admin-divider)",
                }}
              >
                <a
                  href={s.href}
                  className="urban-admin-shortcut-link"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 4px",
                    fontSize: 13,
                    color: "var(--admin-text)",
                    textDecoration: "none",
                    transition: "color 120ms",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--admin-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--admin-text)";
                  }}
                >
                  <span>{s.label}</span>
                  <Icons.ArrowRight size={12} />
                </a>
              </li>
            ))}
          </ul>
        </AdminCard>
      </section>

      {/* === Resultado da última execução === */}
      {result && (
        <section style={{ marginBottom: 48 }}>
          <AdminCard variant="subtle">
            <AdminCardHeader
              eyebrow="ULTIMA EXECUCAO"
              title={result.name}
              actions={
                <AdminBadge
                  kind={result.status === "success" ? "success" : "error"}
                >
                  {result.status}
                </AdminBadge>
              }
            />
            <p
              style={{
                fontSize: 12,
                color: "var(--admin-text-muted)",
                margin: "0 0 14px",
              }}
            >
              Inicio {new Date(result.startedAt).toLocaleString("pt-BR")} — fim{" "}
              {result.finishedAt
                ? new Date(result.finishedAt).toLocaleString("pt-BR")
                : "em andamento"}
              {typeof result.durationMs === "number" ? ` — ${result.durationMs}ms` : ""}
            </p>
            <pre
              style={{
                maxHeight: 320,
                overflow: "auto",
                margin: 0,
                padding: 16,
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--admin-divider)",
                borderRadius: 2,
                fontSize: 12,
                color: "var(--admin-text-muted)",
                fontFamily: "monospace",
                lineHeight: 1.55,
              }}
            >
              {JSON.stringify(result.result ?? { error: result.errorMessage }, null, 2)}
            </pre>
          </AdminCard>
        </section>
      )}

      {/* === Histórico === */}
      <section style={{ marginBottom: 32 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="urban-admin-eyebrow">HISTORICO</p>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--admin-text)",
                margin: "8px 0 0",
                letterSpacing: -0.3,
              }}
            >
              Ultimos jobs admin
            </h2>
          </div>
          <AdminButton
            variant="ghost"
            size="sm"
            onClick={loadStatus}
            leftIcon={<Icons.RefreshCw size={11} />}
          >
            Recarregar
          </AdminButton>
        </header>

        <AdminTable
          columns={historyColumns}
          rows={history}
          rowKey={(r) => r.id}
          empty={
            <AdminEmptyState
              title="Nenhuma execucao registrada"
              body="Execute um job acima para criar a primeira entrada."
            />
          }
        />
      </section>

      <footer
        style={{
          marginTop: 32,
          paddingTop: 20,
          borderTop: "1px solid var(--admin-divider)",
          fontSize: 12,
          color: "var(--admin-text-muted)",
          lineHeight: 1.55,
        }}
      >
        Jobs destrutivos, billing e Stays ficam fora daqui ate terem confirmacao
        operacional dedicada.
      </footer>
    </div>
  );
}

function JobCard({
  title,
  status,
  statusKind,
  description,
  actionLabel,
  disabled,
  running,
  onRun,
}: {
  title: string;
  status: string;
  statusKind: "success" | "warn" | "error" | "neutral" | "accent";
  description: string;
  actionLabel: string;
  disabled: boolean;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <AdminCard
      variant="subtle"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        height: "100%",
      }}
    >
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <AdminStatusDot kind={statusKind} size={8} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--admin-text)",
              textTransform: "lowercase",
            }}
          >
            {status}
          </span>
        </div>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--admin-text)",
            margin: 0,
            letterSpacing: -0.3,
          }}
        >
          {title}
        </h3>
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--admin-text-muted)",
          margin: 0,
          lineHeight: 1.55,
          flex: 1,
        }}
      >
        {description}
      </p>
      <AdminButton
        variant="primary"
        size="md"
        onClick={onRun}
        disabled={disabled}
        loading={running}
        style={{ alignSelf: "flex-start" }}
      >
        {running ? "Executando…" : actionLabel}
      </AdminButton>
    </AdminCard>
  );
}
