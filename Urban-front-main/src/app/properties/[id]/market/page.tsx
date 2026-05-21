"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
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
import { trackEvent } from "../../../service/tracking";
import { PercentileHero } from "./components/PercentileHero";
import { AdrComparisonChart } from "./components/AdrComparisonChart";
import { ComparablesTable, type SortColumn } from "./components/ComparablesTable";

/**
 * /properties/:id/market — Market Intel dashboard (Gap 3 — Track 2, semana 5-6).
 *
 * Zonas:
 *  1) PercentileHero (full-width)
 *  2) 4 KPI cards
 *  3) Gráfico ADR diário (sua propriedade vs comp set)
 *  4) Tabela 10 comparáveis anônimos (sortable, mobile vira cards)
 *  5) Empty state quando `comparables.length < 5`
 *
 * Mock controlado por `NEXT_PUBLIC_MARKET_INTEL_MOCK_DATA` em api.ts.
 */

const PERIOD_OPTIONS: ReadonlyArray<{ id: string; label: string; days: number }> = [
  { id: "30d", label: "Últimos 30 dias", days: 30 },
  { id: "60d", label: "Últimos 60 dias", days: 60 },
  { id: "90d", label: "Últimos 90 dias", days: 90 },
];

const MIN_COMPARABLES = 5;

