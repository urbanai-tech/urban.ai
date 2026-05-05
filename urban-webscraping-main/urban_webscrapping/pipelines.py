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
from datetime import datetime
from typing import Any

from itemadapter import ItemAdapter
from scrapy import Spider

from urban_webscrapping.utils.aws_s3_helper import S3Helper
from urban_webscrapping.utils.urban_backend_client import (
    UrbanBackendClient,
    UrbanBackendError,
)
from urban_webscrapping.utils.venue_map import match_venue

from .items import EventItem


logger = logging.getLogger(__name__)


# ============================== S3 (legado/bronze) ==============================


class S3ItemPipelineJson:
    def __init__(self):
        self.s3 = S3Helper()

    def process_item(self, item: EventItem, spider: Spider) -> EventItem:
        """Uploads the event item data to an S3 bucket."""
        spider_name = spider.name
        today = datetime.now().strftime("%Y-%m-%d")
        key = f"raw/json/{spider_name}/{today}.json"

        response = self.s3.put_object_json(
            bucket_name="urbanai-data-lake",
            object_name=key,
            data=ItemAdapter(item).asdict(),
        )

        print(response)

        return item


class S3ItemPipelineParquet:
    def __init__(self):
        self.s3 = S3Helper()

    def process_item(self, item: EventItem, spider: Spider) -> EventItem:
        """Uploads the event item data to an S3 bucket in Parquet format."""
        spider_name = spider.name
        today = datetime.now().strftime("%Y-%m-%d")
        key = f"raw/parquet/{spider_name}/{today}.parquet"

        response = self.s3.put_object_parquet(
            bucket_name="urbanai-data-lake",
            object_name=key,
            data=ItemAdapter(item).asdict(),
        )

        print(response)

        return item


# ============================== Ingest Urban AI (F6.2 Plus) ==============================


class UrbanIngestPipeline:
    """Envia cada item para o backend Urban AI via `POST /events/ingest`.

    Comportamento:
      - Se `URBAN_COLLECTOR_EMAIL`/`URBAN_COLLECTOR_PASSWORD` não estiverem
        setados, a pipeline é DESABILITADA silenciosamente (mantém S3 OK).
        Útil pra dev local sem backend rodando.
      - Cada item vira um payload de `/events/ingest` com:
          source = `scraper-<spider_name>`
          venueType / venueCapacity / lat / lng = via venue_map quando reconhece
        senão lat/lng=null e backend marca pendingGeocode (cron resolve).
      - Buffer batch_size=100 — flush automático ao encher e ao fechar spider.
      - Retry exponencial gerenciado pelo client; falha de batch não derruba
        spider (logado, próximo batch tenta).
    """

    def __init__(self):
        self.enabled = bool(
            os.environ.get("URBAN_COLLECTOR_EMAIL")
            and os.environ.get("URBAN_COLLECTOR_PASSWORD")
        )
        self.client: UrbanBackendClient | None = None
        if self.enabled:
            try:
                self.client = UrbanBackendClient.from_env()
                logger.info("UrbanIngestPipeline ATIVA")
            except Exception as e:
                logger.warning(
                    "UrbanIngestPipeline desabilitada (falha ao inicializar client): %s",
                    e,
                )
                self.enabled = False
        else:
            logger.info(
                "UrbanIngestPipeline DESABILITADA "
                "(URBAN_COLLECTOR_EMAIL/PASSWORD não setadas) — "
                "S3 bronze segue funcionando normalmente"
            )

    def process_item(self, item: EventItem, spider: Spider) -> EventItem:
        if not self.enabled or not self.client:
            return item

        adapter = ItemAdapter(item)
        payload = self._item_to_payload(adapter, spider.name)
        if not payload:
            # Item não tinha campos mínimos — skip silencioso
            return item

        try:
            self.client.add_event(payload)
        except UrbanBackendError as e:
            # Não derruba o spider — só loga. Próximo flush tenta de novo.
            logger.warning("UrbanIngestPipeline add_event falhou: %s", e)

        return item

    def close_spider(self, spider: Spider) -> None:
        """Flush final ao terminar o spider."""
        if self.client:
            try:
                self.client.close()
            except UrbanBackendError as e:
                logger.error(
                    "UrbanIngestPipeline close falhou — eventos no buffer NÃO foram enviados: %s",
                    e,
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
        """ISO 8601. Aceita datetime, date, ou string já ISO."""
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return str(value)
