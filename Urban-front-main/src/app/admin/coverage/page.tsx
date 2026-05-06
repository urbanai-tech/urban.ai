"use client";

import { useEffect, useState } from "react";
import {
  fetchCoverageRegions,
  fetchCoverageStats,
  createCoverageRegion,
  updateCoverageRegion,
  deleteCoverageRegion,
  checkCoveragePoint,
  resetStaleEnrichment,
  type CoverageRegion,
  type CoverageStats,
} from "../../service/api";

/**
 * /admin/coverage — gerencia áreas de cobertura geográfica do motor de eventos.
 *
 * Modelo Híbrido:
 *  - Default: cobertura segue imóveis cadastrados (raio 80km)
 *  - Override: regiões manuais nesta tela (active / bootstrap / inactive)
 *
 * Eventos fora da cobertura ficam outOfScope=true → não enriquecem (Gemini),
 * não entram no motor, mas são preservados no DB.
 */
export default function CoverageAdminPage() {
  const [regions, setRegions] = useState<CoverageRegion[]>([]);
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Coverage check tool
  const [checkLat, setCheckLat] = useState("");
  const [checkLng, setCheckLng] = useState("");
  const [checkResult, setCheckResult] = useState<boolean | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [r, s] = await Promise.all([fetchCoverageRegions(), fetchCoverageStats()]);
      setRegions(r);
      setStats(s);
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

  async function handleCheck() {
    const lat = Number(checkLat);
    const lng = Number(checkLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      alert("lat/lng inválidos");
      return;
    }
    try {
      const r = await checkCoveragePoint(lat, lng);
      setCheckResult(r.inCoverage);
    } catch (err: any) {
      alert("Erro: " + (err?.message || "falhou"));
    }
  }

  async function handleResetStale() {
    if (!confirm("Resetar eventos com relevancia=0 (bug antigo) para re-tentativa? Pode levar tempo no próximo cron.")) return;
    try {
      const r = await resetStaleEnrichment();
      alert(`OK — ${r.reset} eventos marcados pra re-tentativa.`);
    } catch (err: any) {
      alert("Erro: " + (err?.message || "falhou"));
    }
  }

  async function handleDelete(r: CoverageRegion) {
    if (!confirm(`Remover região "${r.name}"?`)) return;
    setBusyId(r.id);
    try {
      await deleteCoverageRegion(r.id);
      load();
    } catch (err: any) {
      alert("Erro: " + (err?.message || "falhou"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusChange(r: CoverageRegion, newStatus: CoverageRegion["status"]) {
    setBusyId(r.id);
    try {
      await updateCoverageRegion(r.id, { status: newStatus });
      load();
    } catch (err: any) {
      alert("Erro: " + (err?.message || "falhou"));
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <div className="max-w-2xl p-6 border border-red-700 rounded bg-red-950/30">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cobertura geográfica</h1>
            <p className="text-sm text-slate-400">
              Modelo híbrido — eventos entram no motor se estão dentro de raio
              de imóveis cadastrados <strong>OU</strong> dentro de uma região
              configurada aqui.
            </p>
          </div>
          <a href="/admin" className="text-sm text-emerald-400 hover:underline">
            ← Voltar
          </a>
        </header>

        {/* Stats */}
        {stats && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Regiões ativas" value={stats.activeRegions} />
            <Stat
              label="Bootstrap (pré-aquecimento)"
              value={stats.bootstrapRegions}
              color="text-amber-300"
            />
            <Stat label="Imóveis cadastrados" value={stats.addresses} />
            <Stat label="Raio por imóvel (km)" value={stats.addressRadiusKm} />
          </section>
        )}

        {/* Quick coverage check tool */}
        <section className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
          <h3 className="text-sm font-bold mb-2">Testar ponto</h3>
          <p className="text-xs text-slate-500 mb-3">
            Útil pra debugar: cole lat/lng e veja se ficaria dentro da cobertura.
          </p>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="number"
              step="0.0001"
              placeholder="latitude (-23.5275)"
              value={checkLat}
              onChange={(e) => setCheckLat(e.target.value)}
              className="flex-1 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
            />
            <input
              type="number"
              step="0.0001"
              placeholder="longitude (-46.6783)"
              value={checkLng}
              onChange={(e) => setCheckLng(e.target.value)}
              className="flex-1 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
            />
            <button
              onClick={handleCheck}
              className="px-4 py-2 rounded bg-emerald-500 text-slate-900 font-bold text-sm"
            >
              Testar
            </button>
            {checkResult !== null && (
              <span
                className={`text-sm font-bold flex items-center px-3 ${
                  checkResult ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {checkResult ? "✓ DENTRO" : "✗ FORA"}
              </span>
            )}
          </div>
        </section>

        {/* Regiões */}
        <section>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Regiões configuradas</h2>
            <div className="flex gap-2">
              <button
                onClick={handleResetStale}
                className="text-xs px-3 py-1.5 rounded border border-amber-700 text-amber-300 hover:bg-amber-950/30"
                title="Reseta eventos com relevancia=0 (bug antigo) pra re-tentativa Gemini"
              >
                Reset retroativo enrichment
              </button>
              <button
                onClick={() => setShowNew((v) => !v)}
                className="text-xs px-3 py-1.5 rounded bg-emerald-500 text-slate-900 font-bold"
              >
                {showNew ? "Cancelar" : "+ Nova região"}
              </button>
            </div>
          </header>

          {showNew && (
            <NewRegionForm
              onCreated={() => {
                setShowNew(false);
                load();
              }}
            />
          )}

          <div className="border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Geometria</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                      Carregando…
                    </td>
                  </tr>
                ) : regions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500 text-xs">
                      Nenhuma região configurada. Cobertura cai 100% em imóveis cadastrados.
                    </td>
                  </tr>
                ) : (
                  regions.map((r) => (
                    <tr key={r.id} className="border-t border-slate-800">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.name}</div>
                        {r.notes && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {r.notes.slice(0, 80)}
                            {r.notes.length > 80 && "…"}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={r.status}
                          onChange={(e) =>
                            handleStatusChange(r, e.target.value as CoverageRegion["status"])
                          }
                          disabled={busyId === r.id}
                          className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700"
                        >
                          <option value="active">active</option>
                          <option value="bootstrap">bootstrap</option>
                          <option value="inactive">inactive</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-400">
                        {r.centerLat !== null && r.radiusKm !== null
                          ? `(${r.centerLat}, ${r.centerLng}) raio ${r.radiusKm}km`
                          : `bbox [${r.minLat}..${r.maxLat}, ${r.minLng}..${r.maxLng}]`}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleDelete(r)}
                          disabled={busyId === r.id}
                          className="text-xs px-2 py-1 rounded border border-red-700/40 text-red-300 hover:bg-red-950/30"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? "text-slate-50"}`}>
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

function NewRegionForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"circle" | "bbox">("circle");
  const [centerLat, setCenterLat] = useState("");
  const [centerLng, setCenterLng] = useState("");
  const [radiusKm, setRadiusKm] = useState("80");
  const [minLat, setMinLat] = useState("");
  const [maxLat, setMaxLat] = useState("");
  const [minLng, setMinLng] = useState("");
  const [maxLng, setMaxLng] = useState("");
  const [status, setStatus] = useState<"active" | "bootstrap" | "inactive">("active");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload =
        mode === "circle"
          ? {
              name,
              status,
              notes: notes || null,
              centerLat: Number(centerLat),
              centerLng: Number(centerLng),
              radiusKm: Number(radiusKm),
            }
          : {
              name,
              status,
              notes: notes || null,
              minLat: Number(minLat),
              maxLat: Number(maxLat),
              minLng: Number(minLng),
              maxLng: Number(maxLng),
            };
      await createCoverageRegion(payload);
      onCreated();
    } catch (err: any) {
      alert("Erro: " + (err?.response?.data?.message || err?.message || "falhou"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-3 p-4 rounded-xl border border-emerald-800/40 bg-emerald-950/20 space-y-3 text-sm"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <input
          placeholder="Nome (ex: Rio Metropolitano)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="md:col-span-2 px-3 py-2 rounded bg-slate-800 border border-slate-700"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="px-3 py-2 rounded bg-slate-800 border border-slate-700"
        >
          <option value="active">active</option>
          <option value="bootstrap">bootstrap</option>
          <option value="inactive">inactive</option>
        </select>
      </div>

      <div className="flex gap-3 text-xs">
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === "circle"}
            onChange={() => setMode("circle")}
          />{" "}
          Centro + raio
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === "bbox"}
            onChange={() => setMode("bbox")}
          />{" "}
          Bounding box
        </label>
      </div>

      {mode === "circle" ? (
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            step="0.0001"
            placeholder="centerLat (-23.5505)"
            value={centerLat}
            onChange={(e) => setCenterLat(e.target.value)}
            required
            className="px-3 py-2 rounded bg-slate-800 border border-slate-700"
          />
          <input
            type="number"
            step="0.0001"
            placeholder="centerLng (-46.6333)"
            value={centerLng}
            onChange={(e) => setCenterLng(e.target.value)}
            required
            className="px-3 py-2 rounded bg-slate-800 border border-slate-700"
          />
          <input
            type="number"
            placeholder="radiusKm (80)"
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
            required
            className="px-3 py-2 rounded bg-slate-800 border border-slate-700"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input
            type="number"
            step="0.0001"
            placeholder="minLat"
            value={minLat}
            onChange={(e) => setMinLat(e.target.value)}
            required
            className="px-3 py-2 rounded bg-slate-800 border border-slate-700"
          />
          <input
            type="number"
            step="0.0001"
            placeholder="maxLat"
            value={maxLat}
            onChange={(e) => setMaxLat(e.target.value)}
            required
            className="px-3 py-2 rounded bg-slate-800 border border-slate-700"
          />
          <input
            type="number"
            step="0.0001"
            placeholder="minLng"
            value={minLng}
            onChange={(e) => setMinLng(e.target.value)}
            required
            className="px-3 py-2 rounded bg-slate-800 border border-slate-700"
          />
          <input
            type="number"
            step="0.0001"
            placeholder="maxLng"
            value={maxLng}
            onChange={(e) => setMaxLng(e.target.value)}
            required
            className="px-3 py-2 rounded bg-slate-800 border border-slate-700"
          />
        </div>
      )}

      <textarea
        rows={2}
        placeholder="Notas (justificativa, plano de expansão, etc.)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-xs"
      />

      <button
        type="submit"
        disabled={busy}
        className="px-5 py-2 rounded bg-emerald-500 text-slate-900 font-bold disabled:opacity-50"
      >
        {busy ? "Salvando…" : "Criar região"}
      </button>
    </form>
  );
}
