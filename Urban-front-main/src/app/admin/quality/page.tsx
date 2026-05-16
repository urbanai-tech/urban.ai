"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchAdminPricingQuality,
  fetchAdminOccupancy,
  fetchAdminOccupancyProperties,
  upsertAdminManualOccupancy,
  type AdminOccupancyProperty,
  type AdminPricingQuality,
  type AdminOccupancyCoverage,
} from "../../service/api";

type OccupancyStatus = "booked" | "available" | "blocked" | "unknown";

const statusOptions: Array<{ value: OccupancyStatus; label: string }> = [
  { value: "available", label: "Disponivel" },
  { value: "booked", label: "Reservado" },
  { value: "blocked", label: "Bloqueado" },
  { value: "unknown", label: "Desconhecido" },
];

export default function AdminQualityPage() {
  const [quality, setQuality] = useState<AdminPricingQuality | null>(null);
  const [occupancy, setOccupancy] = useState<AdminOccupancyCoverage | null>(null);
  const [properties, setProperties] = useState<AdminOccupancyProperty[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recordStatus, setRecordStatus] = useState<OccupancyStatus>("available");
  const [listedPrice, setListedPrice] = useState("");
  const [realRevenue, setRealRevenue] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.listId === selectedListId) ?? null,
    [properties, selectedListId],
  );

  useEffect(() => {
    Promise.all([
      fetchAdminPricingQuality(),
      fetchAdminOccupancy(),
      fetchAdminOccupancyProperties(),
    ])
      .then(([q, o, p]) => {
        setQuality(q);
        setOccupancy(o);
        setProperties(p);
        const first = p[0];
        if (first) {
          setSelectedListId(first.listId);
          setListedPrice(formatMoneyInput(first.manualDailyPrice ?? first.dailyPrice));
        }
      })
      .catch((err) => {
        const status = err?.response?.status;
        setError(status === 401 || status === 403 ? "Acesso negado." : err?.message || "Erro");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProperty) return;
    setListedPrice(formatMoneyInput(selectedProperty.manualDailyPrice ?? selectedProperty.dailyPrice));
  }, [selectedProperty]);

  async function refreshOccupancy() {
    const [coverage, propertyList] = await Promise.all([
      fetchAdminOccupancy(),
      fetchAdminOccupancyProperties(),
    ]);
    setOccupancy(coverage);
    setProperties(propertyList);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedListId) {
      setSaveMessage("Selecione um imovel.");
      return;
    }
    if (!recordDate) {
      setSaveMessage("Informe a data observada.");
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      const listedPriceCents = moneyToCents(listedPrice);
      const revenueCents = moneyToCents(realRevenue);
      const result = await upsertAdminManualOccupancy({
        listId: selectedListId,
        date: recordDate,
        status: recordStatus,
        listedPriceCents,
        revenueCents,
        currency: "BRL",
      });
      await refreshOccupancy();
      setSaveMessage(
        `Registro ${result.status} salvo para ${recordDate}. Training: ${
          result.trainingReady ? "pronto" : "fora do treino"
        }.`,
      );
    } catch (err: any) {
      setSaveMessage(err?.response?.data?.message || err?.message || "Erro ao salvar ocupacao.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-slate-50">
        <p>Carregando...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-slate-50">
        <div className="max-w-2xl rounded border border-red-700 bg-red-950/30 p-6">{error}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-50">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Qualidade da IA + Ocupacao</h1>
            <p className="text-sm text-slate-400">
              MAPE sobre preco aplicado real e cobertura de historico de ocupacao.
            </p>
          </div>
          <a href="/admin" className="text-sm text-emerald-400 hover:underline">
            Voltar
          </a>
        </header>

        {quality && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="mb-4 text-lg font-bold">
              Backtest MAPE (ultimos {quality.windowDays} dias)
            </h2>

            {quality.sampleSize === 0 ? (
              <div className="rounded border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">
                Sem dados de preco aplicado real ainda. O ground truth comeca a entrar quando
                anfitrioes confirmarem o preco aplicado ou quando o push automatico Stays gravar
                o resultado. Janela: {quality.windowDays} dias.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Kpi
                  label="MAPE"
                  value={quality.mapePercent != null ? `${quality.mapePercent}%` : "-"}
                  sub={`alvo <= ${quality.qualityGate.threshold}%`}
                />
                <Kpi label="RMSE" value={quality.rmse != null ? `R$ ${quality.rmse}` : "-"} />
                <Kpi
                  label="Erro mediano"
                  value={
                    quality.medianAbsoluteError != null
                      ? `R$ ${quality.medianAbsoluteError}`
                      : "-"
                  }
                />
                <Kpi
                  label="Amostras"
                  value={quality.sampleSize}
                  sub={quality.discarded > 0 ? `${quality.discarded} descartadas` : undefined}
                />
              </div>
            )}

            <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm">
              <strong className={quality.qualityGate.passes ? "text-emerald-300" : "text-amber-300"}>
                Gate de qualidade: {quality.qualityGate.passes ? "aprovado" : "ainda nao atingido"}
              </strong>
              <p className="mt-1 text-xs text-slate-400">
                Criterio: MAPE {"<="} {quality.qualityGate.threshold}% AND amostras {">="} 30.
                {!quality.qualityGate.meetsMinSample && " Falta amostragem minima."}
              </p>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-start">
            <div>
              <h2 className="text-lg font-bold">Cobertura de ocupacao</h2>
              <p className="text-xs text-slate-400">
                Listings distintos com historico: <strong>{occupancy?.distinctListings ?? 0}</strong>
              </p>
            </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
              {properties.length} imoveis elegiveis
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Por status</h3>
              {!occupancy || occupancy.byStatus.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Sem registros. Use o apontamento manual abaixo para iniciar o historico real.
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {occupancy.byStatus.map((row) => (
                    <li key={row.status} className="flex justify-between">
                      <code className="text-slate-300">{row.status}</code>
                      <span className="font-bold">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Por origem</h3>
              {!occupancy || occupancy.byOrigin.length === 0 ? (
                <p className="text-xs text-slate-500">Sem origens registradas ainda.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {occupancy.byOrigin.map((row) => (
                    <li key={row.origin} className="flex justify-between">
                      <code className="text-slate-300">{row.origin}</code>
                      <span className="font-bold">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-bold">Apontamento manual de ocupacao</h2>
          <p className="mt-1 text-xs text-slate-400">
            Use para registrar observacoes reais do alpha: disponibilidade, reserva, diaria
            anunciada e receita realizada por dia. Registros booked/available entram no treino.
          </p>

          <form className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold uppercase text-slate-500">Imovel</span>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={selectedListId}
                onChange={(event) => {
                  setSelectedListId(event.target.value);
                  setSaveMessage(null);
                }}
              >
                {properties.length === 0 && <option value="">Nenhum imovel elegivel</option>}
                {properties.map((property) => (
                  <option key={property.listId} value={property.listId}>
                    {property.title || property.airbnbListingId || property.listId}
                    {property.userEmail ? ` - ${property.userEmail}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-slate-500">Data observada</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                type="date"
                value={recordDate}
                onChange={(event) => setRecordDate(event.target.value)}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={recordStatus}
                onChange={(event) => setRecordStatus(event.target.value as OccupancyStatus)}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-slate-500">Diaria anunciada</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                inputMode="decimal"
                placeholder="150,00"
                value={listedPrice}
                onChange={(event) => setListedPrice(event.target.value)}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-slate-500">Receita real do dia</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                inputMode="decimal"
                placeholder="150,00"
                value={realRevenue}
                onChange={(event) => setRealRevenue(event.target.value)}
              />
            </label>

            {selectedProperty && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400 md:col-span-2">
                <strong className="text-slate-300">{selectedProperty.title || "Imovel sem titulo"}</strong>
                <span className="ml-2">
                  {selectedProperty.city || "cidade n/d"} / {selectedProperty.state || "UF n/d"}
                </span>
                <span className="ml-2">
                  Receita media mensal:{" "}
                  {selectedProperty.averageMonthlyRevenue != null
                    ? `R$ ${selectedProperty.averageMonthlyRevenue}`
                    : "n/d"}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:items-center">
              <button
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving || properties.length === 0}
                type="submit"
              >
                {saving ? "Salvando..." : "Salvar ocupacao"}
              </button>
              {saveMessage && <p className="text-sm text-slate-300">{saveMessage}</p>}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function formatMoneyInput(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return String(Number(value));
}

function moneyToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}
