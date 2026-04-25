"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminPricingQuality,
  fetchAdminOccupancy,
  type AdminPricingQuality,
  type AdminOccupancyCoverage,
} from "../../service/api";

export default function AdminQualityPage() {
  const [quality, setQuality] = useState<AdminPricingQuality | null>(null);
  const [occupancy, setOccupancy] = useState<AdminOccupancyCoverage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAdminPricingQuality(), fetchAdminOccupancy()])
      .then(([q, o]) => {
        setQuality(q);
        setOccupancy(o);
      })
      .catch((err) => {
        const status = err?.response?.status;
        setError(status === 401 || status === 403 ? "Acesso negado." : err?.message || "Erro");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="min-h-screen bg-slate-950 text-slate-50 p-8"><p>Carregando…</p></main>;
  if (error) return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-2xl p-6 border border-red-700 rounded bg-red-950/30">{error}</div>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Qualidade da IA + Ocupação</h1>
            <p className="text-sm text-slate-400">
              MAPE sobre preço aplicado real (ground truth) e cobertura de histórico de ocupação.
            </p>
          </div>
          <a href="/admin" className="text-sm text-emerald-400 hover:underline">← Voltar</a>
        </header>

        {/* MAPE */}
        {quality && (
          <section className="border border-slate-800 rounded-2xl bg-slate-900/40 p-6">
            <h2 className="text-lg font-bold mb-4">Backtest MAPE (últimos {quality.windowDays} dias)</h2>

            {quality.sampleSize === 0 ? (
              <div className="p-4 border border-amber-700/40 rounded bg-amber-950/20 text-amber-200 text-sm">
                Sem dados de preço aplicado real ainda. O ground truth começa a entrar quando anfitriões
                confirmarem o preço aplicado via <code>PATCH /sugestoes-preco/:id/aplicado</code> ou via push
                automático Stays. Janela: {quality.windowDays} dias.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Kpi label="MAPE" value={quality.mapePercent != null ? `${quality.mapePercent}%` : "—"} sub={`alvo ≤ ${quality.qualityGate.threshold}%`} />
                <Kpi label="RMSE" value={quality.rmse != null ? `R$ ${quality.rmse}` : "—"} />
                <Kpi label="Erro mediano" value={quality.medianAbsoluteError != null ? `R$ ${quality.medianAbsoluteError}` : "—"} />
                <Kpi label="Amostras" value={quality.sampleSize} sub={quality.discarded > 0 ? `${quality.discarded} descartadas` : undefined} />
              </div>
            )}

            <div className="mt-6 p-4 rounded-lg border border-slate-800 bg-slate-950/50 text-sm">
              <strong className={quality.qualityGate.passes ? "text-emerald-300" : "text-amber-300"}>
                Gate de qualidade: {quality.qualityGate.passes ? "✅ aprovado" : "🔶 ainda não atingido"}
              </strong>
              <p className="text-xs text-slate-400 mt-1">
                Critério: MAPE ≤ {quality.qualityGate.threshold}% AND amostras ≥ 30.
                {!quality.qualityGate.meetsMinSample && " Falta amostragem mínima."}
              </p>
            </div>
          </section>
        )}

        {/* Ocupação */}
        {occupancy && (
          <section className="border border-slate-800 rounded-2xl bg-slate-900/40 p-6">
            <h2 className="text-lg font-bold mb-4">Cobertura de ocupação</h2>
            <p className="text-xs text-slate-400 mb-4">
              Listings distintos com histórico: <strong>{occupancy.distinctListings}</strong>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold mb-2">Por status</h3>
                {occupancy.byStatus.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Sem registros. A entity OccupancyHistory está pronta — popular via Stays Reservations API,
                    scraping de calendário Airbnb (cinza, com cuidado) ou marcação manual do anfitrião.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {occupancy.byStatus.map((r) => (
                      <li key={r.status} className="flex justify-between">
                        <code className="text-slate-300">{r.status}</code>
                        <span className="font-bold">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Por origem</h3>
                {occupancy.byOrigin.length === 0 ? (
                  <p className="text-xs text-slate-500">Sem origens registradas ainda.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {occupancy.byOrigin.map((r) => (
                      <li key={r.origin} className="flex justify-between">
                        <code className="text-slate-300">{r.origin}</code>
                        <span className="font-bold">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-950/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}
