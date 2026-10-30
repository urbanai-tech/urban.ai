"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  AppButton,
  AppCard,
  AppConfirmDialog,
  AppPageShell,
  AppSectionHeader,
  AppToastProvider,
  Icons,
  useAppToast,
} from "../../../componentes/ui";
import {
  copyPricingRulesFromProperty,
  fetchPricingRules,
  previewPricingRules,
  savePricingRules,
  type PricingRule,
  type PricingRulesPreviewResponse,
} from "../../../service/api";
import { trackEvent } from "../../../service/tracking";
import { PricingRuleCard } from "./components/PricingRuleCard";
import { CopyRulesModal } from "./components/CopyRulesModal";
import { PreviewStrip } from "./components/PreviewStrip";
import styles from "./page.module.css";

/**
 * Página `/properties/:id/pricing-rules` (Gap 2 — Track 2, semana 5-6).
 *
 * Accordion de 8 regras de preço por imóvel. Cada regra tem switch on/off,
 * controles (slider/number), mini-gráfico de preview e expandable "Por que
 * usar isso?". Preview real-time global em 14 dias, debounced 400ms. Footer
 * sticky com salvar/descartar.
 *
 * Estado dirty é calculado por JSON.stringify das regras vs snapshot salvo.
 * `Ctrl+S` / `Cmd+S` salva (fora de inputs).
 */

