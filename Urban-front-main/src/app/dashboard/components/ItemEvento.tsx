"use client";

import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import {
  alterarAceitoSugestao,
  registrarPrecoAplicadoSugestao,
} from "@/app/service/api";
import {
  RecommendationCard,
  AppButton,
  AppInput,
  AppSelect,
  AppTextarea,
  AppBadge,
  Icons,
  useToastCompat,
} from "@/app/componentes/ui";
import { AplicarPrecoDialog } from "./AplicarPrecoDialog";
import { DialogSurface } from "@/app/componentes/ui/DialogSurface";
import { formatBrl } from "./aplicar-preco-domain";
import { useStaysAutoMode } from "./useStaysAutoMode";
import styles from "./ItemEvento.module.css";

/**
 * EventCard do /dashboard (calendário) — REFATORADO (Sprint 3 redesign).
 *
 * Antes (screenshot host-calendário.png):
 *  - SUG (azul #1931CF) somia, ATUAL (verde #3FCF19) dominava — hierarquia
 *    invertida.
 *  - Form "Registrar resultado" inline com campos cortados pelo viewport.
 *  - Botoes colorScheme=teal/red.
 *
 * Agora:
 *  - RecommendationCard (Pilar D do plano) com sugestão Bebas accent
 *    dominando, atual como referencia menor, CTA primary #E8500A.
 *  - CTA honesto: "Vou aplicar este preço" abre o dialog com valor, data e
 *    passo a passo; a Urban AI NÃO muda o preço no Airbnb. Só a confirmação
 *    do preço que o anfitrião aplicou grava o resultado (precoAplicado).
 *    No modo automático (Stays) o fluxo antigo de aceite é mantido.
 *  - "Registrar resultado" vira Drawer slide-in (campos respiram, nada
 *    cortado).
 *  - Cores semanticas via design system (success/warn/danger sutis).
 */

export interface EventItem {
  id: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  enderecoCompleto?: string;
  cidade: string;
  estado: string;
  precoSugerido: string | number;
  seuPrecoAtual?: string | number;
  diferencaPercentual: string;
  recomendacao?: string;
  motivo_ia?: string | null;
  criadoEm?: string;
  precoAplicado?: string | number | null;
  aplicadoEm?: string | null;
  origemAplicacao?: string | null;
  reservaStatus?: "unknown" | "booked" | "not_booked" | "blocked" | null;
  receitaReal?: string | number | null;
  noitesReservadas?: string | number | null;
  resultadoRegistradoEm?: string | null;
  feedbackObservacao?: string | null;
  status?:
    | "suggested"
    | "accepted"
    | "rejected"
    | "applied_manual"
    | "applied_stays"
    | "expired";
  aceitoEm?: string | null;
  rejeitadoEm?: string | null;
  expiradoEm?: string | null;
  idAnalise: string;
  aceito: boolean;
}

interface EventCardProps {
  ev: EventItem;
  cardBorder: string;
  bg: string;
  propertyId: string;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  onChange?: (updated: EventItem) => void;
  /** Força o modo automático (Stays). Sem valor, vem do perfil do usuário. */
  staysAuto?: boolean;
}

const toNumber = (v: string | number | undefined): number => {
  if (v === undefined || v === null) return NaN;
  if (typeof v === "number") return v;
  const s = v.trim();
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  return Number(s);
};

const formatBRL = (value: string | number | undefined): string => {
  if (value === undefined || value === null) return "";
  const n = typeof value === "string" ? toNumber(value) : value;
  if (!Number.isFinite(n)) return "";
  return formatBrl(n as number);
};

