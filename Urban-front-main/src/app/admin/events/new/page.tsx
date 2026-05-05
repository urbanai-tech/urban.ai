"use client";

import { useState } from "react";
import {
  createManualEvent,
  fetchGeocoderStatus,
  runGeocoderNow,
  type ManualEventInput,
} from "../../../service/api";

/**
 * /admin/events/new — Camada 3 (F6.2 Plus): cadastro manual de eventos.
 *
 * Use-case típico: você ouviu falar de um evento crítico que ainda não está
 * coberto pelos coletores (ex: Web Summit Rio, Bett Brasil, conferência
 * setorial específica) e quer garantir que está no DB pra a IA ponderar.
 *
 * Source forçado a 'admin-manual'. Dedup automático via dedupHash — se
 * outro coletor já cadastrou o mesmo evento, este faz UPSERT conservador
 * (não sobrescreve campos já preenchidos pela IA).
 */

const VENUE_TYPES = [
  { value: "", label: "(automático via venue_map)" },
  { value: "stadium", label: "Estádio" },
  { value: "arena", label: "Arena/Casa de show" },
  { value: "convention_center", label: "Centro de convenções" },
  { value: "theater", label: "Teatro" },
  { value: "park", label: "Parque/outdoor" },
  { value: "other", label: "Outro" },
];

const CATEGORIAS = [
  "",
  "show",
  "esporte",
  "conferencia",
  "feira",
  "festival",
  "teatro",
  "cinema",
  "exposicao",
  "curso",
  "religioso",
  "outro",
];

