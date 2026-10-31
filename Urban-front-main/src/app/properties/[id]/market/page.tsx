"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AppBadge,
  AppButton,
  AppEmptyState,
  AppMetricCard,
  AppPageShell,
  AppSectionHeader,
  AppSelect,
  AppToastProvider,
  Icons,
} from "../../../componentes/ui";
import {
  fetchMarketIntel,
  type MarketIntelResponse,
} from "../../../service/api";
import { dateAtLocalOffset, formatLocalDate } from "../../../lib/date";
import { trackEvent } from "../../../service/tracking";
import { PercentileHero } from "./components/PercentileHero";
import { AdrComparisonChart } from "./components/AdrComparisonChart";
import styles from "./page.module.css";
import { brlWhole } from "../../../lib/format";
import {
  CAPACITY_OPTIONS,
  DEFAULT_FILTERS,
  eventEffectView,
  filtersFromTarget,
  filtersToInput,
  hasTypologyFilter,
  insufficiencyView,
  LISTING_TYPE_OPTIONS,
  occupancyView,
  originPhrase,
  RADIUS_OPTIONS,
  ROOMS_OPTIONS,
  seasonalityBars,
  sourceBadges,
  targetHasTypology,
  trendView,
  type MarketFilters,
} from "./market-domain";

/**
 * /properties/:id/market — Market Intel dashboard (ADR 0028: mercado multifonte).
 *
 * Zonas:
 *  0) Filtros: período, raio (1–5 km) e tipologia (quartos, tipo de anúncio, capacidade)
 *  1) PercentileHero (full-width) + selos de fonte e data de coleta
 *  2) KPI cards (ocupação indisponível/estimada é dita, nunca vira 0%)
 *  3) Gráfico ADR diário (sua propriedade vs comp set)
 *  4) Faixas agregadas (P25/mediana/P75) — nunca dados por imóvel de terceiros
 *  5) Tendência de 30 dias, sazonalidade e efeito dos eventos no bairro
 *  6) Estado "amostra insuficiente" explicando o que falta e o que dá para mudar
 */

const PERIOD_OPTIONS: ReadonlyArray<{ id: string; label: string; days: number }> = [
  { id: "30d", label: "Últimos 30 dias", days: 30 },
  { id: "60d", label: "Últimos 60 dias", days: 60 },
  { id: "90d", label: "Últimos 90 dias", days: 90 },
];

function isoOffset(daysAhead: number): string {
  return formatLocalDate(dateAtLocalOffset(daysAhead));
}

