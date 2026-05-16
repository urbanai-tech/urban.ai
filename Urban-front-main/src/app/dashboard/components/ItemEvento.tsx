"use client";

import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import { toast } from "react-toastify";
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
} from "@/app/componentes/ui";

/**
 * EventCard do /dashboard (calendario) — REFATORADO (Sprint 3 redesign).
 *
 * Antes (screenshot host-calendario.png):
 *  - SUG (azul #1931CF) somia, ATUAL (verde #3FCF19) dominava — hierarquia
 *    invertida.
 *  - Form "Registrar resultado" inline com campos cortados pelo viewport.
 *  - Botoes colorScheme=teal/red.
 *
 * Agora:
 *  - RecommendationCard (Pilar D do plano) com sugestao Bebas accent
 *    dominando, atual como referencia menor, CTA primary #E8500A
 *    "Aplicar sugestao" inconfundivel.
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
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n as number);
};

export const EventCard: React.FC<EventCardProps> = ({
  ev,
  setIsLoading,
  onChange,
}) => {
  const sugNum = toNumber(ev.precoSugerido);
  const atualNum = toNumber(ev.seuPrecoAtual);

  const [accepted, setAccepted] = useState(ev.aceito);
  const [loadingSaving, setLoadingSaving] = useState(false);
  const [loadingAppliedPrice, setLoadingAppliedPrice] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      toast(`Voce aceitou a sugestao de preco de ${formatBRL(sugNum)}`, {
        type: "success",
      });
    } catch {
      toast("Nao foi possivel aceitar a sugestao de preco", { type: "error" });
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
      toast("A sugestao de preco foi cancelada.", { type: "info" });
    } catch {
      toast("Nao foi possivel cancelar a sugestao de preco.", { type: "error" });
    } finally {
      setLoadingSaving(false);
      setIsLoading(false);
    }
  }

  async function handleRegisterAppliedPrice() {
    const appliedPrice = toNumber(appliedPriceInput);
    if (!Number.isFinite(appliedPrice) || appliedPrice <= 0) {
      toast("Informe um preco aplicado valido.", { type: "warning" });
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
      toast("Preco e resultado registrados.", { type: "success" });
      setDrawerOpen(false);
    } catch {
      toast("Nao foi possivel registrar o preco aplicado.", { type: "error" });
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

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <RecommendationCard
          eventTitle={ev.nome}
          eventCategory={eventCategory}
          eventDate={ev.dataInicio}
          eventLocation={distanceMeta}
          currentPrice={Number.isFinite(atualNum) ? atualNum : 0}
          suggestedPrice={Number.isFinite(sugNum) ? sugNum : 0}
          reason={ev.motivo_ia ?? ev.recomendacao ?? undefined}
          status={cardStatus}
          onPrimary={accepted ? handleCancel : handleAccept}
          primaryLabel={accepted ? "Cancelar aceite" : "Aplicar sugestao"}
          onSecondary={accepted ? () => setDrawerOpen(true) : undefined}
          secondaryLabel="Registrar resultado"
          loading={loadingSaving}
        />

        {/* Estado: ja aplicado */}
        {ev.precoAplicado && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              alignSelf: "flex-start",
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(22, 160, 107, 0.25)",
              background: "rgba(22, 160, 107, 0.08)",
              color: "var(--app-success)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Icons.Check size={12} /> Aplicado {formatBRL(ev.precoAplicado)}
          </div>
        )}

        {ev.status === "rejected" && (
          <div style={{ alignSelf: "flex-start" }}>
            <AppBadge kind="error">Rejeitada</AppBadge>
          </div>
        )}

        {ev.status === "expired" && (
          <div style={{ alignSelf: "flex-start" }}>
            <AppBadge kind="neutral">Expirada</AppBadge>
          </div>
        )}
      </div>

      {/* Drawer "Registrar resultado" — substitui o form inline cortado */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
            }}
          />
          <aside
            className="urban-app"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 480,
              background: "var(--app-surface)",
              borderLeft: "1px solid var(--app-divider)",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              animation: "urban-app-drawer-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <header
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--app-divider)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <div>
                <p className="urban-app-eyebrow">RESULTADO DA SUGESTAO</p>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "var(--app-text)",
                    margin: "6px 0 0",
                    letterSpacing: -0.2,
                  }}
                >
                  Registrar preco aplicado
                </h2>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Fechar"
                style={{
                  background: "transparent",
                  border: "1px solid var(--app-divider-strong)",
                  borderRadius: 6,
                  color: "var(--app-text-muted)",
                  padding: 6,
                  cursor: "pointer",
                  display: "inline-flex",
                  lineHeight: 0,
                }}
              >
                <Icons.Close size={16} />
              </button>
            </header>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <AppInput
                label="Preco aplicado"
                leftAddon={<span style={{ fontSize: 13 }}>R$</span>}
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
                <option value="unknown">Ainda nao sei</option>
                <option value="booked">Reservou</option>
                <option value="not_booked">Nao reservou</option>
                <option value="blocked">Bloqueado</option>
              </AppSelect>
              <AppInput
                label="Receita real (opcional)"
                leftAddon={<span style={{ fontSize: 13 }}>R$</span>}
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
                label="Observacao (opcional)"
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={4}
                placeholder="Anotacao livre sobre como foi a reserva."
              />
            </div>
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--app-divider)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
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
        </div>
      )}
    </>
  );
};