export default function NovoEventoManual() {
  const [form, setForm] = useState<ManualEventInput>({
    nome: "",
    dataInicio: "",
    cidade: "São Paulo",
    estado: "SP",
  });
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    status: "created" | "updated" | "skipped";
    reason?: string;
    id?: string;
    dedupHash?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geocoderQueue, setGeocoderQueue] = useState<number | null>(null);

  function patch<K extends keyof ManualEventInput>(key: K, value: ManualEventInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setLastResult(null);
    try {
      const r = await createManualEvent({
        ...form,
        latitude:
          form.latitude !== undefined && form.latitude !== null && !Number.isNaN(Number(form.latitude))
            ? Number(form.latitude)
            : undefined,
        longitude:
          form.longitude !== undefined && form.longitude !== null && !Number.isNaN(Number(form.longitude))
            ? Number(form.longitude)
            : undefined,
        venueCapacity: form.venueCapacity ? Number(form.venueCapacity) : undefined,
        expectedAttendance: form.expectedAttendance ? Number(form.expectedAttendance) : undefined,
      });
      setLastResult(r.results[0] ?? null);
      // Atualiza fila do geocoder pra mostrar se entrou pendente
      try {
        const g = await fetchGeocoderStatus();
        setGeocoderQueue(g.pendingGeocode);
      } catch {}
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Erro ao cadastrar.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setForm({ nome: "", dataInicio: "", cidade: "São Paulo", estado: "SP" });
    setLastResult(null);
    setError(null);
  }

  async function triggerGeocoder() {
    try {
      const r = await runGeocoderNow(50);
      alert(`Geocoder: tentou ${r.attempted}, sucesso ${r.succeeded}, falhou ${r.failed}`);
      const g = await fetchGeocoderStatus();
      setGeocoderQueue(g.pendingGeocode);
    } catch (err: any) {
      alert("Erro: " + (err?.message || "falhou"));
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Novo evento (manual)</h1>
            <p className="text-sm text-slate-400">
              Camada 3 — curadoria humana. Source: <code>admin-manual</code>.
              Lat/lng opcional (backend geocodifica via cron quando ausente).
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <a
              href="/admin/events/import"
              className="text-xs px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800"
            >
              Importar CSV →
            </a>
            <a href="/admin" className="text-sm text-emerald-400 hover:underline">
              ← Voltar
            </a>
          </div>
        </header>

        {/* Resultado */}
        {lastResult && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              lastResult.status === "created"
                ? "border-emerald-700/40 bg-emerald-950/30 text-emerald-200"
                : lastResult.status === "updated"
                ? "border-amber-700/40 bg-amber-950/30 text-amber-200"
                : "border-red-700/40 bg-red-950/30 text-red-200"
            }`}
          >
            <strong>{lastResult.status.toUpperCase()}</strong>
            {lastResult.id && (
              <span className="ml-2 font-mono text-xs">{lastResult.id}</span>
            )}
            {lastResult.reason && <span className="ml-2">— {lastResult.reason}</span>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={reset}
                className="text-xs px-3 py-1.5 rounded bg-emerald-500 text-slate-900 font-bold"
              >
                + Cadastrar outro
              </button>
              <a
                href="/admin/events"
                className="text-xs px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800"
              >
                Ver todos
              </a>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <Field label="Nome *" required>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => patch("nome", e.target.value)}
              required
              maxLength={255}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              placeholder='Ex: "Web Summit Rio 2026"'
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Data início *" required>
              <input
                type="datetime-local"
                value={form.dataInicio}
                onChange={(e) => patch("dataInicio", e.target.value)}
                required
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              />
            </Field>

            <Field label="Data fim (opcional)">
              <input
                type="datetime-local"
                value={form.dataFim ?? ""}
                onChange={(e) => patch("dataFim", e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              />
            </Field>
          </div>

          <Field label="Endereço completo (recomendado)">
            <input
              type="text"
              value={form.enderecoCompleto ?? ""}
              onChange={(e) => patch("enderecoCompleto", e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              placeholder='Ex: "Allianz Parque - Av. Francisco Matarazzo, 1705"'
            />
            <p className="text-xs text-slate-500 mt-1">
              Quando lat/lng abaixo estiver vazio, o backend usa o endereço pra geocodificar via cron (a cada 30 min).
            </p>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Cidade">
              <input
                type="text"
                value={form.cidade ?? ""}
                onChange={(e) => patch("cidade", e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              />
            </Field>

            <Field label="UF">
              <input
                type="text"
                value={form.estado ?? ""}
                onChange={(e) => patch("estado", e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Latitude (opcional)">
              <input
                type="number"
                step="0.000001"
                value={form.latitude ?? ""}
                onChange={(e) =>
                  patch("latitude", e.target.value === "" ? null : Number(e.target.value))
                }
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                placeholder="-23.5275"
              />
            </Field>

            <Field label="Longitude (opcional)">
              <input
                type="number"
                step="0.000001"
                value={form.longitude ?? ""}
                onChange={(e) =>
                  patch("longitude", e.target.value === "" ? null : Number(e.target.value))
                }
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                placeholder="-46.6783"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Categoria">
              <select
                value={form.categoria ?? ""}
                onChange={(e) => patch("categoria", e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c || "(sem categoria)"}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tipo do venue">
              <select
                value={form.venueType ?? ""}
                onChange={(e) => patch("venueType", e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              >
                {VENUE_TYPES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Capacidade do venue">
              <input
                type="number"
                value={form.venueCapacity ?? ""}
                onChange={(e) =>
                  patch("venueCapacity", e.target.value === "" ? null : Number(e.target.value))
                }
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
                placeholder="Ex: 43000"
              />
            </Field>
          </div>

          <Field label="Público esperado deste evento">
            <input
              type="number"
              value={form.expectedAttendance ?? ""}
              onChange={(e) =>
                patch("expectedAttendance", e.target.value === "" ? null : Number(e.target.value))
              }
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              placeholder="Ex: 38000 (pode ser menor que capacidade)"
            />
          </Field>

          <Field label="Link do site oficial">
            <input
              type="url"
              value={form.linkSiteOficial ?? ""}
              onChange={(e) => patch("linkSiteOficial", e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              placeholder="https://..."
            />
          </Field>

          <Field label="URL da imagem">
            <input
              type="url"
              value={form.imagemUrl ?? ""}
              onChange={(e) => patch("imagemUrl", e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              placeholder="https://..."
            />
          </Field>

          <Field label="Descrição">
            <textarea
              rows={4}
              value={form.descricao ?? ""}
              onChange={(e) => patch("descricao", e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
              placeholder="Resumo do evento — vai pro card no painel admin e ajuda a IA a inferir relevância."
            />
          </Field>

          <div className="flex justify-between items-center pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded bg-emerald-500 text-slate-900 font-bold text-sm disabled:opacity-50"
            >
              {submitting ? "Salvando…" : "Salvar evento"}
            </button>

            <span className="text-xs text-slate-500">
              {geocoderQueue !== null && (
                <>
                  Fila geocoder: <strong>{geocoderQueue}</strong>
                  <button
                    onClick={triggerGeocoder}
                    type="button"
                    className="ml-3 text-xs px-2 py-1 rounded border border-slate-700 hover:bg-slate-800"
                  >
                    Rodar agora
                  </button>
                </>
              )}
            </span>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      {children}
    </label>
  );
}
