'use client';

import React from 'react';

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
    <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "8px 24px",
          borderRadius: 999,
          background: "#fff",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={() => onPageChange(Math.max(paginaAtual - 1, 1))}
          disabled={previousDisabled}
          style={pageButtonStyle(previousDisabled)}
        >
          {"<-"} Anterior
        </button>

        <p style={{ margin: 0, color: "#374151", fontSize: 16, fontWeight: 650 }}>
          Pagina {paginaAtual} de {totalPaginas}
        </p>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(paginaAtual + 1, totalPaginas))}
          disabled={nextDisabled}
          style={pageButtonStyle(nextDisabled)}
        >
          Proximo {"->"}
        </button>
      </div>
    </div>
  );
}

function pageButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "4px 12px",
    borderRadius: 999,
    border: "none",
    background: disabled ? "#E5E7EB" : "#2563EB",
    color: disabled ? "#6B7280" : "#fff",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.2s",
  };
}
