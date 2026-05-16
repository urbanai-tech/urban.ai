"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminPlansConfig,
  updateAdminPlan,
  fetchStripeSyncCheck,
  type AdminPlanConfig,
  type StripeSyncReport,
  type StripePriceCycleStatus,
} from "../../service/api";
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
  AdminInput,
  AdminSwitch,
  AdminEmptyState,
  AdminPageLoading,
  Icons,
  useAdminToast,
} from "../_components";
import type { AdminBadgeKind, AdminStatusKind } from "../_components";

/**
 * /admin/pricing-config — gestão dos preços dos planos da Urban AI.
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Gate F5 com 3 estados visuais coloridos → AdminStatusDot + texto neutro.
 *  - StripeSyncCard: 5 stats com hierarquia (1 hero + 4 sm).
 *  - Tabela sync com 8 status × 8 cores → AdminBadge monocromática (success/warn/error/neutral).
 *  - details/summary mantido mas estilizado (divider + padding).
 *  - Inputs nativos → AdminInput/AdminSwitch.
 *  - "← Voltar" removido (AdminShell tem breadcrumb).
 */
export default function PricingConfigPage() {
  const [plans, setPlans] = useState<AdminPlanConfig[]>([]);
  const [stripe, setStripe] = useState<StripeSyncReport | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setPlans(await fetchAdminPlansConfig());
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

  async function loadStripeCheck() {
    setStripeLoading(true);
    try {
      setStripe(await fetchStripeSyncCheck());
    } catch (err) {
      console.error("Stripe sync check falhou", err);
    } finally {
      setStripeLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadStripeCheck();
  }, []);

  if (loading) return <AdminPageLoading />;

  if (error) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
        <AdminEmptyState
          eyebrow="Erro"
          title="Falha ao carregar"
          body={error}
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

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      <AdminSectionHeader
        eyebrow="ADMIN · PRICING"
        title="Configuracao de precos"
        subtitle={
          <>
            Matriz F6.5 — precos por imovel x 4 ciclos com desconto progressivo.
            Mudancas refletem imediatamente em <code style={{ color: "var(--admin-accent)" }}>/plans</code>
            {" "}e novos checkouts.
          </>
        }
      />

      {/* === Aviso Stripe Price IDs read-only === */}
      <section
        style={{
          marginBottom: 32,
          padding: "14px 18px",
          borderLeft: "2px solid var(--admin-warning)",
          background: "rgba(245, 181, 71, 0.06)",
          fontSize: 13,
          color: "var(--admin-text-muted)",
          lineHeight: 1.55,
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--admin-warning)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          Atencao
        </p>
        <p style={{ margin: "6px 0 0" }}>
          Os <strong style={{ color: "var(--admin-text)" }}>Stripe Price IDs</strong>
          {" "}mostrados ao final de cada plano sao read-only. Para mudar valor
          cobrado de fato, e necessario criar nova Price no Dashboard Stripe e
          atualizar a env var correspondente no Railway. Mudar o preco de
          display aqui sem atualizar o Stripe vai causar mismatch entre o que o
          usuario ve e o que e cobrado.
        </p>
      </section>

      {/* === Stripe sync check === */}
      <section style={{ marginBottom: 56 }}>
        <StripeSyncCard
          report={stripe}
          loading={stripeLoading}
          onRefresh={loadStripeCheck}
        />
      </section>

      {/* === Planos === */}
      <section>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 20 }}>
          PLANOS
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onSaved={load} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanCard({ plan, onSaved }: { plan: AdminPlanConfig; onSaved: () => void }) {
  const [edited, setEdited] = useState<Partial<AdminPlanConfig>>({});
  const [busy, setBusy] = useState(false);
  const toast = useAdminToast();

  function field<K extends keyof AdminPlanConfig>(key: K) {
    return (edited[key] ?? plan[key]) as AdminPlanConfig[K];
  }

  function patch<K extends keyof AdminPlanConfig>(key: K, value: AdminPlanConfig[K]) {
    setEdited((e) => ({ ...e, [key]: value }));
  }

  async function save() {
    if (Object.keys(edited).length === 0) return;
    setBusy(true);
    try {
      await updateAdminPlan(plan.name, edited);
      toast.success("Plano salvo.");
      setEdited({});
      onSaved();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message || "falhou"));
    } finally {
      setBusy(false);
    }
  }

  const dirty = Object.keys(edited).length > 0;

  return (
    <AdminCard variant="subtle">
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--admin-text)",
              margin: 0,
              letterSpacing: -0.3,
            }}
          >
            {plan.title}
          </h3>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              color: "var(--admin-text-dim)",
              margin: "4px 0 0",
            }}
          >
            {plan.name}
          </p>
        </div>
        <AdminSwitch
          checked={field("isActive") as boolean}
          onChange={(v) => patch("isActive", v)}
          label="Ativo"
        />
      </header>

      {plan.isCustomPrice ? (
        <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: 0 }}>
          Plano custom (sob consulta) — sem matriz de precos editavel.
        </p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <AdminInput
              label="Mensal (R$/imovel/mes)"
              value={(field("priceMonthly") as string) ?? ""}
              onChange={(e) => patch("priceMonthly", e.target.value as AdminPlanConfig["priceMonthly"])}
            />
            <AdminInput
              label="Trimestral"
              value={(field("priceQuarterly") as string) ?? ""}
              onChange={(e) => patch("priceQuarterly", e.target.value as AdminPlanConfig["priceQuarterly"])}
            />
            <AdminInput
              label="Semestral"
              value={(field("priceSemestral") as string) ?? ""}
              onChange={(e) => patch("priceSemestral", e.target.value as AdminPlanConfig["priceSemestral"])}
            />
            <AdminInput
              label="Anual"
              value={(field("priceAnnualNew") as string) ?? ""}
              onChange={(e) => patch("priceAnnualNew", e.target.value as AdminPlanConfig["priceAnnualNew"])}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <AdminInput
              label="% desconto trimestral"
              type="number"
              value={String(field("discountQuarterlyPercent") ?? "")}
              onChange={(e) =>
                patch("discountQuarterlyPercent", Number(e.target.value) as AdminPlanConfig["discountQuarterlyPercent"])
              }
            />
            <AdminInput
              label="% desconto semestral"
              type="number"
              value={String(field("discountSemestralPercent") ?? "")}
              onChange={(e) =>
                patch("discountSemestralPercent", Number(e.target.value) as AdminPlanConfig["discountSemestralPercent"])
              }
            />
            <AdminInput
              label="% desconto anual"
              type="number"
              value={String(field("discountAnnualPercent") ?? "")}
              onChange={(e) =>
                patch("discountAnnualPercent", Number(e.target.value) as AdminPlanConfig["discountAnnualPercent"])
              }
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <AdminInput
              label="Limite de imoveis (vazio = sem limite)"
              type="number"
              value={String(field("propertyLimit") ?? "")}
              onChange={(e) =>
                patch(
                  "propertyLimit",
                  (e.target.value ? Number(e.target.value) : null) as AdminPlanConfig["propertyLimit"],
                )
              }
            />
            <AdminInput
              label="Highlight badge"
              value={(field("highlightBadge") as string) ?? ""}
              onChange={(e) => patch("highlightBadge", e.target.value as AdminPlanConfig["highlightBadge"])}
            />
            <AdminInput
              label="Discount badge"
              value={(field("discountBadge") as string) ?? ""}
              onChange={(e) => patch("discountBadge", e.target.value as AdminPlanConfig["discountBadge"])}
            />
          </div>

          {/* Stripe Price IDs read-only */}
          <details
            style={{
              marginTop: 20,
              border: "1px solid var(--admin-divider)",
              borderRadius: 2,
              padding: "12px 14px",
              background: "rgba(255, 255, 255, 0.02)",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "var(--admin-text-muted)",
              }}
            >
              Stripe Price IDs (read-only — gerenciar no Dashboard Stripe)
            </summary>
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--admin-divider)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
                fontSize: 11,
                fontFamily: "monospace",
                color: "var(--admin-text-dim)",
              }}
            >
              <div>monthly: {plan.stripePriceIdMonthly || "—"}</div>
              <div>quarterly: {plan.stripePriceIdQuarterly || "—"}</div>
              <div>semestral: {plan.stripePriceIdSemestral || "—"}</div>
              <div>annual: {plan.stripePriceIdAnnualNew || "—"}</div>
            </div>
          </details>
        </>
      )}

      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid var(--admin-divider)",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
          {dirty ? "Mudancas nao salvas" : ""}
        </span>
        <AdminButton variant="primary" onClick={save} disabled={!dirty} loading={busy}>
          {busy ? "Salvando…" : "Salvar mudancas"}
        </AdminButton>
      </footer>
    </AdminCard>
  );
}

