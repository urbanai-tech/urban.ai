"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppButton, Icons } from "../../../../componentes/ui";
import {
  getPropriedadesDropdownList,
  type PropertyDropdown,
} from "../../../../service/api";

/**
 * Modal "Copiar regras de outro imóvel".
 *
 * Lista os imóveis do anfitrião (exceto o atual), renderiza como rádio +
 * preview pequeno do nome/thumb e um botão único de confirmação.
 *
 * - Carrega a lista via `getPropriedadesDropdownList` (já existe no api.ts)
 * - Se houver apenas o imóvel atual (anfitrião single-property), mostra
 *   empty state amigável.
 */

export function CopyRulesModal({
  open,
  currentPropertyId,
  onClose,
  onCopy,
  loading,
}: {
  open: boolean;
  currentPropertyId: string;
  onClose: () => void;
  onCopy: (sourcePropertyId: string) => void;
  loading?: boolean;
}) {
  const [properties, setProperties] = useState<PropertyDropdown[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      try {
        setFetching(true);
        setFetchError(null);
        const data = await getPropriedadesDropdownList();
        if (!cancelled) {
          setProperties(data);
          // pré-seleciona o primeiro candidato
          const firstOther = data.find((p) => p.id !== currentPropertyId);
          setSelectedId(firstOther?.id ?? null);
        }
      } catch (err) {
        console.error("[CopyRulesModal] erro listando imóveis", err);
        if (!cancelled) {
          setFetchError("Não foi possível carregar seus imóveis.");
          setProperties([]);
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, currentPropertyId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const otherProperties = useMemo(
    () => (properties ?? []).filter((p) => p.id !== currentPropertyId),
    [properties, currentPropertyId],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-rules-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(14, 17, 22, 0.45)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--app-surface-elevated, #FFFFFF)",
          border: "1px solid var(--app-divider-strong)",
          borderRadius: 14,
          boxShadow: "0 18px 48px rgba(14, 17, 22, 0.12)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "22px 24px 16px",
            borderBottom: "1px solid var(--app-divider)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--app-text-muted)",
            }}
          >
            Copiar regras
          </p>
          <h2
            id="copy-rules-title"
            style={{
              margin: "6px 0 0",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--app-text)",
              letterSpacing: -0.2,
              lineHeight: 1.3,
            }}
          >
            De qual imóvel você quer copiar?
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13,
              color: "var(--app-text-muted)",
              lineHeight: 1.5,
            }}
          >
            Você pode ajustar depois — as regras vão substituir as deste imóvel quando você
            clicar em copiar.
          </p>
        </header>

        <div
          style={{
            padding: "16px 24px 20px",
            overflowY: "auto",
            flex: 1,
            minHeight: 0,
          }}
        >
          {fetching && (
            <div
              style={{
                padding: "24px 0",
                textAlign: "center",
                color: "var(--app-text-muted)",
                fontSize: 13,
              }}
            >
              Carregando seus imóveis…
            </div>
          )}
          {fetchError && !fetching && (
            <div
              style={{
                padding: "16px",
                border: "1px solid rgba(194, 52, 46, 0.25)",
                background: "rgba(194, 52, 46, 0.06)",
                borderRadius: 10,
                color: "var(--app-danger)",
                fontSize: 13,
              }}
            >
              {fetchError}
            </div>
          )}
          {!fetching && !fetchError && otherProperties.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--app-text-muted)",
                fontSize: 13,
                background: "var(--app-surface-muted)",
                borderRadius: 10,
                border: "1px dashed var(--app-divider-strong)",
              }}
            >
              <Icons.Layers size={20} />
              <p style={{ margin: "10px 0 0" }}>
                Você não tem outros imóveis pra copiar regras ainda. Quando adicionar um
                segundo imóvel, ele aparecerá aqui.
              </p>
            </div>
          )}

          {otherProperties.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {otherProperties.map((p) => {
                const checked = p.id === selectedId;
                return (
                  <li key={p.id}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        border: "1px solid",
                        borderColor: checked
                          ? "var(--app-accent)"
                          : "var(--app-divider-strong)",
                        borderRadius: 10,
                        cursor: "pointer",
                        background: checked ? "var(--app-accent-soft)" : "var(--app-surface)",
                        transition: "background 120ms, border-color 120ms",
                      }}
                    >
                      <input
                        type="radio"
                        name="copy-source"
                        value={p.id}
                        checked={checked}
                        onChange={() => setSelectedId(p.id)}
                        style={{ accentColor: "var(--app-accent)" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--app-text)",
                          }}
                        >
                          {p.propertyName || p.nome || "Imóvel sem nome"}
                        </p>
                        {p.dailyPrice != null && (
                          <p
                            style={{
                              margin: "2px 0 0",
                              fontSize: 12,
                              color: "var(--app-text-muted)",
                            }}
                          >
                            Preço base R$ {Number(p.dailyPrice).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer
          style={{
            padding: "16px 24px 20px",
            borderTop: "1px solid var(--app-divider)",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <AppButton variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </AppButton>
          <AppButton
            variant="primary"
            disabled={!selectedId || otherProperties.length === 0 || loading}
            loading={loading}
            onClick={() => selectedId && onCopy(selectedId)}
          >
            Copiar para este imóvel
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
