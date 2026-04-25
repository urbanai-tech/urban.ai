"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminPlansConfig,
  updateAdminPlan,
  type AdminPlanConfig,
} from "../../service/api";

/**
 * /admin/pricing-config — gestão dos preços dos planos da Urban AI.
 *
 * Permite editar a matriz F6.5 (preços por imóvel × 4 ciclos + descontos
 * + features + limite de imóveis) sem precisar mexer em código.
 *
 * NÃO altera Stripe Price IDs — esses precisam ser criados no Dashboard
 * Stripe primeiro e atualizados nas env vars do Railway. O painel mostra
 * o ID atual (read-only) para auditoria.
 */
export default function PricingConfigPage() {
  const [plans, setPlans] = useState<AdminPlanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setPlans(await fetchAdminPlansConfig());
    } catch (err: any) {
      const status = err?.response?.status;
      setError(status === 401 || status === 403 ? "Acesso negado." : err?.message || "Erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <main className="min-h-screen bg-slate-950 text-slate-50 p-8"><p>Carregando…</p></main>;
  if (error) return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-2xl p-6 border border-red-700 rounded bg-red-950/30">{error}</div>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Configuração de Preços</h1>
            <p className="text-sm text-slate-400">
              Matriz F6.5 — preços por imóvel × 4 ciclos com desconto progressivo. Mudanças refletem
              imediatamente em <code>/plans</code> e novos checkouts.
            </p>
          </div>
          <a href="/admin" className="text-sm text-emerald-400 hover:underline">← Voltar</a>
        </header>

        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 text-xs text-amber-200">
          <strong>Atenção:</strong> os <strong>Stripe Price IDs</strong> mostrados ao final de cada plano são read-only.
          Para mudar valor cobrado de fato, é necessário criar nova Price no Dashboard Stripe
          e atualizar a env var correspondente no Railway. Mudar o preço de display aqui sem
          atualizar o Stripe vai causar mismatch entre o que o usuário vê e o que é cobrado.
        </div>

        <div className="space-y-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onSaved={load} />
          ))}
        </div>
      </div>
    </main>
  );
}

function PlanCard({ plan, onSaved }: { plan: AdminPlanConfig; onSaved: () => void }) {
  const [edited, setEdited] = useState<Partial<AdminPlanConfig>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function field<K extends keyof AdminPlanConfig>(key: K) {
    return (edited[key] ?? plan[key]) as AdminPlanConfig[K];
  }

  function patch<K extends keyof AdminPlanConfig>(key: K, value: AdminPlanConfig[K]) {
    setEdited((e) => ({ ...e, [key]: value }));
  }

  async function save() {
    if (Object.keys(edited).length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      await updateAdminPlan(plan.name, edited);
      setMsg("Salvo ✓");
      setEdited({});
      onSaved();
    } catch (err: any) {
      setMsg("Erro: " + (err?.message || "falhou"));
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  const dirty = Object.keys(edited).length > 0;

  return (
    <div className="border border-slate-800 rounded-2xl bg-slate-900/40 p-5">
      <header className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold">{plan.title}</h3>
          <p className="text-xs text-slate-500 font-mono">{plan.name}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={field("isActive") as boolean}
            onChange={(e) => patch("isActive", e.target.checked)}
          />
          Ativo
        </label>
      </header>

      {plan.isCustomPrice ? (
        <p className="text-sm text-slate-400">Plano custom (sob consulta) — sem matriz de preços editável.</p>
      ) : (
        <>
          {/* Matriz F6.5 — 4 ciclos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Field
              label="Mensal (R$/imóvel/mês)"
              value={(field("priceMonthly") as string) ?? ""}
              onChange={(v) => patch("priceMonthly", v)}
            />
            <Field
              label="Trimestral"
              value={(field("priceQuarterly") as string) ?? ""}
              onChange={(v) => patch("priceQuarterly", v)}
            />
            <Field
              label="Semestral"
              value={(field("priceSemestral") as string) ?? ""}
              onChange={(v) => patch("priceSemestral", v)}
            />
            <Field
              label="Anual"
              value={(field("priceAnnualNew") as string) ?? ""}
              onChange={(v) => patch("priceAnnualNew", v)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <Field
              label="% desconto trimestral"
              value={String(field("discountQuarterlyPercent") ?? "")}
              onChange={(v) => patch("discountQuarterlyPercent", Number(v) as any)}
              type="number"
            />
            <Field
              label="% desconto semestral"
              value={String(field("discountSemestralPercent") ?? "")}
              onChange={(v) => patch("discountSemestralPercent", Number(v) as any)}
              type="number"
            />
            <Field
              label="% desconto anual"
              value={String(field("discountAnnualPercent") ?? "")}
              onChange={(v) => patch("discountAnnualPercent", Number(v) as any)}
              type="number"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field
              label="Limite de imóveis (vazio = sem limite)"
              value={String(field("propertyLimit") ?? "")}
              onChange={(v) => patch("propertyLimit", v ? (Number(v) as any) : (null as any))}
              type="number"
            />
            <Field
              label="Highlight badge"
              value={(field("highlightBadge") as string) ?? ""}
              onChange={(v) => patch("highlightBadge", v as any)}
            />
          </div>

          <Field
            label="Discount badge"
            value={(field("discountBadge") as string) ?? ""}
            onChange={(v) => patch("discountBadge", v as any)}
          />

          {/* Stripe Price IDs read-only */}
          <details className="mt-4 rounded border border-slate-800 bg-slate-950/30 p-3">
            <summary className="cursor-pointer text-xs text-slate-400">
              Stripe Price IDs (read-only — gerenciar no Dashboard Stripe)
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono text-slate-500">
              <div>monthly: {plan.stripePriceIdMonthly || "—"}</div>
              <div>quarterly: {plan.stripePriceIdQuarterly || "—"}</div>
              <div>semestral: {plan.stripePriceIdSemestral || "—"}</div>
              <div>annual: {plan.stripePriceIdAnnualNew || "—"}</div>
            </div>
          </details>
        </>
      )}

      <footer className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
        {msg ? (
          <span className={`text-xs ${msg.startsWith("Erro") ? "text-red-400" : "text-emerald-400"}`}>{msg}</span>
        ) : (
          <span className="text-xs text-slate-500">{dirty ? "Mudanças não salvas" : ""}</span>
        )}
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="px-4 py-2 rounded bg-emerald-500 text-slate-900 font-bold text-sm disabled:opacity-40"
        >
          {busy ? "Salvando…" : "Salvar mudanças"}
        </button>
      </footer>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
      />
    </label>
  );
}
