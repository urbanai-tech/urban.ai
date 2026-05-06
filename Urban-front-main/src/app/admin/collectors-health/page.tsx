"use client";

import { useEffect, useState } from "react";
import {
  fetchCollectorsHealth,
  type CollectorsHealthResponse,
  type CollectorSourceStats,
} from "../../service/api";

/**
 * /admin/collectors-health — saúde dos coletores agrupada por source.
 *
 * Mostra pra cada source ('scraper-sympla', 'api-football', 'firecrawl',
 * 'admin-csv-import', etc.):
 *   - Total no DB
 *   - Volume últimos 7d / 24h
 *   - % out-of-scope
 *   - Pendentes (geocode + enrichment)
 *   - Taxa de erro de enrichment
 *   - Última coleta
 *
 * Útil pra debugar:
 *   - Coletor parou de trazer eventos (last24h=0)?
 *   - Coletor tá trazendo lixo (outOfScope% alto)?
 *   - Gemini tá quebrando muito (errorRate alto)?
 *   - Source escapou (aparece "(sem source)")?
 */
export default function CollectorsHealthPage() {
  const [data, setData] = useState<CollectorsHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCollectorsHealth());
    } catch (err: any) {
      const status = err?.response?.status;
      setError(
        status === 401 || status === 403 ? "Acesso negado." : err?.message || "Erro",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <div className="max-w-2xl p-6 border border-red-700 rounded bg-red-950/30">
          {error}
        </div>
      </main>
    );
  }

  const sources = data?.sources ?? [];
  const totalsByCategory = sources.reduce(
    (acc, s) => {
      acc.total += s.total;
      acc.last24h += s.last24h;
      acc.outOfScope += s.outOfScope;
      acc.withErrors += s.withErrors;
      acc.pendingEnrichment += s.pendingEnrichment;
      return acc;
    },
    { total: 0, last24h: 0, outOfScope: 0, withErrors: 0, pendingEnrichment: 0 },
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Saúde dos coletores</h1>
            <p className="text-sm text-slate-400">
              Volume + qualidade por source. Os 7 spiders Scrapy + 4 coletores
              REST + curadoria manual + import CSV — tudo agrupado aqui.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Atualizando…" : "Atualizar"}
            </button>
            <a href="/admin/events" className="text-sm text-emerald-400 hover:underline self-center">
              ← Eventos
            </a>
          </div>
        </header>

        {/* Totais agregados */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Total no DB" value={totalsByCategory.total} />
          <Stat label="Últimas 24h" value={totalsByCategory.last24h} color="text-emerald-300" />
          <Stat
            label="Out-of-scope"
            value={totalsByCategory.outOfScope}
            color={totalsByCategory.outOfScope > 0 ? "text-red-300" : "text-slate-300"}
          />
          <Stat
            label="Pendentes Gemini"
            value={totalsByCategory.pendingEnrichment}
            color="text-amber-300"
          />
          <Stat
            label="Erros enrichment"
            value={totalsByCategory.withErrors}
            color="text-red-300"
          />
        </section>

        {/* Tabela de sources */}
        <section>
          <h2 className="text-lg font-bold mb-3">Por source</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : sources.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum evento ainda no DB.</p>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-900/60 text-slate-400 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Últimas 24h</th>
                    <th className="px-3 py-2 text-right">Últimos 7d</th>
                    <th className="px-3 py-2 text-right">Out-of-scope</th>
                    <th className="px-3 py-2 text-right">Pend. geo</th>
                    <th className="px-3 py-2 text-right">Pend. Gemini</th>
                    <th className="px-3 py-2 text-right">Enriquecidos</th>
                    <th className="px-3 py-2 text-right">Erro %</th>
                    <th className="px-3 py-2 text-left">Último crawl</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <SourceRow key={s.source} s={s} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="border-t border-slate-800 pt-4 text-xs text-slate-500 space-y-1">
          <p>
            <strong>Como ler:</strong>
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>
              <code>last24h = 0</code> em coletor que devia rodar diário → coletor caiu
              ou cron não disparou
            </li>
            <li>
              <code>outOfScopePercent</code> alto (&gt;30%) → query do coletor está pegando muita coisa de fora; refinar
            </li>
            <li>
              <code>errorRate</code> alto → Gemini falhando (rate-limit, prompt malformado, JSON inválido)
            </li>
            <li>
              <code>(sem source)</code> aparecendo → coletor antigo mandando sem `source` setado
            </li>
          </ul>
          {data && (
            <p className="pt-2">
              Snapshot tirado em {new Date(data.generatedAt).toLocaleString("pt-BR")}.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color ?? "text-slate-50"}`}>
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

function SourceRow({ s }: { s: CollectorSourceStats }) {
  const stale =
    s.lastSeen &&
    Date.now() - new Date(s.lastSeen).getTime() > 48 * 60 * 60 * 1000;

  return (
    <tr className={`border-t border-slate-800 ${stale ? "opacity-70" : ""}`}>
      <td className="px-3 py-2 font-mono text-slate-200">
        {s.source}
        {stale && (
          <span className="ml-2 text-[10px] text-amber-400" title="Sem dados há > 48h">
            STALE
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right">{s.total.toLocaleString("pt-BR")}</td>
      <td
        className={`px-3 py-2 text-right ${
          s.last24h === 0 ? "text-red-400" : "text-emerald-300"
        }`}
      >
        {s.last24h.toLocaleString("pt-BR")}
      </td>
      <td className="px-3 py-2 text-right text-slate-300">
        {s.last7d.toLocaleString("pt-BR")}
      </td>
      <td
        className={`px-3 py-2 text-right ${
          s.outOfScopePercent > 30
            ? "text-red-400"
            : s.outOfScopePercent > 10
            ? "text-amber-400"
            : "text-slate-300"
        }`}
      >
        {s.outOfScope.toLocaleString("pt-BR")} ({s.outOfScopePercent}%)
      </td>
      <td className="px-3 py-2 text-right text-slate-400">
        {s.pendingGeocode > 0 ? s.pendingGeocode : "—"}
      </td>
      <td className="px-3 py-2 text-right text-slate-400">
        {s.pendingEnrichment > 0 ? s.pendingEnrichment : "—"}
      </td>
      <td className="px-3 py-2 text-right text-emerald-300">
        {s.enriched.toLocaleString("pt-BR")}
      </td>
      <td
        className={`px-3 py-2 text-right ${
          s.errorRate > 20 ? "text-red-400" : s.errorRate > 5 ? "text-amber-400" : "text-slate-400"
        }`}
      >
        {s.errorRate}%
      </td>
      <td className="px-3 py-2 text-slate-500 text-[10px]">
        {s.lastSeen
          ? new Date(s.lastSeen).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"}
      </td>
    </tr>
  );
}
