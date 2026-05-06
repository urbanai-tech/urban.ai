"use client";

import { useEffect, useState } from "react";
import {
  fetchDashboardSummary,
  type DashboardSummary,
} from "../../service/api";

/**
 * /admin/dashboard — overview executivo numa única página.
 *
 * Tudo agregado em 1 chamada de API. Mostra:
 *  - Saúde geral (green/amber/red) + alertas
 *  - 4 grandes blocos: eventos, waitlist, cobertura, receita
 *  - Mini-timeline 7 dias
 *  - Top 5 sources últimos 7d
 *  - Atalhos pras páginas detalhadas
 *
 * Auto-refresh a cada 60s.
 */
export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function load() {
    try {
      const r = await fetchDashboardSummary();
      setData(r);
      setError(null);
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

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 60_000); // 60s
    return () => clearInterval(id);
  }, [autoRefresh]);

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <div className="max-w-2xl p-6 border border-red-700 rounded bg-red-950/30">
          {error}
        </div>
      </main>
    );
  }

  if (loading || !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <p className="text-slate-400">Carregando dashboard…</p>
      </main>
    );
  }

  const healthColor =
    data.health === "green"
      ? "text-emerald-300 border-emerald-700/40 bg-emerald-950/30"
      : data.health === "amber"
        ? "text-amber-300 border-amber-700/40 bg-amber-950/30"
        : "text-red-300 border-red-700/40 bg-red-950/30";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Dashboard executivo</h1>
            <p className="text-sm text-slate-400">
              Snapshot consolidado · auto-atualiza a cada 60s ·{" "}
              <span className="text-slate-500">
                Última: {new Date(data.generatedAt).toLocaleTimeString("pt-BR")}
              </span>
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            <button
              onClick={load}
              className="text-xs px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800"
            >
              Atualizar
            </button>
            <a href="/admin" className="text-sm text-emerald-400 hover:underline">
              ← Voltar
            </a>
          </div>
        </header>

        {/* Saúde geral */}
        <section className={`rounded-2xl border p-5 ${healthColor}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {data.health === "green"
                  ? "🟢"
                  : data.health === "amber"
                    ? "🟡"
                    : "🔴"}
              </span>
              <div>
                <p className="text-xs uppercase tracking-wider opacity-70">
                  Saúde geral do sistema
                </p>
                <p className="text-xl font-bold">
                  {data.health === "green" && "Tudo certo"}
                  {data.health === "amber" && "Atenção em alguns pontos"}
                  {data.health === "red" && "Problemas críticos"}
                </p>
              </div>
            </div>
            {data.alerts.length === 0 && (
              <span className="text-xs opacity-70">Nenhum alerta ativo</span>
            )}
          </div>

          {data.alerts.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-sm">
              {data.alerts.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span>
                    {a.severity === "red" && "🚨"}
                    {a.severity === "amber" && "⚠️"}
                    {a.severity === "info" && "ℹ️"}
                  </span>
                  <span>{a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 4 blocos grandes */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Eventos */}
          <Block
            title="Motor de eventos"
            icon="📅"
            href="/admin/events"
          >
            <Stat label="Total" value={data.events.total} />
            <Stat
              label="Dentro da cobertura"
              value={data.events.inScope}
              sub={`${data.events.outOfScope} fora (${data.events.outOfScopePercent}%)`}
              color="text-emerald-300"
            />
            <Stat
              label="Próximos 30 dias"
              value={data.events.next30d}
              sub={`${data.events.megaUpcoming} mega-eventos (rel ≥ 80)`}
            />
            <Stat
              label="Coletados últimas 24h"
              value={data.events.last24h}
              color={data.events.last24h === 0 ? "text-red-300" : "text-emerald-300"}
              sub={`${data.events.last7d} nos últimos 7d`}
            />
          </Block>

          {/* Waitlist */}
          <Block
            title="Lista de espera"
            icon="🎟️"
            href="/admin/waitlist"
          >
            <Stat label="Total" value={data.waitlist.total} />
            <Stat
              label="Aguardando convite"
              value={data.waitlist.pending}
              color="text-amber-300"
            />
            <Stat
              label="Convidados"
              value={data.waitlist.invited}
              color="text-blue-300"
            />
            <Stat
              label="Convertidos em conta"
              value={data.waitlist.converted}
              color="text-emerald-300"
            />
          </Block>

          {/* Cobertura + processamento */}
          <Block
            title="Pipeline de processamento"
            icon="⚙️"
            href="/admin/collectors-health"
          >
            <Stat
              label="Sources distintos"
              value={data.events.distinctSources}
              sub="coletores ativos"
            />
            <Stat
              label="Pendentes Gemini"
              value={data.events.pendingEnrichment}
              color={
                data.events.pendingEnrichment > 100 ? "text-amber-300" : "text-slate-300"
              }
              sub="aguardando enriquecimento"
            />
            <Stat
              label="Pendentes Geocoding"
              value={data.events.pendingGeocode}
              color={
                data.events.pendingGeocode > 50 ? "text-amber-300" : "text-slate-300"
              }
            />
            <Stat
              label="Regiões cobertas"
              value={data.coverage.activeRegions}
              sub={
                data.coverage.bootstrapRegions > 0
                  ? `+${data.coverage.bootstrapRegions} bootstrap`
                  : ""
              }
            />
          </Block>

          {/* Receita */}
          <Block title="Receita & assinaturas" icon="💰" href="/admin/finance">
            <Stat
              label="Assinaturas ativas"
              value={data.revenue.activeSubscriptions}
              color="text-emerald-300"
            />
            <a
              href="/admin/finance"
              className="block text-xs text-blue-300 hover:underline mt-2"
            >
              Ver MRR + custos + margem por imóvel →
            </a>
            <a
              href="/admin/pricing-config"
              className="block text-xs text-blue-300 hover:underline"
            >
              Configurar preços (matriz F6.5) →
            </a>
            <a
              href="/admin/coverage"
              className="block text-xs text-blue-300 hover:underline"
            >
              Cobertura geográfica →
            </a>
          </Block>
        </section>

        {/* Mini-timeline + top sources */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Timeline 7d */}
          <div className="lg:col-span-2 border border-slate-800 rounded-xl bg-slate-900/40 p-5">
            <header className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-200">
                Ingestão últimos {data.timeline.days} dias
              </h2>
              <a
                href="/admin/events"
                className="text-xs text-blue-300 hover:underline"
              >
                Ver completo →
              </a>
            </header>
            <MiniTimeline buckets={data.timeline.buckets} />
          </div>

          {/* Top sources */}
          <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5">
            <header className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-200">
                Top 5 sources (7d)
              </h2>
              <a
                href="/admin/collectors-health"
                className="text-xs text-blue-300 hover:underline"
              >
                Ver todos →
              </a>
            </header>
            {data.topSources.length === 0 ? (
              <p className="text-xs text-slate-500">Sem dados nos últimos 7 dias.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.topSources.map((s, i) => {
                  const max = Math.max(...data.topSources.map((x) => x.count), 1);
                  const pct = (s.count / max) * 100;
                  return (
                    <li key={s.source}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <code className="text-slate-300">
                          {i + 1}. {s.source}
                        </code>
                        <span className="text-emerald-300 font-bold">
                          {s.count.toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="h-1.5 rounded bg-slate-800">
                        <div
                          className="h-full rounded bg-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-4">
          <p>
            <strong>Como ler:</strong> 🟢 verde = sem alertas; 🟡 amber = atenção
            em algum ponto; 🔴 vermelho = problema crítico (coletor caído,
            cobertura zero, etc.). Auto-refresh 60s pode ser desligado no header.
          </p>
        </section>
      </div>
    </main>
  );
}

function Block({
  title,
  icon,
  children,
  href,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4 flex flex-col">
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <span>{icon}</span> {title}
        </h3>
        {href && (
          <a href={href} className="text-xs text-blue-300 hover:underline">
            →
          </a>
        )}
      </header>
      <div className="space-y-2 flex-1">{children}</div>
    </div>
  );
}

function Stat({
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
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${color ?? "text-slate-50"}`}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}

