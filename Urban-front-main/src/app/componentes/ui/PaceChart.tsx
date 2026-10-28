"use client";

import React, { useMemo, useState } from "react";
import { parseLocalDate } from "@/app/lib/date";
import { AppEmptyState } from "./AppEmptyState";
import { TrendingUp } from "./Icons";
import styles from "./PaceChart.module.css";

/**
 * <PaceChart> — Gráfico de pace de reservas vs baseline esperado.
 *
 * Renderiza dois traces sobre 60 dias (ou o range fornecido):
 *  - Booked: % de noites já reservadas para datas futuras (área accent).
 *  - Expected: baseline esperado por sazonalidade (linha tracejada cinza).
 *
 * Eventos relevantes (data[i].eventLabel) viram annotation:
 *  - Linha vertical accent + label rotacionado 90° no topo.
 *
 * Implementado em SVG inline puro (sem recharts) — bundle zero-cost, total
 * controle sobre tipografia, e nenhuma dependência nova. A API/contrato segue
 * o padrão que Recharts usaria, então é trivial trocar depois sem mexer no
 * `<PaceChart>` em si.
 *
 * Tokens via CSS variables (--app-accent, --app-divider, --app-text-muted).
 * Acessível: aria-label descritivo, tooltip em hover via overlay invisível.
 */

export interface PacePoint {
  /** ISO date string YYYY-MM-DD ou Date parseable. */
  date: string;
  /** % de noites já reservadas (0-100). */
  booked: number;
  /** Baseline esperado para a data (0-100). */
  expected: number;
  /** Label do evento (opcional) — desenha annotation vertical. */
  eventLabel?: string | null;
}

export interface PaceChartProps {
  data: PacePoint[];
  /** Altura do canvas SVG em pixels. Default 260. */
  height?: number;
  /** Estado de loading — exibe skeleton no lugar do gráfico. */
  loading?: boolean;
}

// Geometria interna do canvas.
const PADDING_LEFT = 44;
const PADDING_RIGHT = 24;
const PADDING_TOP = 32;
const PADDING_BOTTOM = 32;

function formatDateShortPtBR(iso: string): string {
  const d = parseLocalDate(iso);
  if (!d) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return `${dd}/${months[d.getMonth()]}`;
}

function formatDateFullPtBR(iso: string): string {
  const d = parseLocalDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    weekday: "short",
  });
}

