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

/**
 * /admin/finance — gestão financeira da plataforma.
 *
 * Migrado para o design system admin (.urban-admin):
 *  - Hero: Margem por imóvel em Bebas Neue gigante (KPI estratégico).
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
          <p style={{ fontWeight: 600, color: "var(--admin-text)", margin: 0 }}>
            {c.name}
          </p>
          {c.description && (
            <p
              style={{
                fontSize: 11,
                color: "var(--admin-text-muted)",
                margin: "2px 0 0",
              }}
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
        <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
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
        <span style={{ fontFamily: "monospace", color: "var(--admin-text)" }}>
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
          <span style={{ fontFamily: "monospace", color: "var(--admin-accent)" }}>
            {c.percentOfRevenue}%
          </span>
        ) : (
          <span style={{ color: "var(--admin-text-dim)" }}>—</span>
        ),
    },
    {
      key: "scales",
      header: "Escala",
      width: 70,
      align: "center",
      render: (c) =>
        c.scalesWithListings ? (
          <Icons.Check size={14} style={{ color: "var(--admin-success)" }} />
        ) : (
          <span style={{ color: "var(--admin-text-dim)" }}>—</span>
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
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
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
                style={{
                  marginTop: 12,
                  fontSize: 14,
                  color: "var(--admin-text-muted)",
                  lineHeight: 1.55,
                }}
              >
                {perListingMargin.toFixed(1)}% sobre receita por imóvel · Use
                como teto/piso para decisões de pricing.
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
              <SmallInline label="Receita por imóvel" value={fmt(overview.perListing.revenueCents)} />
              <SmallInline label="Custo por imóvel" value={fmt(overview.perListing.costCents)} />
            </div>
          </div>
        </AdminCard>
      </section>

      {/* === KPIs financeiros === */}
      <section style={{ marginBottom: 64 }}>
        <p className="urban-admin-eyebrow" style={{ marginBottom: 24 }}>
          INDICADORES MENSAIS
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
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: 24,
          marginBottom: 64,
        }}
      >
        <AdminCard variant="subtle">
          <AdminCardHeader title="Receita por plano" />
          {overview.revenue.byPlan.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: 0 }}>
              Sem assinaturas ativas ainda.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {overview.revenue.byPlan.map((p) => (
                <li
                  key={p.planName}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 16,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--admin-divider)",
                    fontSize: 13,
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ color: "var(--admin-text)", fontWeight: 500 }}>
                    {p.planName}
                  </span>
                  <span style={{ color: "var(--admin-text-muted)", fontSize: 12 }}>
                    {p.count} assinaturas
                  </span>
                  <span
                    style={{
                      color: "var(--admin-accent)",
                      fontFamily: "monospace",
                      fontWeight: 600,
                    }}
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
            <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: 0 }}>
              Cadastre custos abaixo.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {overview.costs.byCategory.map((c) => {
                const max = Math.max(
                  ...overview.costs.byCategory.map((x) => x.cents),
                  1,
                );
                return (
                  <div key={c.category}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ color: "var(--admin-text)" }}>{c.category}</span>
                      <span
                        style={{
                          color: "var(--admin-text)",
                          fontFamily: "monospace",
                          fontWeight: 600,
                        }}
                      >
                        {fmt(c.cents)}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 2,
                        background: "var(--admin-divider)",
                      }}
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
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <p className="urban-admin-eyebrow">CUSTOS CADASTRADOS</p>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--admin-text)",
                margin: "8px 0 0",
                letterSpacing: -0.3,
              }}
            >
              Todos os custos operacionais
            </h2>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
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
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      <AdminInput
        label="Nome do custo"
        placeholder="ex: Railway Pro"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
        leftAddon={<span style={{ fontSize: 12, fontWeight: 600 }}>R$</span>}
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

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
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
    <div style={{ display: "inline-flex", gap: 6 }}>
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
          border: "1px solid rgba(248, 113, 113, 0.3)",
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
