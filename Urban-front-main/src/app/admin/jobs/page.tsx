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
import styles from "./page.module.css";

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
    ? geocoderStatus?.readiness?.message ?? "Geocoder sem configuração."
    : geocoderLastFailure
      ? `Último run falhou: ${geocoderLastFailure}`
      : "Processa eventos importados sem latitude/longitude usando o geocoder do backend.";

  if (loading) return <AdminPageLoading />;

  const historyColumns: AdminTableColumn<AdminJobRunResponse>[] = [
    {
      key: "name",
      header: "Job",
      render: (r) => (
        <code className={styles.codeTextFs12}>{r.name}</code>
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
        <span className={styles.labelTextMutedFs12}>
          {new Date(r.startedAt).toLocaleString("pt-BR")}
        </span>
      ),
    },
    {
      key: "duration",
      header: "Duração",
      width: 160,
      align: "right",
      render: (r) => (
        <div className={styles.rowCenteredGap12}>
          <button
            type="button"
            onClick={() => setResult(r)}
            className={styles.buttonAccentBg}
          >
            Ver resultado
          </button>
          <span
            className={styles.labelTextMutedFs12Mono}
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
    { href: "/admin/collectors-health", label: "Ver saúde dos coletores" },
    { href: "/admin/dashboard", label: "Ver dashboard executivo" },
  ];

  return (
    <div className={styles.boxM0xautoP40x32}>
      <AdminSectionHeader
        eyebrow="ADMIN · OPERAÇÃO"
        title="Jobs operacionais"
        subtitle="Ações seguras para operar eventos e readiness sem abrir terminal."
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
          className={styles.boxDangerBgDanger}
        >
          {error}
        </div>
      )}

      {geocoderNeedsAttention && (
        <section
          className={styles.sectionTextBgWarning}
        >
          <p
            className={styles.textWarningFs12}
          >
            Geocoder precisa de atenção
          </p>
          <p className={styles.textTextMutedM6x0x0}>
            {geocoderBlocked ? geocoderStatus?.readiness?.message : geocoderLastFailure}
          </p>
          {(geocoderStatus?.readiness?.nextAction || geocoderStatus?.lastRun?.errorMessage) && (
            <p className={styles.textTextMutedM6x0x0}>
              {geocoderStatus?.readiness?.nextAction ?? geocoderStatus?.lastRun?.errorMessage}
            </p>
          )}
        </section>
      )}

      {/* === Jobs operacionais (4 cards de ação) === */}
      <section className={styles.sectionMb56}>
        <p className={`urban-admin-eyebrow ${styles.eyebrowMb20}`}>
          JOBS OPERACIONAIS
        </p>
        <div
          className={styles.gridColsAuto260Gap16}
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
            description="Libera eventos presos com relevância antiga/zerada para nova tentativa de enriquecimento."
            disabled={!!running}
            running={running === "reset-stale-enrichment"}
            actionLabel="Resetar stale"
            onRun={() => runJob("reset-stale-enrichment", runAdminResetStaleEnrichmentJob)}
          />

          <JobCard
            title="Snapshot de dataset"
            status={datasetHealth ?? "carregando"}
            statusKind="accent"
            description="Captura o preço atual dos imóveis cadastrados para alimentar série temporal e readiness."
            disabled={!!running}
            running={running === "dataset-snapshot"}
            actionLabel="Rodar snapshot"
            onRun={() => runJob("dataset-snapshot", runAdminDatasetSnapshot)}
          />

          <JobCard
            title="Features de eventos"
            status={datasetHealth ?? "carregando"}
            statusKind="accent"
            description="Gera snapshots de proximidade a eventos por imóvel para alimentar o dataset evolutivo."
            disabled={!!running}
            running={running === "event-proximity-snapshot"}
            actionLabel="Gerar features"
            onRun={() => runJob("event-proximity-snapshot", runAdminEventProximitySnapshot)}
          />
        </div>
      </section>

      {/* === Atalhos (links secundários) === */}
      <section className={styles.sectionMb56}>
        <p className={`urban-admin-eyebrow ${styles.eyebrowMb20}`}>
          ATALHOS
        </p>
        <AdminCard variant="subtle">
          <ul className={styles.listM0P0}>
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
                  className={`urban-admin-shortcut-link ${styles.shortcutLinkBetweenCentered}`}
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
        <section className={styles.sectionMb48}>
          <AdminCard variant="subtle">
            <AdminCardHeader
              eyebrow="ÚLTIMA EXECUÇÃO"
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
              className={styles.textTextMutedFs12}
            >
              Inicio {new Date(result.startedAt).toLocaleString("pt-BR")} — fim{" "}
              {result.finishedAt
                ? new Date(result.finishedAt).toLocaleString("pt-BR")
                : "em andamento"}
              {typeof result.durationMs === "number" ? ` — ${result.durationMs}ms` : ""}
            </p>
            <pre
              className={styles.preBlockTextMutedBgSurfaceElevated}
            >
              {JSON.stringify(result.result ?? { error: result.errorMessage }, null, 2)}
            </pre>
          </AdminCard>
        </section>
      )}

      {/* === Histórico === */}
      <section className={styles.sectionMb32}>
        <header
          className={styles.rowBetweenCentered}
        >
          <div>
            <p className="urban-admin-eyebrow">HISTÓRICO</p>
            <h2
              className={styles.headingTextFs20}
            >
              Últimos jobs admin
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
              title="Nenhuma execução registrada"
              body="Execute um job acima para criar a primeira entrada."
            />
          }
        />
      </section>

      <footer
        className={styles.footerTextMutedFs12}
      >
        Jobs destrutivos, billing e Stays ficam fora daqui até terem confirmacao
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
          className={styles.rowCenteredGap8}
        >
          <AdminStatusDot kind={statusKind} size={8} />
          <span
            className={styles.labelTextFs13}
          >
            {status}
          </span>
        </div>
        <h3
          className={styles.subheadingTextFs16}
        >
          {title}
        </h3>
      </div>
      <p
        className={styles.textTextMutedFs13}
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
