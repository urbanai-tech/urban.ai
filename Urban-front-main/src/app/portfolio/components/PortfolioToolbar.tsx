"use client";

import React, { useState } from "react";
import { AppButton, AppConfirmDialog, AppInput, Icons } from "../../componentes/ui";

/**
 * PortfolioToolbar — barra sticky de bulk action no topo do `/portfolio`.
 *
 * Estados:
 *  - `selectedCount === 0`: mostra hint "Selecione imóveis…" com ícone Info.
 *  - `selectedCount > 0`:   mostra "{n} imóvel(s) selecionado(s)" + 4 ações:
 *      • Aplicar estratégia (primary)         → abre dropdown de estratégias.
 *      • Definir preço base (secondary)       → input inline R$ + botão Aplicar.
 *      • Aceitar sugestões (secondary)        → confirma via AppConfirmDialog.
 *      • Mais ações (ghost)                   → dropdown extra (placeholder).
 *
 * Mobile: vira bottom-sheet fixo no rodapé (acima da bottom-nav 64px) quando
 * há seleção; quando `selectedCount === 0`, hint inline fica sticky no topo.
 *
 * O handler `onAction` recebe a ação e payload — a página é responsável de
 * chamar `mutatePortfolioBulkAction` e tratar o resultado.
 */

export type PortfolioToolbarAction =
  | { type: "apply-strategy"; strategy: string }
  | { type: "set-base-price"; price: number }
  | { type: "accept-suggestions" };

export interface PortfolioToolbarProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection?: () => void;
  onSelectAll?: () => void;
  onAction?: (action: PortfolioToolbarAction) => void | Promise<void>;
  loading?: boolean;
}

const STRATEGIES: ReadonlyArray<{ id: string; label: string; helper: string }> = [
  { id: "conservadora", label: "Conservadora", helper: "Foca em ocupação, ADR mais baixo." },
  { id: "moderada", label: "Moderada", helper: "Equilibra ocupação e ADR." },
  { id: "agressiva", label: "Agressiva", helper: "Maximiza ADR mesmo perdendo dias." },
  { id: "autonomous", label: "Autonomous", helper: "Urban AI decide caso a caso." },
];

export function PortfolioToolbar({
  selectedCount,
  totalCount,
  onClearSelection,
  onSelectAll,
  onAction,
  loading = false,
}: PortfolioToolbarProps) {
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [acceptConfirmOpen, setAcceptConfirmOpen] = useState(false);
  const [basePriceMode, setBasePriceMode] = useState(false);
  const [basePriceValue, setBasePriceValue] = useState("");

  const hasSelection = selectedCount > 0;

  const handleStrategy = (strategy: string) => {
    setStrategyOpen(false);
    void onAction?.({ type: "apply-strategy", strategy });
  };

  const handleAccept = async () => {
    await onAction?.({ type: "accept-suggestions" });
    setAcceptConfirmOpen(false);
  };

  const handleBasePrice = () => {
    const num = Number(basePriceValue.replace(/[^0-9.,]/g, "").replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) return;
    void onAction?.({ type: "set-base-price", price: num });
    setBasePriceMode(false);
    setBasePriceValue("");
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
          borderBottom: "1px solid var(--app-divider)",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          borderRadius: 12,
          boxShadow: "0 1px 0 rgba(14, 17, 22, 0.02)",
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
            }}
          >
            <Icons.Info size={14} />
            <span>Selecione imóveis pra aplicar ação em lote.</span>
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
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                color: "var(--app-text)",
                fontSize: 14,
                fontWeight: 600,
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
                imóvel{selectedCount > 1 ? "s" : ""} selecionado{selectedCount > 1 ? "s" : ""}
              </span>
              {onClearSelection && (
                <button
                  type="button"
                  onClick={onClearSelection}
                  disabled={loading}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--app-text-muted)",
                    cursor: "pointer",
                    fontSize: 12,
                    textDecoration: "underline",
                    padding: 0,
                    marginLeft: 4,
                  }}
                >
                  limpar
                </button>
              )}
            </div>

            <div style={{ flex: 1 }} />

            <div
              data-portfolio-actions
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {basePriceMode ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <AppInput
                    leftAddon="R$"
                    placeholder="320"
                    value={basePriceValue}
                    onChange={(e) => setBasePriceValue(e.target.value)}
                    style={{ width: 120, height: 36 }}
                    shellStyle={{ width: 140 }}
                  />
                  <AppButton size="sm" variant="primary" onClick={handleBasePrice} disabled={loading}>
                    Aplicar
                  </AppButton>
                  <AppButton
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setBasePriceMode(false);
                      setBasePriceValue("");
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
                      Aplicar estratégia
                    </AppButton>
                    {strategyOpen && (
                      <Dropdown onClose={() => setStrategyOpen(false)}>
                        {STRATEGIES.map((s) => (
                          <DropdownItem key={s.id} onClick={() => handleStrategy(s.id)}>
                            <span style={{ fontWeight: 600 }}>{s.label}</span>
                            <span
                              style={{
                                display: "block",
                                fontSize: 12,
                                color: "var(--app-text-muted)",
                                fontWeight: 400,
                                marginTop: 2,
                              }}
                            >
                              {s.helper}
                            </span>
                          </DropdownItem>
                        ))}
                      </Dropdown>
                    )}
                  </div>

                  <AppButton
                    size="sm"
                    variant="secondary"
                    onClick={() => setBasePriceMode(true)}
                    disabled={loading}
                  >
                    Definir preço base
                  </AppButton>

                  <AppButton
                    size="sm"
                    variant="secondary"
                    onClick={() => setAcceptConfirmOpen(true)}
                    disabled={loading}
                  >
                    Aceitar sugestões
                  </AppButton>

                  <div style={{ position: "relative" }}>
                    <AppButton
                      size="sm"
                      variant="ghost"
                      onClick={() => setMoreOpen((v) => !v)}
                      disabled={loading}
                      rightIcon={<Icons.ChevronDown size={12} />}
                    >
                      Mais ações
                    </AppButton>
                    {moreOpen && (
                      <Dropdown onClose={() => setMoreOpen(false)}>
                        <DropdownItem disabled>Pausar autopilot (em breve)</DropdownItem>
                        <DropdownItem disabled>Bloquear datas (em breve)</DropdownItem>
                        <DropdownItem disabled>Exportar CSV (em breve)</DropdownItem>
                      </Dropdown>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <AppConfirmDialog
        open={acceptConfirmOpen}
        onClose={() => setAcceptConfirmOpen(false)}
        onConfirm={handleAccept}
        title="Aceitar sugestões nos imóveis selecionados?"
        body={
          <>
            A Urban AI vai aplicar o preço sugerido nos dias com sugestão ativa em{" "}
            <strong>{selectedCount}</strong> imóvel{selectedCount > 1 ? "s" : ""}. A ação fica
            registrada no audit log e pode ser desfeita por dia.
          </>
        }
        confirmLabel={`Aplicar em ${selectedCount} imóvel${selectedCount > 1 ? "s" : ""}`}
        loading={loading}
      />

      <style jsx>{`
        @media (max-width: 767px) {
          [data-portfolio-toolbar] {
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
          minWidth: 240,
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
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "transparent",
        border: "none",
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 8,
        color: disabled ? "var(--app-text-dim)" : "var(--app-text)",
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "var(--app-surface-muted, #F4F5F7)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}
