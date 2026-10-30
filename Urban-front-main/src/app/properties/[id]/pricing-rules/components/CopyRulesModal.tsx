"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import PropertySelect from "../../../../componentes/PropertySelect";
import { AppButton, Icons } from "../../../../componentes/ui";
import { useDialogFocus } from "../../../../componentes/ui/useDialogFocus";
import {
  formatPropertyIdentityLabel,
  getPropriedadesDropdownList,
  type PropertyDropdown,
} from "../../../../service/api";
import styles from "./CopyRulesModal.module.css";

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

  const panelRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus({ open, containerRef: panelRef, onClose });

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
      className={styles.overlay}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        className={styles.modalBackdrop}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={styles.modalPanel}
      >
        <header
          className={styles.modalHeader}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar modal"
            className={`urban-focus-ring ${styles.closeButton} ${loading ? styles.closeButtonBusy : styles.closeButtonReady}`}
          >
            <span aria-hidden="true">x</span>
          </button>

          <p
            className={styles.eyebrow}
          >
            Copiar regras
          </p>
          <h2
            id="copy-rules-title"
            className={styles.modalTitle}
          >
            De qual imóvel você quer copiar?
          </h2>
          <p
            className={styles.modalDescription}
          >
            Você pode ajustar depois. As regras vao substituir as deste imóvel quando clicar em copiar.
          </p>
        </header>

        <div
          className={styles.modalBody}
        >
          {fetching && (
            <div
              role="status"
              aria-live="polite"
              className={styles.loadingMessage}
            >
              Carregando seus imóveis…
            </div>
          )}

          {fetchError && !fetching && (
            <div
              role="alert"
              aria-live="assertive"
              className={styles.fetchError}
            >
              {fetchError}
            </div>
          )}

          {!fetching && !fetchError && otherProperties.length === 0 && (
            <div
              className={styles.emptyState}
            >
              <Icons.Layers size={20} />
              <p className={styles.emptyStateText}>
                Você não tem outros imóveis para copiar regras ainda. Quando adicionar um segundo imóvel, ele aparecera aqui.
              </p>
            </div>
          )}

          {otherProperties.length > 0 && (
            <div className={styles.sourceField}>
              <PropertySelect
                value={selectedId ?? ""}
                propsInfo={otherProperties}
                setPropertyId={setSelectedId}
                placeholder="Buscar imóvel de origem"
                maxWidth="100%"
              />

              {selectedSource && (
                <div
                  className={styles.sourceSummary}
                >
                  <strong className={styles.sourceName}>
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
          className={styles.modalFooter}
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
