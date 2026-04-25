"use client";

import { useEffect, useState } from "react";
import { fetchAdminStays, type AdminStaysHealth } from "../../service/api";

export default function AdminStaysPage() {
  const [data, setData] = useState<AdminStaysHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStays()
      .then(setData)
      .catch((err) => {
        const status = err?.response?.status;
        setError(status === 401 || status === 403 ? "Acesso negado." : err?.message || "Erro");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <main className="min-h-screen bg-slate-950 text-slate-50 p-8"><p>Carregando…</p></main>;
  }
  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <div className="max-w-2xl p-6 border border-red-700 rounded bg-red-950/30">{error}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Saúde da Stays</h1>
          <a href="/admin" className="text-sm text-emerald-400 hover:underline">← Voltar</a>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
            <h3 className="font-semibold mb-3">Contas conectadas</h3>
            {data.accountsByStatus.length === 0 ? (
              <p className="text-slate-500 text-sm">Nenhuma conta ainda.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {data.accountsByStatus.map((r) => (
                  <li key={r.status} className="flex justify-between">
                    <code className="text-slate-300">{r.status}</code>
                    <span className="font-bold">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
            <h3 className="font-semibold mb-3">Listings sincronizados</h3>
            <p className="text-3xl font-bold">{data.listings.total}</p>
            <p className="text-xs text-slate-400 mt-1">
              {data.listings.active} ativos · {data.listings.forcedAuto} em modo automático
            </p>
          </div>

          <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
            <h3 className="font-semibold mb-3">Push price (últimos 30d)</h3>
            {data.pushLast30d.length === 0 ? (
              <p className="text-slate-500 text-sm">Nenhum push registrado.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {data.pushLast30d.map((r) => (
                  <li key={r.status} className="flex justify-between">
                    <span
                      className={
                        r.status === "success"
                          ? "text-emerald-300"
                          : r.status === "rejected"
                          ? "text-amber-300"
                          : r.status === "error"
                          ? "text-red-300"
                          : "text-slate-300"
                      }
                    >
                      {r.status}
                    </span>
                    <span className="font-bold">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">Pushes recentes</h2>
          {data.recent.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum push ainda. Conecte uma conta Stays para começar.</p>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Data alvo</th>
                    <th className="px-3 py-2 text-right">Antes</th>
                    <th className="px-3 py-2 text-right">Depois</th>
                    <th className="px-3 py-2 text-left">Origem</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((p) => (
                    <tr key={p.id} className="border-t border-slate-800">
                      <td className="px-3 py-2">{p.targetDate}</td>
                      <td className="px-3 py-2 text-right">R$ {(p.previousPriceCents / 100).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">R$ {(p.newPriceCents / 100).toFixed(2)}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">{p.origin}</td>
                      <td className="px-3 py-2">
                        <span className={
                          p.status === "success"
                            ? "text-emerald-300"
                            : p.status === "rejected"
                            ? "text-amber-300"
                            : p.status === "error"
                            ? "text-red-300"
                            : "text-slate-300"
                        }>{p.status}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {new Date(p.createdAt).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
