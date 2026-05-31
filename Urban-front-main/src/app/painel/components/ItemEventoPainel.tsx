"use client";

import React, { Dispatch, SetStateAction, useState } from "react";
import { alterarAceitoSugestao } from "@/app/service/api";
import { EventItem } from "@/app/dashboard/components/ItemEvento";
import { RecommendationCard, useToastCompat } from "@/app/componentes/ui";

/**
 * EventCard do /painel — REFATORADO (Sprint 3 redesign anfitrião).
 *
 * Antes (screenshot host-painel.png): hierarquia INVERTIDA — "ATUAL R$ 320"
 * em verde `#3FCF19` dominava, "SUG. R$ 455" em azul `#1931CF` sumia.
 * Auditoria do usuário (P0): a sugestão (output da IA) deve dominar.
 *
 * Agora: usa o componente compartilhado `RecommendationCard` (Pilar D
 * do plano). Preço sugerido em Bebas Neue accent #E8500A; preço atual
 * vira referencia menor; CTA "Aplicar sugestão" inconfundivel.
 */

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

const formatBRL = (n: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);

export const EventCard: React.FC<EventCardProps> = ({
  ev,
  setIsLoading,
  onChange,
}) => {
  const toast = useToastCompat();
  const sugNum = toNumber(ev.precoSugerido);
  const atualNum = toNumber(ev.seuPrecoAtual);
  const [accepted, setAccepted] = useState(ev.aceito);
  const [loading, setLoading] = useState(false);

  const distanceMeta = ev.enderecoCompleto || `${ev.cidade}, ${ev.estado}`;

  async function handleAccept() {
    setLoading(true);
    setIsLoading(true);
    try {
      await alterarAceitoSugestao(ev.idAnalise, true);
      ev.aceito = true;
      setAccepted(true);
      onChange?.({ ...ev });
      toast(`Você aceitou a sugestão de preço de ${formatBRL(sugNum)}`, {
        type: "success",
      });
    } catch (error) {
      toast("Não foi possível aceitar a sugestão de preço", { type: "error" });
      console.error(error);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    setIsLoading(true);
    try {
      await alterarAceitoSugestao(ev.idAnalise, false);
      ev.aceito = false;
      setAccepted(false);
      onChange?.({ ...ev });
      toast("A sugestão de preço foi cancelada.", { type: "info" });
    } catch (error) {
      toast("Não foi possível cancelar a sugestão de preço", { type: "error" });
      console.error(error);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  }

  return (
    <RecommendationCard
      eventTitle={ev.nome}
      eventDate={ev.dataInicio}
      eventLocation={distanceMeta}
      currentPrice={Number.isFinite(atualNum) ? atualNum : 0}
      suggestedPrice={Number.isFinite(sugNum) ? sugNum : 0}
      reason={ev.motivo_ia ?? ev.recomendacao ?? undefined}
      status={accepted ? "accepted" : "pending"}
      onPrimary={accepted ? handleCancel : handleAccept}
      primaryLabel={accepted ? "Cancelar aceite" : "Aplicar sugestão"}
      loading={loading}
      density="compact"
    />
  );
};
