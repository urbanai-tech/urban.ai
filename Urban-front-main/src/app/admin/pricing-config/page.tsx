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
  AdminConfirmDialog,
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
import styles from "./page.module.css";
import { brl } from "../../lib/format";

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
      <div className={styles.pageContainer}>
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
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN · PRICING"
        title="Configuração de preços"
        subtitle={
          <>
            Matriz F6.5 — preços por imóvel x 4 ciclos com desconto progressivo.
            Mudanças refletem imediatamente em <code className={styles.inlineCode}>/plans</code>
            {" "}e novos checkouts.
          </>
        }
      />

      {/* === Aviso Stripe Price IDs read-only === */}
      <section
        className={styles.stripeWarningBanner}
      >
        <p
          className={styles.warningTitle}
        >
          Atencao
        </p>
        <p className={styles.warningBody}>
          Os <strong className={styles.emphasis}>Stripe Price IDs</strong>
          {" "}mostrados ao final de cada plano são read-only. Para mudar valor
          cobrado de fato, é necessário criar nova Price no Dashboard Stripe e
          atualizar a env var correspondente no Railway. Mudar o preço de
          display aqui sem atualizar o Stripe vai causar mismatch entre o que o
          usuário vê e o que é cobrado.
        </p>
      </section>

      {/* === Stripe sync check === */}
      <section className={styles.syncSection}>
        <StripeSyncCard
          report={stripe}
          loading={stripeLoading}
          onRefresh={loadStripeCheck}
        />
      </section>

      {/* === Planos === */}
      <section>
        <p className={`urban-admin-eyebrow ${styles.plansEyebrow}`}>
          PLANOS
        </p>
        <div className={styles.planList}>
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onSaved={load} />
          ))}
        </div>
      </section>
    </div>
  );
}

const FIELD_LABELS: Partial<Record<keyof AdminPlanConfig, string>> = {
  isActive: "Ativo",
  selfServiceEnabled: "Self-service",
  priceMonthly: "Mensal (R$/imóvel/mês)",
  priceQuarterly: "Trimestral",
  priceSemestral: "Semestral",
  priceAnnualNew: "Anual",
  discountQuarterlyPercent: "% desconto trimestral",
  discountSemestralPercent: "% desconto semestral",
  discountAnnualPercent: "% desconto anual",
  minProperties: "Min. imóveis",
  maxProperties: "Max. faixa",
  maxCheckoutQuantity: "Max. checkout self-service",
  propertyLimit: "Legacy propertyLimit",
  sortOrder: "Ordem",
  highlightBadge: "Highlight badge",
  discountBadge: "Discount badge",
};

function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "sim" : "não";
  return String(value);
}

