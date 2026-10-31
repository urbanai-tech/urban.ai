"use client";

import React from "react";
import { asArray } from "../../lib/api-normalize";
import styles from "./AdminTable.module.css";

/**
 * Tabela admin Urban AI. Substitui o padrão `<table className="w-full text-sm">`
 * + `<thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500">`
 * espalhado em todas as telas admin antigas com tr sem hover, sem sticky header,
 * sem scroll indicator.
 *
 * Features:
 *  - Sticky header
 *  - Row hover com border-bottom accent da marca (via .urban-admin-row em globals.css)
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
  minWidth?: number | string;
  style?: React.CSSProperties;
};

function alignClass(align: Column<unknown>["align"]) {
  return align === "right" ? styles.alignRight : align === "center" ? styles.alignCenter : "";
}

export function AdminTable<T>({
  columns,
  rows: rowsProp,
  rowKey,
  onRowClick,
  empty,
  caption,
  stickyHeader = true,
  maxHeight,
  minWidth,
  style,
}: Props<T>) {
  // E2E-09: resposta sem lista não derruba a tabela; cai no estado vazio.
  const rows = asArray<T>(rowsProp);
  const tableMinWidth = minWidth ?? Math.max(560, columns.length * 140);

  return (
    // Região rolável precisa de foco por teclado (axe: scrollable-region-focusable) e de nome.
    <div
      role="region"
      tabIndex={0}
      aria-label={typeof caption === "string" ? caption : "Tabela de dados"}
      className={`${styles.wrapper} ${maxHeight ? styles.wrapperScroll : ""}`}
      style={{ maxHeight, ...style }}
    >
      <table
        className={styles.table}
        style={{ minWidth: tableMinWidth }}
      >
        {caption && (
          <caption
            className={styles.caption}
          >
            {caption}
          </caption>
        )}
        <thead className={`${styles.thead} ${stickyHeader ? styles.theadSticky : ""}`}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${styles.th} ${alignClass(col.align)}`}
                style={{ width: col.width }}
              >
                {col.header === "" ? <span className={styles.srOnly}>Ações</span> : col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length} className={styles.emptyCell}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                className={`urban-admin-row ${styles.row} ${onRowClick ? styles.rowClickable : ""}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${styles.td} ${alignClass(col.align)}`}
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
