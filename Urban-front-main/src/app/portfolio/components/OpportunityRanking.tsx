"use client";

import React from "react";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardHeader,
  Icons,
} from "../../componentes/ui";
import styles from "./OpportunityRanking.module.css";

export type PortfolioOpportunityRankingItem = {
  id: string;
  propertyId: string;
  propertyName: string;
  title: string;
  reason?: string | null;
  dates: string[];
  currentPrice?: number | null;
  suggestedPrice?: number | null;
  liftAmount?: number | null;
  liftPercent?: number | null;
  risk?: number | null;
  confidence?: number | null;
  strategyApplied?: string | null;
  score?: number | null;
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  })}%`;
}

function formatShortDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function formatDates(dates: string[]): string {
  if (dates.length === 0) return "sem data recomendada";
  if (dates.length === 1) return formatShortDate(dates[0]);
  const visible = dates.slice(0, 2).map(formatShortDate).join(", ");
  const extra = dates.length - 2;
  return extra > 0 ? `${visible} +${extra}` : visible;
}

export function OpportunityRanking({
  items,
  selectedKeys,
  onSelect,
}: {
  items: PortfolioOpportunityRankingItem[];
  selectedKeys: Set<string>;
  onSelect: (item: PortfolioOpportunityRankingItem) => void;
}) {
  return (
    <AppCard variant="default" style={{ marginBottom: 20 }}>
      <AppCardHeader
        eyebrow="RANKING"
        title="Oportunidades recomendadas"
        subtitle="Priorize as mudanças com maior impacto esperado e selecione datas para a ação em lote."
      />

      {items.length === 0 ? (
        <div
          className={styles.s1}
        >
          <Icons.Check size={16} />
          <span>Nenhuma oportunidade clara nesta janela.</span>
        </div>
      ) : (
        <div
          role="list"
          className={styles.s2}
        >
          {items.slice(0, 8).map((item, index) => {
            const selected = item.dates.some((date) =>
              selectedKeys.has(`${item.propertyId}|${date}`),
            );
            return (
              <div
                role="listitem"
                key={item.id}
                className={styles.s3}
              >
                <div
                  className={`urban-app-display ${styles.s4} ${selected ? styles.s5 : styles.s6}`}
                >
                  {index + 1}
                </div>

                <div className={styles.s7}>
                  <div
                    className={styles.s8}
                  >
                    <strong
                      className={styles.s9}
                    >
                      {item.title}
                    </strong>
                    {item.strategyApplied && (
                      <AppBadge kind="neutral">{item.strategyApplied}</AppBadge>
                    )}
                    {selected && <AppBadge kind="accent">Selecionada</AppBadge>}
                  </div>

                  <p
                    className={styles.s10}
                  >
                    {item.propertyName} · {formatDates(item.dates)}
                    {item.reason ? ` · ${item.reason}` : ""}
                  </p>

                  <div
                    className={styles.s11}
                  >
                    <span>
                      Lift:{" "}
                      <strong className={styles.s12}>
                        {item.liftAmount != null
                          ? formatCurrency(item.liftAmount)
                          : formatPercent(item.liftPercent)}
                      </strong>
                    </span>
                    <span>
                      Atual:{" "}
                      <strong className={styles.s12}>
                        {formatCurrency(item.currentPrice)}
                      </strong>
                    </span>
                    <span>
                      Sugerido:{" "}
                      <strong className={styles.s12}>
                        {formatCurrency(item.suggestedPrice)}
                      </strong>
                    </span>
                    <span>
                      Risco/conf.:{" "}
                      <strong className={styles.s12}>
                        {formatPercent(item.risk)} / {formatPercent(item.confidence)}
                      </strong>
                    </span>
                  </div>
                </div>

                <AppButton
                  size="sm"
                  variant={selected ? "secondary" : "primary"}
                  onClick={() => onSelect(item)}
                  leftIcon={<Icons.Calendar size={13} />}
                >
                  Selecionar
                </AppButton>
              </div>
            );
          })}
        </div>
      )}
    </AppCard>
  );
}
