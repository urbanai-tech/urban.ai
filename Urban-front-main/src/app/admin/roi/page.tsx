"use client";

import { useEffect, useState } from "react";
import { fetchAdminRoi, type AdminRoiOverview } from "../../service/api";

const WINDOWS = [30, 90, 180, 365];

export default function AdminRoiPage() {
  const [data, setData] = useState<AdminRoiOverview | null>(null);
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(days = windowDays) {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminRoi({ windowDays: days, limit: 50 }));
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
  }, []);

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <p className="text-slate-400">Carregando ROI dos anfitriões...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <div className="max-w-2xl p-6 border border-red-700 rounded bg-red-950/30">
          {error ?? "Não foi possível carregar o painel."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">ROI dos anfitriões</h1>
            <p className="text-sm text-slate-400">
              Dinheiro atribuído à Urban AI, custo da assinatura e retorno por usuário.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={windowDays}
              onChange={(event) => {
                const days = Number(event.target.value);
                setWindowDays(days);
                load(days);
              }}
              className="text-sm bg-slate-900 border border-slate-700 rounded px-3 py-2"
            >
              {WINDOWS.map((days) => (
                <option key={days} value={days}>
                  Últimos {days} dias
                </option>
              ))}
            </select>
            <button
              onClick={() => load()}
              disabled={loading}
              className="text-sm px-3 py-2 rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-50"
            >
              Atualizar
            </button>
            <a href="/admin" className="text-sm text-emerald-400 hover:underline">
              Voltar
            </a>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Kpi label="Gerado para anfitriões" value={fmt(data.totals.totalAttributedCents)} sub={`${fmt(data.totals.confirmedIncrementalCents)} confirmado`} tone="green" />
          <Kpi label="ROI médio" value={data.totals.roiMultiple ? `${data.totals.roiMultiple.toFixed(1)}x` : "sem custo"} sub={data.totals.roiPercent != null ? `${data.totals.roiPercent.toFixed(0)}% líquido` : undefined} tone="blue" />
          <Kpi label="Valor líquido" value={fmt(data.totals.netValueCents)} sub={`Custo: ${fmt(data.totals.subscriptionCostCents)}`} tone={data.totals.netValueCents >= 0 ? "green" : "amber"} />
          <Kpi label="Noites impactadas" value={data.totals.impactedNights.toLocaleString("pt-BR")} sub={`${data.totals.users} usuário(s) no ranking`} />
          <Kpi label="Potencial perdido" value={fmt(data.totals.potentialLostCents)} sub="sugestões não aplicadas" tone="amber" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 border border-slate-800 rounded-xl bg-slate-900/40 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Anfitrião</th>
                  <th className="px-4 py-3 text-right">Gerado</th>
                  <th className="px-4 py-3 text-right">ROI</th>
                  <th className="px-4 py-3 text-right">Assinatura</th>
                  <th className="px-4 py-3 text-right">Aplicadas</th>
                  <th className="px-4 py-3 text-right">Confiança</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Nenhum dado de ROI no período.
                    </td>
                  </tr>
                ) : (
                  data.leaderboard.map((row) => (
                    <tr key={row.user.id} className="border-t border-slate-800">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-100">{row.user.username}</p>
                        <p className="text-xs text-slate-500">{row.user.email}</p>
                        <p className="text-xs text-slate-500">{row.activeListings} imóvel(is) ativo(s)</p>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-300 font-bold">
                        {fmt(row.money.totalAttributedCents)}
                        <p className="text-[10px] text-slate-500 font-normal">
                          {fmt(row.money.projectedIncrementalCents)} acompanhando
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.money.roiMultiple ? `${row.money.roiMultiple.toFixed(1)}x` : "-"}
                        <p className="text-[10px] text-slate-500">{row.money.roiPercent != null ? `${row.money.roiPercent.toFixed(0)}%` : ""}</p>
                      </td>
                      <td className="px-4 py-3 text-right">{fmt(row.subscription.monthlyCostCents)}</td>
                      <td className="px-4 py-3 text-right">
                        {row.activity.applied}/{row.activity.recommendations}
                        <p className="text-[10px] text-slate-500">{row.activity.impactedNights} noites</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs px-2 py-1 rounded ${confidenceClass(row.dataQuality.confidence)}`}>
                          {row.dataQuality.label}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5">
            <h2 className="text-lg font-bold">Como o painel calcula</h2>
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <Rule title="Dinheiro gerado" body="Diferença positiva entre preço aplicado e preço anterior, multiplicada pelas noites impactadas." />
              <Rule title="Confirmado" body="Quando há reserva ou receita real vinculada à recomendação aplicada." />
              <Rule title="Em acompanhamento" body="Quando o preço foi aplicado, mas ainda falta confirmar se virou reserva." />
              <Rule title="Potencial perdido" body="Valor das recomendações com aumento positivo que não foram aceitas ou aplicadas." />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "green" | "blue" | "amber" | "slate";
}) {
  const color =
    tone === "green"
      ? "text-emerald-300"
      : tone === "blue"
        ? "text-blue-300"
        : tone === "amber"
          ? "text-amber-300"
          : "text-slate-50";
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-semibold text-slate-100">{title}</p>
      <p className="text-slate-400 text-xs mt-1">{body}</p>
    </div>
  );
}

function confidenceClass(confidence: "high" | "medium" | "low") {
  if (confidence === "high") return "bg-emerald-500/20 text-emerald-300";
  if (confidence === "medium") return "bg-amber-500/20 text-amber-300";
  return "bg-slate-700 text-slate-300";
}