export const EventCard: React.FC<EventCardProps> = ({
  ev,
  setIsLoading,
  onChange,
  staysAuto,
}) => {
  const toast = useToastCompat();
  const isStaysAuto = useStaysAutoMode(staysAuto);
  const sugNum = toNumber(ev.precoSugerido);
  const atualNum = toNumber(ev.seuPrecoAtual);

  const [accepted, setAccepted] = useState(ev.aceito);
  const [loadingSaving, setLoadingSaving] = useState(false);
  const [loadingAppliedPrice, setLoadingAppliedPrice] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);

  const [appliedPriceInput, setAppliedPriceInput] = useState(
    ev.precoAplicado ? String(ev.precoAplicado).replace(".", ",") : "",
  );
  const [reservationStatus, setReservationStatus] = useState<EventItem["reservaStatus"]>(
    ev.reservaStatus || "unknown",
  );
  const [realRevenueInput, setRealRevenueInput] = useState(
    ev.receitaReal ? String(ev.receitaReal).replace(".", ",") : "",
  );
  const [bookedNightsInput, setBookedNightsInput] = useState(
    ev.noitesReservadas ? String(ev.noitesReservadas) : "",
  );
  const [feedbackNote, setFeedbackNote] = useState(ev.feedbackObservacao || "");

  useEffect(() => {
    setAccepted(ev.aceito);
    setAppliedPriceInput(
      ev.precoAplicado ? String(ev.precoAplicado).replace(".", ",") : "",
    );
    setReservationStatus(ev.reservaStatus || "unknown");
    setRealRevenueInput(
      ev.receitaReal ? String(ev.receitaReal).replace(".", ",") : "",
    );
    setBookedNightsInput(ev.noitesReservadas ? String(ev.noitesReservadas) : "");
    setFeedbackNote(ev.feedbackObservacao || "");
  }, [
    ev.aceito,
    ev.precoAplicado,
    ev.reservaStatus,
    ev.receitaReal,
    ev.noitesReservadas,
    ev.feedbackObservacao,
  ]);

  async function handleAccept() {
    setLoadingSaving(true);
    setIsLoading(true);
    try {
      await alterarAceitoSugestao(ev.idAnalise, true);
      const updated = { ...ev, aceito: true, status: "accepted" as const };
      setAccepted(true);
      onChange?.(updated);
      toast(`Você aceitou a sugestão de preço de ${formatBRL(sugNum)}`, {
        type: "success",
      });
    } catch {
      toast("Não foi possível aceitar a sugestão de preço", { type: "error" });
    } finally {
      setIsLoading(false);
      setLoadingSaving(false);
    }
  }

  async function handleCancel() {
    setLoadingSaving(true);
    setIsLoading(true);
    try {
      await alterarAceitoSugestao(ev.idAnalise, false);
      const updated = { ...ev, aceito: false, status: "rejected" as const };
      setAccepted(false);
      onChange?.(updated);
      toast("A sugestão de preço foi cancelada.", { type: "info" });
    } catch {
      toast("Não foi possível cancelar a sugestão de preço.", { type: "error" });
    } finally {
      setLoadingSaving(false);
      setIsLoading(false);
    }
  }

  /** Ignorar: rejeita a sugestão (não é aplicação nem resultado). */
  async function handleIgnore() {
    setLoadingSaving(true);
    setIsLoading(true);
    try {
      await alterarAceitoSugestao(ev.idAnalise, false);
      onChange?.({ ...ev, aceito: false, status: "rejected" as const });
      setAccepted(false);
      toast("Sugestão ignorada.", { type: "info" });
    } catch {
      toast("Não foi possível ignorar a sugestão.", { type: "error" });
    } finally {
      setLoadingSaving(false);
      setIsLoading(false);
    }
  }

  /** Confirmação do dialog: grava o preço que o anfitrião diz ter aplicado. */
  async function handleConfirmApplied(appliedPrice: number) {
    await registrarPrecoAplicadoSugestao(ev.idAnalise, appliedPrice, "manual_dashboard");
    setAccepted(true);
    setApplyDialogOpen(false);
    onChange?.({
      ...ev,
      aceito: true,
      precoAplicado: appliedPrice,
      aplicadoEm: new Date().toISOString(),
      origemAplicacao: "manual_dashboard",
      status: "applied_manual",
    });
    toast(`Preço aplicado registrado: ${formatBRL(appliedPrice)}`, { type: "success" });
  }

  async function handleRegisterAppliedPrice() {
    const appliedPrice = toNumber(appliedPriceInput);
    if (!Number.isFinite(appliedPrice) || appliedPrice <= 0) {
      toast("Informe um preço aplicado válido.", { type: "warning" });
      return;
    }

    setLoadingAppliedPrice(true);
    try {
      const receitaReal = realRevenueInput ? toNumber(realRevenueInput) : null;
      const noitesReservadas = bookedNightsInput
        ? Number(bookedNightsInput)
        : null;
      const normalizedNights = Number.isFinite(noitesReservadas as number)
        ? Math.max(0, Math.floor(noitesReservadas as number))
        : null;
      const normalizedRevenue = Number.isFinite(receitaReal as number)
        ? receitaReal
        : null;

      await registrarPrecoAplicadoSugestao(
        ev.idAnalise,
        appliedPrice,
        "manual_dashboard",
        {
          reservaStatus: reservationStatus,
          receitaReal: normalizedRevenue,
          noitesReservadas: normalizedNights,
          feedbackObservacao: feedbackNote || null,
        },
      );
      onChange?.({
        ...ev,
        precoAplicado: appliedPrice,
        aplicadoEm: new Date().toISOString(),
        origemAplicacao: "manual_dashboard",
        reservaStatus: reservationStatus,
        receitaReal: normalizedRevenue,
        noitesReservadas: normalizedNights,
        resultadoRegistradoEm: new Date().toISOString(),
        feedbackObservacao: feedbackNote || null,
        status: "applied_manual",
      });
      toast("Preço e resultado registrados.", { type: "success" });
      setDrawerOpen(false);
    } catch {
      toast("Não foi possível registrar o preço aplicado.", { type: "error" });
    } finally {
      setLoadingAppliedPrice(false);
    }
  }

  const distanceMeta = ev.enderecoCompleto || `${ev.cidade}, ${ev.estado}`;
  const eventCategory = ev.recomendacao ? undefined : undefined;
  const cardStatus: "pending" | "accepted" | "applied" | "rejected" =
    ev.status === "applied_manual" || ev.status === "applied_stays"
      ? "applied"
      : accepted
        ? "accepted"
        : ev.status === "rejected"
          ? "rejected"
          : "pending";

  const hasApplied = cardStatus === "applied";
  // Modo automático (Stays): mantém aceite/desfazer como antes. Fluxo manual:
  // o anfitrião aplica no Airbnb e confirma o preço; "Ignorar" rejeita.
  const primaryAction = isStaysAuto
    ? accepted
      ? handleCancel
      : handleAccept
    : () => setApplyDialogOpen(true);
  const primaryLabel = isStaysAuto
    ? accepted
      ? "Desfazer aprovação"
      : "Aplicar sugestão"
    : accepted
      ? "Informar preço aplicado"
      : "Vou aplicar este preço";
  const secondaryAction = isStaysAuto
    ? accepted
      ? () => setDrawerOpen(true)
      : undefined
    : hasApplied
      ? () => setDrawerOpen(true)
      : ev.status === "rejected"
        ? undefined
        : handleIgnore;
  const secondaryLabel = !isStaysAuto && !hasApplied ? "Ignorar" : "Registrar resultado";

  return (
    <>
      <div className={styles.s1}>
        <RecommendationCard
          eventTitle={ev.nome}
          eventCategory={eventCategory}
          eventDate={ev.dataInicio}
          eventLocation={distanceMeta}
          currentPrice={Number.isFinite(atualNum) ? atualNum : 0}
          suggestedPrice={Number.isFinite(sugNum) ? sugNum : 0}
          reason={ev.motivo_ia ?? ev.recomendacao ?? undefined}
          status={cardStatus}
          onPrimary={primaryAction}
          primaryLabel={primaryLabel}
          onSecondary={secondaryAction}
          secondaryLabel={secondaryLabel}
          loading={loadingSaving}
          density="compact"
        />

        {/* Estado: já aplicado */}
        {ev.precoAplicado && (
          <div
            className={styles.s10}
          >
            <Icons.Check size={12} /> Aplicado {formatBRL(ev.precoAplicado)}
            {ev.origemAplicacao?.startsWith("manual") ? " (informado por você)" : ""}
          </div>
        )}

        {ev.status === "rejected" && (
          <div className={styles.s2}>
            <AppBadge kind="error">Rejeitada</AppBadge>
          </div>
        )}

        {ev.status === "expired" && (
          <div className={styles.s2}>
            <AppBadge kind="neutral">Expirada</AppBadge>
          </div>
        )}
      </div>

      {!isStaysAuto && (
        <AplicarPrecoDialog
          open={applyDialogOpen}
          onClose={() => setApplyDialogOpen(false)}
          onConfirm={handleConfirmApplied}
          eventName={ev.nome}
          eventStart={ev.dataInicio}
          eventEnd={ev.dataFim}
          suggestedPrice={Number.isFinite(sugNum) ? sugNum : 0}
          currentPrice={Number.isFinite(atualNum) ? atualNum : undefined}
          appliedPrice={ev.precoAplicado ? toNumber(ev.precoAplicado) : null}
        />
      )}

      {/* Drawer "Registrar resultado" — substitui o form inline cortado */}
      {drawerOpen && (
        <DialogSurface
          onClose={() => setDrawerOpen(false)}
          aria-labelledby="registrar-resultado-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1300,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={() => setDrawerOpen(false)}
            className={styles.s11}
          />
          <aside
            className={`urban-app ${styles.s3}`}
          >
            <header
              className={styles.s4}
            >
              <div>
                <p className="urban-app-eyebrow">RESULTADO DA SUGESTÃO</p>
                <h2
                  id="registrar-resultado-title"
                  className={styles.s5}
                >
                  Registrar preço aplicado
                </h2>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Fechar"
                className={styles.s6}
              >
                <Icons.Close size={16} />
              </button>
            </header>
            <div
              className={styles.s7}
            >
              <AppInput
                label="Preço aplicado"
                leftAddon={<span className={styles.s8}>R$</span>}
                value={appliedPriceInput}
                onChange={(e) => setAppliedPriceInput(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
              <AppSelect
                label="Resultado da reserva"
                value={reservationStatus || "unknown"}
                onChange={(e) =>
                  setReservationStatus(
                    (e.target.value as EventItem["reservaStatus"]) || "unknown",
                  )
                }
              >
                <option value="unknown">Ainda não sei</option>
                <option value="booked">Reservou</option>
                <option value="not_booked">Não reservou</option>
                <option value="blocked">Bloqueado</option>
              </AppSelect>
              <AppInput
                label="Receita real (opcional)"
                leftAddon={<span className={styles.s8}>R$</span>}
                value={realRevenueInput}
                onChange={(e) => setRealRevenueInput(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
              <AppInput
                label="Noites reservadas (opcional)"
                value={bookedNightsInput}
                onChange={(e) => setBookedNightsInput(e.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
              <AppTextarea
                label="Observação (opcional)"
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={4}
                placeholder="Anotação livre sobre como foi a reserva."
              />
            </div>
            <div
              className={styles.s9}
            >
              <AppButton
                variant="ghost"
                onClick={() => setDrawerOpen(false)}
                disabled={loadingAppliedPrice}
              >
                Cancelar
              </AppButton>
              <AppButton
                variant="primary"
                onClick={handleRegisterAppliedPrice}
                loading={loadingAppliedPrice}
              >
                Salvar resultado
              </AppButton>
            </div>
          </aside>
          <style jsx global>{`
            @keyframes urban-app-drawer-in {
              from {
                transform: translateX(100%);
              }
              to {
                transform: translateX(0);
              }
            }
          `}</style>
        </DialogSurface>
      )}
    </>
  );
};
