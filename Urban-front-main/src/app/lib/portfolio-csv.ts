import { csvCell } from "./csv-safe";

/**
 * Export CSV do portfólio (calendário já carregado na tela): uma linha por imóvel e dia.
 * Toda célula passa por `csvCell` (aspas + neutralização de fórmula do Excel/Sheets), inclusive
 * o nome do imóvel e o do evento, que vêm de texto livre. Sem valor => célula vazia (nunca 0).
 *
 * Só dados que o anfitrião já vê na tela; nada de proprietário, e-mail ou ID interno.
 */
export type PortfolioCsvDay = {
  date: string;
  atual: number | null | undefined;
  sugestao: number | null | undefined;
  base?: number | null;
  evento?: { nome?: string | null; impacto?: string | null } | null;
};

export type PortfolioCsvProperty = {
  name: string;
  days: PortfolioCsvDay[];
};

export const PORTFOLIO_CSV_HEADERS = [
  "imovel",
  "data",
  "preco_atual",
  "preco_sugerido",
  "preco_base",
  "diferenca_sugerido_atual",
  "evento",
  "impacto_evento",
] as const;

function numberOrEmpty(value: number | null | undefined): number | "" {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

export function buildPortfolioCsv(properties: PortfolioCsvProperty[]): { csv: string; rows: number } {
  const lines: string[] = [PORTFOLIO_CSV_HEADERS.map(csvCell).join(",")];
  let rows = 0;
  for (const property of properties) {
    for (const day of property.days ?? []) {
      const atual = numberOrEmpty(day.atual);
      const sugestao = numberOrEmpty(day.sugestao);
      const diff = atual === "" || sugestao === "" ? "" : Math.round((sugestao - atual) * 100) / 100;
      lines.push(
        [
          property.name,
          day.date,
          atual,
          sugestao,
          numberOrEmpty(day.base),
          diff,
          day.evento?.nome ?? "",
          day.evento?.impacto ?? "",
        ]
          .map(csvCell)
          .join(","),
      );
      rows += 1;
    }
  }
  // BOM para o Excel abrir acentos em UTF-8; CRLF é o fim de linha padrão de CSV.
  return { csv: `﻿${lines.join("\r\n")}\r\n`, rows };
}

export function portfolioCsvFileName(from: string, to: string): string {
  const safe = (value: string) => value.replace(/[^0-9-]/g, "");
  return `portfolio-${safe(from)}_${safe(to)}.csv`;
}
