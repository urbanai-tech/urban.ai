'use client';

import React from 'react';
import styles from './Pagination.module.css';

interface PaginationProps {
  paginaAtual: number;
  totalPaginas: number;
  onPageChange: (novaPagina: number) => void;
}

export function Pagination({
  paginaAtual,
  totalPaginas,
  onPageChange,
}: PaginationProps) {
  const previousDisabled = paginaAtual === 1;
  const nextDisabled = paginaAtual === totalPaginas;

  return (
    <div className={styles.paginationRow}>
      <div className={styles.paginationBar}>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(paginaAtual - 1, 1))}
          disabled={previousDisabled}
          className={styles.pageButton}
          style={pageButtonColors(previousDisabled)}
        >
          {"<-"} Anterior
        </button>

        <p className={styles.paginationLabel} style={{ color: "#374151" }}>
          Pagina {paginaAtual} de {totalPaginas}
        </p>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(paginaAtual + 1, totalPaginas))}
          disabled={nextDisabled}
          className={styles.pageButton}
          style={pageButtonColors(nextDisabled)}
        >
          Próximo {"->"}
        </button>
      </div>
    </div>
  );
}

/** Cores sem token equivalente; o texto habilitado (branco) vem da classe. */
function pageButtonColors(disabled: boolean): React.CSSProperties {
  return disabled
    ? { background: "#E5E7EB", color: "#6B7280" }
    : { background: "#2563EB" };
}