function statusBadgeKind(status: StripePriceCycleStatus): AdminBadgeKind {
  switch (status) {
    case "ok":
      return "success";
    case "missing":
    case "not-found":
      return "error";
    case "cycle-mismatch":
    case "currency-mismatch":
    case "inactive":
      return "warn";
    default:
      return "neutral";
  }
}

function StripeSyncCard({
  report,
  loading,
  onRefresh,
}: {
  report: StripeSyncReport | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const fmt = (cents?: number) =>
    cents == null
      ? "—"
      : `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  let gateKind: AdminStatusKind = "neutral";
  let gateLabel = "Verificando…";
  if (report) {
    if (!report.summary.stripeKeyConfigured) {
      gateKind = "error";
      gateLabel = "STRIPE_SECRET_KEY ausente";
    } else if (report.summary.total !== 8 || report.summary.ok !== 8) {
      gateKind = "warn";
      gateLabel = "Gate F5 incompleto";
    } else {
      gateKind = "success";
      gateLabel = "Gate F5 pronto";
    }
  }

  const syncColumns: AdminTableColumn<StripeSyncReport["entries"][number]>[] = [
    {
      key: "plan",
      header: "Plano",
      render: (e) => (
        <span style={{ fontSize: 12, color: "var(--admin-text)", fontWeight: 500 }}>
          {e.planName}
        </span>
      ),
    },
    {
      key: "cycle",
      header: "Ciclo",
      width: 100,
      render: (e) => (
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>{e.cycle}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 140,
      render: (e) => <AdminBadge kind={statusBadgeKind(e.status)}>{e.status}</AdminBadge>,
    },
    {
      key: "priceId",
      header: "Price ID",
      render: (e) => (
        <code style={{ fontSize: 10, color: "var(--admin-text-dim)" }}>
          {e.priceId ?? "—"}
        </code>
      ),
    },
    {
      key: "amount",
      header: "Valor Stripe",
      width: 130,
      align: "right",
      render: (e) => (
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--admin-text)" }}>
          {fmt(e.stripeAmountCents)}
        </span>
      ),
    },
    {
      key: "details",
      header: "Detalhes",
      render: (e) => (
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
          {e.details ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <AdminCard variant="subtle">
      <AdminCardHeader
        eyebrow="STRIPE PRICE IDs"
        title="Sync check"
        actions={
          <AdminButton
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            leftIcon={<Icons.RefreshCw size={11} />}
          >
            {loading ? "Verificando…" : "Re-verificar"}
          </AdminButton>
        }
      />

      <p
        style={{
          fontSize: 13,
          color: "var(--admin-text-muted)",
          margin: "0 0 16px",
          lineHeight: 1.55,
        }}
      >
        Valida que os 8 Price IDs (matriz F6.5) existem no Stripe e batem com o
        ciclo esperado.
      </p>

      {!report ? (
        <p style={{ fontSize: 13, color: "var(--admin-text-muted)" }}>Carregando relatorio…</p>
      ) : (
        <>
          {/* Gate indicator (substitui 3 cards coloridos) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              border: "1px solid var(--admin-divider)",
              borderRadius: 2,
              marginBottom: 24,
              background: "rgba(255, 255, 255, 0.02)",
            }}
          >
            <AdminStatusDot kind={gateKind} size={10} />
            <div style={{ flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--admin-text)",
                }}
              >
                {gateLabel}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "var(--admin-text-muted)",
                  lineHeight: 1.55,
                }}
              >
                {!report.summary.stripeKeyConfigured
                  ? "Sem isso, nao e possivel validar Price IDs remotamente. Configure no Railway antes de continuar."
                  : report.summary.total !== 8 || report.summary.ok !== 8
                    ? "O sync check precisa fechar 8/8 Price IDs OK antes de liberar smoke de checkout pago."
                    : "Os 8 Price IDs esperados estao OK no sync check."}
              </p>
            </div>
          </div>

          {/* Stats em hierarquia: 1 hero "OK" + 4 sm */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.6fr) repeat(4, minmax(0, 1fr))",
              gap: 24,
              borderTop: "1px solid var(--admin-divider)",
              borderBottom: "1px solid var(--admin-divider)",
              marginBottom: 24,
              alignItems: "end",
            }}
          >
            <AdminMetricCard
              label="OK / total"
              value={`${report.summary.ok} / ${report.summary.total}`}
              variant="md"
              accent={report.summary.ok === report.summary.total}
              sub="Price IDs validados"
            />
            <AdminMetricCard label="Faltando" value={report.summary.missing} variant="sm" />
            <AdminMetricCard
              label="Sem chave"
              value={report.summary.notConfigured}
              variant="sm"
            />
            <AdminMetricCard label="Problemas" value={report.summary.problems} variant="sm" />
            <AdminMetricCard
              label="Stripe key"
              value={report.summary.stripeKeyConfigured ? "ok" : "ausente"}
              variant="sm"
            />
          </div>

          <AdminTable
            columns={syncColumns}
            rows={report.entries}
            rowKey={(_, i) => `${i}`}
            empty={
              <AdminEmptyState title="Sem entradas" body="Nenhuma matriz definida." />
            }
          />
        </>
      )}
    </AdminCard>
  );
}
