"use client";

import React, { useState } from "react";
import { AppButton, AppInput, Icons } from "../../componentes/ui";

export type PortfolioToolbarAction =
  | { type: "apply-strategy"; strategy: string }
  | { type: "set-base-price"; price: number }
  | { type: "set-date-price"; price: number }
  | { type: "accept-suggestions" }
  | { type: "apply-internal" };

export interface PortfolioToolbarProps {
  selectedCount: number;
  selectedDatesCount: number;
  totalCount: number;
  onClearSelection?: () => void;
  onSelectAll?: () => void;
  onAction?: (action: PortfolioToolbarAction) => void | Promise<void>;
  loading?: boolean;
}

const STRATEGIES: ReadonlyArray<{ id: string; label: string; helper: string }> = [
  {
    id: "conservadora",
    label: "Conservadora",
    helper: "Prioriza noites ocupadas com diárias mais acessiveis.",
  },
  {
    id: "moderada",
    label: "Moderada",
    helper: "Equilibra ocupação e valor da diária.",
  },
  {
    id: "agressiva",
    label: "Agressiva",
    helper: "Busca diárias mais altas quando há demanda.",
  },
  {
    id: "autonomous",
    label: "Automático",
    helper: "A Urban AI escolhe o melhor caminho caso a caso.",
  },
];

