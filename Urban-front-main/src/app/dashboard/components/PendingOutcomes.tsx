"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPendingOutcomes, type PendingOutcomeItem } from "../../service/api/beta-ops";
import { AppCard, AppCardHeader } from "../../componentes/ui";
import { EventCard, type EventItem } from "./ItemEvento";
import { pendingOutcomesHeading } from "./aplicar-preco-domain";

/**
 * "Como foi?" — preços que o anfitrião aplicou e cujo evento já passou, sem resultado
 * registrado. O calendário só lista eventos de hoje em diante, então este bloco é o caminho
 * no app para informar o resultado DEPOIS do evento (reserva, receita, noites). Reusa o
 * EventCard: o botão "Registrar resultado" abre o mesmo drawer. Some quando não há pendência
 * (ou se a consulta falhar: nunca bloqueia o calendário).
 */
export function PendingOutcomes() {
  const [items, setItems] = useState<PendingOutcomeItem[]>([]);
  const [, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchPendingOutcomes();
      setItems(Array.isArray(result?.data) ? result.data : []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (items.length === 0) return null;

  return (
    <AppCard variant="accent">
      <AppCardHeader
        eyebrow="COMO FOI?"
        title={pendingOutcomesHeading(items.length)}
        subtitle="Conte se reservou, quanto entrou e quantas noites. É isso que nos deixa medir se a recomendação funcionou para você; sem o seu registro, não estimamos receita."
      />
      <div className="dashboard-events-list">
        {items.map((item) => (
          <EventCard
            key={item.idAnalise}
            ev={item as unknown as EventItem}
            cardBorder="gray.200"
            bg="white"
            propertyId={item.propertyId ?? ""}
            setIsLoading={setLoading}
            onChange={(updated) => {
              // Resultado registrado: tira da lista na hora e confirma com o servidor.
              if (updated.resultadoRegistradoEm) {
                setItems((current) => current.filter((entry) => entry.idAnalise !== item.idAnalise));
              }
              void load();
            }}
          />
        ))}
      </div>
    </AppCard>
  );
}
