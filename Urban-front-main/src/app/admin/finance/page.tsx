"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminFinanceOverview,
  fetchAdminCosts,
  createAdminCost,
  updateAdminCost,
  deleteAdminCost,
  seedAdminCosts,
  type AdminFinanceOverview,
  type AdminCost,
} from "../../service/api";
import {
  AdminSectionHeader,
  AdminCard,
  AdminCardHeader,
  AdminButton,
  AdminMetricCard,
  AdminTable,
  type AdminTableColumn,
  AdminInput,
  AdminSelect,
  AdminSwitch,
  AdminBadge,
  AdminDrawer,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminPageLoading,
  useAdminToast,
  Icons,
} from "../_components";
import styles from "./page.module.css";

/**
 * /admin/finance — gestão financeira da plataforma.
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Hero: Margem por imóvel em Archivo (display) gigante (KPI estratégico).
 *  - KPIs em grid plano (sem cards arredondados verdes).
 *  - Barras de custo em laranja (não verde — custo ≠ receita).
 *  - NewCostForm vira AdminDrawer lateral.
 *  - alert()/confirm() nativos → AdminToast / AdminConfirmDialog.
 */
export default function AdminFinancePage() {
  const [overview, setOverview] = useState<AdminFinanceOverview | null>(null);
  const [costs, setCosts] = useState<AdminCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const toast = useAdminToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [o, c] = await Promise.all([
        fetchAdminFinanceOverview(),
        fetchAdminCosts(showInactive),
      ]);
      setOverview(o);
      setCosts(c);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  if (loading) return <AdminPageLoading />;

  if (error || !overview) {
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

  const fmt = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const perListingMargin = overview.perListing.marginPercent;
  const marginTrend: "up" | "down" = perListingMargin > 0 ? "up" : "down";

  const costColumns: AdminTableColumn<AdminCost>[] = [
    {
      key: "name",
      header: "Nome",
      render: (c) => (
        <div>
          <p className={styles.costName}>
            {c.name}
          </p>
          {c.description && (
            <p
              className={styles.costDescription}
            >
              {c.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Categoria",
      width: 110,
      render: (c) => (
        <AdminBadge kind="neutral">{c.category}</AdminBadge>
      ),
    },
    {
      key: "recurrence",
      header: "Recorrência",
      width: 110,
      render: (c) => (
        <span className={styles.costCategoryCell}>
          {c.recurrence}
        </span>
      ),
    },
    {
      key: "monthly",
      header: "Mensal",
      width: 120,
      align: "right",
      render: (c) => (
        <span className={styles.costAmountCell}>
          R$ {(c.monthlyCostCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "percent",
      header: "% receita",
      width: 90,
      align: "center",
      render: (c) =>
        c.percentOfRevenue != null ? (
          <span className={styles.costMonthlyCell}>
            {c.percentOfRevenue}%
          </span>
        ) : (
          <span className={styles.emptyCell}>—</span>
        ),
    },
    {
      key: "scales",
      header: "Escala",
      width: 70,
      align: "center",
      render: (c) =>
        c.scalesWithListings ? (
          <Icons.Check size={14} className={styles.okIcon} />
        ) : (
          <span className={styles.emptyCell}>—</span>
        ),
    },
    {
      key: "active",
      header: "Status",
      width: 100,
      render: (c) => (
        <AdminBadge kind={c.active ? "success" : "neutral"}>
          {c.active ? "Ativo" : "Inativo"}
        </AdminBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      width: 90,
      align: "right",
      render: (c) => <CostActions cost={c} onChange={load} />,
    },
  ];

  return (
    <div className={styles.pageContainer}>
      <AdminSectionHeader
        eyebrow="ADMIN · FINANCEIRO"
        title="Resumo financeiro"
        subtitle="Custos operacionais, receita estimada e margem em tempo real."
        actions={
          <AdminButton
            variant="secondary"
            as="a"
            href="/admin/pricing-config"
            rightIcon={<Icons.ArrowRight size={12} />}
          >
            Configurar preços
          </AdminButton>
        }
      />

      {/* === Hero — Margem por imóvel === */}
      <section className={styles.heroSection}>
        <AdminCard variant="accent" className={styles.heroCard}>
          <div
            className={styles.heroGrid}
          >
            <div>
              <p className="urban-admin-eyebrow">MARGEM POR IMÓVEL ATIVO</p>
              <p
                className="urban-admin-display-hero"
                style={{
                  marginTop: 12,
                  color:
                    perListingMargin > 30
                      ? "var(--admin-success)"
                      : perListingMargin > 0
                        ? "var(--admin-text)"
                        : "var(--admin-danger)",
                }}
              >
                {fmt(overview.perListing.marginCents)}
              </p>
              <p
                className={styles.heroDescription}
              >
                {perListingMargin.toFixed(1)}% sobre receita por imóvel · Use
                como teto/piso para decisões de pricing.
              </p>
            </div>
            <div
              className={styles.heroStats}
            >
              <SmallInline label="Receita por imóvel" value={fmt(overview.perListing.revenueCents)} />
              <SmallInline label="Custo por imóvel" value={fmt(overview.perListing.costCents)} />
            </div>
          </div>
        </AdminCard>
      </section>

      {/* === KPIs financeiros === */}
      <section className={styles.metricsSection}>
        <p className={`urban-admin-eyebrow ${styles.sectionEyebrow}`}>
          INDICADORES MENSAIS
        </p>
        <div
          className={styles.metricsGrid}
        >
          <AdminMetricCard
            label="MRR estimado"
            value={fmt(overview.revenue.mrrCents)}
            sub={`${overview.activePayments} assinaturas ativas`}
          />
          <AdminMetricCard
            label="Custos mensais"
            value={fmt(overview.costs.totalCents)}
            sub={`${fmt(overview.costs.fixedCents)} fixos + ${fmt(overview.costs.percentualCents)} variáveis`}
          />
          <AdminMetricCard
            label="Margem"
            value={fmt(overview.margin.absoluteCents)}
            sub={`${overview.margin.percent.toFixed(1)}% sobre MRR`}
            trend={marginTrend}
            trendValue={`${overview.margin.percent.toFixed(1)}%`}
            accent={perListingMargin > 30}
          />
          <AdminMetricCard
            label="Imóveis ativos"
            value={overview.activeListings}
          />
        </div>
      </section>

      {/* === Receita por plano + Custos por categoria === */}
      <section
        className={styles.breakdownGrid}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader title="Receita por plano" />
          {overview.revenue.byPlan.length === 0 ? (
            <p className={styles.emptyHint}>
              Sem assinaturas ativas ainda.
            </p>
          ) : (
            <ul className={styles.planList}>
              {overview.revenue.byPlan.map((p) => (
                <li
                  key={p.planName}
                  className={styles.planRow}
                >
                  <span className={styles.planName}>
                    {p.planName}
                  </span>
                  <span className={styles.planCount}>
                    {p.count} assinaturas
                  </span>
                  <span
                    className={styles.planRevenue}
                  >
                    {fmt(p.monthlyCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard variant="subtle">
          <AdminCardHeader title="Custos por categoria" />
          {overview.costs.byCategory.length === 0 ? (
            <p className={styles.emptyHint}>
              Cadastre custos abaixo.
            </p>
          ) : (
            <div className={styles.categoryList}>
              {overview.costs.byCategory.map((c) => {
                const max = Math.max(
                  ...overview.costs.byCategory.map((x) => x.cents),
                  1,
                );
                return (
                  <div key={c.category}>
                    <div
                      className={styles.categoryRow}
                    >
                      <span className={styles.categoryName}>{c.category}</span>
                      <span
                        className={styles.categoryAmount}
                      >
                        {fmt(c.cents)}
                      </span>
                    </div>
                    <div
                      className={styles.categoryBarTrack}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(c.cents / max) * 100}%`,
                          background: "var(--admin-accent)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminCard>
      </section>

      {/* === Custos cadastrados (CRUD) === */}
      <section>
        <header
          className={styles.costsHeader}
        >
          <div>
            <p className="urban-admin-eyebrow">CUSTOS CADASTRADOS</p>
            <h2
              className={styles.costsTitle}
            >
              Todos os custos operacionais
            </h2>
          </div>
          <div className={styles.costsActions}>
            <AdminSwitch
              checked={showInactive}
              onChange={setShowInactive}
              label="Mostrar inativos"
            />
            <AdminButton
              variant="secondary"
              size="md"
              onClick={() => setConfirmSeed(true)}
              leftIcon={<Icons.Database size={12} />}
            >
              Popular default
            </AdminButton>
            <AdminButton
              variant="primary"
              size="md"
              onClick={() => setShowNew(true)}
              leftIcon={<Icons.Plus size={12} />}
            >
              Novo custo
            </AdminButton>
          </div>
        </header>

        <AdminTable
          columns={costColumns}
          rows={costs}
          rowKey={(r) => r.id}
          empty={
            <AdminEmptyState
              title="Nenhum custo cadastrado"
              body="Comece adicionando Railway, Brevo, Gemini etc."
              action={
                <AdminButton
                  variant="primary"
                  onClick={() => setShowNew(true)}
                  leftIcon={<Icons.Plus size={12} />}
                >
                  Adicionar custo
                </AdminButton>
              }
            />
          }
        />
      </section>

      {/* === Drawer: novo custo === */}
      <AdminDrawer
        open={showNew}
        onClose={() => setShowNew(false)}
        eyebrow="NOVO CUSTO"
        title="Cadastrar"
      >
        <NewCostForm
          onCreated={() => {
            setShowNew(false);
            toast.success("Custo cadastrado.");
            load();
          }}
          onCancel={() => setShowNew(false)}
        />
      </AdminDrawer>

      {/* === Dialog: confirmar seed default === */}
      <AdminConfirmDialog
        open={confirmSeed}
        onClose={() => setConfirmSeed(false)}
        loading={seeding}
        title="Popular custos default"
        body="Cria entradas default (Railway, Stripe, Gemini, Brevo etc.) sem sobrescrever as existentes."
        confirmLabel="Popular"
        onConfirm={async () => {
          setSeeding(true);
          try {
            const r = await seedAdminCosts(false);
            toast.success(`Seed OK — ${r.created} criados, ${r.skipped} ignorados.`);
            setConfirmSeed(false);
            load();
          } catch (err: unknown) {
            const e = err as { message?: string };
            toast.error("Erro: " + (e?.message ?? "falhou"));
          } finally {
            setSeeding(false);
          }
        }}
      />
    </div>
  );
}

function SmallInline({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p
        className={styles.statValue}
      >
        {value}
      </p>
    </div>
  );
}

function NewCostForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("infra");
  const [recurrence, setRecurrence] = useState("monthly");
  const [valueReais, setValueReais] = useState("");
  const [percent, setPercent] = useState("");
  const [scales, setScales] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useAdminToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createAdminCost({
        name,
        category,
        recurrence,
        monthlyCostCents: Math.round(Number(valueReais.replace(",", ".")) * 100) || 0,
        percentOfRevenue: percent ? Number(percent.replace(",", ".")) : undefined,
        scalesWithListings: scales,
      });
      onCreated();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message ?? "falhou"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className={styles.costForm}
    >
      <AdminInput
        label="Nome do custo"
        placeholder="ex: Railway Pro"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <div className={styles.costFormRow}>
        <AdminSelect
          label="Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="infra">infra</option>
          <option value="apis">apis</option>
          <option value="comms">comms</option>
          <option value="payments">payments</option>
          <option value="people">people</option>
          <option value="marketing">marketing</option>
          <option value="legal">legal</option>
          <option value="data">data</option>
          <option value="other">other</option>
        </AdminSelect>

        <AdminSelect
          label="Recorrência"
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value)}
        >
          <option value="monthly">mensal</option>
          <option value="usage_based">por uso</option>
          <option value="one_time">único</option>
          <option value="percentual">% receita</option>
        </AdminSelect>
      </div>

      <AdminInput
        label="Valor mensal"
        leftAddon={<span className={styles.currencyPrefix}>R$</span>}
        placeholder="0,00"
        value={valueReais}
        onChange={(e) => setValueReais(e.target.value)}
      />

      {recurrence === "percentual" ? (
        <AdminInput
          label="Percentual da receita"
          placeholder="ex: 4.99"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          helper="Custo proporcional à receita captada (ex: Stripe fees 4.99%)"
        />
      ) : (
        <AdminSwitch
          checked={scales}
          onChange={setScales}
          label="Escala com imóveis"
        />
      )}

      <div className={styles.formActions}>
        <AdminButton variant="ghost" onClick={onCancel} type="button" disabled={busy}>
          Cancelar
        </AdminButton>
        <AdminButton type="submit" variant="primary" loading={busy}>
          {busy ? "Salvando…" : "Adicionar custo"}
        </AdminButton>
      </div>
    </form>
  );
}

function CostActions({ cost, onChange }: { cost: AdminCost; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useAdminToast();

  async function toggle() {
    setBusy(true);
    try {
      await updateAdminCost(cost.id, { active: !cost.active });
      toast.success(cost.active ? "Custo desativado." : "Custo reativado.");
      onChange();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message ?? "falhou"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteAdminCost(cost.id);
      toast.success(`'${cost.name}' removido.`);
      setConfirmDelete(false);
      onChange();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error("Erro: " + (e?.message ?? "falhou"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.rowActions}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={cost.active ? "Desativar" : "Ativar"}
        aria-label={cost.active ? "Desativar custo" : "Ativar custo"}
        style={{
          background: "transparent",
          border: "1px solid var(--admin-divider-strong)",
          borderRadius: 2,
          color: "var(--admin-text-muted)",
          padding: 6,
          cursor: busy ? "not-allowed" : "pointer",
          display: "inline-flex",
          lineHeight: 0,
        }}
      >
        <Icons.RefreshCw size={12} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        disabled={busy}
        title="Remover"
        aria-label="Remover custo"
        style={{
          background: "transparent",
          border: "1px solid color-mix(in srgb, var(--admin-danger) 30%, transparent)",
          borderRadius: 2,
          color: "var(--admin-danger)",
          padding: 6,
          cursor: busy ? "not-allowed" : "pointer",
          display: "inline-flex",
          lineHeight: 0,
        }}
      >
        <Icons.Trash size={12} />
      </button>
      <AdminConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title={`Remover '${cost.name}'?`}
        body="Esta ação é permanente. O custo será excluído da matriz."
        confirmLabel="Remover"
        destructive
        loading={busy}
      />
    </div>
  );
}
