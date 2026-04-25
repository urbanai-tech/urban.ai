"use client";

import { useEffect, useState } from "react";
import { fetchAdminEvents, type AdminEventsAnalytics } from "../../service/api";

/**
 * /admin/events — analytics do motor de eventos (F6.2).
 *
 * Mostra:
 *  - Cobertura geral (total, com coordenadas, com relevância)
 *  - Eventos próximos (7/30/90 dias) e mega-eventos
 *  - Distribuição por categoria, cidade, faixa de relevância
 *  - Top 10 eventos próximos por relevância
 *  - Última atualização do crawl
 */
export default function AdminEventsPage() {
  const [data, setData] = useState<AdminEventsAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminEvents()
      .then(setData)
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          setError("Acesso negado. Você precisa ser admin.");
        } else {
          setError(err?.message || "Erro ao carregar.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <p className="text-slate-400">Carregando…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <div className="max-w-2xl mx-auto p-6 border border-red-700 rounded-xl bg-red-950/30">
          <h1 className="text-xl font-bold mb-2">Erro</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  const { summary, upcoming, byCategory, byCity, byRelevance, topUpcoming, lastCrawlAt } = data;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Motor de Eventos</h1>
            <p className="text-sm text-slate-400">
              Cobertura, categorias, top eventos próximos.
              {lastCrawlAt && ` · Último crawl: ${new Date(lastCrawlAt).toLocaleString("pt-BR")}`}
            </p>
          </div>
          <a href="/admin" className="text-sm text-emerald-400 hover:underline">
            ← Voltar
          </a>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Total no DB" value={summary.total} />
          <Kpi label="Ativos" value={summary.ativos} />
          <Kpi label="Cobertura geo" value={`${summary.coveragePercent}%`} sub={`${summary.coordsMissing} sem coord`} />
          <Kpi label="Enriquecidos (Gemini)" value={`${summary.enrichmentPercent}%`} sub={`${summary.relevanceMissing} sem relevância`} />
          <Kpi label="Próximos 7d" value={upcoming.next7d} />
          <Kpi label="Próximos 30d" value={upcoming.next30d} />
          <Kpi label="Próximos 90d" value={upcoming.next90d} />
          <Kpi label="Mega-eventos 30d" value={upcoming.megaUpcoming} sub="relevância ≥ 80" />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Por categoria">
            <BarList rows={byCategory.map((r) => ({ label: r.categoria, value: r.count }))} />
          </Card>
          <Card title="Por cidade (top 10)">
            <BarList rows={byCity.map((r) => ({ label: r.cidade, value: r.count }))} />
          </Card>
          <Card title="Distribuição de relevância">
            <BarList rows={byRelevance.map((r) => ({ label: r.bucket, value: r.count }))} />
          </Card>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">Top 10 próximos por relevância</h2>
          <div className="border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Cidade</th>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-center">Relevância</th>
                  <th className="px-3 py-2 text-left">Categoria</th>
                  <th className="px-3 py-2 text-center">Capacidade</th>
                  <th className="px-3 py-2 text-center">Raio</th>
                  <th className="px-3 py-2 text-center">Geo</th>
                </tr>
              </thead>
              <tbody>
                {topUpcoming.map((e) => (
                  <tr key={e.id} className="border-t border-slate-800">
                    <td className="px-3 py-2">{e.nome}</td>
                    <td className="px-3 py-2 text-slate-300">{e.cidade}</td>
                    <td className="px-3 py-2 text-slate-300 text-xs">
                      {new Date(e.dataInicio).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          (e.relevancia ?? 0) >= 80
                            ? "bg-rose-500/20 text-rose-300"
                            : (e.relevancia ?? 0) >= 60
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {e.relevancia ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{e.categoria || "—"}</td>
                    <td className="px-3 py-2 text-center text-xs">{e.capacidadeEstimada ?? "—"}</td>
                    <td className="px-3 py-2 text-center text-xs">{e.raioImpactoKm ? `${e.raioImpactoKm} km` : "—"}</td>
                    <td className="px-3 py-2 text-center">{e.hasCoords ? "✓" : "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-4">
          <p>
            <strong>Gap conhecido:</strong> os 8 spiders atuais cobrem shows e ingressos comerciais.
            Conferências, cursos profissionais, jogos em estádios e centros de eventos ainda não entram.
            Plano de evolução em 3 camadas (APIs oficiais → Firecrawl → curadoria) em
            <code className="px-1">docs/runbooks/event-engine-evolution.md</code>.
          </p>
        </section>
      </div>
    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
      <h3 className="font-semibold mb-3 text-sm">{title}</h3>
      {children}
    </div>
  );
}

function BarList({ rows }: { rows: Array<{ label: string; value: number }> }) {
  if (rows.length === 0) {
    return <p className="text-xs text-slate-500">Sem dados.</p>;
  }
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5 text-xs">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between mb-0.5">
            <span className="text-slate-300 truncate">{r.label}</span>
            <span className="text-emerald-300 font-bold ml-2">{r.value}</span>
          </div>
          <div className="h-1.5 rounded bg-slate-800">
            <div
              className="h-full rounded bg-emerald-500"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
