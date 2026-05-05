"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminOverview,
  fetchAdminPricingStatus,
  fetchAdminDatasetMetrics,
  type AdminOverview,
  type AdminPricingStatus,
  type AdminDatasetMetrics,
} from "../service/api";

/**
 * /admin — painel administrativo Urban AI (F6.3).
 *
 * Acesso requer role='admin' no backend (RolesGuard). Páginas internas:
 *  - / (este) — overview + tier IA + dataset
 *  - /admin/users — listagem e gestão de usuários (a expandir)
 *
 * Não substitui dashboards de observabilidade (Sentry, UptimeRobot) — é o
 * painel de NEGÓCIO: quantos usuários, quanta receita, qual modelo de IA
 * está ativo, quão grande é o dataset proprietário.
 */
export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [pricing, setPricing] = useState<AdminPricingStatus | null>(null);
  const [dataset, setDataset] = useState<AdminDatasetMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [o, p, d] = await Promise.all([
          fetchAdminOverview(),
          fetchAdminPricingStatus(),
          fetchAdminDatasetMetrics(),
        ]);
        setOverview(o);
        setPricing(p);
        setDataset(d);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          setError("Acesso negado. Você precisa ser admin para ver este painel.");
        } else {
          setError(err?.message || "Erro ao carregar painel.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <p className="text-slate-400">Carregando painel admin...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <div className="max-w-2xl mx-auto p-6 border border-red-700 rounded-xl bg-red-950/30">
          <h1 className="text-xl font-bold mb-2">Erro</h1>
          <p className="text-slate-300">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold mb-2">Painel Urban AI</h1>
          <p className="text-slate-400">
            Visão consolidada da operação. Acesso restrito a usuários com role=admin.
          </p>
        </header>

        {/* === Overview KPIs === */}
        {overview && (
          <section>
            <h2 className="text-xl font-bold mb-3">Visão geral</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Usuários ativos" value={overview.users.active} sub={`de ${overview.users.total} cadastrados`} />
              <KpiCard label="Imóveis cadastrados" value={overview.product.propertiesRegistered} />
              <KpiCard label="Assinaturas ativas" value={overview.revenue.activeSubscriptions} />
              <KpiCard
                label="Eventos no DB"
                value={overview.product.eventsTotal}
                sub={`+${overview.product.eventsLast7d} nos últimos 7d`}
              />
              <KpiCard label="Análises geradas" value={overview.product.analysesTotal} />
              <KpiCard
                label="Sugestões aceitas"
                value={overview.product.analysesAccepted}
                sub={`${overview.product.acceptanceRatePercent}% taxa de aceite`}
              />
              <KpiCard label="Admins" value={overview.users.admins} />
            </div>
          </section>
        )}

        {/* === IA — tier ativo === */}
        {overview && pricing && (
          <section className="border border-emerald-800/40 rounded-2xl bg-emerald-950/20 p-6">
            <header className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl font-bold">Motor de IA — estado atual</h2>
              <span className="text-xs uppercase tracking-wider text-emerald-300 font-bold">
                {overview.ai.currentTier}
              </span>
            </header>
            <div className="space-y-2 text-sm">
              <p>
                Estratégia ativa: <strong>{pricing.activeStrategy}</strong>
              </p>
              <p className="text-slate-400">{overview.ai.reason}</p>
              <p className="text-slate-500 text-xs">
                Default por env (PRICING_STRATEGY): <code>{pricing.strategyEnvDefault}</code> ·
                Bootstrap on boot: {pricing.bootstrapOnBoot ? "sim" : "não"}
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <KpiCard label="Snapshots no dataset" value={overview.ai.dataset.totalSnapshots} />
              <KpiCard label="Listings distintos" value={overview.ai.dataset.distinctListings} />
              <KpiCard label="Dias cobertos" value={overview.ai.dataset.distinctDays} />
              <KpiCard
                label="Snapshots training-ready"
                value={overview.ai.dataset.trainingReady}
                sub={
                  overview.ai.dataset.totalSnapshots > 0
                    ? `${Math.round(
                        (overview.ai.dataset.trainingReady / overview.ai.dataset.totalSnapshots) * 100,
                      )}%`
                    : undefined
                }
              />
            </div>

            <div className="mt-6 text-xs text-slate-400 space-y-1">
              <p>
                <strong>Tier 0</strong>: regras + multiplicadores (default sem dataset)
              </p>
              <p>
                <strong>Tier 1–2</strong>: ≥500 listings × 30 dias + XGBoost ready → switch automático
              </p>
              <p>
                <strong>Tier 3</strong>: ≥5000 × 90 dias com MAPE ≤15%
              </p>
              <p>
                <strong>Tier 4 (moat)</strong>: ≥10k × 365 dias + modelo neural híbrido carregado
              </p>
            </div>
          </section>
        )}

        {/* === Dataset — origens e top listings === */}
        {dataset && (
          <section>
            <h2 className="text-xl font-bold mb-3">Dataset proprietário</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5">
                <h3 className="font-semibold mb-3">Por origem</h3>
                {dataset.byOrigin.length === 0 ? (
                  <p className="text-slate-500 text-sm">Sem snapshots ainda. O cron diário começa a popular após o próximo deploy.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {dataset.byOrigin.map((row) => (
                      <li key={row.origin} className="flex justify-between">
                        <code className="text-slate-300">{row.origin}</code>
                        <span className="font-bold text-emerald-300">{row.count.toLocaleString("pt-BR")}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-slate-500 mt-4">
                  Dias cobertos: {dataset.daysCovered}
                </p>
              </div>

              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5">
                <h3 className="font-semibold mb-3">Top listings (por volume de snapshots)</h3>
                {dataset.topListings.length === 0 ? (
                  <p className="text-slate-500 text-sm">Aguardando primeiro batch.</p>
                ) : (
                  <ul className="space-y-1 text-sm font-mono">
                    {dataset.topListings.map((row) => (
                      <li key={row.listingId} className="flex justify-between">
                        <span className="text-slate-400 truncate">{row.listingId}</span>
                        <span className="text-emerald-300">{row.snapshots}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {/* === Navegação para outras seções === */}
        <section className="border-t border-slate-800 pt-6">
          <h2 className="text-xl font-bold mb-3">Seções</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <NavCard href="/admin/finance" title="Financeiro" desc="MRR, custos, margem, custo por imóvel" />
            <NavCard href="/admin/pricing-config" title="Configurar preços" desc="Editar matriz F6.5 (4 ciclos × planos)" />
            <NavCard href="/admin/waitlist" title="Lista de Espera" desc="Pré-lançamento — gerir convites e referrals" />
            <NavCard href="/admin/users" title="Usuários" desc="Roles, ativação, busca" />
            <NavCard href="/admin/events" title="Motor de eventos" desc="Cobertura, categorias, top relevância" />
            <NavCard href="/admin/events/new" title="+ Cadastrar evento" desc="Camada 3 — curadoria manual (admin-manual)" />
            <NavCard href="/admin/events/import" title="Importar CSV de eventos" desc="Em lote — SPTuris/PMI/ABRH semestral" />
            <NavCard href="/admin/stays" title="Saúde da Stays" desc="Contas, listings, push history" />
            <NavCard href="/admin/funnel" title="Funil de produto" desc="Signup → análise → aceito → aplicado" />
            <NavCard href="/admin/quality" title="Qualidade IA + Ocupação" desc="MAPE, gate, ocupação" />
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Próximas seções planejadas: alertas Sentry, health Prefect/Scrapyd,
            dashboard de marketing GA4/Pixel, drill-down por imóvel. Ver <code>docs/runbooks/admin-evolution.md</code>.
          </p>
        </section>
      </div>
    </main>
  );
}

function NavCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a
      href={href}
      className="block p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-emerald-500/50 hover:bg-emerald-950/20 transition-colors"
    >
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-slate-400 mt-1">{desc}</p>
    </a>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-50 mt-1">{value.toLocaleString("pt-BR")}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}
