"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminEvents,
  fetchAdminEventsList,
  fetchEventsTimeline,
  type AdminEventsAnalytics,
  type EventListItem,
  type EventsTimelineResponse,
} from "../../service/api";

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

  // Listing detalhada (filtros)
  const [listing, setListing] = useState<{
    items: EventListItem[];
    total: number;
    page: number;
    limit: number;
  } | null>(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [scope, setScope] = useState<'in' | 'out' | 'all'>('in');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);

  // Timeline
  const [timeline, setTimeline] = useState<EventsTimelineResponse | null>(null);
  const [timelineDays, setTimelineDays] = useState(30);

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

  useEffect(() => {
    fetchEventsTimeline(timelineDays).then(setTimeline).catch(() => {});
  }, [timelineDays]);

  async function loadListing() {
    setListingLoading(true);
    try {
      const r = await fetchAdminEventsList({
        page,
        limit: 50,
        scope,
        source: sourceFilter || undefined,
        search: search.trim() || undefined,
      });
      setListing({ items: r.items, total: r.total, page: r.page, limit: r.limit });
    } catch (err: any) {
      console.error(err);
    } finally {
      setListingLoading(false);
    }
  }

  useEffect(() => {
    loadListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, page, sourceFilter]);

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
          <Kpi
            label="Dentro da cobertura"
            value={summary.inScope}
            sub={`${summary.outOfScope} fora`}
            color="text-emerald-300"
          />
          <Kpi label="Cobertura geo" value={`${summary.coveragePercent}%`} sub={`${summary.coordsMissing} sem coord`} />
          <Kpi label="Enriquecidos (Gemini)" value={`${summary.enrichmentPercent}%`} sub={`${summary.relevanceMissing} sem relevância`} />
          <Kpi label="Próximos 7d" value={upcoming.next7d} />
          <Kpi label="Próximos 30d" value={upcoming.next30d} />
          <Kpi label="Próximos 90d" value={upcoming.next90d} />
          <Kpi label="Mega-eventos 30d" value={upcoming.megaUpcoming} sub="relevância ≥ 80" />
        </section>

        <section className="flex flex-wrap gap-2 text-xs">
          <a
            href="/admin/coverage"
            className="px-3 py-1.5 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-950/30"
          >
            Ver/editar regiões de cobertura →
          </a>
          <a
            href="/admin/collectors-health"
            className="px-3 py-1.5 rounded border border-blue-700 text-blue-300 hover:bg-blue-950/30"
          >
            Saúde dos coletores →
          </a>
          <a
            href="/admin/events/new"
            className="px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800"
          >
            + Cadastrar evento manual
          </a>
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

        {/* ============== Timeline de ingestão ============== */}
        <section>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">Evolução de ingestão</h2>
            <div className="flex gap-1">
              {[7, 14, 30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setTimelineDays(d)}
                  className={`text-xs px-2 py-1 rounded ${
                    timelineDays === d
                      ? "bg-emerald-500 text-slate-900 font-bold"
                      : "border border-slate-700 hover:bg-slate-800"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </header>

          {timeline && <TimelineChart data={timeline} />}
        </section>

        {/* ============== Listagem detalhada com filtros ============== */}
        <section>
          <h2 className="text-xl font-bold mb-3">Listagem detalhada</h2>

          <div className="flex flex-wrap gap-2 mb-3">
            <div className="flex rounded-lg overflow-hidden border border-slate-700">
              {(['in', 'out', 'all'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setScope(s);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                    scope === s
                      ? 'bg-emerald-500 text-slate-900'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {s === 'in' && 'Dentro da cobertura'}
                  {s === 'out' && 'Fora (out-of-scope)'}
                  {s === 'all' && 'Todos'}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Buscar por nome ou cidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  loadListing();
                }
              }}
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs"
            />

            <input
              type="text"
              placeholder="Source (api-football, sympla...)"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              onBlur={() => setPage(1)}
              className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs w-56"
            />

            <button
              onClick={() => {
                setPage(1);
                loadListing();
              }}
              className="px-3 py-1.5 rounded bg-emerald-500 text-slate-900 font-bold text-xs"
            >
              Buscar
            </button>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase">
                <tr>
                  <th className="px-2 py-1.5 text-left">Nome</th>
                  <th className="px-2 py-1.5 text-left">Cidade</th>
                  <th className="px-2 py-1.5 text-left">Data</th>
                  <th className="px-2 py-1.5 text-center">Rel.</th>
                  <th className="px-2 py-1.5 text-left">Source</th>
                  <th className="px-2 py-1.5 text-center">Geo</th>
                  <th className="px-2 py-1.5 text-center">Scope</th>
                  <th className="px-2 py-1.5 text-center">Enrich</th>
                </tr>
              </thead>
              <tbody>
                {listingLoading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                      Carregando…
                    </td>
                  </tr>
                ) : !listing || listing.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                      Nenhum evento com esses filtros.
                    </td>
                  </tr>
                ) : (
                  listing.items.map((e) => (
                    <tr key={e.id} className="border-t border-slate-800 hover:bg-slate-900/30">
                      <td className="px-2 py-1.5 max-w-xs truncate" title={e.nome}>
                        {e.nome}
                      </td>
                      <td className="px-2 py-1.5 text-slate-400">
                        {e.cidade}/{e.estado}
                      </td>
                      <td className="px-2 py-1.5 text-slate-400">
                        {new Date(e.dataInicio).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {e.relevancia !== null ? (
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              e.relevancia >= 80
                                ? 'bg-rose-500/20 text-rose-300'
                                : e.relevancia >= 60
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {e.relevancia}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500 font-mono text-[10px]">
                        {e.source ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {e.latitude && e.longitude ? (
                          '✓'
                        ) : e.pendingGeocode ? (
                          <span className="text-amber-400" title="Aguardando geocoder">
                            ⌛
                          </span>
                        ) : (
                          <span className="text-red-400">✗</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {e.outOfScope ? (
                          <span className="text-red-400" title="Fora da cobertura">
                            ✗
                          </span>
                        ) : (
                          <span className="text-emerald-400">✓</span>
                        )}
                      </td>
                      <td
                        className="px-2 py-1.5 text-center"
                        title={e.enrichmentLastError ?? ''}
                      >
                        {e.relevancia !== null
                          ? '✓'
                          : e.enrichmentAttempts > 0
                          ? `${e.enrichmentAttempts}x ⚠️`
                          : '⌛'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {listing && listing.total > listing.limit && (
            <div className="flex justify-between items-center mt-2 text-xs">
              <span className="text-slate-500">
                Página {listing.page} · {listing.total.toLocaleString('pt-BR')} no total
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={listing.page === 1}
                  className="px-3 py-1 rounded border border-slate-700 disabled:opacity-30"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={listing.page * listing.limit >= listing.total}
                  className="px-3 py-1 rounded border border-slate-700 disabled:opacity-30"
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-4">
          <p>
            <strong>Status do motor:</strong> spiders Scrapy (Camada legado) + APIs
            oficiais (api-football, sp-cultura) + LLM extractors (Firecrawl/SerpAPI/Tavily,
            Camada 2) + curadoria humana (admin-manual / admin-csv-import, Camada 3).
            Cobertura geográfica controlada em <code>/admin/coverage</code>.
            Saúde dos coletores em <code>/admin/collectors-health</code>.
          </p>
        </section>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color ?? ""}`}>{value}</p>
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

// ============== TimelineChart ==============

function TimelineChart({ data }: { data: EventsTimelineResponse }) {
  const buckets = data.buckets;
  const maxTotal = Math.max(
    ...buckets.map((b) => b.inScope + b.outOfScope),
    1,
  );

  // Mostra label de data esparso pra não poluir
  const labelStep = Math.max(1, Math.floor(buckets.length / 8));

  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
        <div>
          <p className="text-slate-500 uppercase">Período</p>
          <p className="text-slate-200 font-bold mt-0.5">{data.days}d</p>
        </div>
        <div>
          <p className="text-slate-500 uppercase">Total in-scope</p>
          <p className="text-emerald-300 font-bold mt-0.5">
            {data.totalInScope.toLocaleString("pt-BR")}
          </p>
        </div>
        <div>
          <p className="text-slate-500 uppercase">Total out-of-scope</p>
          <p className="text-red-300 font-bold mt-0.5">
            {data.totalOutScope.toLocaleString("pt-BR")}
          </p>
        </div>
        <div>
          <p className="text-slate-500 uppercase">Pico</p>
          <p className="text-slate-200 font-bold mt-0.5">
            {data.peakDay.day
              ? `${new Date(data.peakDay.day).toLocaleDateString("pt-BR")}: ${data.peakDay.total}`
              : "—"}
          </p>
        </div>
      </div>

      {/* Stacked bar chart simples em SVG/CSS */}
      <div className="flex items-end gap-px h-32 border-b border-slate-700 pb-1">
        {buckets.map((b) => {
          const total = b.inScope + b.outOfScope;
          const inHeight = total > 0 ? (b.inScope / maxTotal) * 100 : 0;
          const outHeight = total > 0 ? (b.outOfScope / maxTotal) * 100 : 0;
          return (
            <div
              key={b.day}
              className="flex-1 flex flex-col justify-end relative group min-w-0"
              title={`${new Date(b.day).toLocaleDateString("pt-BR")} — in: ${b.inScope}, out: ${b.outOfScope}`}
            >
              {/* Out-of-scope no topo */}
              {b.outOfScope > 0 && (
                <div
                  className="bg-red-400 hover:bg-red-300 transition-colors"
                  style={{ height: `${outHeight}%` }}
                />
              )}
              {/* In-scope embaixo */}
              {b.inScope > 0 && (
                <div
                  className="bg-emerald-400 hover:bg-emerald-300 transition-colors"
                  style={{ height: `${inHeight}%` }}
                />
              )}
              {/* Tooltip on hover */}
              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[10px] whitespace-nowrap pointer-events-none z-10">
                <div className="font-bold">
                  {new Date(b.day).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </div>
                <div className="text-emerald-300">in: {b.inScope}</div>
                <div className="text-red-300">out: {b.outOfScope}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Labels do eixo X */}
      <div className="flex gap-px mt-1 text-[9px] text-slate-500">
        {buckets.map((b, i) => (
          <div key={b.day} className="flex-1 text-center min-w-0">
            {i % labelStep === 0
              ? new Date(b.day).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })
              : ""}
          </div>
        ))}
      </div>

      <div className="flex gap-4 mt-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-emerald-400 rounded-sm inline-block" />
          <span className="text-slate-400">In-scope</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-red-400 rounded-sm inline-block" />
          <span className="text-slate-400">Out-of-scope</span>
        </span>
      </div>
    </div>
  );
}
