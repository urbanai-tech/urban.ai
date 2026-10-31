"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppButton, Icons } from "./ui";
import { fetchHostEventCatalog, type EventCatalogItem } from "../service/api";
import {
  CATALOG_LOOKAHEAD_DAYS,
  catalogWindow,
  nextWeeklyReportAt,
  pickCatalogCity,
  pickUpcomingCityEvents,
  whyNoSuggestionCopy,
} from "../lib/next-suggestions-domain";
import styles from "./NextSuggestionsGuide.module.css";

const HOST_TIME_ZONE = "America/Sao_Paulo";
const eventDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: HOST_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
});
const reportDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: HOST_TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
});

type GuideProperty = { cidade?: string | null };

/**
 * Quando não há sugestão de preço, explica o porquê e mostra o que vem a seguir:
 * próximos eventos da cidade (catálogo da API), como e quando o anfitrião é avisado.
 * Nunca deixa uma tela vazia (MKT-05).
 */
export function NextSuggestionsGuide({
  properties,
  headingAs: Heading = "h3",
  eyebrow = "NADA PARA DECIDIR AGORA",
  title = "Nenhuma sugestão para decidir agora",
}: {
  properties: ReadonlyArray<GuideProperty>;
  /** Nível do título: h3 dentro de uma seção com h2 (padrão). */
  headingAs?: "h2" | "h3";
  eyebrow?: string;
  title?: string;
}) {
  const city = useMemo(() => pickCatalogCity(properties), [properties]);
  const [events, setEvents] = useState<EventCatalogItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!city) {
      setEvents([]);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    const now = new Date();
    const { from, to } = catalogWindow(now, CATALOG_LOOKAHEAD_DAYS);
    fetchHostEventCatalog({ city, from, to, limit: 12 })
      .then((response) => {
        // Resposta de mock (fallback de contrato) não é dado real: não mostra como se fosse.
        if (!cancelled) setEvents(response.mock ? [] : pickUpcomingCityEvents(response.items, now));
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [city]);

  const weeklyReport = useMemo(() => reportDateFormatter.format(nextWeeklyReportAt()), []);

  return (
    <section className={styles.guide} data-next-suggestions aria-label="O que vem a seguir">
      <div className={styles.head}>
        <p className="urban-app-eyebrow">{eyebrow}</p>
        <Heading className={styles.title}>{title}</Heading>
        <p className={styles.lead}>{whyNoSuggestionCopy({ city, upcomingCount: events.length })}</p>
      </div>

      <div className={styles.blocks}>
        <div className={styles.block} data-next-suggestions-events>
          <h4 className={styles.blockTitle}>{city ? `Próximos eventos em ${city}` : "Próximos eventos"}</h4>
          {!loaded ? (
            <p className={styles.note} role="status">
              Buscando a agenda da sua cidade…
            </p>
          ) : events.length > 0 ? (
            <ul className={styles.list}>
              {events.map((event) => (
                <li key={event.id} className={styles.item}>
                  <span className={styles.itemName}>{event.name}</span>
                  <span className={styles.itemMeta}>
                    {eventDateFormatter.format(new Date(event.startsAt)).replace(/\./g, "")}
                    {event.venueName ? ` · ${event.venueName}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>
              {city
                ? `Nenhum evento da agenda de ${city} nos próximos ${CATALOG_LOOKAHEAD_DAYS} dias entrou no catálogo ainda. Seguimos monitorando.`
                : "Preencha a cidade do imóvel em Imóveis para ver a agenda da região aqui."}
            </p>
          )}
        </div>

        <div className={styles.block} data-next-suggestions-notify>
          <h4 className={styles.blockTitle}>Como e quando você é avisado</h4>
          <ul className={styles.list}>
            <li className={styles.item}>
              <span className={styles.itemName}>Assim que surgir uma oportunidade</span>
              <span className={styles.itemMeta}>
                O app confere os eventos de hora em hora e avisa em Avisos e por notificação, se estiver ativada.
              </span>
            </li>
            <li className={styles.item}>
              <span className={styles.itemName}>Resumo semanal por e-mail</span>
              <span className={styles.itemMeta}>
                Próximo envio: {weeklyReport}, às 8h30, se estiver ativado em Comunicações.
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.actions}>
        <AppButton as="a" href="/events" variant="primary" size="md" rightIcon={<Icons.ArrowRight size={14} />}>
          Ver agenda de eventos
        </AppButton>
        <AppButton as="a" href="/properties" variant="secondary" size="md">
          Ver Imóveis
        </AppButton>
        <AppButton as="a" href="/settings/communications" variant="ghost" size="md">
          Ajustar avisos
        </AppButton>
      </div>
    </section>
  );
}
