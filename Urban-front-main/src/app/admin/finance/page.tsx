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

/**
 * /admin/finance — gestão financeira da plataforma.
 *
 * Mostra:
 *  - MRR estimado, custos, margem, margem por imóvel
 *  - CRUD de custos operacionais (Railway, Mailersend, Gemini, etc.)
 *  - Distribuição de custos por categoria
 *
 * Não substitui ERP/financeiro real — é instrumento de gestão para
 * decisões de pricing e visão rápida de saúde financeira.
 */
export default function AdminFinancePage() {
  const [overview, setOverview] = useState<AdminFinanceOverview | null>(null);
  const [costs, setCosts] = useState<AdminCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [showNew, setShowNew] = useState(false);

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
    } catch (err: any) {
      const status = err?.response?.status;
      setError(status === 401 || status === 403 ? "Acesso negado." : err?.message || "Erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  if (loading) return <main className="min-h-screen bg-slate-950 text-slate-50 p-8"><p>Carregando…</p></main>;
  if (error || !overview) return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-2xl p-6 border border-red-700 rounded bg-red-950/30">{error}</div>
    </main>
  );

  const fmt = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const marginColor =
    overview.margin.percent > 30 ? "text-emerald-300"
    : overview.margin.percent > 0 ? "text-amber-300"
    : "text-red-300";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-sm text-slate-400">
              Custos operacionais, receita estimada e margem em tempo real.
            </p>
          </div>
          <div className="flex gap-3">
            <a href="/admin/pricing-config" className="text-sm px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800">
              Configurar preços
            </a>
            <a href="/admin" className="text-sm text-emerald-400 hover:underline self-center">← Voltar</a>
          </div>
        </header>

        {/* === KPIs financeiros === */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="MRR estimado" value={fmt(overview.revenue.mrrCents)} sub={`${overview.activePayments} assinaturas ativas`} />
          <Kpi label="Custos mensais" value={fmt(overview.costs.totalCents)} sub={`${fmt(overview.costs.fixedCents)} fixos + ${fmt(overview.costs.percentualCents)} variáveis`} />
          <Kpi
            label="Margem"
            value={fmt(overview.margin.absoluteCents)}
            sub={`${overview.margin.percent.toFixed(1)}%`}
            valueClassName={marginColor}
          />
          <Kpi label="Imóveis ativos" value={overview.activeListings.toLocaleString("pt-BR")} />
        </section>

        {/* === Por imóvel === */}
        <section className="border border-emerald-800/40 rounded-2xl bg-emerald-950/20 p-6">
          <h2 className="text-lg font-bold mb-4">Por imóvel ativo</h2>
          <p className="text-xs text-slate-400 mb-4">
            Cálculo: MRR ÷ imóveis · custos ÷ imóveis · margem por imóvel.
            Use como teto/piso para decisões de pricing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Kpi label="Receita por imóvel" value={fmt(overview.perListing.revenueCents)} />
            <Kpi label="Custo por imóvel" value={fmt(overview.perListing.costCents)} />
            <Kpi
              label="Margem por imóvel"
              value={fmt(overview.perListing.marginCents)}
              sub={`${overview.perListing.marginPercent.toFixed(1)}%`}
              valueClassName={
                overview.perListing.marginPercent > 30 ? "text-emerald-300"
                : overview.perListing.marginPercent > 0 ? "text-amber-300"
                : "text-red-300"
              }
            />
          </div>
        </section>

        {/* === Receita por plano === */}
        <section>
          <h2 className="text-lg font-bold mb-3">Receita por plano</h2>
          <div className="border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Plano</th>
                  <th className="px-3 py-2 text-right">Assinaturas</th>
                  <th className="px-3 py-2 text-right">MRR equivalente</th>
                </tr>
              </thead>
              <tbody>
                {overview.revenue.byPlan.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-slate-500 text-xs">
                      Sem assinaturas ativas ainda.
                    </td>
                  </tr>
                ) : (
                  overview.revenue.byPlan.map((p) => (
                    <tr key={p.planName} className="border-t border-slate-800">
                      <td className="px-3 py-2">{p.planName}</td>
                      <td className="px-3 py-2 text-right">{p.count}</td>
                      <td className="px-3 py-2 text-right text-emerald-300">{fmt(p.monthlyCents)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* === Custos por categoria === */}
        <section>
          <h2 className="text-lg font-bold mb-3">Custos por categoria</h2>
          {overview.costs.byCategory.length === 0 ? (
            <p className="text-xs text-slate-500">Cadastre custos abaixo.</p>
          ) : (
            <div className="space-y-1.5">
              {overview.costs.byCategory.map((c) => {
                const max = Math.max(...overview.costs.byCategory.map((x) => x.cents), 1);
                return (
                  <div key={c.category}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-300">{c.category}</span>
                      <span className="text-emerald-300 font-bold">{fmt(c.cents)}</span>
                    </div>
                    <div className="h-2 rounded bg-slate-800">
                      <div className="h-full rounded bg-emerald-500" style={{ width: `${(c.cents / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* === CRUD de custos === */}
        <section>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Custos cadastrados</h2>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-slate-400 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Mostrar inativos
              </label>
              <button
                onClick={async () => {
                  if (!confirm("Popular a tabela com os custos default da Urban AI (Railway, Stripe, Gemini, Mailersend etc.)? Custos já cadastrados são preservados.")) return;
                  try {
                    const r = await seedAdminCosts(false);
                    alert(`Seed OK — ${r.created} criados, ${r.skipped} ignorados.`);
                    load();
                  } catch (err: any) {
                    alert("Erro: " + (err?.message || "falhou"));
                  }
                }}
                className="text-xs px-3 py-1.5 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-950"
                title="Cria entradas default (Railway, Stripe, Gemini, etc.) sem sobrescrever as existentes"
              >
                Popular default
              </button>
              <button
                onClick={() => setShowNew((v) => !v)}
                className="text-xs px-3 py-1.5 rounded bg-emerald-500 text-slate-900 font-bold"
              >
                {showNew ? "Cancelar" : "+ Novo custo"}
              </button>
            </div>
          </header>

          {showNew && <NewCostForm onCreated={() => { setShowNew(false); load(); }} />}

          <div className="border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Categoria</th>
                  <th className="px-3 py-2 text-left">Recorrência</th>
                  <th className="px-3 py-2 text-right">Mensal</th>
                  <th className="px-3 py-2 text-center">% receita</th>
                  <th className="px-3 py-2 text-center">Escala</th>
                  <th className="px-3 py-2 text-center">Ativo</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {costs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-slate-500 text-xs">
                      Nenhum custo cadastrado. Comece adicionando Railway, Mailersend, Gemini etc.
                    </td>
                  </tr>
                ) : (
                  costs.map((c) => (
                    <CostRow key={c.id} cost={c} onChange={load} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi({ label, value, sub, valueClassName }: { label: string; value: string | number; sub?: string; valueClassName?: string }) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClassName ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function NewCostForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("infra");
  const [recurrence, setRecurrence] = useState("monthly");
  const [valueReais, setValueReais] = useState("");
  const [percent, setPercent] = useState("");
  const [scales, setScales] = useState(false);
  const [busy, setBusy] = useState(false);

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
      setName(""); setValueReais(""); setPercent(""); setScales(false);
      onCreated();
    } catch (err: any) {
      alert("Erro: " + (err?.message || "falhou"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-3 p-4 rounded-xl border border-emerald-800/40 bg-emerald-950/20 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm"
    >
      <input
        placeholder="Nome (ex: Railway Pro)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="col-span-2 px-3 py-2 rounded bg-slate-800 border border-slate-700"
      />
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-2 py-2 rounded bg-slate-800 border border-slate-700">
        <option value="infra">infra</option>
        <option value="apis">apis</option>
        <option value="comms">comms</option>
        <option value="payments">payments</option>
        <option value="people">people</option>
        <option value="marketing">marketing</option>
        <option value="legal">legal</option>
        <option value="data">data</option>
        <option value="other">other</option>
      </select>
      <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="px-2 py-2 rounded bg-slate-800 border border-slate-700">
        <option value="monthly">mensal</option>
        <option value="usage_based">por uso</option>
        <option value="one_time">único</option>
        <option value="percentual">% receita</option>
      </select>
      <input
        placeholder="R$ mensal"
        value={valueReais}
        onChange={(e) => setValueReais(e.target.value)}
        className="px-3 py-2 rounded bg-slate-800 border border-slate-700"
      />
      {recurrence === "percentual" ? (
        <input
          placeholder="% (ex: 4.99)"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          className="px-3 py-2 rounded bg-slate-800 border border-slate-700"
        />
      ) : (
        <label className="flex items-center text-xs gap-2">
          <input type="checkbox" checked={scales} onChange={(e) => setScales(e.target.checked)} />
          Escala c/ imóveis
        </label>
      )}
      <button
        type="submit"
        disabled={busy}
        className="col-span-2 md:col-span-6 mt-1 px-4 py-2 rounded bg-emerald-500 text-slate-900 font-bold disabled:opacity-50"
      >
        {busy ? "Salvando…" : "Adicionar custo"}
      </button>
    </form>
  );
}

function CostRow({ cost, onChange }: { cost: AdminCost; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await updateAdminCost(cost.id, { active: !cost.active });
      onChange();
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm(`Remover '${cost.name}'?`)) return;
    setBusy(true);
    try {
      await deleteAdminCost(cost.id);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-slate-800">
      <td className="px-3 py-2">
        <p className="font-semibold">{cost.name}</p>
        {cost.description && <p className="text-xs text-slate-500">{cost.description}</p>}
      </td>
      <td className="px-3 py-2 text-xs text-slate-300">{cost.category}</td>
      <td className="px-3 py-2 text-xs">{cost.recurrence}</td>
      <td className="px-3 py-2 text-right">
        R$ {(cost.monthlyCostCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </td>
      <td className="px-3 py-2 text-center text-xs">
        {cost.percentOfRevenue != null ? `${cost.percentOfRevenue}%` : "—"}
      </td>
      <td className="px-3 py-2 text-center text-xs">{cost.scalesWithListings ? "✓" : "—"}</td>
      <td className="px-3 py-2 text-center">
        <button
          onClick={toggle}
          disabled={busy}
          className={`px-2 py-1 rounded text-xs font-bold ${cost.active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-400"}`}
        >
          {cost.active ? "Ativo" : "Inativo"}
        </button>
      </td>
      <td className="px-3 py-2 text-center">
        <button onClick={remove} disabled={busy} className="text-xs text-red-400 hover:text-red-300">
          remover
        </button>
      </td>
    </tr>
  );
}
