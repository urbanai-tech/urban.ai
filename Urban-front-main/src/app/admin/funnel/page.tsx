"use client";

import { useEffect, useState } from "react";
import { fetchAdminFunnel, type AdminProductFunnel } from "../../service/api";

export default function AdminFunnelPage() {
  const [data, setData] = useState<AdminProductFunnel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminFunnel()
      .then(setData)
      .catch((err) => {
        const status = err?.response?.status;
        setError(status === 401 || status === 403 ? "Acesso negado." : err?.message || "Erro");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="min-h-screen bg-slate-950 text-slate-50 p-8"><p>Carregando…</p></main>;
  if (error || !data) return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-2xl p-6 border border-red-700 rounded bg-red-950/30">{error}</div>
    </main>
  );

  const stages = [
    { key: "signups", label: "Signups (30d)", value: data.stages.signups },
    { key: "onboardedWithAirbnbId", label: "Com Airbnb host ID", value: data.stages.onboardedWithAirbnbId },
    { key: "analysesGenerated", label: "Análises geradas", value: data.stages.analysesGenerated },
    { key: "suggestionsAccepted", label: "Sugestões aceitas", value: data.stages.suggestionsAccepted },
    { key: "appliedPriceCaptured", label: "Preço real aplicado", value: data.stages.appliedPriceCaptured },
    { key: "activeSubscriptions", label: "Assinaturas ativas", value: data.stages.activeSubscriptions },
    { key: "operationModeAuto", label: "Modo automático", value: data.stages.operationModeAuto },
  ];

  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Funil de Produto</h1>
            <p className="text-sm text-slate-400">Janela: últimos {data.windowDays} dias</p>
          </div>
          <a href="/admin" className="text-sm text-emerald-400 hover:underline">← Voltar</a>
        </header>

        <section className="space-y-3">
          {stages.map((s) => (
            <div key={s.key} className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-semibold">{s.label}</span>
                <span className="text-emerald-300 font-bold">{s.value.toLocaleString("pt-BR")}</span>
              </div>
              <div className="h-2 rounded bg-slate-800">
                <div className="h-full rounded bg-emerald-500" style={{ width: `${(s.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div className="border border-emerald-800/40 rounded-xl bg-emerald-950/20 p-4">
            <p className="text-xs uppercase tracking-wider text-emerald-300">Taxa de aceite</p>
            <p className="text-3xl font-bold mt-1">{data.rates.acceptanceRatePercent}%</p>
            <p className="text-xs text-slate-400 mt-1">aceitas / análises geradas</p>
          </div>
          <div className="border border-emerald-800/40 rounded-xl bg-emerald-950/20 p-4">
            <p className="text-xs uppercase tracking-wider text-emerald-300">Taxa de aplicação</p>
            <p className="text-3xl font-bold mt-1">{data.rates.applicationRatePercent}%</p>
            <p className="text-xs text-slate-400 mt-1">preço aplicado / aceitas (ground truth do MAPE)</p>
          </div>
        </section>
      </div>
    </main>
  );
}
