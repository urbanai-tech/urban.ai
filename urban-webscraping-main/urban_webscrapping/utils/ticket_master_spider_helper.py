import logging
from typing import Any

logger = logging.getLogger(__name__)


class TicketMasterHelper:
    def __init__(self) -> None: ...

    def process_event(self, event: dict[str, Any]) -> dict[str, Any]:
        """Extrai e estrutura os dados de um único evento"""
        # Informações básicas
        event_id = event.get("id", "")
        name = event.get("name", "")
        event_url = event.get("url", "")

        # Data e hora
        dates = event.get("dates", {}).get("start", {})
        date_start = dates.get("localDate", "")
        datetime_utc = dates.get("dateTime", "")

        # Imagem (seleciona a de maior resolução)
        image_url = self._get_best_image(event.get("images", []))

        # Localização (usa o primeiro venue)
        venue = event.get("_embedded", {}).get("venues", [{}])[0]
        location = venue.get("name", "")
        postal_code = venue.get("postalCode", "")
        coords = venue.get("location", {})
        latitude = coords.get("latitude", "")
        longitude = coords.get("longitude", "")

        return {
            "id": event_id,
            "nome": name,
            "linkSiteOficial": event_url,
            "imagem_url": image_url,
            "dataInicio": datetime_utc or date_start,
            "enderecoCompleto": location,
            "postal_code": postal_code,
            "latitude": latitude,
            "longitude": longitude,
        }

    def _get_best_image(self, images: list[dict[str, Any]]) -> str:
        """Seleciona a imagem de maior resolução disponível"""
        if not images:
            return ""

        # Tenta encontrar a imagem SOURCE (original)
        for img in images:
            if img.get("attribution", "").lower().find("source") != -1:
                return str(img.get("url", ""))

        # Fallback: seleciona pela maior resolução
        return str(
            max(
                images,
                key=lambda x: x.get("width", 0) * x.get("height", 0),
                default={"url": ""},
            ).get("url", "")
        )

    def errback(self, failure: Any) -> None:
        logger.error("Request failed: %s", failure)
