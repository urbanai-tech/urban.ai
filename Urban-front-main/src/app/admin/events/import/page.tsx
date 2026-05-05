"use client";

import { useState } from "react";
import { importCsvEvents } from "../../../service/api";

/**
 * /admin/events/import — Camada 3 (F6.2 Plus): import semestral em CSV.
 *
 * Use-case: você recebe da SPTuris/PMI/ABRH/Sebrae uma planilha com 100+
 * eventos do semestre. Cola tudo num CSV (template abaixo), faz upload,
 * e o backend ingere com dedup automático.
 *
 * - Max 1000 linhas por upload (5MB)
 * - Source forçado a 'admin-csv-import' (sobrescreve qualquer source no CSV)
 * - Linhas inválidas (sem nome ou data) viram report — não derrubam o batch
 */

const CSV_TEMPLATE = `nome,dataInicio,dataFim,enderecoCompleto,cidade,estado,latitude,longitude,categoria,venueType,venueCapacity,expectedAttendance,linkSiteOficial,descricao
"RD Summit 2026","2026-10-15T08:00:00","2026-10-17T18:00:00","São Paulo Expo, SP","São Paulo","SP","-23.6258","-46.6469","conferencia","convention_center","90000","30000","https://rdsummit.com.br","Maior conferência de marketing e vendas da AL"
"Palmeiras x Santos","2026-05-10T16:00:00","","Allianz Parque","São Paulo","SP","","","esporte","stadium","43713","","",""`;

interface ImportResult {
  parsedRows: number;
  invalidRows: Array<{ line: number; reason: string }>;
  ingest: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    bySource: Record<string, { created: number; updated: number; skipped: number }>;
  };
}

export default function ImportarCsvEventos() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || submitting) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Arquivo > 5MB. Divida em partes menores.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const r = await importCsvEvents(file, sourceLabel || undefined);
      setResult(r);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Erro ao processar CSV.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "urban-ai-events-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Importar eventos via CSV</h1>
            <p className="text-sm text-slate-400">
              Camada 3 — curadoria humana em lote. Max 1000 linhas, 5MB.
              Source: <code>admin-csv-import</code> (override via campo opcional).
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <a
              href="/admin/events/new"
              className="text-xs px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800"
            >
              ← Cadastrar 1 evento
            </a>
            <a href="/admin" className="text-sm text-emerald-400 hover:underline">
              Voltar
            </a>
          </div>
        </header>

        <section className="rounded-xl border border-blue-700/40 bg-blue-950/30 p-4 text-sm text-blue-200">
          <h3 className="font-bold mb-2">Schema esperado</h3>
          <p className="text-xs mb-3">
            Cabeçalho na 1ª linha. Colunas obrigatórias: <code>nome</code>,{" "}
            <code>dataInicio</code>. Demais opcionais. Aliases aceitos:{" "}
            <code>name</code>/<code>nome</code>, <code>startdate</code>/
            <code>dataInicio</code>, <code>address</code>/<code>enderecoCompleto</code>,{" "}
            <code>lat</code>/<code>latitude</code>, etc.
          </p>
          <button
            onClick={downloadTemplate}
            className="text-xs px-3 py-1.5 rounded bg-blue-500 text-slate-900 font-bold"
          >
            Baixar template CSV
          </button>
        </section>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-6"
        >
          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">Arquivo CSV *</span>
            <input
              type="file"
              accept=".csv,text/csv"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-emerald-500 file:text-slate-900 file:font-bold file:text-xs"
            />
          </label>

          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">
              Source label (opcional — default <code>admin-csv-import</code>)
            </span>
            <input
              type="text"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              placeholder='Ex: "csv-spturis-2026q2", "csv-pmi-2026"'
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Útil pra rastrear de qual planilha veio. Aparece no painel admin
              filtrado por source.
            </p>
          </label>

          {file && (
            <div className="text-xs text-slate-400">
              Arquivo: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}

          <button
            type="submit"
            disabled={!file || submitting}
            className="px-6 py-2.5 rounded bg-emerald-500 text-slate-900 font-bold text-sm disabled:opacity-50"
          >
            {submitting ? "Processando…" : "Importar"}
          </button>
        </form>

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {result && (
          <section className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="Linhas no CSV" value={result.parsedRows} />
              <Stat label="Inválidas" value={result.invalidRows.length} color="text-amber-300" />
              <Stat label="Criados" value={result.ingest.created} color="text-emerald-300" />
              <Stat label="Atualizados" value={result.ingest.updated} color="text-blue-300" />
              <Stat label="Skipados (backend)" value={result.ingest.skipped} color="text-red-300" />
            </div>

            {result.invalidRows.length > 0 && (
              <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
                <h3 className="font-bold mb-2 text-amber-200 text-sm">Linhas inválidas</h3>
                <ul className="space-y-1 text-xs font-mono text-amber-200/80 max-h-40 overflow-y-auto">
                  {result.invalidRows.map((r, i) => (
                    <li key={i}>
                      Linha {r.line}: {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Object.keys(result.ingest.bySource).length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <h3 className="font-bold mb-2 text-sm">Resumo por source</h3>
                <table className="w-full text-xs">
                  <thead className="text-slate-400 uppercase">
                    <tr>
                      <th className="text-left px-2 py-1">Source</th>
                      <th className="text-right px-2 py-1">Criados</th>
                      <th className="text-right px-2 py-1">Atualizados</th>
                      <th className="text-right px-2 py-1">Skipados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.ingest.bySource).map(([s, agg]) => (
                      <tr key={s} className="border-t border-slate-800">
                        <td className="px-2 py-1 font-mono">{s}</td>
                        <td className="px-2 py-1 text-right text-emerald-300">{agg.created}</td>
                        <td className="px-2 py-1 text-right text-blue-300">{agg.updated}</td>
                        <td className="px-2 py-1 text-right text-red-300">{agg.skipped}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${color ?? "text-slate-50"}`}>
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}