export function PaceChart({
  data,
  height = 260,
  loading = false,
}: PaceChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // ResponsiveContainer-style: usamos viewBox + preserveAspectRatio pra escalar
  // o SVG conforme largura do parent. Width fixo no viewBox = 800.
  const VIEWBOX_WIDTH = 800;
  const VIEWBOX_HEIGHT = height;
  const innerWidth = VIEWBOX_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const innerHeight = VIEWBOX_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    const n = data.length;
    return data.map((d, i) => {
      const x =
        PADDING_LEFT +
        (n === 1 ? innerWidth / 2 : (i / (n - 1)) * innerWidth);
      const yBooked =
        PADDING_TOP + innerHeight - (clamp01(d.booked) / 100) * innerHeight;
      const yExpected =
        PADDING_TOP + innerHeight - (clamp01(d.expected) / 100) * innerHeight;
      return { x, yBooked, yExpected, ...d };
    });
  }, [data, innerHeight, innerWidth]);

  // X-axis ticks esparsos (~a cada 7 dias, máx 8 labels)
  const xTicks = useMemo(() => {
    if (points.length === 0) return [];
    const stride = Math.max(1, Math.ceil(points.length / 8));
    return points.filter((_, i) => i % stride === 0 || i === points.length - 1);
  }, [points]);

  // Y-axis ticks: 0, 25, 50, 75, 100
  const yTicks = [0, 25, 50, 75, 100];

  // Loading skeleton
  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Carregando gráfico de reservas"
        className={`urban-app-skeleton ${styles.carregandoGraficoDe}`}
        style={{ height }}
      />
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <AppEmptyState
        eyebrow="SEM DADOS DE RESERVAS"
        title="Aguardando histórico"
        body="Assim que houver reservas futuras suficientes, o gráfico aparece aqui."
        icon={<TrendingUp size={32} />}
      />
    );
  }

  // Path para a área de "booked" (linha + fill até base)
  const bookedLinePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yBooked}`)
    .join(" ");
  const bookedAreaPath =
    bookedLinePath +
    ` L ${points[points.length - 1].x} ${PADDING_TOP + innerHeight}` +
    ` L ${points[0].x} ${PADDING_TOP + innerHeight} Z`;

  // Path para "expected" (linha tracejada)
  const expectedPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yExpected}`)
    .join(" ");

  const events = points.filter((p) => p.eventLabel && p.eventLabel.trim());
  const visibleEvents = events.slice(0, 8);
  const eventList = events.slice(0, 6);
  const hasCurveSignal = points.some((p) => clamp01(p.booked) > 0 || clamp01(p.expected) > 0);
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  if (!hasCurveSignal) {
    return (
      <div
        style={{ minHeight: height, gridTemplateColumns: events.length ? "minmax(0, 0.9fr) minmax(260px, 1.1fr)" : "1fr" }}
        className={`pace-empty-grid ${styles.paceEmptyGrid}`}
      >
        <div>
          <p className={`urban-app-eyebrow-muted ${styles.appEyebrowMuted}`}>
            Sem curva de ocupação
          </p>
          <h3 className={styles.paceChartSubheading}>
            Ainda não há reservas ou baseline suficientes para comparar.
          </h3>
          <p className={styles.paceChartText}>
            Neste estado, o bloco funciona melhor como agenda de eventos relevantes. Quando chegarem dados de
            ocupação futura, a curva volta a aparecer.
          </p>
        </div>

        {events.length > 0 && (
          <div className={styles.paceChartGrid}>
            {eventList.map((event, index) => (
              <div
                key={`${event.date}-${index}`}
                className={styles.paceChartGridSurfaceMuted}
              >
                <span className={styles.paceChartLabel}>
                  {formatDateShortPtBR(event.date)}
                </span>
                <span
                  className={styles.paceChartLabel13}
                  title={event.eventLabel ?? undefined}
                >
                  {event.eventLabel}
                </span>
              </div>
            ))}
            {events.length > eventList.length && (
              <p className={styles.paceChartText12}>
                +{events.length - eventList.length} {events.length - eventList.length === 1 ? "evento" : "eventos"} no período.
              </p>
            )}
          </div>
        )}

        <style>{`
          @media (max-width: 820px) {
            .pace-empty-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={styles.paceChartBox}>
      <svg
        role="img"
        aria-label={`Gráfico de reservas dos próximos ${points.length} dias. Reservado comparado ao esperado.`}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        className={styles.paceChartIcon} style={{ height }}
      >
        <defs>
          <linearGradient id="pace-booked-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--app-accent)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--app-accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Gridlines horizontais */}
        {yTicks.map((t) => {
          const y = PADDING_TOP + innerHeight - (t / 100) * innerHeight;
          return (
            <g key={`grid-${t}`}>
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
                className={styles.paceChartSvgText}
              >
                {t}%
              </text>
            </g>
          );
        })}

        {/* Event annotations (linha vertical + label rotacionada) */}
        {visibleEvents.map((ev, i) => (
          <g key={`ev-${i}`}>
            <line
              x1={ev.x}
              x2={ev.x}
              y1={PADDING_TOP}
              y2={PADDING_TOP + innerHeight}
              stroke="var(--app-accent)"
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity={0.55}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={ev.x} cy={PADDING_TOP + 5} r={3} fill="var(--app-accent)" />
            <title>{ev.eventLabel ?? "Evento relevante"}</title>
          </g>
        ))}

        {/* Área Booked (fill + stroke) */}
        <path d={bookedAreaPath} fill="url(#pace-booked-fill)" />
        <path
          d={bookedLinePath}
          fill="none"
          stroke="var(--app-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Linha Expected (tracejada cinza) */}
        <path
          d={expectedPath}
          fill="none"
          stroke="var(--app-text-muted)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.7}
          vectorEffect="non-scaling-stroke"
        />

        {/* X-axis labels */}
        {xTicks.map((p, i) => (
          <text
            key={`xt-${i}`}
            x={p.x}
            y={VIEWBOX_HEIGHT - 10}
            textAnchor="middle"
            fontSize={10}
            fill="var(--app-text-muted)"
            className={styles.paceChartSvgText}
          >
            {formatDateShortPtBR(p.date)}
          </text>
        ))}

        {/* Hover dot (sobre a curva booked) */}
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
              cy={hovered.yBooked}
              r={4}
              fill="var(--app-accent)"
              stroke="var(--app-surface)"
              strokeWidth={2}
            />
          </>
        )}

        {/* Hover capture — uma faixa transparente por ponto, pra capturar mouse */}
        {points.map((p, i) => {
          const prev = i === 0 ? p.x : (p.x + points[i - 1].x) / 2;
          const next =
            i === points.length - 1 ? p.x : (p.x + points[i + 1].x) / 2;
          return (
            <rect
              key={`hover-${i}`}
              x={prev}
              y={PADDING_TOP}
              width={Math.max(1, next - prev)}
              height={innerHeight}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className={styles.paceChartRect}
            />
          );
        })}
      </svg>

      {/* Tooltip flutuante */}
      {hovered && (
        <div
          role="tooltip"
          className={styles.paceChartAbs} style={{ left: `calc(${(hovered.x / VIEWBOX_WIDTH) * 100}% - 0px)` }}
        >
          <div className={styles.paceChartBox2}>
            {formatDateFullPtBR(hovered.date)}
          </div>
          <div className={styles.paceChartBoxTextMuted}>
            <span className={styles.paceChartLabelAccent}>
              {Math.round(hovered.booked)}% reservado
            </span>
            {" · "}
            esperado {Math.round(hovered.expected)}%
          </div>
          {hovered.eventLabel && (
            <div
              className={styles.paceChartBox11}
            >
              {hovered.eventLabel}
            </div>
          )}
        </div>
      )}

      {/* Legenda */}
      <div
        className={styles.paceChartRow}
      >
        <span className={styles.paceChartLabelGap6}>
          <span
            className={styles.paceChartLabelW12px}
          />
          Reservado
        </span>
        <span className={styles.paceChartLabelGap6}>
          <span
            className={styles.paceChartLabelH0}
          />
          Esperado
        </span>
        {events.length > 0 && (
          <span className={styles.paceChartLabelGap6}>
            <span
              className={styles.paceChartLabelW2px}
            />
            Evento relevante
          </span>
        )}
      </div>

      {events.length > 0 && (
        <div className={styles.paceChartRowGap8}>
          {eventList.map((event, index) => (
            <span
              key={`${event.date}-chip-${index}`}
              title={event.eventLabel ?? undefined}
              className={styles.paceChartLabel11}
            >
              <span className={styles.paceChartLabel2}>{formatDateShortPtBR(event.date)}</span>
              <span className={styles.paceChartLabel3}>
                {event.eventLabel}
              </span>
            </span>
          ))}
          {events.length > eventList.length && (
            <span className={styles.paceChartLabelTextMuted}>
              +{events.length - eventList.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}
