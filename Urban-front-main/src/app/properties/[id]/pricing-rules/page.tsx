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
 *
 * Backend ainda não entregou na semana 5 — o mock controlado por
 * `NEXT_PUBLIC_PRICING_RULES_MOCK_DATA` cobre o caso.
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
    <AppPageShell maxWidth={1200} style={{ paddingBottom: 160 }}>
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

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
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
          style={{
            marginTop: 16,
            fontSize: 12,
            color: "var(--app-text-muted)",
            lineHeight: 1.5,
          }}
        >
          {enabledCount} de {rules.length} regras ativas. Mudanças se aplicam só após salvar.
          Use <kbd
            style={{
              padding: "1px 6px",
              border: "1px solid var(--app-divider-strong)",
              borderRadius: 4,
              fontSize: 11,
              background: "var(--app-surface-muted)",
            }}
          >Ctrl</kbd>
          {" + "}
          <kbd
            style={{
              padding: "1px 6px",
              border: "1px solid var(--app-divider-strong)",
              borderRadius: 4,
              fontSize: 11,
              background: "var(--app-surface-muted)",
            }}
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
      aria-label="Carregando regras de preco"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <AppCard key={i} style={{ padding: "18px 20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 22,
                background: "var(--app-surface-muted)",
                borderRadius: 999,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 14,
                  width: "55%",
                  background: "var(--app-surface-muted)",
                  borderRadius: 4,
                }}
              />
              <div
                style={{
                  marginTop: 8,
                  height: 10,
                  width: "85%",
                  background: "var(--app-surface-muted)",
                  borderRadius: 4,
                  opacity: 0.7,
                }}
              />
            </div>
            <div
              style={{
                width: 120,
                height: 40,
                background: "var(--app-surface-muted)",
                borderRadius: 6,
              }}
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
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        padding: "12px 20px",
        background: "var(--app-surface, #FFFFFF)",
        borderTop: "1px solid var(--app-divider-strong)",
        boxShadow: "0 -8px 24px rgba(14, 17, 22, 0.08)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
            color: "var(--app-text-muted)",
            fontSize: 12,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: "uppercase",
              border: "1px solid",
              borderColor: dirty ? "rgba(232, 80, 10, 0.25)" : "var(--app-divider-strong)",
              color: dirty ? "var(--app-accent)" : "var(--app-text-muted)",
              background: dirty ? "var(--app-accent-soft)" : "var(--app-surface-muted)",
            }}
          >
            {dirty ? "Mudanças não salvas" : "Tudo salvo"}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            {previewLoading
              ? "Preview atualizando…"
              : previewStale !== null
                ? `Preview atualizado há ${previewStale}s`
                : "Preview ainda não calculado"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
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
