"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminAlphaDashboard,
  fetchAdminAlphaRecommendations,
  runAdminAlphaReprocess,
  type AdminAlphaDashboard,
  type AdminAlphaRecommendation,
} from "@/app/service/api";

const DEFAULT_EMAIL = "gustavo8gouveia@hotmail.com";

export default function AdminAlphaPage() {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [dashboard, setDashboard] = useState<AdminAlphaDashboard | null>(null);
  const [rows, setRows] = useState<AdminAlphaRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const load = async (targetEmail = email) => {
    setError(null);
    setLoading(true);
    try {
      const [dash, exportData] = await Promise.all([
        fetchAdminAlphaDashboard(targetEmail),
        fetchAdminAlphaRecommendations(targetEmail, 500),
      ]);
      setDashboard(dash);
      setRows(exportData.rows);
    } catch (err: any) {
      const status = err?.response?.status;
      setError(status === 403 ? "Acesso negado para este painel." : err?.message || "Erro ao carregar alpha.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(DEFAULT_EMAIL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const qualityFlags = useMemo(() => {
    if (!dashboard) return [];
    return Object.entries(dashboard.events.qualityFlags).sort((a, b) => b[1] - a[1]);
  }, [dashboard]);

  const handleExport = () => {
    const headers = [
      "property",
      "event",
      "eventDate",
      "currentPrice",
      "suggestedPrice",
      "lift",
      "status",
      "appliedPrice",
      "reservationStatus",
      "realRevenue",
      "bookedNights",
      "qualityFlags",
    ];
    const csvRows = rows.map((row) =>
      [
        row.property.title,
        row.event.name,
        row.event.startsAt,
        row.pricing.current,
        row.pricing.suggested,
        row.pricing.lift,
        row.lifecycle.status,
        row.lifecycle.appliedPrice,
        row.outcome.reservationStatus,
        row.outcome.realRevenue,
        row.outcome.bookedNights,
        row.qualityFlags.join("|"),
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `urban-alpha-${email}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReprocess = async () => {
    setRunning(true);
    setError(null);
    try {
      const run = await runAdminAlphaReprocess(email);
      setLastRun(`${run.status} - ${run.id}`);
      await load(email);
    } catch (err: any) {
      setError(err?.message || "Erro ao reprocessar alpha.");
    } finally {
      setRunning(false);
    }
  };

  if (loading && !dashboard) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <p className="text-slate-400">Carregando painel alpha...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <a href="/admin" className="text-sm text-emerald-300 hover:text-emerald-200">
              Admin
            </a>
            <h1 className="text-3xl font-bold mt-2">Painel Alpha</h1>
            <p className="text-slate-400 mt-1">KPIs reais, auditoria de recomendacoes e rotina de reprocessamento.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="h-10 w-72 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") load(email);
              }}
            />
            <button
              className="h-10 rounded-lg border border-slate-700 px-4 text-sm font-semibold hover:bg-slate-900"
              onClick={() => load(email)}
            >
              Atualizar
            </button>
            <button
              className="h-10 rounded-lg border border-emerald-500 px-4 text-sm font-semibold text-emerald-200 hover:bg-emerald-950 disabled:opacity-60"
              onClick={handleExport}
              disabled={!rows.length}
            >
              Export CSV
            </button>
            <button
              className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              onClick={handleReprocess}
              disabled={running}
            >
              {running ? "Reprocessando..." : "Reprocessar alpha"}
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-700 bg-red-950/30 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        {dashboard && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Kpi label="Imoveis alpha" value={dashboard.properties.total} sub={`${dashboard.properties.completed} completos`} />
              <Kpi label="Com preco base" value={dashboard.properties.withManualPrice} sub={`${dashboard.properties.withAverageMonthlyRevenue} com receita mensal`} />
              <Kpi label="Recomendacoes" value={dashboard.recommendations.total} sub={`${dashboard.recommendations.distinctEvents} eventos distintos`} />
              <Kpi label="Feedback capturado" value={dashboard.recommendations.feedbackCaptured} sub={`${dashboard.recommendations.booked} reservas confirmadas`} />
              <Kpi label="Preco aplicado" value={dashboard.recommendations.applied} sub={`${dashboard.recommendations.accepted} aceites`} />
              <Kpi label="Receita real" value={formatBRL(dashboard.recommendations.realRevenue)} />
              <Kpi label="Lift diario potencial" value={formatBRL(dashboard.recommendations.potentialDailyLift)} />
              <Kpi label="Eventos futuros" value={dashboard.events.upcoming} sub={`+${dashboard.events.createdLast24h} em 24h`} />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <h2 className="font-bold mb-3">Qualidade de eventos</h2>
                {qualityFlags.length ? (
                  <ul className="space-y-2 text-sm">
                    {qualityFlags.map(([flag, count]) => (
                      <li key={flag} className="flex justify-between">
                        <code className="text-slate-300">{flag}</code>
                        <span className="font-bold text-amber-300">{count.toLocaleString("pt-BR")}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-emerald-300">Sem flags nas recomendacoes atuais.</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 lg:col-span-2">
                <h2 className="font-bold mb-3">Operacao</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <Status label="Tester" value={dashboard.user.email} />
                  <Status label="Ultima leitura" value={new Date(dashboard.generatedAt).toLocaleString("pt-BR")} />
                  <Status label="Ultimo job" value={lastRun || "Sem disparo nesta sessao"} />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
                <h2 className="font-bold">Auditoria de recomendacoes</h2>
                <span className="text-xs text-slate-500">{rows.length.toLocaleString("pt-BR")} linhas</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-slate-950/60 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Imovel</th>
                      <th className="px-4 py-3 text-left">Evento</th>
                      <th className="px-4 py-3 text-right">Atual</th>
                      <th className="px-4 py-3 text-right">Sug.</th>
                      <th className="px-4 py-3 text-right">Lift</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Resultado</th>
                      <th className="px-4 py-3 text-left">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((row) => (
                      <tr key={row.id} className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-200">{row.property.title || row.property.listId}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-100">{row.event.name}</p>
                          <p className="text-xs text-slate-500">{row.event.startsAt ? new Date(row.event.startsAt).toLocaleDateString("pt-BR") : "-"}</p>
                        </td>
                        <td className="px-4 py-3 text-right">{formatBRL(row.pricing.current)}</td>
                        <td className="px-4 py-3 text-right text-emerald-300">{formatBRL(row.pricing.suggested)}</td>
                        <td className="px-4 py-3 text-right">{row.pricing.lift === null ? "-" : formatBRL(row.pricing.lift)}</td>
                        <td className="px-4 py-3">{row.lifecycle.status}</td>
                        <td className="px-4 py-3">
                          {row.outcome.reservationStatus || "pendente"}
                          {row.outcome.realRevenue ? ` / ${formatBRL(row.outcome.realRevenue)}` : ""}
                        </td>
                        <td className="px-4 py-3 text-xs text-amber-200">{row.qualityFlags.join(", ") || "ok"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-slate-200">{value}</p>
    </div>
  );
}

function formatBRL(value: number | string | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(n);
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
