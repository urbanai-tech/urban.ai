"use client";

import { useCallback, useEffect, useState } from "react";
import {
  staysGetRecommendation,
  staysLinkListing,
  staysListPriceUpdates,
  staysPreviewPrice,
  staysPushPrice,
  staysRollback,
  staysUnlinkListing,
  type PriceUpdatePublic,
  type StaysCapabilities,
  type StaysLinkableProperty,
  type StaysListingPublic,
  type StaysMatchSuggestion,
  type StaysPricePreview,
  type StaysRecommendation,
} from "../../service/api";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppConfirmDialog,
  AppEmptyState,
  AppGrid,
  AppHStack,
  AppSelect,
  AppVStack,
  Icons,
} from "../../componentes/ui";
import {
  STAYS_WRITES_DISABLED_MESSAGE,
  canRollback,
  newStaysRequestId,
  priceUpdateBadgeKind,
  priceUpdateOriginLabel,
  priceUpdateStatusLabel,
} from "./stays-integration-domain";

const operationModeLabels: Record<StaysListingPublic["operationMode"], string> = {
  inherit: "Usar padrão da conta",
  notifications: "Recomendação manual",
  auto: "Automático em beta",
};

function formatCurrency(cents?: number | null) {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "sem preço";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function errorMessage(err: unknown, fallback: string) {
  const anyErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
  const raw = anyErr?.response?.data?.message ?? anyErr?.message;
  return Array.isArray(raw) ? raw.join(" ") : raw || fallback;
}

/**
 * Lista de anúncios Stays com:
 *  - vínculo ao imóvel Urban (seletor + sugestão automática que o anfitrião confirma);
 *  - "Aplicar via Stays": prévia com o preço AO VIVO da Stays e confirmação;
 *  - "Reverter" e um histórico curto dos pushes (PriceUpdate).
 * Quando a escrita está desligada no ambiente, os botões de escrita ficam
 * desabilitados e a tela diz "Escrita desligada neste ambiente".
 */
export function StaysListingsPanel({
  listings,
  properties,
  suggestions,
  capabilities,
  onListingChanged,
}: {
  listings: StaysListingPublic[];
  properties: StaysLinkableProperty[];
  suggestions: StaysMatchSuggestion[];
  capabilities: StaysCapabilities | null;
  onListingChanged: (listing: StaysListingPublic) => void;
}) {
  const writesEnabled = Boolean(capabilities?.priceWritesEnabled);

  if (listings.length === 0) return null;

  return (
    <AppVStack gap="md">
      {!writesEnabled && (
        <AppCard variant="subtle">
          <AppHStack gap="sm" align="center" wrap>
            <AppBadge kind="warn">{STAYS_WRITES_DISABLED_MESSAGE}</AppBadge>
            <span>
              Você pode vincular imóveis e ver a prévia com o preço atual da Stays. Aplicar e reverter
              preços fica bloqueado até a escrita ser liberada.
            </span>
          </AppHStack>
        </AppCard>
      )}
      {listings.map((listing) => (
        <StaysListingRow
          key={listing.id}
          listing={listing}
          properties={properties}
          suggestion={suggestions.find((item) => item.listingId === listing.id) ?? null}
          takenPropertyIds={
            new Set(
              listings
                .filter((other) => other.id !== listing.id && other.propriedadeId)
                .map((other) => other.propriedadeId as string),
            )
          }
          writesEnabled={writesEnabled}
          onListingChanged={onListingChanged}
        />
      ))}
    </AppVStack>
  );
}

function StaysListingRow({
  listing,
  properties,
  suggestion,
  takenPropertyIds,
  writesEnabled,
  onListingChanged,
}: {
  listing: StaysListingPublic;
  properties: StaysLinkableProperty[];
  suggestion: StaysMatchSuggestion | null;
  takenPropertyIds: Set<string>;
  writesEnabled: boolean;
  onListingChanged: (listing: StaysListingPublic) => void;
}) {
  const [linkBusy, setLinkBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [history, setHistory] = useState<PriceUpdatePublic[]>([]);
  const [recommendation, setRecommendation] = useState<StaysRecommendation | null>(null);
  const [preview, setPreview] = useState<StaysPricePreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<PriceUpdatePublic | null>(null);
  const [rollbackBusy, setRollbackBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await staysListPriceUpdates(listing.id, 5));
    } catch {
      /* histórico é complementar; a linha continua utilizável */
    }
  }, [listing.id]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  async function changeLink(propriedadeId: string) {
    setRowError(null);
    setLinkBusy(true);
    try {
      const updated = propriedadeId
        ? await staysLinkListing(listing.id, propriedadeId)
        : await staysUnlinkListing(listing.id);
      onListingChanged(updated);
      setPreview(null);
      setRecommendation(null);
    } catch (err) {
      setRowError(errorMessage(err, "Não foi possível salvar o vínculo."));
    } finally {
      setLinkBusy(false);
    }
  }

  async function openApply() {
    setRowError(null);
    setNotice(null);
    setPreview(null);
    setPreviewBusy(true);
    try {
      const rec = await staysGetRecommendation(listing.id);
      setRecommendation(rec);
      if (!rec) {
        setRowError("Ainda não há recomendação de preço futura para este imóvel.");
        return;
      }
      // Sem previousPriceCents: o servidor lê o preço vigente no calendário Stays.
      const result = await staysPreviewPrice({
        listingId: listing.id,
        targetDate: rec.targetDate,
        newPriceCents: rec.recommendedPriceCents,
        currency: "BRL",
        analisePrecoId: rec.analisePrecoId,
      });
      setPreview(result);
    } catch (err) {
      setRowError(errorMessage(err, "Não foi possível gerar a prévia."));
    } finally {
      setPreviewBusy(false);
    }
  }

  async function confirmApply() {
    if (!preview || !recommendation) return;
    setPushBusy(true);
    setRowError(null);
    try {
      const result = await staysPushPrice({
        requestId: newStaysRequestId(),
        listingId: listing.id,
        targetDate: preview.targetDate,
        newPriceCents: preview.newPriceCents,
        previousPriceCents: preview.previousPriceCents,
        currency: preview.currency,
        analisePrecoId: recommendation.analisePrecoId,
      });
      setNotice(
        result.status === "success"
          ? `Preço aplicado na Stays: ${formatCurrency(result.newPriceCents)} em ${result.targetDate}.`
          : `A Stays não aplicou o preço (${result.errorMessage ?? priceUpdateStatusLabel(result.status)}).`,
      );
      setPreview(null);
      await refreshHistory();
    } catch (err) {
      setRowError(errorMessage(err, "Não foi possível aplicar o preço."));
    } finally {
      setPushBusy(false);
      setConfirmOpen(false);
    }
  }

  async function confirmRollback() {
    if (!rollbackTarget) return;
    setRollbackBusy(true);
    setRowError(null);
    try {
      const result = await staysRollback(rollbackTarget.id);
      setNotice(
        result.status === "success"
          ? `Preço revertido para ${formatCurrency(result.newPriceCents)}.`
          : "A reversão não foi aplicada; você pode tentar de novo.",
      );
      await refreshHistory();
    } catch (err) {
      setRowError(errorMessage(err, "Não foi possível reverter."));
    } finally {
      setRollbackBusy(false);
      setRollbackTarget(null);
    }
  }

  const linkedProperty = properties.find((item) => item.id === listing.propriedadeId) ?? null;
  const suggestedProperty =
    !listing.propriedadeId && suggestion
      ? properties.find((item) => item.id === suggestion.propriedadeId) ?? null
      : null;

  return (
    <AppCard variant="default">
      <AppVStack gap="sm">
        <AppHStack gap="md" justify="space-between" align="flex-start" wrap>
          <AppVStack gap="xs">
            <strong>{listing.title || "(sem título)"}</strong>
            <span className="urban-app-eyebrow-muted">
              {listing.shortAddress || "Sem endereço"} · Código na Stays: {listing.staysListingId}
            </span>
            <span className="urban-app-eyebrow-muted">
              Modo: {operationModeLabels[listing.operationMode] || listing.operationMode}
            </span>
          </AppVStack>
          <AppHStack gap="xs" wrap>
            <AppBadge kind={listing.active ? "success" : "neutral"}>{listing.active ? "Ativo" : "Inativo"}</AppBadge>
            {listing.operationMode === "auto" && <AppBadge kind="accent">Beta automático</AppBadge>}
            <AppBadge kind={linkedProperty ? "success" : "warn"}>
              {linkedProperty ? "Vinculado" : "Sem vínculo"}
            </AppBadge>
          </AppHStack>
        </AppHStack>

        <AppGrid minColWidth={220} gap="sm">
          <AppSelect
            label={`Imóvel My Urban de ${listing.title || listing.staysListingId}`}
            value={listing.propriedadeId ?? ""}
            onChange={(e) => void changeLink(e.target.value)}
            disabled={linkBusy}
          >
            <option value="">Sem vínculo</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id} disabled={takenPropertyIds.has(property.id)}>
                {[property.internalNickname, property.titulo].filter(Boolean).join(" · ")}
                {takenPropertyIds.has(property.id) ? " (já vinculado)" : ""}
              </option>
            ))}
          </AppSelect>
          <AppHStack gap="sm" align="flex-end" wrap>
            <AppButton
              variant="primary"
              size="md"
              onClick={() => void openApply()}
              loading={previewBusy}
              disabled={!listing.propriedadeId || !listing.active}
              leftIcon={<Icons.Zap size={14} />}
            >
              Aplicar via Stays
            </AppButton>
          </AppHStack>
        </AppGrid>

        {suggestedProperty && suggestion && (
          <AppHStack gap="sm" align="center" wrap>
            <Icons.Sparkles size={14} />
            <span>
              Sugestão: <strong>{suggestedProperty.titulo}</strong> (semelhança de nome/endereço{" "}
              {Math.round(suggestion.score * 100)}%)
            </span>
            <AppButton variant="secondary" size="sm" onClick={() => void changeLink(suggestion.propriedadeId)} loading={linkBusy}>
              Usar sugestão
            </AppButton>
          </AppHStack>
        )}

        {rowError && (
          <AppHStack gap="xs" align="center" role="alert">
            <Icons.AlertCircle size={14} />
            <span>{rowError}</span>
          </AppHStack>
        )}
        {notice && (
          <AppHStack gap="xs" align="center" role="status">
            <Icons.Check size={14} />
            <span>{notice}</span>
          </AppHStack>
        )}

        {preview && (
          <AppCard variant="subtle">
            <AppVStack gap="sm">
              <p className="urban-app-eyebrow-muted">
                PRÉVIA · {preview.targetDate}
                {recommendation?.eventName ? ` · ${recommendation.eventName}` : ""}
              </p>
              <AppHStack gap="lg" wrap>
                <span>
                  Atual na Stays: <strong>{formatCurrency(preview.previousPriceCents)}</strong>
                </span>
                <span>
                  Recomendado: <strong>{formatCurrency(preview.newPriceCents)}</strong>
                </span>
                <span>
                  Diferença:{" "}
                  <strong>
                    {preview.diffPercent == null
                      ? "—"
                      : `${preview.diffPercent > 0 ? "+" : ""}${preview.diffPercent.toFixed(1)}%`}
                  </strong>
                </span>
              </AppHStack>
              {[...preview.blockers, ...preview.warnings].map((issue) => (
                <AppHStack key={issue.code} gap="xs" align="center">
                  <AppBadge kind={preview.blockers.includes(issue) ? "error" : "warn"}>
                    {preview.blockers.includes(issue) ? "Bloqueio" : "Aviso"}
                  </AppBadge>
                  <span>{issue.message}</span>
                </AppHStack>
              ))}
              <AppHStack gap="sm" wrap>
                <AppButton
                  variant="primary"
                  size="sm"
                  disabled={!writesEnabled || !preview.readyForPush}
                  onClick={() => setConfirmOpen(true)}
                >
                  {writesEnabled ? "Confirmar e aplicar" : STAYS_WRITES_DISABLED_MESSAGE}
                </AppButton>
                <AppButton variant="ghost" size="sm" onClick={() => setPreview(null)}>
                  Cancelar
                </AppButton>
              </AppHStack>
            </AppVStack>
          </AppCard>
        )}

        <AppVStack gap="xs">
          <p className="urban-app-eyebrow-muted">HISTÓRICO NA STAYS</p>
          {history.length === 0 ? (
            <span className="urban-app-eyebrow-muted">Nenhum preço enviado por aqui ainda.</span>
          ) : (
            history.map((item) => (
              <AppHStack key={item.id} gap="sm" align="center" justify="space-between" wrap>
                <span>
                  {item.targetDate} · {formatCurrency(item.previousPriceCents)} → {formatCurrency(item.newPriceCents)} ·{" "}
                  {priceUpdateOriginLabel(item.origin)}
                </span>
                <AppHStack gap="xs" align="center">
                  <AppBadge kind={priceUpdateBadgeKind(item.status)}>{priceUpdateStatusLabel(item.status)}</AppBadge>
                  {canRollback(item, history) && (
                    <AppButton
                      variant="secondary"
                      size="sm"
                      disabled={!writesEnabled}
                      title={writesEnabled ? undefined : STAYS_WRITES_DISABLED_MESSAGE}
                      onClick={() => setRollbackTarget(item)}
                    >
                      Reverter
                    </AppButton>
                  )}
                </AppHStack>
              </AppHStack>
            ))
          )}
        </AppVStack>
      </AppVStack>

      <AppConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmApply}
        loading={pushBusy}
        title="Aplicar preço via Stays?"
        body={
          preview
            ? `A Stays passará de ${formatCurrency(preview.previousPriceCents)} para ${formatCurrency(preview.newPriceCents)} em ${preview.targetDate}. Você pode reverter depois.`
            : undefined
        }
        confirmLabel="Aplicar"
      />
      <AppConfirmDialog
        open={Boolean(rollbackTarget)}
        onClose={() => setRollbackTarget(null)}
        onConfirm={confirmRollback}
        loading={rollbackBusy}
        destructive
        title="Reverter este preço?"
        body={
          rollbackTarget
            ? `A Stays volta para ${formatCurrency(rollbackTarget.previousPriceCents)} em ${rollbackTarget.targetDate}.`
            : undefined
        }
        confirmLabel="Reverter"
      />
    </AppCard>
  );
}

export function StaysListingsEmpty({ onSync, busy }: { onSync: () => void; busy: boolean }) {
  return (
    <AppEmptyState
      title="Nenhum anúncio sincronizado"
      body="Clique em Sincronizar agora para puxar os anúncios da sua conta Stays."
      action={
        <AppButton variant="primary" onClick={onSync} loading={busy} leftIcon={<Icons.Zap size={14} />}>
          Sincronizar agora
        </AppButton>
      }
    />
  );
}