function isoOffset(daysAhead: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
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
  const [data, setData] = useState<MarketIntelResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState<number>(0);

  const period = useMemo(
    () => PERIOD_OPTIONS.find((p) => p.id === periodId) ?? PERIOD_OPTIONS[0],
    [periodId],
  );

  // Carga inicial + reage a mudanças de período / reload.
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
        });
        if (!cancelled) {
          setData(result);
          trackEvent("market_intel_viewed", {
            propertyId,
            period: period.id,
            percentile: result.percentile,
            comparables: result.comparablesCount,
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
  }, [propertyId, period, reloadCount]);

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

  const handleSort = useCallback(
    (column: SortColumn) => {
      trackEvent("comparable_sorted", {
        propertyId,
        column,
      });
    },
    [propertyId],
  );

  const handleRetry = useCallback(() => {
    setReloadCount((c) => c + 1);
  }, []);

  const handleGotoProperties = useCallback(() => {
    router.push("/properties");
  }, [router]);

  // Render skeleton — 3 retângulos animados.
  if (loading && !data) {
    return (
      <AppPageShell maxWidth={1280}>
        <AppSectionHeader
          eyebrow="MERCADO · IMOVEIS PARECIDOS"
          title="Como seu imóvel se compara"
          subtitle="Comparacao com imoveis parecidos em ate 3 km · atualizado a cada 24h"
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            aria-busy="true"
            aria-label="Carregando destaque principal"
            className="urban-app-skeleton"
            style={{ height: 200, borderRadius: 16 }}
          />
          <div
            aria-busy="true"
            aria-label="Carregando resumo"
            className="urban-app-skeleton"
            style={{ height: 120, borderRadius: 12 }}
          />
          <div
            aria-busy="true"
            aria-label="Carregando gráfico e tabela"
            className="urban-app-skeleton"
            style={{ height: 360, borderRadius: 12 }}
          />
        </div>
      </AppPageShell>
    );
  }

  // Render erro
  if (error) {
    return (
      <AppPageShell maxWidth={1280}>
        <AppSectionHeader
          eyebrow="MERCADO · IMOVEIS PARECIDOS"
          title="Como seu imóvel se compara"
          subtitle="Comparacao com imoveis parecidos em ate 3 km · atualizado a cada 24h"
        />
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

  const insufficient = data.comparables.length < MIN_COMPARABLES;
  const deltaAdr = data.yourAdr - data.medianAdr;
  const deltaPct =
    data.medianAdr > 0 ? Math.round((deltaAdr / data.medianAdr) * 100) : 0;

  return (
    <AppPageShell maxWidth={1280}>
      <AppSectionHeader
        eyebrow="MERCADO · IMOVEIS PARECIDOS"
        title="Como seu imóvel se compara"
        subtitle={`Comparacao com imoveis parecidos em ate 3 km · atualizado a cada 24h${
          data.updatedAt
            ? ` · última atualização ${formatUpdatedAt(data.updatedAt)}`
            : ""
        }`}
        actions={
          <div style={{ minWidth: 220 }}>
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

      {insufficient ? (
        <AppEmptyState
          eyebrow="POUCOS IMOVEIS PARECIDOS"
          title="Ainda precisamos de mais referencias"
          body={`Precisamos de pelo menos ${MIN_COMPARABLES} imoveis parecidos no seu bairro para comparar com seguranca. Vamos buscar mais nos proximos 7 dias.`}
          icon={<Icons.MapPin size={32} />}
          action={
            <AppButton
              variant="primary"
              size="md"
              onClick={handleGotoProperties}
            >
              Ver outros imóveis
            </AppButton>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {/* ZONA 1 — Hero metric */}
          <PercentileHero
            percentile={data.percentile}
            neighborhood={data.neighborhood}
            comparablesCount={data.comparablesCount}
            medianAdr={data.medianAdr}
            trend30d={data.percentileTrend30d}
          />

          {/* ZONA 2 — 4 KPI cards */}
          <section aria-label="Indicadores chave">
            <div className="market-intel-kpi-grid">
              <KpiCardWrap>
                <AppMetricCard
                  label="Diaria media dos parecidos"
                  value={formatBRL(data.medianAdr)}
                  sub={`Bairro ${data.neighborhood}`}
                />
              </KpiCardWrap>
              <KpiCardWrap>
                <AppMetricCard
                  label="Ocupacao media dos parecidos"
                  value={formatPct(data.medianOccupancy)}
                  sub={`Sua ocupação ${formatPct(data.yourOccupancy)}`}
                />
              </KpiCardWrap>
              <KpiCardWrap>
                <AppMetricCard
                  label="Sua diaria vs media"
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
                  sub="Nota 0-100 · aumenta preco quando ha evento"
                />
              </KpiCardWrap>
            </div>
          </section>

          {/* ZONA 3 — Gráfico ADR */}
          <section
            aria-label="Comparativo de diaria media"
            style={{
              padding: 24,
              background: "var(--app-surface)",
              border: "1px solid var(--app-divider)",
              borderRadius: 12,
              boxShadow: "0 1px 2px rgba(14, 17, 22, 0.04)",
            }}
          >
            <header style={{ marginBottom: 16 }}>
              <p className="urban-app-eyebrow-muted">DIARIA MEDIA · {period.label.toUpperCase()}</p>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--app-text)",
                  margin: "6px 0 4px",
                  letterSpacing: -0.2,
                }}
              >
                Sua diaria comparada com imoveis parecidos
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--app-text-muted)",
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                Linha solida e o seu imovel · tracejada e a media dos {data.comparablesCount} imoveis parecidos.
              </p>
            </header>
            <AdrComparisonChart data={data.daily} />
          </section>

          {/* ZONA 4 — Tabela de comparáveis */}
          <section aria-label="Imóveis comparáveis">
            <header style={{ marginBottom: 16 }}>
              <p className="urban-app-eyebrow-muted">IMOVEIS PARECIDOS ANONIMOS</p>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--app-text)",
                  margin: "6px 0 4px",
                  letterSpacing: -0.2,
                }}
              >
                {data.comparables.length} imoveis parecidos na regiao
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--app-text-muted)",
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                Mostramos apenas numeros anonimos, sem identificar imoveis reais. Voce pode ordenar por qualquer coluna.
              </p>
            </header>
            <ComparablesTable comparables={data.comparables} onSort={handleSort} />
          </section>
        </div>
      )}

      <style>{`
        .market-intel-kpi-grid {
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (min-width: 900px) {
          .market-intel-kpi-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
      `}</style>
    </AppPageShell>
  );
}

function KpiCardWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 20,
        background: "var(--app-surface)",
        border: "1px solid var(--app-divider)",
        borderRadius: 12,
        boxShadow: "0 1px 2px rgba(14, 17, 22, 0.04)",
      }}
    >
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