function PricingRulesPageContent() {
  const params = useParams<{ id: string }>();
  const propertyId = String(params?.id ?? "");
  const toast = useAppToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [preview, setPreview] = useState<PricingRulesPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState<number | null>(null);
  const [staleSeconds, setStaleSeconds] = useState<number | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [copyModalOpen, setCopyModalOpen] = useState<boolean>(false);
  const [copyLoading, setCopyLoading] = useState<boolean>(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState<boolean>(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga inicial.
  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchPricingRules(propertyId);
        if (cancelled) return;
        setRules(data.rules);
        setSavedSnapshot(JSON.stringify(data.rules));
        // primeiro preview imediato
        try {
          const p = await previewPricingRules(propertyId, data.rules);
          if (!cancelled) {
            setPreview(p);
            setPreviewUpdatedAt(Date.now());
          }
        } catch (err) {
          console.warn("[pricing-rules] preview inicial falhou", err);
        }
        trackEvent("pricing_rules_viewed", { propertyId });
      } catch (err) {
        console.error("[pricing-rules] carga inicial falhou", err);
        toast.error(
          "Não foi possível carregar as regras",
          "Tente recarregar a página em alguns segundos.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [propertyId, toast]);

  // Stale clock — atualiza "atualizado há Ns" a cada segundo.
  useEffect(() => {
    if (previewUpdatedAt === null) {
      setStaleSeconds(null);
      return;
    }
    setStaleSeconds(0);
    const id = window.setInterval(() => {
      setStaleSeconds(Math.max(0, Math.round((Date.now() - previewUpdatedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [previewUpdatedAt]);

  const dirty = useMemo(
    () => savedSnapshot !== "" && JSON.stringify(rules) !== savedSnapshot,
    [rules, savedSnapshot],
  );

  // Debounce preview a cada mudança de regra.
  useEffect(() => {
    if (!propertyId || rules.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const p = await previewPricingRules(propertyId, rules);
        setPreview(p);
        setPreviewUpdatedAt(Date.now());
      } catch (err) {
        console.warn("[pricing-rules] preview falhou", err);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rules, propertyId]);

  // Warning na navegação se houver mudanças não salvas.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleSave = useCallback(async () => {
    if (!dirty || saving) return;
    try {
      setSaving(true);
      const data = await savePricingRules(propertyId, rules);
      setRules(data.rules);
      setSavedSnapshot(JSON.stringify(data.rules));
      toast.success("Regras salvas", "As novas regras já estão valendo no seu pricing.");
      trackEvent("pricing_rules_saved", {
        propertyId,
        enabledCount: data.rules.filter((r) => r.enabled).length,
      });
    } catch (err) {
      console.error("[pricing-rules] erro salvando", err);
      toast.error("Falha ao salvar", "Suas mudanças foram preservadas — tente de novo.");
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, propertyId, rules, toast]);

  // Atalho Ctrl/Cmd+S.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta || e.key.toLowerCase() !== "s") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      // Permite Ctrl+S em qualquer lugar exceto textarea/contenteditable (poupa autocomplete nativo de notas)
      if (tag === "textarea" || target?.isContentEditable) return;
      e.preventDefault();
      void handleSave();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  function handleRuleChange(index: number, next: PricingRule) {
    setRules((prev) => {
      const copy = prev.slice();
      copy[index] = next;
      return copy;
    });
  }

  function toggleExpanded(index: number) {
    setExpandedIndex((curr) => (curr === index ? null : index));
  }

  function handleDiscard() {
    if (!dirty) return;
    setDiscardConfirmOpen(true);
  }

  function confirmDiscard() {
    try {
      const restored: PricingRule[] = JSON.parse(savedSnapshot);
      setRules(restored);
      toast.info("Alterações descartadas");
    } catch {
      /* swallow — snapshot inválido nunca deve acontecer */
    } finally {
      setDiscardConfirmOpen(false);
    }
  }

  async function handleCopy(sourcePropertyId: string) {
    try {
      setCopyLoading(true);
      const data = await copyPricingRulesFromProperty(sourcePropertyId, propertyId);
      setRules(data.rules);
      setSavedSnapshot(JSON.stringify(data.rules));
      toast.success(
        "Regras copiadas",
        "As regras do imóvel selecionado substituíram as deste imóvel.",
      );
      trackEvent("pricing_rules_copied_from_property", {
        propertyId,
        sourcePropertyId,
      });
      setCopyModalOpen(false);
    } catch (err) {
      console.error("[pricing-rules] copy falhou", err);
      toast.error(
        "Falha ao copiar",
        "Não foi possível copiar agora. Tente de novo em alguns segundos.",
      );
    } finally {
      setCopyLoading(false);
    }
  }

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <AppPageShell maxWidth={1200} className={styles.pageShell}>
      <AppSectionHeader
        eyebrow="PRECIFICAÇÃO · REGRAS"
        title="Regras de preço do imóvel"
        subtitle="Combine regras simples (fim de semana, last-minute, evento) que ajustam seu preço base automaticamente. Veja o impacto nos próximos 14 dias enquanto edita — nada é aplicado até você clicar em salvar."
        actions={
          <AppButton
            variant="secondary"
            onClick={() => setCopyModalOpen(true)}
            leftIcon={<Icons.Layers size={14} />}
          >
            Copiar de outro imóvel
          </AppButton>
        }
      />

      <PreviewStrip
        loading={loading && !preview}
        data={preview}
        staleSeconds={staleSeconds}
        loadingPreview={previewLoading}
      />

      <div className={styles.rulesList}>
        {loading ? (
          <PricingRulesSkeleton />
        ) : (
          rules.map((rule, index) => (
            <PricingRuleCard
              key={rule.type}
              rule={rule}
              expanded={expandedIndex === index}
              onToggleExpanded={() => toggleExpanded(index)}
              onChange={(next) => handleRuleChange(index, next)}
              disabled={saving}
            />
          ))
        )}
      </div>

      {!loading && (
        <p
          className={styles.footnote}
        >
          {enabledCount} de {rules.length} regras ativas. Mudanças se aplicam só após salvar.
          Use <kbd
            className={styles.keyHint}
          >Ctrl</kbd>
          {" + "}
          <kbd
            className={styles.keyHint}
          >S</kbd> pra salvar rapidamente.
        </p>
      )}

      <StickySaveFooter
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        previewStale={staleSeconds}
        previewLoading={previewLoading}
      />

      <CopyRulesModal
        open={copyModalOpen}
        currentPropertyId={propertyId}
        onClose={() => (copyLoading ? null : setCopyModalOpen(false))}
        onCopy={handleCopy}
        loading={copyLoading}
      />

      <AppConfirmDialog
        open={discardConfirmOpen}
        onClose={() => setDiscardConfirmOpen(false)}
        onConfirm={confirmDiscard}
        title="Descartar alterações?"
        body="Você vai voltar pras regras salvas atualmente. As mudanças desta sessão serão perdidas."
        confirmLabel="Descartar"
        destructive
      />
    </AppPageShell>
  );
}

function PricingRulesSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando regras de preço"
      className={styles.skeletonList}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <AppCard key={i} className={styles.skeletonCard}>
          <div
            className={styles.skeletonRow}
          >
            <div
              className={styles.skeletonSwitch}
            />
            <div className={styles.skeletonText}>
              <div
                className={styles.skeletonTitle}
              />
              <div
                className={styles.skeletonSubtitle}
              />
            </div>
            <div
              className={styles.skeletonAction}
            />
          </div>
        </AppCard>
      ))}
    </div>
  );
}

function StickySaveFooter({
  dirty,
  saving,
  onSave,
  onDiscard,
  previewStale,
  previewLoading,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  previewStale: number | null;
  previewLoading: boolean;
}) {
  return (
    <div
      role="region"
      aria-label="Ações de salvamento"
      className={styles.saveBar}
    >
      <div
        className={styles.footerInner}
      >
        <div
          className={styles.footerStatus}
        >
          <span
            className={`${styles.dirtyBadge} ${dirty ? styles.dirtyBadgeUnsaved : styles.dirtyBadgeSaved}`}
          >
            {dirty ? "Mudanças não salvas" : "Tudo salvo"}
          </span>
          <span
            className={styles.previewStatus}
          >
            {previewLoading
              ? "Preview atualizando…"
              : previewStale !== null
                ? `Preview atualizado há ${previewStale}s`
                : "Preview ainda não calculado"}
          </span>
        </div>
        <div className={styles.footerActions}>
          <AppButton
            variant="ghost"
            onClick={onDiscard}
            disabled={!dirty || saving}
          >
            Descartar
          </AppButton>
          <AppButton
            variant="primary"
            onClick={onSave}
            disabled={!dirty || saving}
            loading={saving}
          >
            Salvar alterações
          </AppButton>
        </div>
      </div>
    </div>
  );
}

export default function PricingRulesPage() {
  return (
    <AppToastProvider>
      <PricingRulesPageContent />
    </AppToastProvider>
  );
}