function MiniTimeline({
  buckets,
}: {
  buckets: Array<{ day: string; inScope: number; outOfScope: number }>;
}) {
  const max = Math.max(...buckets.map((b) => b.inScope + b.outOfScope), 1);
  return (
    <div>
      <div className="flex items-end gap-1 h-24 border-b border-slate-700 pb-1">
        {buckets.map((b) => {
          const total = b.inScope + b.outOfScope;
          const inHeight = total > 0 ? (b.inScope / max) * 100 : 0;
          const outHeight = total > 0 ? (b.outOfScope / max) * 100 : 0;
          return (
            <div
              key={b.day}
              className="flex-1 flex flex-col justify-end relative group"
              title={`${new Date(b.day).toLocaleDateString("pt-BR")} — in: ${b.inScope}, out: ${b.outOfScope}`}
            >
              {b.outOfScope > 0 && (
                <div
                  className="bg-red-400"
                  style={{ height: `${outHeight}%` }}
                />
              )}
              {b.inScope > 0 && (
                <div
                  className="bg-emerald-400"
                  style={{ height: `${inHeight}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1 text-[9px] text-slate-500">
        {buckets.map((b) => (
          <div key={b.day} className="flex-1 text-center">
            {new Date(b.day).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-2 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-emerald-400 inline-block" /> in-scope
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-400 inline-block" /> out-of-scope
        </span>
      </div>
    </div>
  );
}
