"use client";

import React, { Dispatch, SetStateAction } from "react";
import { EventCard as DashboardEventCard, EventItem } from "@/app/dashboard/components/ItemEvento";

/**
 * EventCard do /painel.
 *
 * Antes este arquivo tinha uma cópia do card que só marcava a sugestão como
 * aceita (`alterarAceitoSugestao`) e MUTAVA a prop `ev` (`ev.aceito = true`),
 * dando a entender que o preço tinha mudado no Airbnb. Agora usa o mesmo card
 * do /dashboard: "Vou aplicar este preço" abre o dialog com valor, data e
 * passo a passo, e só a confirmação do preço aplicado grava o resultado.
 * O estado vive no card e sobe pelo `onChange`, sem mutar props.
 */

interface EventCardProps {
  ev: EventItem;
  cardBorder: string;
  bg: string;
  propertyId: string;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  onChange?: (updated: EventItem) => void;
}

export const EventCard: React.FC<EventCardProps> = (props) => <DashboardEventCard {...props} />;
