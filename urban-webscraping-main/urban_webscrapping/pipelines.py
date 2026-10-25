"""Pipelines for processing and storing scraped event items.

This module provides Scrapy pipelines for:
- Storing valid event items into a MySQL database (legacy bronze layer
  via S3, mantido).
- **NEW (F6.2 Plus):** Enviar items pro backend Urban AI via
  `POST /events/ingest` (com dedup automático, source tagging,
  geocoding lazy quando lat/lng ausente).
"""

import logging
import os
import sqlite3
from datetime import datetime
from typing import Any

from itemadapter import ItemAdapter
from scrapy import Spider

from urban_webscrapping.utils.aws_s3_helper import S3Helper
from urban_webscrapping.utils.event_datetime import to_sp_iso
from urban_webscrapping.utils.urban_backend_client import (
    UrbanBackendClient,
    UrbanBackendError,
    is_production,
)
from urban_webscrapping.utils.venue_map import match_venue

from .items import EventItem

logger = logging.getLogger(__name__)


# ============================== S3 (legado/bronze) ==============================


class S3ItemPipelineJson:
    def __init__(self) -> None:
        self.s3 = S3Helper()

    def process_item(self, item: EventItem, spider: Spider) -> EventItem:
        """Uploads the event item data to an S3 bucket."""
        spider_name = spider.name
        today = datetime.now().strftime("%Y-%m-%d")
        key = f"raw/json/{spider_name}/{today}.json"

        self.s3.put_object_json(
            bucket_name="urbanai-data-lake",
            object_name=key,
            data=ItemAdapter(item).asdict(),
        )

        logger.info("S3 JSON upload concluido: %s", key)

        return item


class S3ItemPipelineParquet:
    def __init__(self) -> None:
        self.s3 = S3Helper()

    def process_item(self, item: EventItem, spider: Spider) -> EventItem:
        """Uploads the event item data to an S3 bucket in Parquet format."""
        spider_name = spider.name
        today = datetime.now().strftime("%Y-%m-%d")
        key = f"raw/parquet/{spider_name}/{today}.parquet"

        self.s3.put_object_parquet(
            bucket_name="urbanai-data-lake",
            object_name=key,
            data=ItemAdapter(item).asdict(),
        )

        logger.info("S3 Parquet upload concluido: %s", key)

        return item


# ============================== Ingest Urban AI (F6.2 Plus) ==============================


