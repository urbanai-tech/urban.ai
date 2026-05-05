"""BaseCollector — esqueleto comum para todos os coletores Urban AI.

Cada coletor concreto (api-football, Sympla, Eventbrite, Firecrawl,
SP Cultura, SerpAPI, etc.) herda de `BaseCollector` e implementa apenas:

  1. `source` (class attr) — string usada como `source` no POST
     `/events/ingest`. Ex.: 'api-football', 'sympla-api', 'sp-cultura'.

  2. `fetch_raw()` → list[dict] — busca os eventos brutos da fonte.
     Pode ser HTTP, leitura de CSV, scraping via Firecrawl, etc.
     Retorna lista de dicts no formato bruto da fonte.

  3. `normalize(raw)` → dict | None — transforma um item bruto em
     payload para POST `/events/ingest`. Retorna None pra item lixo
     (filtrado).

A `BaseCollector.run()` orquestra: fetch_raw → normalize cada → enrich
com venue_map → adiciona ao client → flush. Faz tudo, com logs e
métricas no final.

CLI: cada coletor tem `python -m urban_webscrapping.collectors.<nome>`
que cria instância default e roda. Útil pra testes manuais e cron
do Prefect/Scrapyd/Railway.
"""

from __future__ import annotations

import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from urban_webscrapping.utils.urban_backend_client import (
    UrbanBackendClient,
    UrbanBackendError,
)
from urban_webscrapping.utils.venue_map import match_venue


logger = logging.getLogger(__name__)


@dataclass
class CollectorRunResult:
    """Resumo de uma execução de coletor."""

    source: str
    fetched: int = 0
    normalized: int = 0
    sent: int = 0
    skipped_empty: int = 0
    skipped_invalid: int = 0
    errors: list[str] = field(default_factory=list)
    elapsed_seconds: float = 0.0
    backend_response: dict[str, Any] | None = None  # Última resposta agregada do backend


class BaseCollector(ABC):
    """Classe base para todos os coletores Urban AI.

    Subclasses devem definir `source` e implementar `fetch_raw()` +
    `normalize(raw)`. O resto (auth, batch, dedup, geocoding lazy) já
    vem de graça.
    """

    #: String identificadora da fonte. Ex.: 'sp-cultura', 'api-football'.
    source: str = ""

    def __init__(
        self,
        client: UrbanBackendClient | None = None,
        dry_run: bool = False,
    ):
        if not self.source:
            raise ValueError(
                f"{type(self).__name__}: atributo de classe `source` é obrigatório"
            )
        if client is None and not dry_run:
            client = UrbanBackendClient.from_env()
        self.client = client
        self.dry_run = dry_run

    # ============== A ser implementado por cada coletor ==============

    @abstractmethod
    def fetch_raw(self) -> list[dict[str, Any]]:
        """Busca eventos brutos da fonte. Retorna lista de dicts no formato
        original da fonte. Sem normalização ainda.
        """
        raise NotImplementedError

    @abstractmethod
    def normalize(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        """Converte 1 item bruto → payload do POST /events/ingest.

        Retornar None descarta o item (lixo, fora de SP, sem data válida, etc.).

        Payload mínimo:
          { nome, dataInicio, source }
        + opcionalmente: enderecoCompleto, latitude, longitude, dataFim,
          categoria, venueType, venueCapacity, sourceId, crawledUrl, etc.

        Lat/lng pode ser omitido SE enderecoCompleto presente — backend
        marca pendingGeocode e cron resolve depois.
        """
        raise NotImplementedError

    # ============== Helpers compartilhados ==============

    def enrich_with_venue(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Tenta enriquecer com `venue_map`: se o endereço (ou nome) bate
        com um venue conhecido de SP, preenche lat/lng/venueType/venueCapacity.

        Se já vieram lat/lng do coletor, NÃO sobrescreve (coletor sabe mais).
        Só preenche o que está vazio.
        """
        if payload.get("latitude") is not None and payload.get("longitude") is not None:
            # Já tem geo do coletor — só completa metadados se vazio
            search = (payload.get("enderecoCompleto") or "") + " " + (payload.get("nome") or "")
            venue = match_venue(search)
            if venue:
                payload.setdefault("venueType", venue.venue_type)
                if venue.capacity is not None:
                    payload.setdefault("venueCapacity", venue.capacity)
            return payload

        # Sem geo do coletor — tenta puxar tudo do venue_map
        search = (payload.get("enderecoCompleto") or "") + " " + (payload.get("nome") or "")
        venue = match_venue(search)
        if venue:
            payload["latitude"] = venue.lat
            payload["longitude"] = venue.lng
            payload.setdefault("venueType", venue.venue_type)
            if venue.capacity is not None:
                payload.setdefault("venueCapacity", venue.capacity)
        # Se ainda não tem, backend marca pendingGeocode (precisa endereço)
        return payload

    # ============== Orquestração ==============

    def run(self) -> CollectorRunResult:
        """Execução completa: fetch → normalize → enrich → send → flush.

        Sempre retorna `CollectorRunResult` (mesmo em caso de erro grande,
        coloca em `result.errors`). Não vaza exception pra fora — chamador
        decide se trata.
        """
        result = CollectorRunResult(source=self.source)
        start = time.time()

        try:
            raw_items = self.fetch_raw()
        except Exception as e:
            logger.exception("[%s] fetch_raw falhou", self.source)
            result.errors.append(f"fetch_raw: {e}")
            result.elapsed_seconds = round(time.time() - start, 2)
            return result

        result.fetched = len(raw_items)
        logger.info("[%s] fetched %d items", self.source, result.fetched)

        for raw in raw_items:
            try:
                payload = self.normalize(raw)
            except Exception as e:
                logger.warning("[%s] normalize crashed: %s", self.source, e)
                result.errors.append(f"normalize: {e}")
                result.skipped_invalid += 1
                continue

            if not payload:
                result.skipped_empty += 1
                continue

            # Garante source consistente (subclass pode ter esquecido)
            payload.setdefault("source", self.source)

            # Enrich com venue_map antes de enviar
            payload = self.enrich_with_venue(payload)

            result.normalized += 1

            if self.dry_run or self.client is None:
                # Modo dry-run: log o que mandaria, não envia
                logger.debug("[%s] DRY-RUN payload: %s", self.source, payload)
                continue

            try:
                self.client.add_event(payload)
                result.sent += 1
            except UrbanBackendError as e:
                logger.warning("[%s] add_event failed: %s", self.source, e)
                result.errors.append(f"add_event: {e}")

        # Flush final
        if not self.dry_run and self.client:
            try:
                response = self.client.flush()
                if response:
                    result.backend_response = response
            except UrbanBackendError as e:
                logger.error("[%s] flush final falhou: %s", self.source, e)
                result.errors.append(f"flush: {e}")

        result.elapsed_seconds = round(time.time() - start, 2)
        logger.info(
            "[%s] DONE — fetched=%d normalized=%d sent=%d skipped_empty=%d skipped_invalid=%d errors=%d in %.1fs",
            self.source,
            result.fetched,
            result.normalized,
            result.sent,
            result.skipped_empty,
            result.skipped_invalid,
            len(result.errors),
            result.elapsed_seconds,
        )
        return result


def setup_logging(level: str = "INFO") -> None:
    """Setup de logging padrão para CLI dos coletores."""
    log_level = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
