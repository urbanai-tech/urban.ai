"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminAlphaDashboard,
  fetchAdminAlphaRecommendations,
  runAdminAlphaReprocess,
  type AdminAlphaDashboard,
  type AdminAlphaRecommendation,
} from "@/app/service/api";
import {
  AdminSectionHeader,
  AdminMetricCard,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminTable,
  type AdminTableColumn,
  AdminInput,
  AdminEmptyState,
  AdminPageLoading,
  useAdminToast,
  Icons,
} from "../_components";

const DEFAULT_EMAIL = "gustavo8gouveia@hotmail.com";

/**
 * /admin/alpha — painel alpha (KPIs reais + auditoria + reprocesso).
 *
 * Migrado pro design system admin (.urban-admin):
 *  - Hero KPI "Receita real" em Bebas Neue (decisão central da operação alpha).
 *  - Toolbar com hierarquia: Reprocessar=primary, Export=secondary, Atualizar=ghost.
 *  - Tabela com AdminTable + hover orange.
 *  - Cards "Qualidade" / "Operação" viram AdminCard variant="subtle".
 *  - alert() → useAdminToast.
 */
export default function AdminAlphaPage() {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [dashboard, setDashboard] = useState<AdminAlphaDashboard | null>(null);
  const [rows, setRows] = useState<AdminAlphaRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const toast = useAdminToast();

  const load = async (targetEmail = email) => {
    setError(null);
    setLoading(true);
    try {
      const [dash, exportData] = await Promise.all([
        fetchAdminAlphaDashboard(targetEmail),
        fetchAdminAlphaRecommendations(targetEmail, 500),
      ]);
      setDashboard(dash);
      setRows(exportData.rows);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e?.response?.status;
      setError(status === 403 ? "Acesso negado para este painel." : e?.message || "Erro ao carregar alpha.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(DEFAULT_EMAIL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const qualityFlags = useMemo(() => {
    if (!dashboard) return [];
    return Object.entries(dashboard.events.qualityFlags).sort((a, b) => b[1] - a[1]);
  }, [dashboard]);

  const handleExport = () => {
    const headers = [
      "property",
      "event",
      "eventDate",
      "currentPrice",
      "suggestedPrice",
      "lift",
      "status",
      "appliedPrice",
      "reservationStatus",
      "realRevenue",
      "bookedNights",
      "qualityFlags",
    ];
    const csvRows = rows.map((row) =>
      [
        row.property.title,
        row.event.name,
        row.event.startsAt,
        row.pricing.current,
        row.pricing.suggested,
        row.pricing.lift,
        row.lifecycle.status,
        row.lifecycle.appliedPrice,
        row.outcome.reservationStatus,
        row.outcome.realRevenue,
        row.outcome.bookedNights,
        row.qualityFlags.join("|"),
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `urban-alpha-${email}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Export CSV gerado (${rows.length} linhas).`);
  };

  const handleReprocess = async () => {
    setRunning(true);
    setError(null);
    try {
      const run = await runAdminAlphaReprocess(email);
      setLastRun(`${run.status} - ${run.id}`);
      toast.success(`Reprocessamento disparado (${run.status}).`);
      await load(email);
    } catch (err: unknown) {
      const e = err as { message?: string };
      const msg = e?.message || "Erro ao reprocessar alpha.";
      setError(msg);
      toast.error("Erro: " + msg);
    } finally {
      setRunning(false);
    }
  };

  if (loading && !dashboard) {
    return <AdminPageLoading />;
  }

  const columns: AdminTableColumn<AdminAlphaRecommendation>[] = [
    {
      key: "property",
      header: "Imóvel",
      render: (r) => (
        <span style={{ color: "var(--admin-text)", fontWeight: 500 }}>
          {r.property.title || r.property.listId}
        </span>
      ),
    },
    {
      key: "event",
      header: "Evento",
      render: (r) => (
        <div>
          <p style={{ fontWeight: 500, color: "var(--admin-text)", margin: 0 }}>
            {r.event.name}
          </p>
          <p
            style={{
              fontSize: 11,
              color: "var(--admin-text-dim)",
              margin: "2px 0 0",
              fontFamily: "monospace",
            }}
          >
            {r.event.startsAt
              ? new Date(r.event.startsAt).toLocaleDateString("pt-BR")
              : "—"}
          </p>
        </div>
      ),
    },
    {
      key: "current",
      header: "Atual",
      width: 100,
      align: "right",
      render: (r) => (
        <span style={{ fontFamily: "monospace", color: "var(--admin-text)" }}>
          {formatBRL(r.pricing.current)}
        </span>
      ),
    },
    {
      key: "suggested",
      header: "Sug.",
      width: 100,
      align: "right",
      render: (r) => (
        <span
          style={{
            fontFamily: "monospace",
            color: "var(--admin-accent)",
            fontWeight: 600,
          }}
        >
          {formatBRL(r.pricing.suggested)}
        </span>
      ),
    },
    {
      key: "lift",
      header: "Lift",
      width: 100,
      align: "right",
      render: (r) => (
        <span style={{ fontFamily: "monospace", color: "var(--admin-text-muted)" }}>
          {r.pricing.lift === null ? "—" : formatBRL(r.pricing.lift)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      render: (r) => (
        <code style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>
          {r.lifecycle.status}
        </code>
      ),
    },
    {
      key: "outcome",
      header: "Resultado",
      render: (r) => (
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
          {r.outcome.reservationStatus || "pendente"}
          {r.outcome.realRevenue ? ` · ${formatBRL(r.outcome.realRevenue)}` : ""}
        </span>
      ),
    },
    {
      key: "flags",
      header: "Flags",
      render: (r) =>
        r.qualityFlags.length ? (
          <span style={{ fontSize: 11, color: "var(--admin-warning)" }}>
            {r.qualityFlags.join(", ")}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--admin-success)" }}>ok</span>
        ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · ALPHA"
        title="Painel Alpha"
        subtitle="KPIs reais, auditoria de recomendações e rotina de reprocessamento."
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <AdminInput
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") load(email);
              }}
              placeholder="email@dominio.com"
              shellStyle={{ width: 260 }}
              leftAddon={<Icons.Mail size={12} />}
            />
            <AdminButton
              variant="ghost"
              onClick={() => load(email)}
              disabled={loading}
              leftIcon={<Icons.RefreshCw size={12} />}
            >
              Atualizar
            </AdminButton>
            <AdminButton
              variant="secondary"
              onClick={handleExport}
              disabled={!rows.length}
              leftIcon={<Icons.Download size={12} />}
            >
              Export CSV
            </AdminButton>
            <AdminButton
              variant="primary"
              onClick={handleReprocess}
              loading={running}
              leftIcon={<Icons.Zap size={12} />}
            >
              {running ? "Reprocessando…" : "Reprocessar alpha"}
            </AdminButton>
          </div>
        }
      />

      {error && (
        <div style={{ marginBottom: 32 }}>
          <AdminEmptyState
            eyebrow="Erro"
            title="Falha no painel alpha"
            body={error}
            icon={<Icons.AlertCircle size={32} />}
          />
        </div>
      )}

      {dashboard && (
        <>
          {/* === Hero KPI: Receita real === */}
          <section style={{ marginBottom: 56 }}>
            <AdminCard variant="accent" style={{ padding: "40px 40px 36px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
                  gap: 32,
                  alignItems: "end",
                }}
              >
                <div>
                  <p className="urban-admin-eyebrow">RECEITA REAL (ALPHA)</p>
                  <p
                    className="urban-admin-display-hero"
                    style={{ marginTop: 12, color: "var(--admin-accent)" }}
                  >
                    {formatBRL(dashboard.recommendations.realRevenue)}
                  </p>
                  <p
                    style={{
                      marginTop: 12,
                      fontSize: 14,
                      color: "var(--admin-text-muted)",
                      lineHeight: 1.55,
                    }}
                  >
                    Receita captada a partir de recomendações aplicadas ·{" "}
                    Lift diário potencial:{" "}
                    <span style={{ color: "var(--admin-accent)", fontWeight: 600 }}>
                      {formatBRL(dashboard.recommendations.potentialDailyLift)}
                    </span>
                  </p>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 16,
                    borderLeft: "1px solid var(--admin-divider)",
                    paddingLeft: 32,
                  }}
                >
                  <InlineStat
                    label="Aplicados"
                    value={dashboard.recommendations.applied.toLocaleString("pt-BR")}
                  />
                  <InlineStat
                    label="Aceites"
                    value={dashboard.recommendations.accepted.toLocaleString("pt-BR")}
                  />
                  <InlineStat
                    label="Reservas"
                    value={dashboard.recommendations.booked.toLocaleString("pt-BR")}
                  />
                </div>
              </div>
            </AdminCard>
          </section>

          {/* === KPIs principais === */}
          <section style={{ marginBottom: 64 }}>
            <p className="urban-admin-eyebrow" style={{ marginBottom: 24 }}>
              INDICADORES OPERACIONAIS
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 32,
                borderTop: "1px solid var(--admin-divider)",
                borderBottom: "1px solid var(--admin-divider)",
              }}
            >
              <AdminMetricCard
                label="Imóveis alpha"
                value={dashboard.properties.total}
                sub={`${dashboard.properties.completed} completos`}
              />
              <AdminMetricCard
                label="Com preço base"
                value={dashboard.properties.withManualPrice}
                sub={`${dashboard.properties.withAverageMonthlyRevenue} com receita mensal`}
              />
              <AdminMetricCard
                label="Recomendações"
                value={dashboard.recommendations.total}
                sub={`${dashboard.recommendations.distinctEvents} eventos distintos`}
              />
              <AdminMetricCard
                label="Feedback capturado"
                value={dashboard.recommendations.feedbackCaptured}
                sub={`${dashboard.recommendations.booked} reservas confirmadas`}
                status="success"
              />
              <AdminMetricCard
                label="Eventos futuros"
                value={dashboard.events.upcoming}
                sub={`+${dashboard.events.createdLast24h} em 24h`}
              />
            </div>
          </section>

          {/* === Qualidade + Operação === */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
              gap: 24,
              marginBottom: 56,
            }}
          >
            <AdminCard variant="subtle">
              <AdminCardHeader title="Qualidade de eventos" />
              {qualityFlags.length ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {qualityFlags.map(([flag, count]) => (
                    <li
                      key={flag}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "10px 0",
                        borderBottom: "1px solid var(--admin-divider)",
                        fontSize: 13,
                      }}
                    >
                      <code style={{ color: "var(--admin-text)" }}>{flag}</code>
                      <span style={{ color: "var(--admin-warning)", fontWeight: 600 }}>
                        {count.toLocaleString("pt-BR")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: 13, color: "var(--admin-success)", margin: 0 }}>
                  Sem flags nas recomendações atuais.
                </p>
              )}
            </AdminCard>

            <AdminCard variant="subtle">
              <AdminCardHeader title="Operação" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 16,
                }}
              >
                <SmallStat label="Tester" value={dashboard.user.email} />
                <SmallStat
                  label="Última leitura"
                  value={new Date(dashboard.generatedAt).toLocaleString("pt-BR")}
                />
                <SmallStat
                  label="Último job"
                  value={lastRun || "Sem disparo nesta sessão"}
                />
              </div>
            </AdminCard>
          </section>

          {/* === Auditoria de recomendações === */}
          <section>
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <p className="urban-admin-eyebrow">AUDITORIA</p>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: "var(--admin-text)",
                    margin: "8px 0 0",
                    letterSpacing: -0.3,
                  }}
                >
                  Recomendações
                </h2>
              </div>
              <span style={{ fontSize: 11, color: "var(--admin-text-dim)", letterSpacing: 1.5, textTransform: "uppercase" }}>
                {rows.length.toLocaleString("pt-BR")} linhas · mostrando até 100
              </span>
            </header>

            <AdminTable
              columns={columns}
              rows={rows.slice(0, 100)}
              rowKey={(r) => r.id}
              empty={
                <AdminEmptyState
                  title="Sem recomendações"
                  body="Nenhuma recomendação foi gerada para esse tester ainda."
                />
              }
            />
          </section>
        </>
      )}
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: "var(--admin-text)",
          margin: "6px 0 0",
          fontFamily: "monospace",
          letterSpacing: -0.3,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p
        style={{
          fontSize: 13,
          color: "var(--admin-text)",
          margin: "6px 0 0",
          wordBreak: "break-word",
          lineHeight: 1.4,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function formatBRL(value: number | string | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(n);
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
