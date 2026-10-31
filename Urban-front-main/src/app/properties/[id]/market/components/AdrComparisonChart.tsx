"use client";

import React, { useMemo, useState } from "react";
import { parseLocalDate } from "@/app/lib/date";
import type { MarketIntelDailyPoint } from "../../../../service/api";
import { visuallyHiddenStyle } from "../../../../componentes/ui/styles";
import styles from "./AdrComparisonChart.module.css";
import { brlCompact, brlWhole } from "../../../../lib/format";

/**
 * <AdrComparisonChart> — SVG inline 2 séries (sua ADR vs mediana comp set).
 *
 *  - Linha sólida accent: yourAdr
 *  - Linha tracejada muted: medianAdr
 *  - Hover capture via overlay invisível → tooltip flutuante
 *  - Eixo Y em R$ ("R$ 240", "R$ 1,2 mil")
 *  - Eixo X com 5 ticks (dia 1, 8, 15, 22, 29 quando há 30 pontos)
 *
 * Memoizado quando `data` não muda (props comparison superficial via JSX —
 * o cálculo de geometria fica num useMemo).
 */
export interface AdrComparisonChartProps {
  data: ReadonlyArray<MarketIntelDailyPoint>;
  height?: number;
}

const PADDING_LEFT = 62;
const PADDING_RIGHT = 24;
const PADDING_TOP = 28;
const PADDING_BOTTOM = 32;
const VIEWBOX_WIDTH = 800;

function formatBRL(value: number): string {
  return brlWhole(value);
}

function formatAxisK(value: number): string {
  // Eixo Y compacto: 240 → "R$ 240", 1200 → "R$ 1,2 mil"
  return brlCompact(value);
}

function formatDateLong(iso: string): string {
  const d = parseLocalDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    weekday: "short",
  });
}

function formatDateShort(iso: string): string {
  const d = parseLocalDate(iso);
  if (!d) return iso;
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
    const indices: number[] = [];
    for (let i = 0; i < n; i += stride) indices.push(i);
    // O último ponto só entra se couber sem encostar no tick anterior (DS-19: "29 30").
    if (n - 1 - indices[indices.length - 1] >= stride * 0.6) indices.push(n - 1);
    return indices.map((i) => geometry.points[i]);
  }, [geometry.points]);

  if (!data || data.length === 0) {
    return (
      <div
        className={styles.emptyState}
      >
        Sem dados diários para o período selecionado.
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
      ? `Sua diária média subiu de ${formatBRL(first.yourAdr)} para ${formatBRL(last.yourAdr)} no período.`
      : last.yourAdr < first.yourAdr
        ? `Sua diária média caiu de ${formatBRL(first.yourAdr)} para ${formatBRL(last.yourAdr)} no período.`
        : `Sua diária média ficou estável em torno de ${formatBRL(last.yourAdr)} no período.`;

  return (
    <div className={styles.chartWrapper}>
      <p style={visuallyHiddenStyle}>{trendText}</p>
      <svg
        role="img"
        aria-label={`Gráfico comparativo de diária média, seu imóvel e imóveis parecidos, ${data.length} dias.`}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        className={styles.chartSvg}
        style={{ "--chart-h": `${height}px` } as React.CSSProperties}
      >
        <title>Comparativo de diária média</title>

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
                className={styles.axisTickLabel}
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
            className={styles.axisTickLabel}
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
              // outline:none inline de propósito: a regra global :focus-visible tem mais
              // especificidade que uma classe e faria o anel de foco aparecer.
              className={styles.hoverZone}
              style={{ outline: "none" }}
              aria-label={`${formatDateLong(p.date)} — sua diária média ${formatBRL(p.yourAdr)}, média dos parecidos ${formatBRL(p.medianAdr)}`}
            />
          );
        })}
      </svg>

      {hovered && (
        <div
          role="tooltip"
          className={styles.tooltip}
          style={{ "--tooltip-left": `${(hovered.x / VIEWBOX_WIDTH) * 100}%` } as React.CSSProperties}
        >
          <div className={styles.tooltipDate}>
            {formatDateLong(hovered.date)}
          </div>
          <div
            className={styles.tooltipBody}
          >
            <span>
              <span className={styles.tooltipYourLabel}>
                Sua diária
              </span>{" "}
              <span className={styles.tooltipYourValue}>
                {formatBRL(hovered.yourAdr)}
              </span>
            </span>
            <span className={styles.tooltipMedianLine}>
              Média dos parecidos {formatBRL(hovered.medianAdr)}
            </span>
          </div>
        </div>
      )}

      {/* Legenda */}
      <div
        className={styles.legendRow}
      >
        <span className={styles.legendItem}>
          <span
            className={styles.legendSwatchSolid}
          />
          Sua diária
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.legendSwatchDashed}
          />
          Média dos parecidos
        </span>
      </div>
    </div>
  );
}
