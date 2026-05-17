"use client";

import React, { useMemo, useState } from "react";
import type { MarketIntelDailyPoint } from "../../../../service/api";

/**
 * <AdrComparisonChart> — SVG inline 2 séries (sua ADR vs mediana comp set).
 *
 *  - Linha sólida accent: yourAdr
 *  - Linha tracejada muted: medianAdr
 *  - Hover capture via overlay invisível → tooltip flutuante
 *  - Eixo Y em R$ k (0.2k, 0.3k)
 *  - Eixo X com 5 ticks (dia 1, 8, 15, 22, 29 quando há 30 pontos)
 *
 * Memoizado quando `data` não muda (props comparison superficial via JSX —
 * o cálculo de geometria fica num useMemo).
 */
export interface AdrComparisonChartProps {
  data: ReadonlyArray<MarketIntelDailyPoint>;
  height?: number;
}

const PADDING_LEFT = 52;
const PADDING_RIGHT = 24;
const PADDING_TOP = 28;
const PADDING_BOTTOM = 32;
const VIEWBOX_WIDTH = 800;

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatAxisK(value: number): string {
  // Ex: 240 → "R$ 0,2k" — eixo Y compacto
  const k = value / 1000;
  return `R$ ${k.toFixed(1).replace(".", ",")}k`;
}

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    weekday: "short",
  });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return String(d.getDate());
}