class UrbanIngestPipeline:
    """Envia cada item para o backend Urban AI via `POST /events/ingest`.

    Comportamento:
      - Habilitada SOMENTE com `URBAN_EVENTS_INGEST_API_KEY` (o backend só
        aceita essa chave; o caminho de login por e-mail/senha foi removido).
      - Sem a chave: em dev local fica desabilitada com aviso (S3 segue OK); em
        produção (Railway/ENVIRONMENT=production) é erro ALTO — log ERROR e
        stat `urban_ingest/misconfigured=1` — para não perder dados em silêncio.
      - Cada item vira um payload de `/events/ingest` com:
          source = `scraper-<spider_name>`
          venueType / venueCapacity / lat / lng = via venue_map quando reconhece
        senão lat/lng=null e backend marca pendingGeocode (cron resolve).
      - Eventos vão para o outbox SQLite (`URBAN_INGEST_OUTBOX_PATH`) e só saem
        de lá depois de confirmados; o que falhar no flush final é reenviado
        na próxima execução (com backoff), nunca descartado.
    """

    def __init__(self, stats: Any = None) -> None:
        self.stats = stats
        self.enabled = bool(
            (os.environ.get("URBAN_EVENTS_INGEST_API_KEY") or "").strip()
        )
        self.client: UrbanBackendClient | None = None
        # D2 — itens vistos neste run; 0 no fechamento = site mudou/quebrou.
        self.items_seen = 0
        if self.enabled:
            try:
                self.client = UrbanBackendClient.from_env()
                logger.info("UrbanIngestPipeline ATIVA")
                if self.client.outbox_degraded:
                    self._stat_set("urban_ingest/outbox_degraded", 1)
            except Exception as e:
                logger.error(
                    "UrbanIngestPipeline desabilitada (falha ao inicializar client): %s",
                    e,
                )
                self._stat_set("urban_ingest/misconfigured", 1)
                self.enabled = False
        elif is_production():
            logger.error(
                "UrbanIngestPipeline NÃO configurada em produção: "
                "URBAN_EVENTS_INGEST_API_KEY ausente. Nenhum evento será enviado "
                "ao backend — configure a chave no serviço de webscraping."
            )
            self._stat_set("urban_ingest/misconfigured", 1)
        else:
            logger.warning(
                "UrbanIngestPipeline DESABILITADA (URBAN_EVENTS_INGEST_API_KEY "
                "não setada) — nenhum envio ao backend nesta execução"
            )

    @classmethod
    def from_crawler(cls, crawler: Any) -> "UrbanIngestPipeline":
        return cls(stats=crawler.stats)

    def _stat_set(self, key: str, value: Any) -> None:
        if self.stats is not None:
            self.stats.set_value(key, value)

    def process_item(self, item: EventItem, spider: Spider) -> EventItem:
        self.items_seen += 1
        if not self.enabled or not self.client:
            return item

        adapter = ItemAdapter(item)
        payload = self._item_to_payload(adapter, spider.name)
        if not payload:
            # Item não tinha campos mínimos — skip silencioso
            return item

        try:
            self.client.add_event(payload)
        except (UrbanBackendError, sqlite3.Error) as e:
            # Não derruba o spider — só loga. O lote fica no outbox (se houve
            # falha só no flush) e o próximo flush tenta de novo.
            logger.warning("UrbanIngestPipeline add_event falhou: %s", e)

        return item

    def close_spider(self, spider: Spider) -> None:
        """Flush final ao terminar o spider."""
        if self.items_seen == 0:
            # Spider terminou "OK" sem nenhum item: tipicamente o HTML/API do site
            # mudou. O backend também alerta (collector-zero-yield), mas este log
            # deixa o sinal no próprio run do scheduler.
            logger.warning(
                "[scraper-%s] ZERO_ITEMS: spider terminou sem nenhum item — "
                "provável mudança no site/API de origem",
                spider.name,
            )
        if self.client:
            try:
                self.client.close()
            except UrbanBackendError as e:
                logger.error(
                    "UrbanIngestPipeline close falhou — lote NÃO confirmado; os "
                    "eventos seguem no outbox para a próxima execução: %s",
                    e,
                )
                self._stat_set("urban_ingest/delivery_failed", 1)
            self._report_delivery(spider)

    def _report_delivery(self, spider: Spider) -> None:
        """Publica contadores de entrega e alerta se sobrou fila."""
        client = self.client
        if client is None:
            return
        for key, value in client.stats.items():
            self._stat_set(f"urban_ingest/{key}", value)
        pending = client.buffer_size()
        self._stat_set("urban_ingest/pending_after_close", pending)
        if pending:
            logger.error(
                "[scraper-%s] %d evento(s) NÃO confirmados pelo backend; "
                "permanecem no outbox (%s) e serão reenviados",
                spider.name,
                pending,
                client.outbox_status() or "buffer em memória: serão PERDIDOS",
            )

    # ============================ Helpers ============================

    def _item_to_payload(
        self, adapter: ItemAdapter, spider_name: str
    ) -> dict[str, Any] | None:
        """Converte EventItem (Scrapy) → payload do /events/ingest."""
        nome = adapter.get("nome")
        data_inicio = adapter.get("dataInicio")
        if not nome or not data_inicio:
            return None

        endereco = adapter.get("enderecoCompleto") or ""
        cidade = adapter.get("cidade") or ""
        estado = adapter.get("estado") or "SP"

        # Tenta enriquecer com venue_map (lat/lng + capacity + type)
        # Procura no endereço primeiro, depois no nome (alguns spiders
        # colocam o local no nome do evento).
        venue = match_venue(endereco) or match_venue(nome)

        payload: dict[str, Any] = {
            "nome": str(nome).strip(),
            "dataInicio": self._format_date(data_inicio),
            "enderecoCompleto": str(endereco).strip(),
            "cidade": str(cidade).strip(),
            "estado": str(estado).strip()[:2].upper() or "SP",
            "linkSiteOficial": adapter.get("linkSiteOficial"),
            "imagemUrl": adapter.get("imagem_url"),
            "source": f"scraper-{spider_name}",
            "crawledUrl": adapter.get("linkSiteOficial"),
        }

        data_fim = adapter.get("dataFim")
        if data_fim:
            payload["dataFim"] = self._format_date(data_fim)

        if venue:
            payload["latitude"] = venue.lat
            payload["longitude"] = venue.lng
            payload["venueType"] = venue.venue_type
            if venue.capacity is not None:
                payload["venueCapacity"] = venue.capacity
        # Sem venue: lat/lng ficam ausentes, backend marca pendingGeocode

        return payload

    @staticmethod
    def _format_date(value: Any) -> str:
        """ISO 8601 com offset de São Paulo (D3). Aceita datetime, date ou string.

        datetime sem fuso (horário de parede do site) -> São Paulo; datetime
        com fuso (ex.: UTC do Ticketmaster) -> convertido para São Paulo;
        date pura permanece data pura.
        """
        iso = to_sp_iso(value)
        return iso if iso is not None else str(value)
