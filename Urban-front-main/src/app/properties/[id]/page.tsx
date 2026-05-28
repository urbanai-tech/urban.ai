"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  RefreshCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardHeader,
  AppEmptyState,
  AppInput,
  AppLoadingStatus,
  AppPageShell,
  AppSectionHeader,
  AppSelect,
  AppTextarea,
  AppToastProvider,
  useToastCompat,
} from "../../componentes/ui";
import {
  fetchMyRoi,
  fetchPace,
  getEventosAcompanhando,
  getEventosPorPropriedade,
  getPropertyById,
  getPropertyOccupancyHistory,
  getPropertyPricingInputHistory,
  registrarResultadoSugestao,
  updatePropertyPricingInputs,
  upsertPropertyOccupancy,
  type PaceApiPoint,
  type PricingInputHistory,
  type PropertyDetail,
  type PropertyOccupancyRecord,
  type PropertyOccupancyStatus,
  type RoiSummary,
} from "../../service/api";
import { dateAtLocalOffset, formatLocalDate } from "../../lib/date";

type SuggestionItem = {
  id?: string;
  idAnalise: string;
  nome?: string;
  dataInicio?: string;
  enderecoCompleto?: string;
  cidade?: string;
  estado?: string;
  precoSugerido?: string | number | null;
  seuPrecoAtual?: string | number | null;
  diferencaPercentual?: string | number | null;
  recomendacao?: string | null;
  motivo_ia?: string | null;
  criadoEm?: string;
  precoAplicado?: string | number | null;
  aplicadoEm?: string | null;
  aceito?: boolean;
  status?: string;
  reservaStatus?: "unknown" | "booked" | "not_booked" | "blocked" | null;
  receitaReal?: string | number | null;
  noitesReservadas?: string | number | null;
  resultadoRegistradoEm?: string | null;
  feedbackObservacao?: string | null;
};

type PricingDraft = { manualDailyPrice: string; averageMonthlyRevenue: string };
type OccupancyDraft = {
  date: string;
  status: PropertyOccupancyStatus;
  listedPrice: string;
  revenue: string;
  nightsBooked: string;
};
type OutcomeDraft = {
  appliedPrice: string;
  reservationStatus: "unknown" | "booked" | "not_booked" | "blocked";
  realRevenue: string;
  bookedNights: string;
  note: string;
};

function todayIso(): string {
  return formatLocalDate(new Date());
}