function PlanCard({ plan, onSaved }: { plan: AdminPlanConfig; onSaved: () => void }) {
  const [edited, setEdited] = useState<Partial<AdminPlanConfig>>({});
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const toast = useAdminToast();

  function field<K extends keyof AdminPlanConfig>(key: K) {
    return (edited[key] ?? plan[key]) as AdminPlanConfig[K];
  }

  function patch<K extends keyof AdminPlanConfig>(key: K, value: AdminPlanConfig[K]) {
    setEdited((e) => ({ ...e, [key]: value }));
  }

  // Diff antigo -> novo mostrado no diálogo de confirmação.
  const changes = (Object.keys(edited) as Array<keyof AdminPlanConfig>).map((key) => ({
    key,
    label: FIELD_LABELS[key] ?? String(key),
    from: formatDiffValue(plan[key]),
    to: formatDiffValue(edited[key]),
  }));

  async function save() {
    if (Object.keys(edited).length === 0) return;
    setConfirming(false);
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
  const min = Number(field("minProperties") ?? 1) || 1;
  const maxRaw = field("maxProperties") as number | null | undefined;
  const max = maxRaw == null ? null : Number(maxRaw);
  const previewQuantity = min <= 50 && (max === null || max >= 50) ? 50 : min;
  const monthly = parseAdminMoney(field("priceMonthly") as string);
  const quarterly = parseAdminMoney(field("priceQuarterly") as string);
  const semestral = parseAdminMoney(field("priceSemestral") as string);
  const annual = parseAdminMoney(field("priceAnnualNew") as string);

  return (
    <AdminCard variant="subtle">
      <header
        className={styles.planHeader}
      >
        <div>
          <h3
            className={styles.planTitle}
          >
            {plan.title}
          </h3>
          <p
            className={styles.planName}
          >
            {plan.name}
          </p>
        </div>
        <AdminSwitch
          checked={field("isActive") as boolean}
          onChange={(v) => patch("isActive", v)}
          label="Ativo"
        />
        <AdminSwitch
          checked={(field("selfServiceEnabled") as boolean | undefined) ?? true}
          onChange={(v) => patch("selfServiceEnabled", v)}
          label="Self-service"
        />
      </header>

      {plan.isCustomPrice ? (
        <p className={styles.customPlanNote}>
          Plano custom (sob consulta) — sem matriz de preços editavel.
        </p>
      ) : (
        <>
          <div
            className={styles.priceFieldsGrid}
          >
            <AdminInput
              label="Mensal (R$/imóvel/mês)"
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
            className={styles.priceFieldsGrid}
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
            className={styles.discountFieldsGrid}
          >
            <AdminInput
              label="Min. imóveis"
              type="number"
              value={String(field("minProperties") ?? "")}
              onChange={(e) =>
                patch(
                  "minProperties",
                  (e.target.value ? Number(e.target.value) : null) as AdminPlanConfig["minProperties"],
                )
              }
            />
            <AdminInput
              label="Max. faixa (vazio = sem limite)"
              type="number"
              value={String(field("maxProperties") ?? "")}
              onChange={(e) =>
                patch(
                  "maxProperties",
                  (e.target.value ? Number(e.target.value) : null) as AdminPlanConfig["maxProperties"],
                )
              }
            />
            <AdminInput
              label="Max. checkout self-service"
              type="number"
              value={String(field("maxCheckoutQuantity") ?? "")}
              onChange={(e) =>
                patch(
                  "maxCheckoutQuantity",
                  (e.target.value ? Number(e.target.value) : null) as AdminPlanConfig["maxCheckoutQuantity"],
                )
              }
            />
            <AdminInput
              label="Legacy propertyLimit"
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
              label="Ordem"
              type="number"
              value={String(field("sortOrder") ?? 0)}
              onChange={(e) => patch("sortOrder", Number(e.target.value) as AdminPlanConfig["sortOrder"])}
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

          <div
            className={styles.previewMetricsGrid}
          >
            <PreviewMetric label={`Preview ${previewQuantity} imóveis / mês`} value={formatAdminMoney(monthly * previewQuantity)} />
            <PreviewMetric label="Trimestral cobrado" value={formatAdminMoney(quarterly * previewQuantity * 3)} />
            <PreviewMetric label="Semestral cobrado" value={formatAdminMoney(semestral * previewQuantity * 6)} />
            <PreviewMetric label="Anual cobrado" value={formatAdminMoney(annual * previewQuantity * 12)} />
          </div>

          {/* Stripe Price IDs read-only */}
          <details
            className={styles.priceIdsDetails}
          >
            <summary
              className={styles.priceIdsSummary}
            >
              Stripe Price IDs (read-only — gerenciar no Dashboard Stripe)
            </summary>
            <div
              className={styles.priceIdsList}
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
        className={styles.planFooter}
      >
        <span className={styles.mutedNote}>
          {dirty ? "Mudanças não salvas" : ""}
        </span>
        <AdminButton variant="primary" onClick={() => setConfirming(true)} disabled={!dirty} loading={busy}>
          {busy ? "Salvando…" : "Salvar mudanças"}
        </AdminButton>
      </footer>

      <AdminConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Aplicar mudanças no plano ${plan.title}?`}
        confirmLabel="Aplicar no checkout"
        onConfirm={save}
        body={
          <>
            <p className={styles.diffIntro}>
              Vale no checkout e em /plans assim que salvar. O valor cobrado no Stripe não muda por aqui.
            </p>
            <ul className={styles.diffList}>
              {changes.map((change) => (
                <li key={change.key} className={styles.diffRow}>
                  <span className={styles.diffLabel}>{change.label}</span>
                  <span className={styles.diffOld}>{change.from}</span>
                  <span aria-hidden="true">→</span>
                  <span className={styles.diffNew}>{change.to}</span>
                </li>
              ))}
            </ul>
          </>
        }
      />
    </AdminCard>
  );
}

function parseAdminMoney(value: string | undefined | null): number {
  if (!value) return 0;
  const parsed = Number(String(value).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAdminMoney(value: number) {
  return brl(value);
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className={styles.metricLabel}
      >
        {label}
      </div>
      <div className={styles.metricValue}>{value}</div>
    </div>
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
        <span className={styles.syncPlanName}>
          {e.planName}
        </span>
      ),
    },
    {
      key: "cycle",
      header: "Ciclo",
      width: 100,
      render: (e) => (
        <span className={styles.mutedNote}>{e.cycle}</span>
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
        <code className={styles.syncPriceId}>
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
        <span className={styles.syncAmount}>
          {fmt(e.stripeAmountCents)}
        </span>
      ),
    },
    {
      key: "details",
      header: "Detalhes",
      render: (e) => (
        <span className={styles.mutedNote}>
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
        className={styles.syncIntro}
      >
        Valida que os 8 Price IDs (matriz F6.5) existem no Stripe e batem com o
        ciclo esperado.
      </p>

      {!report ? (
        <p className={styles.syncLoading}>Carregando relatorio…</p>
      ) : (
        <>
          {/* Gate indicator (substitui 3 cards coloridos) */}
          <div
            className={styles.gateIndicator}
          >
            <AdminStatusDot kind={gateKind} size={10} />
            <div className={styles.gateText}>
              <p
                className={styles.gateLabel}
              >
                {gateLabel}
              </p>
              <p
                className={styles.gateDescription}
              >
                {!report.summary.stripeKeyConfigured
                  ? "Sem isso, não é possível validar Price IDs remotamente. Configure no Railway antes de continuar."
                  : report.summary.total !== 8 || report.summary.ok !== 8
                    ? "O sync check precisa fechar 8/8 Price IDs OK antes de liberar smoke de checkout pago."
                    : "Os 8 Price IDs esperados estão OK no sync check."}
              </p>
            </div>
          </div>

          {/* Stats em hierarquia: 1 hero "OK" + 4 sm */}
          <div
            className={styles.syncStatsGrid}
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
