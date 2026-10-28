"use client";

import { useEffect, useMemo, useState } from "react";
import { csvCell } from "@/app/lib/csv-safe";
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
import styles from "./page.module.css";

const DEFAULT_EMAIL = process.env.NEXT_PUBLIC_ADMIN_ALPHA_DEFAULT_EMAIL?.trim() ?? "";

/**
 * /admin/alpha — painel alpha (KPIs reais + auditoria + reprocesso).
 *
 * Migrado pro design system admin (.urban-admin):
 *  - Hero KPI "Receita real" em Archivo (display) (decisão central da operação alpha).
 *  - Toolbar com hierarquia: Reprocessar=primary, Export=secondary, Atualizar=ghost.
 *  - Tabela com AdminTable + hover orange.
 *  - Cards "Qualidade" / "Operação" viram AdminCard variant="subtle".
 *  - alert() → useAdminToast.
 */
export default function AdminAlphaPage() {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [dashboard, setDashboard] = useState<AdminAlphaDashboard | null>(null);
  const [rows, setRows] = useState<AdminAlphaRecommendation[]>([]);
  const [loading, setLoading] = useState(Boolean(DEFAULT_EMAIL));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const toast = useAdminToast();

  const load = async (targetEmail = email) => {
    const normalizedEmail = targetEmail.trim();
    if (!normalizedEmail) {
      setError("Informe o e-mail do usuário que deseja auditar.");
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const [dash, exportData] = await Promise.all([
        fetchAdminAlphaDashboard(normalizedEmail),
        fetchAdminAlphaRecommendations(normalizedEmail, 500),
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
    if (DEFAULT_EMAIL) load(DEFAULT_EMAIL);
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
        <span className={styles.labelTextW500}>
          {r.property.title || r.property.listId}
        </span>
      ),
    },
    {
      key: "event",
      header: "Evento",
      render: (r) => (
        <div>
          <p className={styles.textTextW500}>
            {r.event.name}
          </p>
          <p
            className={styles.textTextDimFs11}
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
        <span className={styles.labelTextMono}>
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
          className={styles.labelAccentW600}
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
        <span className={styles.labelTextMutedMono}>
          {r.pricing.lift === null ? "—" : formatBRL(r.pricing.lift)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      render: (r) => (
        <code className={styles.codeTextMutedFs11}>
          {r.lifecycle.status}
        </code>
      ),
    },
    {
      key: "outcome",
      header: "Resultado",
      render: (r) => (
        <span className={styles.labelTextMutedFs12}>
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
          <span className={styles.labelWarningFs11}>
            {r.qualityFlags.join(", ")}
          </span>
        ) : (
          <span className={styles.labelSuccessFs11}>ok</span>
        ),
    },
  ];

  return (
    <div className={styles.boxM0xautoP40x32}>
      <AdminSectionHeader
        eyebrow="ADMIN · ALPHA"
        title="Painel Alpha"
        subtitle="KPIs reais, auditoria de recomendações e rotina de reprocessamento."
        actions={
          <div className={styles.rowCenteredWrap}>
            <AdminInput
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") load(email);
              }}
              placeholder="nome@empresa.com"
              shellClassName={styles.emailShell}
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
        <div className={styles.boxMb32}>
          <AdminEmptyState
            eyebrow="Erro"
            title="Falha no painel alpha"
            body={error}
            icon={<Icons.AlertCircle size={32} />}
          />
        </div>
      )}

      {!error && !dashboard && (
        <div className={styles.boxMb32}>
          <AdminEmptyState
            eyebrow="ALPHA"
            title="Informe um usuário"
            body="Digite o e-mail do usuário que deseja auditar e carregue os dados reais da API."
            icon={<Icons.Mail size={32} />}
          />
        </div>
      )}

      {dashboard && (
        <>
          {/* === Hero KPI: Receita real === */}
          <section className={styles.sectionMb56}>
            <AdminCard variant="accent" className={styles.heroCard}>
              <div
                className={styles.gridColsGap32}
              >
                <div>
                  <p className="urban-admin-eyebrow">RECEITA REAL (ALPHA)</p>
                  <p
                    className={`urban-admin-display-hero ${styles.displayHeroAccentMt12}`}
                  >
                    {formatBRL(dashboard.recommendations.realRevenue)}
                  </p>
                  <p
                    className={styles.textTextMutedFs14}
                  >
                    Receita captada a partir de recomendações aplicadas ·{" "}
                    Lift diário potencial:{" "}
                    <span className={styles.labelAccentW6002}>
                      {formatBRL(dashboard.recommendations.potentialDailyLift)}
                    </span>
                  </p>
                </div>
                <div
                  className={styles.gridColsGap16}
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
          <section className={styles.sectionMb64}>
            <p className={`urban-admin-eyebrow ${styles.eyebrowMb24}`}>
              INDICADORES OPERACIONAIS
            </p>
            <div
              className={styles.gridColsAuto200Gap32}
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
            className={styles.gridColsGap24}
          >
            <AdminCard variant="subtle">
              <AdminCardHeader title="Qualidade de eventos" />
              {qualityFlags.length ? (
                <ul className={styles.listM0P0}>
                  {qualityFlags.map(([flag, count]) => (
                    <li
                      key={flag}
                      className={styles.rowBetweenFs13}
                    >
                      <code className={styles.codeText}>{flag}</code>
                      <span className={styles.labelWarningW600}>
                        {count.toLocaleString("pt-BR")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.textSuccessFs13}>
                  Sem flags nas recomendações atuais.
                </p>
              )}
            </AdminCard>

            <AdminCard variant="subtle">
              <AdminCardHeader title="Operação" />
              <div
                className={styles.gridColsAuto180Gap16}
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
              className={styles.rowBetweenCentered}
            >
              <div>
                <p className="urban-admin-eyebrow">AUDITORIA</p>
                <h2
                  className={styles.headingTextFs20}
                >
                  Recomendações
                </h2>
              </div>
              <span className={styles.labelTextDimFs11}>
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
        className={styles.textTextFs22}
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
        className={styles.textTextFs13}
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