export function AdrComparisonChart({
  data,
  height = 280,
}: AdrComparisonChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const VIEWBOX_HEIGHT = height;
  const innerWidth = VIEWBOX_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const innerHeight = VIEWBOX_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const geometry = useMemo(() => {
    if (!data || data.length === 0) {
      return { points: [], yMin: 0, yMax: 0, yTicks: [] as number[] };
    }
    // Calcula faixa Y combinando ambas séries com folga de 10% em cima/baixo
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const p of data) {
      if (p.yourAdr < yMin) yMin = p.yourAdr;
      if (p.medianAdr < yMin) yMin = p.medianAdr;
      if (p.yourAdr > yMax) yMax = p.yourAdr;
      if (p.medianAdr > yMax) yMax = p.medianAdr;
    }
    const span = Math.max(20, yMax - yMin);
    yMin = Math.floor((yMin - span * 0.1) / 20) * 20;
    yMax = Math.ceil((yMax + span * 0.1) / 20) * 20;

    const n = data.length;
    const points = data.map((d, i) => {
      const x =
        PADDING_LEFT +
        (n === 1 ? innerWidth / 2 : (i / (n - 1)) * innerWidth);
      const ratioYour = (d.yourAdr - yMin) / (yMax - yMin || 1);
      const ratioMed = (d.medianAdr - yMin) / (yMax - yMin || 1);
      const yYour = PADDING_TOP + innerHeight - ratioYour * innerHeight;
      const yMed = PADDING_TOP + innerHeight - ratioMed * innerHeight;
      return {
        ...d,
        idx: i,
        x,
        yYour,
        yMed,
      };
    });

    // 5 ticks Y igualmente distribuídos
    const yTickCount = 5;
    const yTicks: number[] = [];
    for (let i = 0; i < yTickCount; i++) {
      yTicks.push(yMin + ((yMax - yMin) * i) / (yTickCount - 1));
    }

    return { points, yMin, yMax, yTicks };
  }, [data, innerHeight, innerWidth]);

  // X ticks: 5 dias esparsos (1, 8, 15, 22, 29 quando 30 pontos)
  const xTicks = useMemo(() => {
    if (geometry.points.length === 0) return [];
    const n = geometry.points.length;
    const stride = Math.max(1, Math.floor((n - 1) / 4));
    const indices = new Set<number>();
    for (let i = 0; i < n; i += stride) indices.add(i);
    indices.add(n - 1);
    return Array.from(indices)
      .sort((a, b) => a - b)
      .map((i) => geometry.points[i]);
  }, [geometry.points]);

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          color: "var(--app-text-muted)",
          fontSize: 13,
          border: "1px dashed var(--app-divider-strong)",
          borderRadius: 12,
        }}
      >
        Sem série diária para o período selecionado.
      </div>
    );
  }

  const yourPath = geometry.points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yYour}`)
    .join(" ");
  const medianPath = geometry.points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yMed}`)
    .join(" ");

  const hovered = hoverIdx !== null ? geometry.points[hoverIdx] : null;

  // Resumo textual pra leitor de tela
  const last = geometry.points[geometry.points.length - 1];
  const first = geometry.points[0];
  const trendText =
    last.yourAdr > first.yourAdr
      ? `Seu ADR subiu de ${formatBRL(first.yourAdr)} para ${formatBRL(last.yourAdr)} no período.`
      : last.yourAdr < first.yourAdr
        ? `Seu ADR caiu de ${formatBRL(first.yourAdr)} para ${formatBRL(last.yourAdr)} no período.`
        : `Seu ADR ficou estável em torno de ${formatBRL(last.yourAdr)} no período.`;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <p className="sr-only">{trendText}</p>
      <svg
        role="img"
        aria-label={`Gráfico comparativo de ADR diário (sua propriedade vs mediana do comp set), ${data.length} dias.`}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height, display: "block" }}
      >
        <title>Comparativo ADR diário — sua propriedade vs comp set</title>

        {/* Gridlines Y */}
        {geometry.yTicks.map((t, i) => {
          const ratio = (t - geometry.yMin) / (geometry.yMax - geometry.yMin || 1);
          const y = PADDING_TOP + innerHeight - ratio * innerHeight;
          return (
            <g key={`gy-${i}`}>
              <line
                x1={PADDING_LEFT}
                x2={VIEWBOX_WIDTH - PADDING_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--app-divider)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PADDING_LEFT - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="var(--app-text-muted)"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {formatAxisK(t)}
              </text>
            </g>
          );
        })}

        {/* Linha mediana (tracejada) */}
        <path
          d={medianPath}
          fill="none"
          stroke="var(--app-text-muted)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.75}
          vectorEffect="non-scaling-stroke"
        />

        {/* Linha do seu ADR (sólida accent) */}
        <path
          d={yourPath}
          fill="none"
          stroke="var(--app-accent)"
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* X labels — dias */}
        {xTicks.map((p, i) => (
          <text
            key={`xt-${i}`}
            x={p.x}
            y={VIEWBOX_HEIGHT - 10}
            textAnchor="middle"
            fontSize={10}
            fill="var(--app-text-muted)"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            {formatDateShort(p.date)}
          </text>
        ))}

        {/* Hover indicador */}
        {hovered && (
          <>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={PADDING_TOP}
              y2={PADDING_TOP + innerHeight}
              stroke="var(--app-text-muted)"
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity={0.5}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={hovered.x}
              cy={hovered.yYour}
              r={4.5}
              fill="var(--app-accent)"
              stroke="var(--app-surface)"
              strokeWidth={2}
            />
            <circle
              cx={hovered.x}
              cy={hovered.yMed}
              r={4}
              fill="var(--app-text-muted)"
              stroke="var(--app-surface)"
              strokeWidth={2}
            />
          </>
        )}

        {/* Hover capture rects */}
        {geometry.points.map((p, i) => {
          const prev = i === 0 ? p.x : (p.x + geometry.points[i - 1].x) / 2;
          const next =
            i === geometry.points.length - 1
              ? p.x
              : (p.x + geometry.points[i + 1].x) / 2;
          return (
            <rect
              key={`hov-${i}`}
              x={prev}
              y={PADDING_TOP}
              width={Math.max(1, next - prev)}
              height={innerHeight}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onFocus={() => setHoverIdx(i)}
              onBlur={() => setHoverIdx(null)}
              tabIndex={0}
              style={{ cursor: "crosshair", outline: "none" }}
              aria-label={`${formatDateLong(p.date)} — seu ADR ${formatBRL(p.yourAdr)}, mediana ${formatBRL(p.medianAdr)}`}
            />
          );
        })}
      </svg>

      {hovered && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            left: `calc(${(hovered.x / VIEWBOX_WIDTH) * 100}% - 0px)`,
            top: 4,
            transform: "translateX(-50%)",
            background: "var(--app-surface)",
            border: "1px solid var(--app-divider-strong)",
            borderRadius: 8,
            padding: "10px 14px",
            boxShadow: "0 4px 16px rgba(14, 17, 22, 0.10)",
            fontSize: 12,
            color: "var(--app-text)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 2,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {formatDateLong(hovered.date)}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <span>
              <span style={{ color: "var(--app-accent)", fontWeight: 600 }}>
                Seu ADR
              </span>{" "}
              <span style={{ color: "var(--app-text)" }}>
                {formatBRL(hovered.yourAdr)}
              </span>
            </span>
            <span style={{ color: "var(--app-text-muted)" }}>
              Mediana comp set {formatBRL(hovered.medianAdr)}
            </span>
          </div>
        </div>
      )}

      {/* Legenda */}
      <div
        style={{
          display: "flex",
          gap: 20,
          marginTop: 12,
          flexWrap: "wrap",
          fontSize: 12,
          color: "var(--app-text-muted)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 3,
              background: "var(--app-accent)",
              borderRadius: 2,
            }}
          />
          Seu ADR
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 0,
              borderTop: "2px dashed var(--app-text-muted)",
            }}
          />
          Mediana comp set
        </span>
      </div>
    </div>
  );
}
