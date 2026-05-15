"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminJobRuns,
  fetchAdminDatasetDiagnostics,
  fetchGeocoderStatus,
  runAdminDatasetSnapshot,
  runAdminEventProximitySnapshot,
  runAdminGeocoderJob,
  runAdminResetStaleEnrichmentJob,
  type AdminJobRunResponse,
} from "../../service/api";

export default function AdminJobsPage() {
  const [pendingGeocode, setPendingGeocode] = useState<number | null>(null);
  const [datasetHealth, setDatasetHealth] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<AdminJobRunResponse | null>(null);
  const [history, setHistory] = useState<AdminJobRunResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    try {
      const status = await fetchGeocoderStatus();
      setPendingGeocode(status.pendingGeocode);
      const dataset = await fetchAdminDatasetDiagnostics();
      setDatasetHealth(`${dataset.health} / ${dataset.readiness}`);
      const runs = await fetchAdminJobRuns(8);
      setHistory(runs);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Erro ao carregar status.");
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function runJob(name: string, handler: () => Promise<AdminJobRunResponse>) {
    if (running) return;
    setRunning(name);
    setResult(null);
    setError(null);
    try {
      const details = await handler();
      setResult(details);
      await loadStatus();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Falha ao executar job.");
      await loadStatus();
    } finally {
      setRunning(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Jobs operacionais</h1>
            <p className="text-sm text-slate-400">
              Acoes seguras para operar eventos e readiness sem abrir terminal.
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <button
              onClick={loadStatus}
              className="px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800"
            >
              Atualizar status
            </button>
            <a href="/admin" className="px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800">
              Voltar
            </a>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <JobCard
            title="Geocoder de eventos"
            status={pendingGeocode === null ? "carregando" : `${pendingGeocode} pendentes`}
            description="Processa eventos importados sem latitude/longitude usando o geocoder do backend."
            disabled={!!running}
            running={running === "geocoder"}
            actionLabel="Rodar geocoder"
            onRun={() => runJob("geocoder", () => runAdminGeocoderJob(50))}
          />

          <JobCard
            title="Reset enrichment stale"
            status="manual"
            description="Libera eventos presos com relevancia antiga/zerada para nova tentativa de enriquecimento."
            disabled={!!running}
            running={running === "reset-stale-enrichment"}
            actionLabel="Resetar stale"
            onRun={() => runJob("reset-stale-enrichment", runAdminResetStaleEnrichmentJob)}
          />

          <JobCard
            title="Snapshot de dataset"
            status={datasetHealth ?? "carregando"}
            description="Captura o preco atual dos imoveis cadastrados para alimentar serie temporal e readiness."
            disabled={!!running}
            running={running === "dataset-snapshot"}
            actionLabel="Rodar snapshot"
            onRun={() => runJob("dataset-snapshot", runAdminDatasetSnapshot)}
          />

          <JobCard
            title="Features de eventos"
            status={datasetHealth ?? "carregando"}
            description="Gera snapshots de proximidade a eventos por imovel para alimentar o dataset evolutivo."
            disabled={!!running}
            running={running === "event-proximity-snapshot"}
            actionLabel="Gerar features"
            onRun={() => runJob("event-proximity-snapshot", runAdminEventProximitySnapshot)}
          />

          <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Atalhos</p>
            <h2 className="text-lg font-semibold mt-1">Operacao de eventos</h2>
            <div className="mt-4 space-y-2 text-sm">
              <a className="block text-blue-300 hover:underline" href="/admin/events/new">
                Cadastrar evento manual
              </a>
              <a className="block text-blue-300 hover:underline" href="/admin/events/import">
                Importar CSV de eventos
              </a>
              <a className="block text-blue-300 hover:underline" href="/admin/collectors-health">
                Ver saude dos coletores
              </a>
              <a className="block text-blue-300 hover:underline" href="/admin/dashboard">
                Ver dashboard executivo
              </a>
            </div>
          </div>
        </section>

        {result && (
          <section className="border border-slate-800 rounded-xl bg-slate-900/40 p-5">
            <header className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Ultima execucao</p>
                <h2 className="text-lg font-semibold">{result.name}</h2>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  result.status === "success"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-red-500/20 text-red-300"
                }`}
              >
                {result.status}
              </span>
            </header>
            <p className="text-xs text-slate-500 mb-3">
              Inicio {new Date(result.startedAt).toLocaleString("pt-BR")} - fim{" "}
              {result.finishedAt ? new Date(result.finishedAt).toLocaleString("pt-BR") : "em andamento"}
              {typeof result.durationMs === "number" ? ` - ${result.durationMs}ms` : ""}
            </p>
            <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 border border-slate-800 p-3 text-xs text-slate-300">
              {JSON.stringify(result.result ?? { error: result.errorMessage }, null, 2)}
            </pre>
          </section>
        )}

        <section className="border border-slate-800 rounded-xl bg-slate-900/40 p-5">
          <header className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Historico</p>
              <h2 className="text-lg font-semibold">Ultimos jobs admin</h2>
            </div>
            <button
              onClick={loadStatus}
              className="px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800 text-sm"
            >
              Recarregar
            </button>
          </header>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma execucao registrada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 text-left">Job</th>
                    <th className="py-2 text-left">Status</th>
                    <th className="py-2 text-left">Inicio</th>
                    <th className="py-2 text-right">Duracao</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((run) => (
                    <tr key={run.id} className="border-t border-slate-800">
                      <td className="py-2 pr-3 font-mono text-slate-300">{run.name}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            run.status === "success"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : run.status === "error"
                                ? "bg-red-500/20 text-red-300"
                                : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-400">
                        {new Date(run.startedAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2 text-right text-slate-400">
                        <button
                          type="button"
                          onClick={() => setResult(run)}
                          className="mr-3 text-blue-300 hover:underline"
                        >
                          Ver resultado
                        </button>
                        {typeof run.durationMs === "number" ? `${run.durationMs}ms` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-4">
          Jobs destrutivos, billing e Stays ficam fora daqui ate terem confirmacao operacional dedicada.
        </section>
      </div>
    </main>
  );
}

function JobCard({
  title,
  status,
  description,
  actionLabel,
  disabled,
  running,
  onRun,
}: {
  title: string;
  status: string;
  description: string;
  actionLabel: string;
  disabled: boolean;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5 flex flex-col">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500">{status}</p>
        <h2 className="text-lg font-semibold mt-1">{title}</h2>
      </div>
      <p className="text-sm text-slate-400 mt-3 flex-1">{description}</p>
      <button
        onClick={onRun}
        disabled={disabled}
        className="mt-5 px-4 py-2 rounded bg-emerald-500 text-slate-950 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running ? "Executando..." : actionLabel}
      </button>
    </div>
  );
}
