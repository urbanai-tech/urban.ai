"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAdminStays, type AdminStaysHealth } from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminButton,
  AdminBadge,
  AdminStatusDot,
  AdminMetricCard,
  AdminTable,
  type AdminTableColumn,
  AdminEmptyState,
  AdminPageLoading,
  Icons,
} from "../_components";
import type { AdminBadgeKind, AdminStatusKind } from "../_components";
import styles from "./page.module.css";
import { brlFromCents } from "../../lib/format";

type PushRow = AdminStaysHealth["recent"][number];

const PUSH_STATUS_ORDER = ["success", "rejected", "error", "pending"] as const;

/**
 * /admin/stays — Saúde da integração Stays.
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Hierarquia invertida: KPIs primeiro (push success rate como hero).
 *  - Alerta beta-private vira faixa horizontal slim (border-left amber 2px).
 *  - 4 status (success/rejected/error/pending) viram barra empilhada compacta
 *    + grid de SmallStat ao inves de 4 cores diferentes.
 *  - Tabela "Pushes recentes" com AdminTable + filtro de status.
 *  - "← Voltar" removido (AdminShell tem breadcrumb).
 */
export default function AdminStaysPage() {
  const [data, setData] = useState<AdminStaysHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminStays());
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e?.response?.status;
      setError(
        status === 401 || status === 403 ? "Acesso negado." : e?.message || "Erro",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pushByStatus = useMemo(() => {
    const m = new Map<string, number>();
    data?.pushLast30d.forEach((r) => m.set(r.status, r.count));
    return m;
  }, [data]);

  const totalPushes = useMemo(
    () =>
      Array.from(pushByStatus.values()).reduce((acc, v) => acc + v, 0),
    [pushByStatus],
  );

  const successRate =
    totalPushes > 0
      ? Math.round(((pushByStatus.get("success") ?? 0) / totalPushes) * 100)
      : null;

  const filteredRecent = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "all") return data.recent;
    return data.recent.filter((p) => p.status === statusFilter);
  }, [data, statusFilter]);

  if (loading) return <AdminPageLoading />;

  if (error || !data) {
    return (
      <div className={styles.pageContainer}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar"
          body={error ?? "Resposta vazia do backend"}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AdminButton variant="primary" onClick={load}>
              Tentar novamente
            </AdminButton>
          }
        />
      </div>
    );
  }

  const pushColumns: AdminTableColumn<PushRow>[] = [
    {
      key: "targetDate",
      header: "Data alvo",
      width: 110,
      render: (p) => (
        <span className={styles.pushPriceCell}>
          {p.targetDate}
        </span>
      ),
    },
    {
      key: "previous",
      header: "Antes",
      align: "right",
      width: 110,
      render: (p) => (
        <span className={styles.pushPreviousPrice}>
          {brlFromCents(p.previousPriceCents)}
        </span>
      ),
    },
    {
      key: "new",
      header: "Depois",
      align: "right",
      width: 110,
      render: (p) => (
        <span className={styles.pushPriceCell}>
          {brlFromCents(p.newPriceCents)}
        </span>
      ),
    },
    {
      key: "origin",
      header: "Origem",
      render: (p) => (
        <code className={styles.pushOrigin}>{p.origin}</code>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      render: (p) => (
        <AdminBadge kind={pushStatusKind(p.status)}>{p.status}</AdminBadge>
      ),
    },
    {
      key: "createdAt",
      header: "Quando",
      width: 170,
      render: (p) => (
        <span className={styles.pushCreatedAt}>
          {new Date(p.createdAt).toLocaleString("pt-BR")}
        </span>
      ),
    },
  ];

  const statusFilterOptions = ["all", ...PUSH_STATUS_ORDER] as const;

  return (
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN · STAYS"
        title="Saúde da Stays"
        subtitle="Integração Stays — contas conectadas, listings sincronizados e pushes de preço."
        actions={
          <AdminButton
            variant="secondary"
            onClick={load}
            leftIcon={<Icons.RefreshCw size={12} />}
          >
            Atualizar
          </AdminButton>
        }
      />

      {/* === Hero KPI: push success rate === */}
      <section className={styles.heroSection}>
        <AdminCard variant="accent" className={styles.heroCard}>
          <div
            className={styles.heroGrid}
          >
            <div>
              <p className="urban-admin-eyebrow">PUSH SUCCESS RATE (30D)</p>
              <p
                className={`urban-admin-display-hero ${styles.successRate} ${
                  successRate == null
                    ? ""
                    : successRate >= 90
                      ? styles.successRateGood
                      : successRate >= 60
                        ? styles.successRateWarn
                        : styles.successRateBad
                }`}
              >
                {successRate == null ? "—" : `${successRate}%`}
              </p>
              <p
                className={styles.heroDescription}
              >
                {totalPushes.toLocaleString("pt-BR")} pushes nos últimos 30 dias ·{" "}
                {pushByStatus.get("success") ?? 0} aceitos pela Stays.
              </p>
            </div>
            <div className={styles.statCard}>
              <p className="urban-admin-eyebrow-muted">Listings sincronizados</p>
              <p className={`urban-admin-display-md ${styles.statValue}`}>
                {data.listings.total}
              </p>
              <p className={styles.statCaption}>
                {data.listings.active} ativos · {data.listings.forcedAuto} em modo automático
              </p>
            </div>
            <div className={styles.statCard}>
              <p className="urban-admin-eyebrow-muted">Contas conectadas</p>
              <p className={`urban-admin-display-md ${styles.statValue}`}>
                {data.accountsByStatus.reduce((acc, r) => acc + r.count, 0)}
              </p>
              <p className={styles.statCaption}>
                {data.accountsByStatus.length} status distintos
              </p>
            </div>
          </div>
        </AdminCard>
      </section>

      {/* === Faixa slim beta-private === */}
      {data.readiness && (
        <section
          className={`${styles.readinessStrip} ${
            data.readiness.betaPrivate ? styles.readinessStripBeta : styles.readinessStripReady
          }`}
        >
          <div className={styles.readinessInfo}>
            <AdminStatusDot
              kind={data.readiness.betaPrivate ? "warn" : "success"}
              size={8}
            />
            <div>
              <p
                className={styles.readinessTitle}
              >
                {data.readiness.betaPrivate
                  ? "Stays aguardando habilitação operacional"
                  : "Stays pronto para smoke controlado"}
              </p>
              <p
                className={styles.readinessDetail}
              >
                API base: {data.readiness.apiBaseConfigured ? "ok" : "faltando"} ·
                Token encryption:{" "}
                {data.readiness.tokenEncryptionConfigured ? "ok" : "faltando"}
              </p>
            </div>
          </div>
          {data.readiness.missingEnv.length > 0 && (
            <div className={styles.missingEnvList}>
              {data.readiness.missingEnv.map((env) => (
                <code
                  key={env}
                  className={styles.missingEnvTag}
                >
                  {env}
                </code>
              ))}
            </div>
          )}
        </section>
      )}

      {/* === Breakdown pushes 30d: barra empilhada + stats === */}
      <section className={styles.section}>
        <p className={`urban-admin-eyebrow ${styles.sectionEyebrow}`}>
          PUSHES (30D) POR STATUS
        </p>

        {totalPushes === 0 ? (
          <AdminCard variant="subtle">
            <p className={styles.emptyHint}>
              Nenhum push registrado.
            </p>
          </AdminCard>
        ) : (
          <>
            {/* Barra empilhada compacta */}
            <div
              className={styles.statusBar}
            >
              {PUSH_STATUS_ORDER.map((s) => {
                const count = pushByStatus.get(s) ?? 0;
                if (count === 0) return null;
                return (
                  <div
                    key={s}
                    title={`${s}: ${count}`}
                    className={styles.statusSegment}
                    style={{
                      "--pct": `${(count / totalPushes) * 100}%`,
                      "--seg-color": pushStatusColor(s),
                    } as React.CSSProperties}
                  />
                );
              })}
            </div>

            {/* Grid 2x2 de small stats */}
            <div
              className={styles.statusGrid}
            >
              {PUSH_STATUS_ORDER.map((s) => (
                <AdminMetricCard
                  key={s}
                  label={s}
                  value={pushByStatus.get(s) ?? 0}
                  status={pushStatusDotKind(s)}
                  variant="sm"
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* === Contas conectadas por status === */}
      <section className={styles.section}>
        <AdminCard variant="subtle">
          <AdminCardHeader title="Contas conectadas" />
          {data.accountsByStatus.length === 0 ? (
            <p className={styles.emptyHint}>
              Nenhuma conta ainda.
            </p>
          ) : (
            <ul
              className={styles.accountList}
            >
              {data.accountsByStatus.map((r) => (
                <li
                  key={r.status}
                  className={styles.accountRow}
                >
                  <code className={styles.accountStatus}>{r.status}</code>
                  <span
                    className={styles.accountCount}
                  >
                    {r.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </section>

      {/* === Pushes recentes === */}
      <section>
        <header
          className={styles.pushesHeader}
        >
          <div>
            <p className="urban-admin-eyebrow">PUSHES RECENTES</p>
            <h2
              className={styles.pushesTitle}
            >
              Últimos pushes
            </h2>
          </div>
          <div
            className={styles.statusFilter}
          >
            {statusFilterOptions.map((s) => {
              const active = s === statusFilter;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`${styles.filterButton} ${active ? styles.filterButtonActive : ""}`}
                >
                  {s === "all" ? "Todos" : s}
                </button>
              );
            })}
          </div>
        </header>

        <AdminTable
          columns={pushColumns}
          rows={filteredRecent}
          rowKey={(p) => p.id}
          empty={
            <AdminEmptyState
              title="Nenhum push com esse filtro"
              body="Conecte uma conta Stays para comecar ou ajuste o filtro."
            />
          }
        />
      </section>
    </div>
  );
}

function pushStatusKind(status: string): AdminBadgeKind {
  if (status === "success") return "success";
  if (status === "rejected") return "warn";
  if (status === "error") return "error";
  return "neutral";
}

function pushStatusDotKind(status: string): AdminStatusKind {
  if (status === "success") return "success";
  if (status === "rejected") return "warn";
  if (status === "error") return "error";
  return "neutral";
}

function pushStatusColor(status: string): string {
  if (status === "success") return "var(--admin-success)";
  if (status === "rejected") return "var(--admin-warning)";
  if (status === "error") return "var(--admin-danger)";
  return "var(--admin-text-muted)";
}
