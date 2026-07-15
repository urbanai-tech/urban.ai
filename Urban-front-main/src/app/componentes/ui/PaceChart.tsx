"use client";

import React, { useMemo, useState } from "react";
import { parseLocalDate } from "@/app/lib/date";
import { AppEmptyState } from "./AppEmptyState";
import { TrendingUp } from "./Icons";

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
        className="urban-app-skeleton"
        style={{
          width: "100%",
          height,
          borderRadius: 8,
        }}
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
        style={{
          minHeight: height,
          display: "grid",
          gridTemplateColumns: events.length ? "minmax(0, 0.9fr) minmax(260px, 1.1fr)" : "1fr",
          gap: 18,
          alignItems: "center",
        }}
        className="pace-empty-grid"
      >
        <div>
          <p className="urban-app-eyebrow-muted" style={{ marginBottom: 8 }}>
            Sem curva de ocupação
          </p>
          <h3 style={{ margin: 0, color: "var(--app-text)", fontSize: 20, lineHeight: 1.25 }}>
            Ainda não há reservas ou baseline suficientes para comparar.
          </h3>
          <p style={{ margin: "8px 0 0", color: "var(--app-text-muted)", fontSize: 13, lineHeight: 1.5 }}>
            Neste estado, o bloco funciona melhor como agenda de eventos relevantes. Quando chegarem dados de
            ocupação futura, a curva volta a aparecer.
          </p>
        </div>

        {events.length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            {eventList.map((event, index) => (
              <div
                key={`${event.date}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px minmax(0, 1fr)",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--app-divider)",
                  background: "var(--app-surface-muted)",
                }}
              >
                <span style={{ color: "var(--app-accent)", fontSize: 12, fontWeight: 750 }}>
                  {formatDateShortPtBR(event.date)}
                </span>
                <span
                  style={{
                    minWidth: 0,
                    color: "var(--app-text)",
                    fontSize: 13,
                    fontWeight: 650,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={event.eventLabel ?? undefined}
                >
                  {event.eventLabel}
                </span>
              </div>
            ))}
            {events.length > eventList.length && (
              <p style={{ margin: 0, color: "var(--app-text-muted)", fontSize: 12 }}>
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
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        role="img"
        aria-label={`Gráfico de reservas dos próximos ${points.length} dias. Reservado comparado ao esperado.`}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height, display: "block" }}
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
                style={{ fontFamily: "Inter, sans-serif" }}
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
            style={{ fontFamily: "Inter, sans-serif" }}
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
              style={{ cursor: "crosshair" }}
            />
          );
        })}
      </svg>

      {/* Tooltip flutuante */}
      {hovered && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            // Posicionamento percentual baseado no viewBox
            left: `calc(${(hovered.x / VIEWBOX_WIDTH) * 100}% - 0px)`,
            top: 4,
            transform: "translateX(-50%)",
            background: "var(--app-surface)",
            border: "1px solid var(--app-divider-strong)",
            borderRadius: 8,
            padding: "8px 12px",
            boxShadow: "var(--app-shadow-elevated)",
            fontSize: 12,
            color: "var(--app-text)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 2,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {formatDateFullPtBR(hovered.date)}
          </div>
          <div style={{ color: "var(--app-text-muted)" }}>
            <span style={{ color: "var(--app-accent)", fontWeight: 600 }}>
              {Math.round(hovered.booked)}% reservado
            </span>
            {" · "}
            esperado {Math.round(hovered.expected)}%
          </div>
          {hovered.eventLabel && (
            <div
              style={{
                marginTop: 4,
                paddingTop: 4,
                borderTop: "1px solid var(--app-divider)",
                color: "var(--app-accent)",
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              {hovered.eventLabel}
            </div>
          )}
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
              width: 12,
              height: 3,
              background: "var(--app-accent)",
              borderRadius: 2,
            }}
          />
          Reservado
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 0,
              borderTop: "2px dashed var(--app-text-muted)",
            }}
          />
          Esperado
        </span>
        {events.length > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: 12,
                background: "var(--app-accent)",
                opacity: 0.6,
              }}
            />
            Evento relevante
          </span>
        )}
      </div>

      {events.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {eventList.map((event, index) => (
            <span
              key={`${event.date}-chip-${index}`}
              title={event.eventLabel ?? undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                maxWidth: 220,
                padding: "6px 8px",
                borderRadius: 999,
                border: "1px solid var(--app-divider)",
                color: "var(--app-text-muted)",
                background: "var(--app-surface-muted)",
                fontSize: 11,
                fontWeight: 650,
              }}
            >
              <span style={{ color: "var(--app-accent)" }}>{formatDateShortPtBR(event.date)}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {event.eventLabel}
              </span>
            </span>
          ))}
          {events.length > eventList.length && (
            <span style={{ color: "var(--app-text-muted)", fontSize: 11, alignSelf: "center" }}>
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
