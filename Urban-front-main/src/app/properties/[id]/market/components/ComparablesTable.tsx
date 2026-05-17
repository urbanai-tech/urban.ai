"use client";

import React, { useMemo, useState } from "react";
import type { ComparableProperty } from "../../../../service/api";
import { Info } from "../../../../componentes/ui/Icons";

/**
 * <ComparablesTable> — 10 imóveis anônimos comparáveis ao seu, com ordenação
 * client-side por coluna. Mobile-first: vira lista de cards verticais < 768px.
 *
 * Acessibilidade:
 *  - <caption> descritivo
 *  - aria-sort no header da coluna ativa
 *  - tooltip explicativo no header de Score
 *  - keyboard navigation: tab pelos headers sortable + Enter/Space pra ordenar
 */
export interface ComparablesTableProps {
  comparables: ReadonlyArray<ComparableProperty>;
  /** Disparado quando o usuário troca a ordenação. */
  onSort?: (column: SortColumn) => void;
}

export type SortColumn = "adr" | "occupancy" | "distance" | "score";
type SortDirection = "asc" | "desc";

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

function formatDistance(value: number): string {
  return `${value.toFixed(1).replace(".", ",")} km`;
}

function typeLabel(type: ComparableProperty["type"]): string {
  switch (type) {
    case "apartamento":
      return "Apartamento";
    case "casa":
      return "Casa";
    case "loft":
      return "Loft";
    case "studio":
      return "Studio";
  }
}

function bedroomsLabel(bedrooms: number): string {
  if (bedrooms === 0) return "—";
  if (bedrooms === 1) return "1 quarto";
  return `${bedrooms} quartos`;
}

export function ComparablesTable({
  comparables,
  onSort,
}: ComparablesTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
    onSort?.(column);
  };

  const sorted = useMemo(() => {
    const arr = [...comparables];
    arr.sort((a, b) => {
      let av = 0;
      let bv = 0;
      switch (sortColumn) {
        case "adr":
          av = a.medianAdr;
          bv = b.medianAdr;
          break;
        case "occupancy":
          av = a.occupancy;
          bv = b.occupancy;
          break;
        case "distance":
          av = a.distanceKm;
          bv = b.distanceKm;
          break;
        case "score":
          av = a.similarityScore;
          bv = b.similarityScore;
          break;
      }
      return sortDirection === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [comparables, sortColumn, sortDirection]);

  const ariaSort = (col: SortColumn): "ascending" | "descending" | "none" => {
    if (sortColumn !== col) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  };

  return (
    <div>
      {/* Versão tabela (>= 768px) */}
      <div
        className="market-intel-table-wrap"
        style={{
          overflowX: "auto",
          border: "1px solid var(--app-divider)",
          borderRadius: 12,
          background: "var(--app-surface)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
          }}
        >
          <caption className="sr-only">
            Lista de {comparables.length} imóveis comparáveis ao seu, anônimos.
            Use os botões de cabeçalho pra ordenar por ADR, ocupação, distância
            ou similaridade.
          </caption>
          <thead>
            <tr
              style={{
                background: "var(--app-surface-muted)",
                borderBottom: "1px solid var(--app-divider-strong)",
              }}
            >
              <ColHeader>#</ColHeader>
              <ColHeader>Tipo</ColHeader>
              <ColHeader>Quartos</ColHeader>
              <SortableColHeader
                label="ADR mediano"
                active={sortColumn === "adr"}
                direction={sortDirection}
                ariaSort={ariaSort("adr")}
                onClick={() => handleSort("adr")}
                align="right"
              />
              <SortableColHeader
                label="Ocupação"
                active={sortColumn === "occupancy"}
                direction={sortDirection}
                ariaSort={ariaSort("occupancy")}
                onClick={() => handleSort("occupancy")}
                align="right"
              />
              <SortableColHeader
                label="Distância"
                active={sortColumn === "distance"}
                direction={sortDirection}
                ariaSort={ariaSort("distance")}
                onClick={() => handleSort("distance")}
                align="right"
              />
              <SortableColHeader
                label="Score similaridade"
                active={sortColumn === "score"}
                direction={sortDirection}
                ariaSort={ariaSort("score")}
                onClick={() => handleSort("score")}
                align="left"
                tooltip="Score de 0 a 1 calculado por tipo, tamanho, distância e padrão de preço. Quanto mais perto de 1, mais similar."
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr
                key={`${c.anonymousId}-${c.distanceKm}`}
                className="market-intel-row"
                style={{
                  borderBottom: "1px solid var(--app-divider)",
                }}
              >
                <td style={cellStyle}>
                  <span
                    style={{
                      fontWeight: 600,
                      color: "var(--app-text)",
                    }}
                  >
                    Imóvel {c.anonymousId}
                  </span>
                </td>
                <td style={cellStyle}>{typeLabel(c.type)}</td>
                <td style={cellStyle}>{bedroomsLabel(c.bedrooms)}</td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  {formatBRL(c.medianAdr)}
                </td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  {formatPct(c.occupancy)}
                </td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  {formatDistance(c.distanceKm)}
                </td>
                <td style={cellStyle}>
                  <SimilarityBar value={c.similarityScore} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Versão mobile (cards) */}
      <div
        className="market-intel-cards"
        aria-hidden="true"
        style={{ display: "none", flexDirection: "column", gap: 12 }}
      >
        {sorted.map((c) => (
          <div
            key={`m-${c.anonymousId}-${c.distanceKm}`}
            style={{
              padding: 16,
              background: "var(--app-surface)",
              border: "1px solid var(--app-divider)",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--app-text)",
                }}
              >
                Imóvel {c.anonymousId}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "var(--app-text-muted)",
                }}
              >
                {typeLabel(c.type)} · {bedroomsLabel(c.bedrooms)}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                fontSize: 12,
              }}
            >
              <MiniStat label="ADR mediano" value={formatBRL(c.medianAdr)} />
              <MiniStat label="Ocupação" value={formatPct(c.occupancy)} />
              <MiniStat label="Distância" value={formatDistance(c.distanceKm)} />
              <MiniStat
                label="Score similar."
                value={<SimilarityBar value={c.similarityScore} />}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile CSS via tag <style> escopado pra esta tela */}
      <style>{`
        @media (max-width: 767px) {
          .market-intel-table-wrap { display: none; }
          .market-intel-cards { display: flex !important; }
        }
        .market-intel-row:hover { background: var(--app-surface-muted); }
      `}</style>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "14px 16px",
  color: "var(--app-text)",
  verticalAlign: "middle",
  fontSize: 13,
};

function ColHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      style={{
        padding: "12px 16px",
        textAlign: align,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: "var(--app-text-muted)",
      }}
    >
      {children}
    </th>
  );
}

function SortableColHeader({
  label,
  active,
  direction,
  ariaSort,
  onClick,
  align = "left",
  tooltip,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  ariaSort: "ascending" | "descending" | "none";
  onClick: () => void;
  align?: "left" | "right";
  tooltip?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      style={{
        padding: 0,
        textAlign: align,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          textAlign: align,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: active ? "var(--app-text)" : "var(--app-text-muted)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          justifyContent: align === "right" ? "flex-end" : "flex-start",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <span>{label}</span>
        {tooltip && (
          <span
            title={tooltip}
            aria-label={tooltip}
            style={{ display: "inline-flex", alignItems: "center" }}
          >
            <Info size={12} />
          </span>
        )}
        <span aria-hidden style={{ fontSize: 10, opacity: active ? 1 : 0.4 }}>
          {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function SimilarityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 130,
      }}
      aria-label={`Score de similaridade ${pct} por cento`}
    >
      <div
        style={{
          position: "relative",
          flex: 1,
          height: 6,
          background: "var(--app-surface-muted)",
          borderRadius: 999,
          overflow: "hidden",
          border: "1px solid var(--app-divider)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${pct}%`,
            background: "var(--app-accent)",
            borderRadius: 999,
          }}
        />
      </div>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
          color: "var(--app-text)",
          fontSize: 12,
          minWidth: 32,
          textAlign: "right",
        }}
      >
        {value.toFixed(2).replace(".", ",")}
      </span>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "var(--app-text-muted)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "var(--app-text)",
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}