function parsePrice(value: string): number | null {
  const normalized = value.replace(/[^0-9.,]/g, "").replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function PortfolioToolbar({
  selectedCount,
  selectedDatesCount,
  totalCount,
  onClearSelection,
  onSelectAll,
  onAction,
  loading = false,
}: PortfolioToolbarProps) {
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [priceMode, setPriceMode] = useState<"base" | "date" | null>(null);
  const [priceValue, setPriceValue] = useState("");

  const hasSelection = selectedCount > 0;

  const handleStrategy = (strategy: string) => {
    setStrategyOpen(false);
    void onAction?.({ type: "apply-strategy", strategy });
  };

  const handlePrice = () => {
    const price = parsePrice(priceValue);
    if (!price || !priceMode) return;
    void onAction?.({
      type: priceMode === "base" ? "set-base-price" : "set-date-price",
      price,
    });
    setPriceMode(null);
    setPriceValue("");
  };

  const openPriceMode = (mode: "base" | "date") => {
    setStrategyOpen(false);
    setPriceMode(mode);
    setPriceValue("");
  };

  return (
    <>
      <div
        data-portfolio-toolbar
        style={{
          position: "sticky",
          top: 64,
          zIndex: 30,
          background: "var(--app-surface-elevated, #FFFFFF)",
          border: "1px solid var(--app-divider)",
          padding: "16px 18px",
          display: "grid",
          gridTemplateColumns: hasSelection ? "minmax(260px, 1fr) auto" : "1fr",
          alignItems: "start",
          gap: "14px 20px",
          borderRadius: 12,
          boxShadow: "0 10px 28px rgba(14, 17, 22, 0.08)",
          marginBottom: 20,
        }}
      >
        {!hasSelection ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              color: "var(--app-text-muted)",
              fontSize: 13,
              fontWeight: 500,
              flexWrap: "wrap",
            }}
          >
            <Icons.Info size={14} />
            <span>Selecione imóveis ou datas recomendadas para agir.</span>
            {totalCount > 0 && onSelectAll && (
              <AppButton size="sm" variant="ghost" onClick={onSelectAll} disabled={loading}>
                Selecionar todos ({totalCount})
              </AppButton>
            )}
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "var(--app-text)",
                fontSize: 14,
                fontWeight: 600,
                flexWrap: "wrap",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 28,
                  height: 24,
                  padding: "0 8px",
                  borderRadius: 999,
                  background: "var(--app-accent-soft, rgba(232, 80, 10, 0.12))",
                  color: "var(--app-accent, #E8500A)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {selectedCount}
              </span>
              <span>
                imóvel{selectedCount > 1 ? "s" : ""} selecionado
                {selectedCount > 1 ? "s" : ""}
              </span>
              {selectedDatesCount > 0 && (
                <span
                  style={{
                    color: "var(--app-text-muted)",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {selectedDatesCount} data{selectedDatesCount > 1 ? "s" : ""} marcada
                  {selectedDatesCount > 1 ? "s" : ""}
                </span>
              )}
              {onClearSelection && (
                <button
                  type="button"
                  onClick={onClearSelection}
                  disabled={loading}
                  aria-label="Limpar selecao"
                  className="urban-focus-ring"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--app-text-muted)",
                    cursor: "pointer",
                    fontSize: 12,
                    textDecoration: "underline",
                    padding: "4px 6px",
                    borderRadius: 4,
                  }}
                >
                  limpar
                </button>
              )}
              <span
                style={{
                  width: "100%",
                  color: "var(--app-text-muted)",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                Toda ação abre uma prévia antes de confirmar.
              </span>
            </div>

            <div
              data-portfolio-actions
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {priceMode ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <AppInput
                    leftAddon="R$"
                    placeholder={priceMode === "base" ? "320" : "420"}
                    value={priceValue}
                    onChange={(e) => setPriceValue(e.target.value)}
                    style={{ width: 120, height: 36 }}
                    shellStyle={{ width: 140 }}
                    aria-label={
                      priceMode === "base"
                        ? "Preço base por imóvel"
                        : "Preço para datas selecionadas"
                    }
                  />
                  <AppButton size="sm" variant="primary" onClick={handlePrice} disabled={loading}>
                    Simular
                  </AppButton>
                  <AppButton
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPriceMode(null);
                      setPriceValue("");
                    }}
                    disabled={loading}
                  >
                    Cancelar
                  </AppButton>
                </div>
              ) : (
                <>
                  <div style={{ position: "relative" }}>
                    <AppButton
                      size="sm"
                      variant="primary"
                      onClick={() => setStrategyOpen((v) => !v)}
                      disabled={loading}
                      rightIcon={<Icons.ChevronDown size={12} />}
                    >
                      Simular modo
                    </AppButton>
                    {strategyOpen && (
                      <Dropdown onClose={() => setStrategyOpen(false)}>
                        {STRATEGIES.map((strategy) => (
                          <DropdownItem
                            key={strategy.id}
                            onClick={() => handleStrategy(strategy.id)}
                          >
                            <span style={{ fontWeight: 600 }}>{strategy.label}</span>
                            <span
                              style={{
                                display: "block",
                                fontSize: 12,
                                color: "var(--app-text-muted)",
                                fontWeight: 400,
                                marginTop: 2,
                              }}
                            >
                              {strategy.helper}
                            </span>
                          </DropdownItem>
                        ))}
                      </Dropdown>
                    )}
                  </div>

                  <AppButton
                    size="sm"
                    variant="secondary"
                    onClick={() => openPriceMode("base")}
                    disabled={loading}
                  >
                    Preço base
                  </AppButton>

                  <AppButton
                    size="sm"
                    variant="secondary"
                    onClick={() => openPriceMode("date")}
                    disabled={loading || selectedDatesCount === 0}
                    title={
                      selectedDatesCount === 0
                        ? "Selecione uma data no calendário ou ranking"
                        : undefined
                    }
                  >
                    Preço por data
                  </AppButton>

                  <AppButton
                    size="sm"
                    variant="secondary"
                    onClick={() => void onAction?.({ type: "accept-suggestions" })}
                    disabled={loading}
                    title="Aceita as sugestões carregadas para os imóveis e datas selecionados."
                  >
                    Aceitar sugestões
                  </AppButton>

                  <AppButton
                    size="sm"
                    variant="ghost"
                    onClick={() => void onAction?.({ type: "apply-internal" })}
                    disabled={loading}
                    title="Registra o aceite internamente sem empurrar para uma integração externa."
                  >
                    Salvar interno
                  </AppButton>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @media (max-width: 767px) {
          [data-portfolio-toolbar] {
            grid-template-columns: 1fr !important;
            position: ${hasSelection ? "fixed" : "sticky"};
            top: ${hasSelection ? "auto" : "56px"};
            bottom: ${hasSelection ? "64px" : "auto"};
            left: ${hasSelection ? "0" : "auto"};
            right: ${hasSelection ? "0" : "auto"};
            margin: 0;
            border-radius: ${hasSelection ? "12px 12px 0 0" : "12px"};
            border-top: ${hasSelection ? "1px solid var(--app-divider-strong)" : "none"};
            box-shadow: ${hasSelection ? "0 -8px 24px rgba(14, 17, 22, 0.08)" : "none"};
            padding: 12px 16px;
            z-index: 50;
          }
          [data-portfolio-actions] {
            width: 100%;
            justify-content: flex-start !important;
          }
        }
      `}</style>
    </>
  );
}

function Dropdown({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 40 }}
        aria-hidden
      />
      <div
        role="menu"
        style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          right: 0,
          zIndex: 41,
          minWidth: 260,
          background: "var(--app-surface-elevated, #FFFFFF)",
          border: "1px solid var(--app-divider-strong)",
          borderRadius: 10,
          padding: 6,
          boxShadow: "0 12px 32px rgba(14, 17, 22, 0.12)",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {children}
      </div>
    </>
  );
}

function DropdownItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="urban-focus-ring"
      style={{
        background: "transparent",
        border: "none",
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 8,
        color: "var(--app-text)",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--app-surface-muted, #F4F5F7)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}