function formatBRL(value: number): string {
  return brlWhole(value);
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MarketIntelContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const propertyId = params?.id ?? "";

  const [periodId, setPeriodId] = useState<string>("30d");
  const [filters, setFilters] = useState<MarketFilters>(DEFAULT_FILTERS);
  // Último valor dos filtros: duas mudanças seguidas (ex.: raio e depois quartos) se compõem
  // mesmo antes do próximo render, em vez de a segunda ler o estado antigo.
  const filtersRef = useRef<MarketFilters>(DEFAULT_FILTERS);
  const [data, setData] = useState<MarketIntelResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState<number>(0);

  const period = useMemo(
    () => PERIOD_OPTIONS.find((p) => p.id === periodId) ?? PERIOD_OPTIONS[0],
    [periodId],
  );

  // Carga inicial + reage a mudanças de período / raio / tipologia / reload.
  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchMarketIntel({
          propertyId,
          from: isoOffset(-(period.days - 1)),
          to: isoOffset(0),
          ...filtersToInput(filters),
        });
        if (!cancelled) {
          setData(result);
          trackEvent("market_intel_viewed", {
            propertyId,
            period: period.id,
            percentile: result.percentile,
            comparables: result.comparablesCount,
            radiusKm: filters.radiusKm,
            typology: hasTypologyFilter(filters),
            insufficient: Boolean(result.insufficientData),
          });
        }
      } catch (err) {
        console.error("[/properties/:id/market] erro carregando market intel", err);
        if (!cancelled) {
          setError("Não foi possível carregar os dados de mercado.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [propertyId, period, filters, reloadCount]);

  const handlePeriodChange = useCallback(
    (next: string) => {
      setPeriodId(next);
      trackEvent("market_intel_period_changed", {
        propertyId,
        period: next,
      });
    },
    [propertyId],
  );

  const applyFilters = useCallback((next: MarketFilters) => {
    filtersRef.current = next;
    setFilters(next);
  }, []);

  const updateFilters = useCallback(
    (patch: Partial<MarketFilters>) => {
      const next = { ...filtersRef.current, ...patch };
      applyFilters(next);
      trackEvent("market_intel_filters_changed", {
        propertyId,
        radiusKm: next.radiusKm,
        rooms: next.rooms,
        listingType: next.listingType,
        capacity: next.capacity,
      });
    },
    [applyFilters, propertyId],
  );

  const handleRetry = useCallback(() => {
    setReloadCount((c) => c + 1);
  }, []);

  const handleGotoProperties = useCallback(() => {
    router.push("/properties");
  }, [router]);

  const radiusLabel = `${filters.radiusKm} km`;
  const header = (
    <AppSectionHeader
      eyebrow="MERCADO · IMÓVEIS PARECIDOS"
      title="Como seu imóvel se compara"
      subtitle={`Comparação com imóveis parecidos em até ${radiusLabel} · atualizado a cada 24h${
        data?.updatedAt ? ` · última atualização ${formatUpdatedAt(data.updatedAt)}` : ""
      }`}
      actions={
        <div className={styles.periodSelectWrap}>
          <AppSelect
            label="Período"
            value={periodId}
            onChange={(e) => handlePeriodChange(e.target.value)}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </AppSelect>
        </div>
      }
    />
  );

  // Render skeleton — 3 retângulos animados.
  if (loading && !data) {
    return (
      <AppPageShell maxWidth={1280}>
        {header}
        <div
          className={styles.loadingStack}
        >
          <div
            role="status"
            aria-busy="true"
            aria-label="Carregando destaque principal"
            className={`urban-app-skeleton ${styles.skeletonHero}`}
          />
          <div
            role="status"
            aria-busy="true"
            aria-label="Carregando resumo"
            className={`urban-app-skeleton ${styles.skeletonStrip}`}
          />
          <div
            role="status"
            aria-busy="true"
            aria-label="Carregando gráfico e tabela"
            className={`urban-app-skeleton ${styles.skeletonChart}`}
          />
        </div>
      </AppPageShell>
    );
  }

  // Render erro
  if (error) {
    return (
      <AppPageShell maxWidth={1280}>
        {header}
        <AppEmptyState
          eyebrow="ALGO DEU ERRADO"
          title="Não conseguimos carregar"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AppButton variant="primary" size="md" onClick={handleRetry}>
              Tentar de novo
            </AppButton>
          }
        />
      </AppPageShell>
    );
  }

  if (!data) {
    return null;
  }

  const insufficient = data.insufficientData ?? false;
  const deltaAdr = data.yourAdr - data.medianAdr;
  const deltaPct =
    data.medianAdr > 0 ? Math.round((deltaAdr / data.medianAdr) * 100) : 0;
  const badges = sourceBadges(data.dataSources);
  const origin = originPhrase(data.dataSources);
  const occupancy = occupancyView(data);
  const trend = trendView(data);
  const bars = seasonalityBars(data.seasonality);
  const eventEffect = eventEffectView(data.neighborhoodEventEffect);
  const canUseMyTypology = targetHasTypology(data.typology?.target);
  const radiusMin = data.radius?.min ?? RADIUS_OPTIONS[0];
  const radiusMax = data.radius?.max ?? RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1];
  const radiusChoices = RADIUS_OPTIONS.filter((km) => km >= radiusMin && km <= radiusMax);

  return (
    <AppPageShell maxWidth={1280}>
      {header}

      {/* ZONA 0 — Filtros de raio e tipologia */}
      <section aria-label="Filtros do mercado" className={styles.filters}>
        <div className={styles.filterGrid}>
          <AppSelect
            label="Raio"
            value={String(filters.radiusKm)}
            onChange={(e) => updateFilters({ radiusKm: Number(e.target.value) })}
          >
            {radiusChoices.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </AppSelect>
          <AppSelect
            label="Quartos"
            value={filters.rooms}
            onChange={(e) => updateFilters({ rooms: e.target.value })}
          >
            {ROOMS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </AppSelect>
          <AppSelect
            label="Tipo de anúncio"
            value={filters.listingType}
            onChange={(e) => updateFilters({ listingType: e.target.value })}
          >
            {LISTING_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </AppSelect>
          <AppSelect
            label="Capacidade"
            value={filters.capacity}
            onChange={(e) => updateFilters({ capacity: e.target.value })}
          >
            {CAPACITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </AppSelect>
        </div>
        <div className={styles.filterActions}>
          {canUseMyTypology ? (
            <AppButton
              variant="secondary"
              size="sm"
              onClick={() => applyFilters(filtersFromTarget(data.typology?.target, filters.radiusKm))}
            >
              Igual ao meu imóvel
            </AppButton>
          ) : null}
          {hasTypologyFilter(filters) ? (
            <AppButton
              variant="ghost"
              size="sm"
              onClick={() => applyFilters({ ...DEFAULT_FILTERS, radiusKm: filters.radiusKm })}
            >
              Limpar tipologia
            </AppButton>
          ) : null}
          <span role="status" className={styles.filterStatus}>
            {loading ? "Atualizando comparação…" : ""}
          </span>
        </div>
      </section>

      {insufficient ? (
        <InsufficientState
          data={data}
          filters={filters}
          onWiden={(km) => updateFilters({ radiusKm: km })}
          onClearTypology={() => applyFilters({ ...DEFAULT_FILTERS, radiusKm: filters.radiusKm })}
          onGotoProperties={handleGotoProperties}
        />
      ) : (
        <div className={styles.contentStack} aria-busy={loading}>
          {/* ZONA 1 — Hero metric + selos de fonte */}
          <PercentileHero
            percentile={data.percentile}
            neighborhood={data.neighborhood}
            comparablesCount={data.comparablesCount}
            medianAdr={data.medianAdr}
            trend30d={data.percentileTrend30d}
            trend={trend}
            origin={origin}
            radiusKm={data.radiusKm ?? filters.radiusKm}
          />

          {badges.length ? (
            <section aria-label="Fontes dos dados" className={styles.sourceStrip}>
              <p className="urban-app-eyebrow-muted">DE ONDE VÊM OS DADOS</p>
              <ul className={styles.sourceList}>
                {badges.map((badge) => (
                  <li key={badge.id}>
                    <AppBadge kind={badge.id === "customers" ? "accent" : "neutral"}>
                      {badge.label} · {badge.detail}
                    </AppBadge>
                  </li>
                ))}
              </ul>
              {data.attribution?.length ? (
                <p className={styles.attribution}>{data.attribution.join(" · ")}</p>
              ) : null}
            </section>
          ) : null}

          {/* ZONA 2 — KPI cards */}
          <section aria-label="Indicadores chave">
            <div className={styles.kpiGrid}>
              <KpiCardWrap>
                <AppMetricCard
                  label="Diária média dos parecidos"
                  value={formatBRL(data.medianAdr)}
                  sub={`Bairro ${data.neighborhood}`}
                />
              </KpiCardWrap>
              <KpiCardWrap>
                <AppMetricCard
                  label="Ocupação média dos parecidos"
                  value={occupancy.value}
                  sub={occupancy.sub}
                />
              </KpiCardWrap>
              <KpiCardWrap>
                <AppMetricCard
                  label="Sua diária vs média"
                  value={`${deltaAdr >= 0 ? "+" : ""}${formatBRL(deltaAdr)}`}
                  trend={deltaAdr > 0 ? "up" : deltaAdr < 0 ? "down" : undefined}
                  trendValue={`${deltaPct >= 0 ? "+" : ""}${deltaPct}%`}
                  accent={deltaAdr > 0}
                />
              </KpiCardWrap>
              <KpiCardWrap>
                <AppMetricCard
                  label="Resposta a eventos"
                  value={data.eventReactivity}
                  sub="Nota 0-100 · aumenta preço quando há evento"
                />
              </KpiCardWrap>
            </div>
          </section>

          {/* ZONA 3 — Gráfico ADR */}
          <section
            aria-label="Comparativo de diária média"
            className={styles.chartSection}
          >
            <header className={styles.sectionHeader}>
              <p className="urban-app-eyebrow-muted">DIÁRIA MÉDIA · {period.label.toUpperCase()}</p>
              <h2
                className={styles.sectionTitle}
              >
                Sua diária comparada com imóveis parecidos
              </h2>
              <p
                className={styles.sectionSubtitle}
              >
                Linha sólida é o seu imóvel · tracejada é a média dos {data.comparablesCount} imóveis parecidos.
              </p>
            </header>
            <AdrComparisonChart data={data.daily} />
          </section>

          {/* ZONA 4 — Faixas agregadas (sem dados por imóvel) */}
          {data.adrPercentiles || data.occupancyPercentiles ? (
            <section aria-label="Faixas de mercado">
              <header className={styles.sectionHeader}>
                <p className="urban-app-eyebrow-muted">FAIXAS DO MERCADO</p>
                <h2
                  className={styles.sectionTitle}
                >
                  Onde a maioria dos {data.comparablesCount} imóveis parecidos se concentra
                </h2>
                <p
                  className={styles.sectionSubtitle}
                >
                  Mostramos apenas faixas agregadas (25% abaixo, mediana e 25% acima). Nunca exibimos dados de um imóvel específico de outro anfitrião.
                </p>
              </header>
              <div className={styles.kpiGrid}>
                {data.adrPercentiles ? (
                  <KpiCardWrap>
                    <AppMetricCard
                      label="Diária · faixa central"
                      value={formatBRL(data.adrPercentiles.p50)}
                      sub={`${formatBRL(data.adrPercentiles.p25)} a ${formatBRL(data.adrPercentiles.p75)}`}
                    />
                  </KpiCardWrap>
                ) : null}
                {data.occupancyPercentiles && occupancy.available ? (
                  <KpiCardWrap>
                    <AppMetricCard
                      label={data.occupancyIsProxy ? "Ocupação · faixa central (estimada)" : "Ocupação · faixa central"}
                      value={formatPct(data.occupancyPercentiles.p50)}
                      sub={`${formatPct(data.occupancyPercentiles.p25)} a ${formatPct(data.occupancyPercentiles.p75)}`}
                    />
                  </KpiCardWrap>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* ZONA 5 — Tendência, eventos no bairro e sazonalidade */}
          <section aria-label="Tendência, eventos e sazonalidade do bairro">
            <header className={styles.sectionHeader}>
              <p className="urban-app-eyebrow-muted">MOVIMENTO DO BAIRRO</p>
              <h2 className={styles.sectionTitle}>Tendência, eventos e sazonalidade</h2>
              <p className={styles.sectionSubtitle}>
                Calculados só com os anúncios que têm histórico de preço. Quando não há dado suficiente, dizemos isso em vez de inventar um número.
              </p>
            </header>
            <div className={styles.kpiGrid}>
              <KpiCardWrap>
                {data.trend30d?.available && data.trend30d.medianAdrChangePct != null ? (
                  <AppMetricCard
                    label="Diária do bairro · 30 dias"
                    value={`${data.trend30d.medianAdrChangePct > 0 ? "+" : ""}${data.trend30d.medianAdrChangePct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                    trend={data.trend30d.medianAdrChangePct > 0 ? "up" : data.trend30d.medianAdrChangePct < 0 ? "down" : undefined}
                    sub={`Mediana de ${formatBRL(data.trend30d.previousMedianAdr ?? 0)} para ${formatBRL(data.trend30d.currentMedianAdr ?? 0)} (${data.trend30d.pairedListings} anúncios com histórico)`}
                  />
                ) : (
                  <AppMetricCard label="Diária do bairro · 30 dias" value="Indisponível" sub={trend.hint} />
                )}
              </KpiCardWrap>
              <KpiCardWrap>
                {eventEffect ? (
                  <AppMetricCard label="Efeito dos eventos no bairro" value={eventEffect.value} sub={eventEffect.sub} />
                ) : (
                  <AppMetricCard
                    label="Efeito dos eventos no bairro"
                    value="Indisponível"
                    sub="Poucos dias com evento de alto impacto e preço do bairro neste período."
                  />
                )}
              </KpiCardWrap>
            </div>
            {bars.length ? (
              <div className={styles.seasonBlock}>
                <h3 className={styles.seasonTitle}>Sazonalidade da diária por mês</h3>
                <svg
                  className={styles.seasonSvg}
                  viewBox={`0 0 ${bars.length * 48} 120`}
                  width={bars.length * 48}
                  height={120}
                  role="img"
                  aria-label={`Sazonalidade da diária: ${bars.map((bar) => `${bar.label} ${bar.delta}`).join(", ")}`}
                >
                  {bars.map((bar, i) => (
                    <g key={bar.month}>
                      <rect
                        className={styles.seasonBar}
                        x={i * 48 + 8}
                        y={100 - bar.heightPct * 0.9}
                        width={32}
                        height={bar.heightPct * 0.9}
                        rx={4}
                      >
                        <title>{`${bar.label}: ${bar.delta}`}</title>
                      </rect>
                      <text className={styles.seasonLabel} x={i * 48 + 24} y={115} textAnchor="middle">
                        {bar.label}
                      </text>
                    </g>
                  ))}
                </svg>
                <ul className={styles.seasonList}>
                  {bars.map((bar) => (
                    <li key={bar.month}>
                      <strong>{bar.label}</strong> {bar.delta}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className={styles.sectionSubtitle}>
                Sazonalidade indisponível: precisamos de pelo menos dois meses de histórico de preços dos parecidos.
              </p>
            )}
          </section>
        </div>
      )}
    </AppPageShell>
  );
}

function InsufficientState({
  data,
  filters,
  onWiden,
  onClearTypology,
  onGotoProperties,
}: {
  data: MarketIntelResponse;
  filters: MarketFilters;
  onWiden: (km: number) => void;
  onClearTypology: () => void;
  onGotoProperties: () => void;
}) {
  const view = insufficiencyView(data, filters);
  return (
    <div className={styles.contentStack}>
      <AppEmptyState
        eyebrow="AMOSTRA INSUFICIENTE"
        title={view.title}
        body={view.body}
        icon={<Icons.MapPin size={32} />}
        action={
          <div className={styles.insufficiencyActions}>
            {view.widenTo ? (
              <AppButton variant="primary" size="md" onClick={() => onWiden(view.widenTo as number)}>
                Aumentar raio para {view.widenTo} km
              </AppButton>
            ) : null}
            {view.canClearTypology ? (
              <AppButton variant="secondary" size="md" onClick={onClearTypology}>
                Limpar tipologia
              </AppButton>
            ) : null}
            <AppButton variant="ghost" size="md" onClick={onGotoProperties}>
              Ver outros imóveis
            </AppButton>
          </div>
        }
      />
      <section aria-label="O que falta para comparar" className={styles.insufficiencyBox}>
        <h2 className={styles.sectionTitle}>O que falta</h2>
        <ul className={styles.reasonList}>
          {view.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        {view.hints.length ? (
          <>
            <h3 className={styles.seasonTitle}>O que você pode fazer</h3>
            <ul className={styles.reasonList}>
              {view.hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}

function KpiCardWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.kpiCard}>
      {children}
    </div>
  );
}

export default function MarketIntelPage() {
  // HostShell (layout) já provê AppToastProvider em telas autenticadas,
  // mas garante caso a página seja renderizada fora dele.
  return (
    <AppToastProvider>
      <MarketIntelContent />
    </AppToastProvider>
  );
}
