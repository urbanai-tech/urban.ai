"use client";

import React, { useEffect, useMemo, useState } from "react";
import PropertySelect from "../../../../componentes/PropertySelect";
import { AppButton, Icons } from "../../../../componentes/ui";
import {
  formatPropertyIdentityLabel,
  getPropriedadesDropdownList,
  type PropertyDropdown,
} from "../../../../service/api";

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
  const [fetching, setFetching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      try {
        setFetching(true);
        setFetchError(null);
        const data = await getPropriedadesDropdownList();
        if (cancelled) return;

        setProperties(data);
        const firstOther = data.find((property) => property.id !== currentPropertyId);
        setSelectedId(firstOther?.id ?? null);
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
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const otherProperties = useMemo(
    () => (properties ?? []).filter((property) => property.id !== currentPropertyId),
    [properties, currentPropertyId],
  );

  const selectedSource = useMemo(
    () => otherProperties.find((property) => property.id === selectedId) ?? null,
    [otherProperties, selectedId],
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
        aria-hidden="true"
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
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar modal"
            className="urban-focus-ring"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              background: "transparent",
              border: "none",
              color: "var(--app-text-muted)",
              cursor: loading ? "not-allowed" : "pointer",
              padding: 8,
              minWidth: 44,
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 0,
              borderRadius: 6,
              fontSize: 18,
            }}
          >
            <span aria-hidden="true">x</span>
          </button>

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
            Você pode ajustar depois. As regras vao substituir as deste imóvel quando clicar em copiar.
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
              role="status"
              aria-live="polite"
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
              role="alert"
              aria-live="assertive"
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
                Você não tem outros imóveis para copiar regras ainda. Quando adicionar um segundo imóvel, ele aparecera aqui.
              </p>
            </div>
          )}

          {otherProperties.length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              <PropertySelect
                value={selectedId ?? ""}
                propsInfo={otherProperties}
                setPropertyId={setSelectedId}
                placeholder="Buscar imóvel de origem"
                maxWidth="100%"
              />

              {selectedSource && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "var(--app-surface-muted)",
                    border: "1px solid var(--app-divider)",
                    color: "var(--app-text-muted)",
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  <strong style={{ color: "var(--app-text)" }}>
                    {formatPropertyIdentityLabel(selectedSource)}
                  </strong>
                  {selectedSource.dailyPrice != null && (
                    <span>
                      {" "}
                      - Preço base R$ {Number(selectedSource.dailyPrice).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
              )}
            </div>
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
