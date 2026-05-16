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

type PushRow = AdminStaysHealth["recent"][number];

const PUSH_STATUS_ORDER = ["success", "rejected", "error", "pending"] as const;

/**
 * /admin/stays — Saude da integracao Stays.
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
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
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
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--admin-text)" }}>
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
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--admin-text-muted)" }}>
          R$ {(p.previousPriceCents / 100).toFixed(2)}
        </span>
      ),
    },
    {
      key: "new",
      header: "Depois",
      align: "right",
      width: 110,
      render: (p) => (
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--admin-text)" }}>
          R$ {(p.newPriceCents / 100).toFixed(2)}
        </span>
      ),
    },
    {
      key: "origin",
      header: "Origem",
      render: (p) => (
        <code style={{ fontSize: 11, color: "var(--admin-text-dim)" }}>{p.origin}</code>
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
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
          {new Date(p.createdAt).toLocaleString("pt-BR")}
        </span>
      ),
    },
  ];

  const statusFilterOptions = ["all", ...PUSH_STATUS_ORDER] as const;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · STAYS"
        title="Saude da Stays"
        subtitle="Integracao Stays — contas conectadas, listings sincronizados e pushes de preco."
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
      <section style={{ marginBottom: 32 }}>
        <AdminCard variant="accent" style={{ padding: "40px 40px 36px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)",
              gap: 32,
              alignItems: "end",
            }}
          >
            <div>
              <p className="urban-admin-eyebrow">PUSH SUCCESS RATE (30D)</p>
              <p
                className="urban-admin-display-hero"
                style={{
                  marginTop: 12,
                  color:
                    successRate == null
                      ? "var(--admin-text-muted)"
                      : successRate >= 90
                        ? "var(--admin-success)"
                        : successRate >= 60
                          ? "var(--admin-warning)"
                          : "var(--admin-danger)",
                }}
              >
                {successRate == null ? "—" : `${successRate}%`}
              </p>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 14,
                  color: "var(--admin-text-muted)",
                  lineHeight: 1.55,
                }}
              >
                {totalPushes.toLocaleString("pt-BR")} pushes nos ultimos 30 dias ·{" "}
                {pushByStatus.get("success") ?? 0} aceitos pela Stays.
              </p>
            </div>
            <div style={{ borderLeft: "1px solid var(--admin-divider)", paddingLeft: 32 }}>
              <p className="urban-admin-eyebrow-muted">Listings sincronizados</p>
              <p className="urban-admin-display-md" style={{ marginTop: 12 }}>
                {data.listings.total}
              </p>
              <p style={{ marginTop: 6, fontSize: 12, color: "var(--admin-text-muted)" }}>
                {data.listings.active} ativos · {data.listings.forcedAuto} em modo automatico
              </p>
            </div>
            <div style={{ borderLeft: "1px solid var(--admin-divider)", paddingLeft: 32 }}>
              <p className="urban-admin-eyebrow-muted">Contas conectadas</p>
              <p className="urban-admin-display-md" style={{ marginTop: 12 }}>
                {data.accountsByStatus.reduce((acc, r) => acc + r.count, 0)}
              </p>
              <p style={{ marginTop: 6, fontSize: 12, color: "var(--admin-text-muted)" }}>
                {data.accountsByStatus.length} status distintos
              </p>
            </div>
          </div>
        </AdminCard>
      </section>

      {/* === Faixa slim beta-private === */}
      {data.readiness && (
        <section
          style={{
            marginBottom: 32,
            padding: "14px 18px",
            borderLeft: `2px solid ${
              data.readiness.betaPrivate ? "var(--admin-warning)" : "var(--admin-success)"
            }`,
            background: data.readiness.betaPrivate
              ? "rgba(245, 181, 71, 0.06)"
              : "rgba(74, 222, 128, 0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <AdminStatusDot
              kind={data.readiness.betaPrivate ? "warn" : "success"}
              size={8}
            />
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--admin-text)",
                }}
              >
                {data.readiness.betaPrivate
                  ? "Stays bloqueado em beta privado"
                  : "Stays pronto para smoke controlado"}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "var(--admin-text-muted)",
                }}
              >
                API base: {data.readiness.apiBaseConfigured ? "ok" : "faltando"} ·
                Token encryption:{" "}
                {data.readiness.tokenEncryptionConfigured ? "ok" : "faltando"}
              </p>
            </div>
          </div>
          {data.readiness.missingEnv.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {data.readiness.missingEnv.map((env) => (
                <code
                  key={env}
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "var(--admin-warning)",
                    border: "1px solid rgba(245, 181, 71, 0.3)",
                    padding: "3px 6px",
                    borderRadius: 2,
                  }}
                >
                  {env}
                </code>
              ))}
            </div>
          )}
        </section>
      )}

      {/* === Breakdown pushes 30d: barra empilhada + stats === */}
      <section style={{ marginBottom: 56 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 24 }}>
          PUSHES (30D) POR STATUS
        </p>

        {totalPushes === 0 ? (
          <AdminCard variant="subtle">
            <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: 0 }}>
              Nenhum push registrado.
            </p>
          </AdminCard>
        ) : (
          <>
            {/* Barra empilhada compacta */}
            <div
              style={{
                display: "flex",
                height: 8,
                marginBottom: 24,
                border: "1px solid var(--admin-divider)",
                borderRadius: 2,
                overflow: "hidden",
                background: "rgba(255, 255, 255, 0.02)",
              }}
            >
              {PUSH_STATUS_ORDER.map((s) => {
                const count = pushByStatus.get(s) ?? 0;
                if (count === 0) return null;
                return (
                  <div
                    key={s}
                    title={`${s}: ${count}`}
                    style={{
                      width: `${(count / totalPushes) * 100}%`,
                      background: pushStatusColor(s),
                      transition: "background 120ms",
                    }}
                  />
                );
              })}
            </div>

            {/* Grid 2x2 de small stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 32,
                borderTop: "1px solid var(--admin-divider)",
                borderBottom: "1px solid var(--admin-divider)",
              }}
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
      <section style={{ marginBottom: 56 }}>
        <AdminCard variant="subtle">
          <AdminCardHeader title="Contas conectadas" />
          {data.accountsByStatus.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: 0 }}>
              Nenhuma conta ainda.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {data.accountsByStatus.map((r) => (
                <li
                  key={r.status}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--admin-divider)",
                    fontSize: 13,
                  }}
                >
                  <code style={{ color: "var(--admin-text)" }}>{r.status}</code>
                  <span
                    style={{
                      fontFamily: "monospace",
                      color: "var(--admin-accent)",
                      fontWeight: 600,
                    }}
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
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="urban-admin-eyebrow">PUSHES RECENTES</p>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--admin-text)",
                margin: "8px 0 0",
                letterSpacing: -0.3,
              }}
            >
              Ultimos pushes
            </h2>
          </div>
          <div
            style={{
              display: "inline-flex",
              border: "1px solid var(--admin-divider)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {statusFilterOptions.map((s) => {
              const active = s === statusFilter;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderRight: "1px solid var(--admin-divider)",
                    borderBottom: active
                      ? "2px solid var(--admin-accent)"
                      : "2px solid transparent",
                    color: active ? "var(--admin-text)" : "var(--admin-text-muted)",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    padding: "8px 14px",
                    cursor: "pointer",
                  }}
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
