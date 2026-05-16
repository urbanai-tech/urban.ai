"use client";

import React from "react";

/**
 * Tabela admin Urban AI. Substitui o padrão `<table className="w-full text-sm">`
 * + `<thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500">`
 * espalhado em todas as telas admin antigas com tr sem hover, sem sticky header,
 * sem scroll indicator.
 *
 * Features:
 *  - Sticky header
 *  - Row hover com border-bottom #E8500A (via .urban-admin-row em globals.css)
 *  - Scroll indicator (sombra lateral quando overflow horizontal)
 *  - Slot empty state
 */

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  /** Largura — string CSS (`120px`, `15%`, `minmax(120px, 1fr)`) ou number (px) */
  width?: string | number;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  caption?: React.ReactNode;
  stickyHeader?: boolean;
  maxHeight?: number | string;
  style?: React.CSSProperties;
};

export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  caption,
  stickyHeader = true,
  maxHeight,
  style,
}: Props<T>) {
  return (
    <div
      style={{
        position: "relative",
        overflowX: "auto",
        overflowY: maxHeight ? "auto" : "visible",
        maxHeight,
        border: "1px solid var(--admin-divider)",
        borderRadius: 2,
        ...style,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
          color: "var(--admin-text)",
        }}
      >
        {caption && (
          <caption
            style={{
              padding: "12px 16px",
              textAlign: "left",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--admin-text-muted)",
              fontWeight: 600,
              borderBottom: "1px solid var(--admin-divider)",
            }}
          >
            {caption}
          </caption>
        )}
        <thead
          style={{
            position: stickyHeader ? "sticky" : "static",
            top: 0,
            background: "rgba(8, 10, 15, 0.95)",
            backdropFilter: "blur(8px)",
            zIndex: 1,
          }}
        >
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: "12px 16px",
                  textAlign: col.align ?? "left",
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "var(--admin-text-muted)",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--admin-divider)",
                  width: col.width,
                  whiteSpace: "nowrap",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: 32 }}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                className="urban-admin-row"
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  cursor: onRowClick ? "pointer" : "default",
                  borderBottom: "1px solid var(--admin-divider)",
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: "14px 16px",
                      textAlign: col.align ?? "left",
                      verticalAlign: "middle",
                    }}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