function isoFromDaysAhead(daysAhead: number): string {
  return formatLocalDate(dateAtLocalOffset(daysAhead));
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMoney(value: string): number | null {
  const parsed = toNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatCents(value: number | null | undefined): string {
  return formatMoney(value == null ? null : value / 100);
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayName(property: PropertyDetail | null): string {
  return (
    property?.list?.internalNickname ||
    property?.list?.titulo ||
    "Imóvel"
  );
}

function locationLabel(property: PropertyDetail | null): string {
  if (!property) return "Localização pendente";
  if (property.cidade && property.estado) return `${property.cidade}, ${property.estado}`;
  return property.cidade || property.estado || property.bairro || "Localização pendente";
}

function addressLine(property: PropertyDetail | null): string {
  if (!property) return "";
  const street = [property.logradouro, property.numero].filter(Boolean).join(", ");
  return [street || null, property.bairro, locationLabel(property), property.cep ? `CEP ${property.cep}` : null]
    .filter(Boolean)
    .join(" - ");
}

function airbnbUrl(listingId?: string | null): string | null {
  const value = listingId?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://www.airbnb.com/rooms/${encodeURIComponent(value)}`;
}

function statusLabel(status?: string | null): string {
  const normalized = String(status ?? "unknown");
  if (normalized === "booked") return "Alugou";
  if (normalized === "available") return "Disponível";
  if (normalized === "blocked") return "Bloqueado";
  if (normalized === "not_booked") return "Não alugou";
  if (normalized === "applied_manual" || normalized === "applied_stays") return "Preço aplicado";
  if (normalized === "accepted") return "Aceito";
  if (normalized === "rejected") return "Recusado";
  return "Em aberto";
}

function priceSourceLabel(property: PropertyDetail | null): string {
  if (property?.list?.pricingInputSource === "manual") return "Referência manual";
  if (property?.list?.dailyPrice) return "Leitura direta";
  return "Sem diária base";
}

function suggestionLift(item: SuggestionItem): number {
  const current = toNumber(item.seuPrecoAtual);
  const suggested = toNumber(item.precoSugerido);
  if (current === null || suggested === null) return 0;
  return Math.max(0, suggested - current);
}

function PropertyDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToastCompat();
  const propertyId = String(params?.id ?? "");

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [pricingHistory, setPricingHistory] = useState<PricingInputHistory[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<SuggestionItem[]>([]);
  const [roi, setRoi] = useState<RoiSummary | null>(null);
  const [pace, setPace] = useState<PaceApiPoint[]>([]);
  const [occupancy, setOccupancy] = useState<PropertyOccupancyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingOccupancy, setSavingOccupancy] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [pricingDraft, setPricingDraft] = useState<PricingDraft>({ manualDailyPrice: "", averageMonthlyRevenue: "" });
  const [occupancyDraft, setOccupancyDraft] = useState<OccupancyDraft>({
    date: todayIso(),
    status: "booked",
    listedPrice: "",
    revenue: "",
    nightsBooked: "1",
  });
  const [outcomeSuggestion, setOutcomeSuggestion] = useState<SuggestionItem | null>(null);
  const [outcomeDraft, setOutcomeDraft] = useState<OutcomeDraft>({
    appliedPrice: "",
    reservationStatus: "unknown",
    realRevenue: "",
    bookedNights: "",
    note: "",
  });

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    const from = isoFromDaysAhead(0);
    const to = isoFromDaysAhead(60);

    const [
      propertyResult,
      historyResult,
      suggestionsResult,
      acceptedResult,
      roiResult,
      paceResult,
      occupancyResult,
    ] = await Promise.allSettled([
      getPropertyById(propertyId),
      getPropertyPricingInputHistory(propertyId, 8),
      getEventosPorPropriedade(propertyId, from, 1, 12),
      getEventosAcompanhando(propertyId, 1, 8),
      fetchMyRoi({ windowDays: 60, propertyId }),
      fetchPace(propertyId, { days: 60 }),
      getPropertyOccupancyHistory(propertyId, { from: isoFromDaysAhead(-30), to, limit: 120 }),
    ]);

    if (propertyResult.status === "fulfilled") {
      setProperty(propertyResult.value);
      setPricingDraft({
        manualDailyPrice: propertyResult.value.list?.manualDailyPrice ? String(propertyResult.value.list.manualDailyPrice) : "",
        averageMonthlyRevenue: propertyResult.value.list?.averageMonthlyRevenue ? String(propertyResult.value.list.averageMonthlyRevenue) : "",
      });
      setOccupancyDraft((prev) => ({
        ...prev,
        listedPrice: prev.listedPrice || String(propertyResult.value.list?.manualDailyPrice ?? propertyResult.value.list?.dailyPrice ?? ""),
      }));
    } else {
      toast("Não foi possível carregar o imóvel.", { type: "error" });
    }

    setPricingHistory(historyResult.status === "fulfilled" ? historyResult.value : []);
    setSuggestions(suggestionsResult.status === "fulfilled" ? suggestionsResult.value.data ?? [] : []);
    setAcceptedSuggestions(acceptedResult.status === "fulfilled" ? acceptedResult.value.data ?? [] : []);
    setRoi(roiResult.status === "fulfilled" ? roiResult.value : null);
    setPace(paceResult.status === "fulfilled" ? paceResult.value : []);
    setOccupancy(occupancyResult.status === "fulfilled" ? occupancyResult.value : []);
    setLoading(false);
  }, [propertyId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = useMemo(() => {
    const comparisonRows = suggestions.length ? suggestions : acceptedSuggestions;
    const totalLift = comparisonRows.reduce((sum, item) => sum + suggestionLift(item), 0);
    const applied = comparisonRows.filter((item) => item.precoAplicado || item.aplicadoEm || String(item.status ?? "").includes("applied")).length;
    const booked = occupancy.filter((item) => item.status === "booked").length;
    const available = occupancy.filter((item) => item.status === "available").length;
    const blocked = occupancy.filter((item) => item.status === "blocked").length;
    const measured = booked + available;
    const occupancyRate = measured > 0 ? Math.round((booked / measured) * 100) : null;
    const paceBooked = pace.filter((point) => Number(point.booked) > 0).length;
    return {
      totalLift,
      applied,
      booked,
      available,
      blocked,
      occupancyRate,
      paceBooked,
      comparisonRows,
    };
  }, [acceptedSuggestions, occupancy, pace, suggestions]);

  async function savePricing() {
    const manualDailyPrice = parseMoney(pricingDraft.manualDailyPrice);
    if (!manualDailyPrice) {
      toast("Informe uma diária de referência válida.", { type: "warning" });
      return;
    }

    setSavingPricing(true);
    try {
      await updatePropertyPricingInputs(propertyId, {
        manualDailyPrice,
        averageMonthlyRevenue: parseMoney(pricingDraft.averageMonthlyRevenue),
      });
      toast("Referência de preço salva.", { type: "success" });
      await load();
    } catch (error) {
      console.error("Erro ao salvar pricing do imóvel:", error);
      toast("Não foi possível salvar a referência.", { type: "error" });
    } finally {
      setSavingPricing(false);
    }
  }

  async function saveOccupancy() {
    if (!occupancyDraft.date) {
      toast("Escolha uma data.", { type: "warning" });
      return;
    }

    setSavingOccupancy(true);
    try {
      await upsertPropertyOccupancy(propertyId, {
        date: occupancyDraft.date,
        status: occupancyDraft.status,
        listedPrice: parseMoney(occupancyDraft.listedPrice),
        revenue: parseMoney(occupancyDraft.revenue),
        nightsBooked: occupancyDraft.nightsBooked ? Number(occupancyDraft.nightsBooked) : null,
      });
      toast("Ocupação registrada.", { type: "success" });
      const records = await getPropertyOccupancyHistory(propertyId, {
        from: isoFromDaysAhead(-30),
        to: isoFromDaysAhead(60),
        limit: 120,
      });
      setOccupancy(records);
    } catch (error) {
      console.error("Erro ao salvar ocupação:", error);
      toast("Não foi possível registrar a ocupação.", { type: "error" });
    } finally {
      setSavingOccupancy(false);
    }
  }

  function openOutcomeModal(item: SuggestionItem) {
    setOutcomeSuggestion(item);
    setOutcomeDraft({
      appliedPrice: item.precoAplicado ? String(item.precoAplicado).replace(".", ",") : item.precoSugerido ? String(item.precoSugerido).replace(".", ",") : "",
      reservationStatus: item.reservaStatus || "unknown",
      realRevenue: item.receitaReal ? String(item.receitaReal).replace(".", ",") : "",
      bookedNights: item.noitesReservadas ? String(item.noitesReservadas) : "",
      note: item.feedbackObservacao || "",
    });
  }

  async function saveOutcome() {
    if (!outcomeSuggestion?.idAnalise) return;
    setSavingOutcome(true);
    try {
      await registrarResultadoSugestao(outcomeSuggestion.idAnalise, {
        precoAplicado: parseMoney(outcomeDraft.appliedPrice),
        reservaStatus: outcomeDraft.reservationStatus,
        receitaReal: parseMoney(outcomeDraft.realRevenue),
        noitesReservadas: outcomeDraft.bookedNights ? Number(outcomeDraft.bookedNights) : null,
        feedbackObservacao: outcomeDraft.note || null,
      });
      toast("Resultado da sugestão registrado.", { type: "success" });
      setOutcomeSuggestion(null);
      await load();
    } catch (error) {
      console.error("Erro ao registrar resultado:", error);
      toast("Não foi possível registrar o resultado.", { type: "error" });
    } finally {
      setSavingOutcome(false);
    }
  }

  if (loading) {
    return (
      <AppPageShell maxWidth={1280}>
        <AppLoadingStatus
          eyebrow="IMÓVEL"
          title="Carregando painel do imóvel"
          body="Estamos reunindo dados de preço, sugestões, ROI e ocupação."
          steps={[
            { id: "property", label: "Dados do imóvel", status: "active" },
            { id: "signals", label: "Sugestões e ganhos", status: "pending" },
            { id: "occupancy", label: "Ocupação", status: "pending" },
          ]}
        />
      </AppPageShell>
    );
  }

  const list = property?.list;
  const url = airbnbUrl(list?.id_do_anuncio);

  return (
    <AppPageShell maxWidth={1280}>
      <AppSectionHeader
        eyebrow="IMÓVEL - PAINEL DEDICADO"
        title={displayName(property)}
        subtitle={addressLine(property) || "Complete a localização para melhorar eventos, raio e demanda."}
        actions={
          <div className="property-detail-actions">
            <AppButton variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => router.push("/properties")}>
              Voltar
            </AppButton>
            <AppButton as="a" href={`/properties/${propertyId}/market`} variant="secondary" size="sm" leftIcon={<BarChart3 size={14} />}>
              Mercado
            </AppButton>
            <AppButton as="a" href={`/properties/${propertyId}/pricing-rules`} variant="secondary" size="sm" leftIcon={<ShieldCheck size={14} />}>
              Regras
            </AppButton>
            {url && (
              <AppButton as="a" href={url} variant="ghost" size="sm" leftIcon={<ExternalLink size={14} />}>
                Airbnb
              </AppButton>
            )}
          </div>
        }
      />

      <AppCard variant="default" style={{ padding: 0, overflow: "hidden" }}>
        <div className="property-hero">
          <div className="property-hero-main">
            {list?.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={list.pictureUrl} alt={displayName(property)} />
            ) : (
              <div className="property-image-fallback">{displayName(property).charAt(0)}</div>
            )}
            <div>
              <div className="property-chip-row">
                <AppBadge kind="neutral"><MapPin size={12} />{locationLabel(property)}</AppBadge>
                {property?.bairro && <AppBadge kind="neutral">{property.bairro}</AppBadge>}
                {list?.internalCode && <AppBadge kind="accent">{list.internalCode}</AppBadge>}
                {list?.id_do_anuncio && <AppBadge kind="neutral">Airbnb {list.id_do_anuncio}</AppBadge>}
              </div>
              <h2>{list?.titulo || displayName(property)}</h2>
              <p>
                Apelido visível: <strong>{list?.internalNickname || "ainda não definido"}</strong>. Use este painel para conferir
                se a sugestão virou preço aplicado, se alugou e quanto gerou.
              </p>
            </div>
          </div>
          <div className="property-monitor">
            <span>Acompanhamento</span>
            <strong>{priceSourceLabel(property)}</strong>
            <small>Última leitura direta: {formatDateTime(list?.lastScrapedAt)}</small>
            <small>Referência atualizada: {formatDateTime(list?.pricingInputsUpdatedAt)}</small>
          </div>
        </div>
      </AppCard>

      <div className="property-metric-grid">
        <Metric label="Ganho atribuído" value={formatCents(roi?.money.totalAttributedCents ?? null)} sub={roi?.dataQuality.label || "ROI dos últimos 60 dias"} accent />
        <Metric label="Potencial em aberto" value={formatMoney(metrics.totalLift)} sub={`${metrics.comparisonRows.length} sugestão(ões) recentes`} accent />
        <Metric label="Preço aplicado" value={metrics.applied} sub="sugestões conferidas" />
        <Metric label="Ocupação declarada" value={metrics.occupancyRate == null ? "-" : `${metrics.occupancyRate}%`} sub={`${metrics.booked} alugou / ${metrics.available} disponível`} />
      </div>

      <div className="property-grid two">
        <AppCard variant="default">
          <AppCardHeader
            eyebrow="PREÇO BASE"
            title="Referência usada pela Urban AI"
            subtitle="Hoje a sugestão usa a referência manual quando existe. A leitura direta fica visível para comparar, sem esconder a fonte."
          />
          <div className="property-price-panel">
            <div>
              <span>Diária de referência</span>
              <strong>{formatMoney(list?.manualDailyPrice ?? list?.dailyPrice ?? null)}</strong>
              <small>{priceSourceLabel(property)}</small>
            </div>
            <div>
              <span>Última diária lida</span>
              <strong>{formatMoney(list?.dailyPrice ?? list?.raw ?? null)}</strong>
              <small>{list?.priceText || "Sem coleta direta recente"}</small>
            </div>
            <div>
              <span>Receita média mensal</span>
              <strong>{formatMoney(list?.averageMonthlyRevenue ?? null)}</strong>
              <small>Referência manual do anfitrião</small>
            </div>
          </div>
          <div className="property-form-grid">
            <AppInput
              label="Diária referência"
              leftAddon="R$"
              value={pricingDraft.manualDailyPrice}
              inputMode="decimal"
              onChange={(event) => setPricingDraft((prev) => ({ ...prev, manualDailyPrice: event.target.value }))}
            />
            <AppInput
              label="Receita média / mês"
              leftAddon="R$"
              value={pricingDraft.averageMonthlyRevenue}
              inputMode="decimal"
              onChange={(event) => setPricingDraft((prev) => ({ ...prev, averageMonthlyRevenue: event.target.value }))}
            />
            <AppButton leftIcon={<Save size={14} />} loading={savingPricing} onClick={savePricing}>
              Salvar referência
            </AppButton>
          </div>
        </AppCard>

        <AppCard variant="default">
          <AppCardHeader
            eyebrow="GANHOS E ROI"
            title="O que este imóvel está retornando"
            subtitle="Usa sugestões aceitas/aplicadas e resultados registrados. Quanto mais você confere reserva e receita, melhor fica."
          />
          <div className="property-roi-list">
            <InfoRow label="ROI líquido" value={roi?.money.roiPercent == null ? "-" : `${roi.money.roiPercent.toFixed(0)}%`} />
            <InfoRow label="Ganho confirmado" value={formatCents(roi?.money.confirmedIncrementalCents ?? null)} />
            <InfoRow label="Ganho projetado" value={formatCents(roi?.money.projectedIncrementalCents ?? null)} />
            <InfoRow label="Potencial perdido" value={formatCents(roi?.money.potentialLostCents ?? null)} />
            <InfoRow label="Sugestões usadas" value={`${roi?.activity.applied ?? 0} de ${roi?.activity.recommendations ?? 0}`} />
          </div>
        </AppCard>
      </div>

      <AppCard variant="default">
        <AppCardHeader
          eyebrow="SUGESTÕES E CONFERÊNCIA"
          title="Preço sugerido vs. preço efetivamente marcado"
          subtitle="Aqui fica a verificação operacional: o que sugerimos, o que foi aplicado, e se alugou."
          actions={<AppButton variant="ghost" size="sm" leftIcon={<RefreshCcw size={14} />} onClick={load}>Atualizar</AppButton>}
        />
        {metrics.comparisonRows.length === 0 ? (
          <AppEmptyState
            icon={<CalendarDays size={28} />}
            title="Sem sugestões recentes para este imóvel"
            body="Quando houver evento relevante, ele aparece aqui com preço atual, sugerido, aplicado e resultado."
          />
        ) : (
          <div className="property-suggestion-list">
            {metrics.comparisonRows.slice(0, 8).map((item) => {
              const current = toNumber(item.seuPrecoAtual);
              const suggested = toNumber(item.precoSugerido);
              const applied = toNumber(item.precoAplicado);
              return (
                <div className="property-suggestion-row" key={item.idAnalise || `${item.nome}-${item.dataInicio}`}>
                  <div>
                    <strong>{item.nome || "Evento"}</strong>
                    <span>{formatDate(item.dataInicio)} - {[item.cidade, item.estado].filter(Boolean).join(", ") || item.enderecoCompleto || "Localização do evento"}</span>
                  </div>
                  <div className="property-price-compare">
                    <span>Atual {formatMoney(current)}</span>
                    <span>Sugerido {formatMoney(suggested)}</span>
                    <span>Aplicado {formatMoney(applied)}</span>
                  </div>
                  <AppBadge kind={applied ? "success" : item.aceito ? "accent" : "neutral"}>
                    {statusLabel(item.reservaStatus || item.status)}
                  </AppBadge>
                  <AppButton size="sm" variant="secondary" onClick={() => openOutcomeModal(item)}>
                    Conferir
                  </AppButton>
                </div>
              );
            })}
          </div>
        )}
      </AppCard>

      <div className="property-grid two">
        <AppCard variant="default">
          <AppCardHeader
            eyebrow="OCUPAÇÃO REAL"
            title="Declarar se alugou ou não"
            subtitle="Este registro alimenta o ground truth de receita, ocupação e qualidade das sugestões."
          />
          <div className="property-form-grid occupancy">
            <AppInput
              label="Data"
              type="date"
              value={occupancyDraft.date}
              onChange={(event) => setOccupancyDraft((prev) => ({ ...prev, date: event.target.value }))}
            />
            <AppSelect
              label="Status"
              value={occupancyDraft.status}
              onChange={(event) => setOccupancyDraft((prev) => ({ ...prev, status: event.target.value as PropertyOccupancyStatus }))}
            >
              <option value="booked">Alugou</option>
              <option value="available">Disponível / não alugou</option>
              <option value="blocked">Bloqueado</option>
              <option value="unknown">Não sei</option>
            </AppSelect>
            <AppInput
              label="Preço marcado"
              leftAddon="R$"
              inputMode="decimal"
              value={occupancyDraft.listedPrice}
              onChange={(event) => setOccupancyDraft((prev) => ({ ...prev, listedPrice: event.target.value }))}
            />
            <AppInput
              label="Receita real"
              leftAddon="R$"
              inputMode="decimal"
              value={occupancyDraft.revenue}
              onChange={(event) => setOccupancyDraft((prev) => ({ ...prev, revenue: event.target.value }))}
            />
            <AppInput
              label="Noites"
              type="number"
              min={0}
              value={occupancyDraft.nightsBooked}
              onChange={(event) => setOccupancyDraft((prev) => ({ ...prev, nightsBooked: event.target.value }))}
            />
            <AppButton leftIcon={<CheckCircle2 size={14} />} loading={savingOccupancy} onClick={saveOccupancy}>
              Registrar
            </AppButton>
          </div>
          <div className="property-occupancy-strip">
            <InfoRow label="Reservas pace" value={String(metrics.paceBooked)} />
            <InfoRow label="Alugou" value={String(metrics.booked)} />
            <InfoRow label="Disponível" value={String(metrics.available)} />
            <InfoRow label="Bloqueado" value={String(metrics.blocked)} />
          </div>
        </AppCard>

        <AppCard variant="default">
          <AppCardHeader
            eyebrow="HISTÓRICO"
            title="Últimas alterações e registros"
            subtitle="Mudanças de referência e ocupação declarada ficam em uma trilha curta para auditoria do imóvel."
          />
          <div className="property-history-list">
            {pricingHistory.slice(0, 5).map((item) => (
              <div className="property-history-row" key={item.id}>
                <Clock3 size={14} />
                <div>
                  <strong>{formatDateTime(item.createdAt)}</strong>
                  <span>
                    Diária {formatMoney(item.previousManualDailyPrice)} -&gt; {formatMoney(item.newManualDailyPrice)}
                    {" | "}
                    Mês {formatMoney(item.previousAverageMonthlyRevenue)} -&gt; {formatMoney(item.newAverageMonthlyRevenue)}
                  </span>
                </div>
              </div>
            ))}
            {occupancy.slice(0, 5).map((item) => (
              <div className="property-history-row" key={item.id}>
                <CalendarDays size={14} />
                <div>
                  <strong>{formatDate(item.date)} - {statusLabel(item.status)}</strong>
                  <span>Preço {formatMoney(item.listedPrice)} | Receita {formatMoney(item.revenue)}</span>
                </div>
              </div>
            ))}
            {pricingHistory.length === 0 && occupancy.length === 0 && (
              <AppEmptyState title="Sem histórico ainda" body="Salve uma referência ou registre ocupação para criar a trilha deste imóvel." />
            )}
          </div>
        </AppCard>
      </div>

      {outcomeSuggestion && (
        <div className="property-modal-overlay" role="dialog" aria-modal="true">
          <div className="property-modal">
            <div className="property-modal-header">
              <div>
                <span>CONFERIR SUGESTÃO</span>
                <h2>{outcomeSuggestion.nome || "Sugestão"}</h2>
              </div>
              <button type="button" onClick={() => setOutcomeSuggestion(null)}>x</button>
            </div>
            <div className="property-form-grid modal">
              <AppInput
                label="Preço aplicado"
                leftAddon="R$"
                value={outcomeDraft.appliedPrice}
                inputMode="decimal"
                onChange={(event) => setOutcomeDraft((prev) => ({ ...prev, appliedPrice: event.target.value }))}
              />
              <AppSelect
                label="Resultado"
                value={outcomeDraft.reservationStatus}
                onChange={(event) => setOutcomeDraft((prev) => ({ ...prev, reservationStatus: event.target.value as OutcomeDraft["reservationStatus"] }))}
              >
                <option value="unknown">Ainda não sei</option>
                <option value="booked">Alugou</option>
                <option value="not_booked">Não alugou</option>
                <option value="blocked">Bloqueado</option>
              </AppSelect>
              <AppInput
                label="Receita real"
                leftAddon="R$"
                value={outcomeDraft.realRevenue}
                inputMode="decimal"
                onChange={(event) => setOutcomeDraft((prev) => ({ ...prev, realRevenue: event.target.value }))}
              />
              <AppInput
                label="Noites"
                type="number"
                value={outcomeDraft.bookedNights}
                onChange={(event) => setOutcomeDraft((prev) => ({ ...prev, bookedNights: event.target.value }))}
              />
              <AppTextarea
                label="Observação"
                value={outcomeDraft.note}
                onChange={(event) => setOutcomeDraft((prev) => ({ ...prev, note: event.target.value }))}
                shellStyle={{ gridColumn: "1 / -1" }}
              />
            </div>
            <div className="property-modal-actions">
              <AppButton variant="ghost" onClick={() => setOutcomeSuggestion(null)}>Cancelar</AppButton>
              <AppButton loading={savingOutcome} onClick={saveOutcome}>Salvar conferência</AppButton>
            </div>
          </div>
        </div>
      )}

      <style jsx>{styles}</style>
    </AppPageShell>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong className={accent ? "accent" : ""}>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function PropertyDetailPage() {
  return (
    <AppToastProvider>
      <PropertyDetailContent />
    </AppToastProvider>
  );
}

const styles = `
  .property-detail-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }

  .property-hero {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 22px;
    padding: 20px;
  }

  .property-hero-main {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 18px;
  }

  .property-hero-main img,
  .property-image-fallback {
    width: 112px;
    height: 112px;
    flex: 0 0 auto;
    border-radius: 12px;
  }

  .property-hero-main img {
    object-fit: cover;
  }

  .property-image-fallback {
    display: grid;
    place-items: center;
    color: var(--app-text-muted);
    background: var(--app-surface-muted);
    border: 1px solid var(--app-divider);
    font-size: 30px;
    font-weight: 800;
  }

  .property-chip-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  .property-hero h2 {
    margin: 0;
    color: var(--app-text);
    font-size: 24px;
    line-height: 1.15;
  }

  .property-hero p {
    max-width: 720px;
    margin: 9px 0 0;
    color: var(--app-text-muted);
    font-size: 14px;
    line-height: 1.55;
  }

  .property-monitor {
    min-width: 250px;
    padding: 14px;
    background: var(--app-surface-muted);
    border: 1px solid var(--app-divider);
    border-radius: 12px;
  }

  .property-monitor span,
  .property-price-panel span {
    display: block;
    color: var(--app-text-subtle);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  .property-monitor strong,
  .property-price-panel strong {
    display: block;
    margin-top: 8px;
    color: var(--app-text);
    font-size: 20px;
    line-height: 1.1;
  }

  .property-monitor small,
  .property-price-panel small {
    display: block;
    margin-top: 7px;
    color: var(--app-text-muted);
    font-size: 12px;
    line-height: 1.35;
  }

  .property-metric-grid,
  .property-grid {
    display: grid;
    gap: 14px;
    margin-top: 18px;
  }

  .property-metric-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .property-grid.two {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .metric-card {
    min-width: 0;
    padding: 16px;
    background: var(--app-surface);
    border: 1px solid var(--app-divider);
    border-radius: 12px;
  }

  .metric-card span {
    display: block;
    color: var(--app-text-subtle);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  .metric-card strong {
    display: block;
    margin-top: 10px;
    overflow: hidden;
    color: var(--app-text);
    font-size: 30px;
    font-weight: 850;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .metric-card strong.accent {
    color: var(--app-accent);
  }

  .metric-card small {
    display: block;
    margin-top: 8px;
    color: var(--app-text-muted);
    font-size: 12px;
  }

  .property-price-panel {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
  }

  .property-price-panel > div,
  .info-row {
    min-width: 0;
    padding: 12px;
    background: var(--app-surface-muted);
    border: 1px solid var(--app-divider);
    border-radius: 10px;
  }

  .property-form-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 10px;
    align-items: end;
    margin-top: 16px;
  }

  .property-form-grid.occupancy {
    grid-template-columns: 150px 180px repeat(3, minmax(0, 1fr)) auto;
  }

  .property-form-grid.modal {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .property-roi-list,
  .property-occupancy-strip {
    display: grid;
    gap: 9px;
    margin-top: 14px;
  }

  .property-occupancy-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .info-row span {
    color: var(--app-text-muted);
    font-size: 13px;
  }

  .info-row strong {
    color: var(--app-text);
    font-size: 14px;
    font-weight: 750;
    text-align: right;
  }

  .property-suggestion-list,
  .property-history-list {
    display: grid;
    gap: 10px;
    margin-top: 14px;
  }

  .property-suggestion-row {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) minmax(280px, 0.8fr) auto auto;
    gap: 12px;
    align-items: center;
    padding: 12px;
    background: var(--app-surface-muted);
    border: 1px solid var(--app-divider);
    border-radius: 10px;
  }

  .property-suggestion-row strong,
  .property-history-row strong {
    display: block;
    color: var(--app-text);
    font-size: 14px;
    line-height: 1.25;
  }

  .property-suggestion-row span,
  .property-history-row span {
    display: block;
    margin-top: 4px;
    color: var(--app-text-muted);
    font-size: 12px;
    line-height: 1.4;
  }

  .property-price-compare {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .property-price-compare span {
    margin: 0;
    padding: 7px 8px;
    color: var(--app-text);
    background: var(--app-surface);
    border: 1px solid var(--app-divider);
    border-radius: 8px;
    font-size: 12px;
    font-weight: 650;
    white-space: nowrap;
  }

  .property-history-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 12px;
    background: var(--app-surface-muted);
    border: 1px solid var(--app-divider);
    border-radius: 10px;
    color: var(--app-text-muted);
  }

  .property-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.54);
    backdrop-filter: blur(4px);
  }

  .property-modal {
    width: min(640px, 100%);
    padding: 22px;
    background: var(--app-surface);
    border: 1px solid var(--app-divider);
    border-radius: 14px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.25);
  }

  .property-modal-header,
  .property-modal-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .property-modal-header span {
    color: var(--app-accent);
    font-size: 11px;
    font-weight: 850;
    letter-spacing: 1.5px;
  }

  .property-modal-header h2 {
    margin: 4px 0 0;
    color: var(--app-text);
    font-size: 20px;
  }

  .property-modal-header button {
    width: 32px;
    height: 32px;
    color: var(--app-text-muted);
    background: transparent;
    border: 1px solid var(--app-divider);
    border-radius: 8px;
    cursor: pointer;
  }

  .property-modal-actions {
    justify-content: flex-end;
    margin-top: 18px;
  }

  @media (max-width: 1100px) {
    .property-metric-grid,
    .property-grid.two,
    .property-price-panel,
    .property-occupancy-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .property-form-grid,
    .property-form-grid.occupancy {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .property-suggestion-row {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .property-hero,
    .property-hero-main {
      flex-direction: column;
      align-items: stretch;
    }

    .property-monitor {
      min-width: 0;
    }

    .property-metric-grid,
    .property-grid.two,
    .property-price-panel,
    .property-occupancy-strip,
    .property-form-grid,
    .property-form-grid.occupancy,
    .property-form-grid.modal,
    .property-price-compare {
      grid-template-columns: 1fr;
    }
  }
`;
