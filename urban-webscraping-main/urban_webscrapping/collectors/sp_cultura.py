"""Coletor SP Cultura — eventos culturais da Prefeitura de São Paulo.

Endpoint público, sem autenticação:
  http://spcultura.prefeitura.sp.gov.br/api/event/find

A API expõe metadados de eventos cadastrados no portal MapaCultural da
Prefeitura — shows, exposições, festivais, atividades em equipamentos
culturais (CEUs, bibliotecas, museus, casas de cultura). Cobre o
"long tail" cultural que escapa de Sympla/Eventim.

Documentação informal (mapa cultural é open-source):
  https://github.com/mapasculturais/mapasculturais

Como a API permite paginar e filtrar por data, esse coletor por default
busca eventos com `startsOn >= hoje` e `<= hoje + 60 dias`. Janela
configurável via env:

  SP_CULTURA_LOOKAHEAD_DAYS  — default 60 (até 2 meses à frente)
  SP_CULTURA_API_BASE        — default URL pública oficial

Roda diariamente. Manda batches de até 100 pro `/events/ingest`. dedupHash
absorve eventos que se sobrepõem com Sympla.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import requests

from urban_webscrapping.collectors.base_collector import (
    BaseCollector,
    CollectorRunResult,
)


logger = logging.getLogger(__name__)


class SpCulturaCollector(BaseCollector):
    """Coleta eventos do MapaCultural da Prefeitura de SP."""

    source = "sp-cultura"

    DEFAULT_API_BASE = "http://spcultura.prefeitura.sp.gov.br/api"
    DEFAULT_LOOKAHEAD_DAYS = 60
    DEFAULT_PAGE_LIMIT = 100  # API costuma paginar com @offset / @limit
    REQUEST_TIMEOUT = 30

    def __init__(
        self,
        client=None,
        dry_run: bool = False,
        api_base: str | None = None,
        lookahead_days: int | None = None,
    ):
        super().__init__(client=client, dry_run=dry_run)
        self.api_base = (
            api_base
            or os.environ.get("SP_CULTURA_API_BASE")
            or self.DEFAULT_API_BASE
        ).rstrip("/")
        self.lookahead_days = (
            lookahead_days
            or int(os.environ.get("SP_CULTURA_LOOKAHEAD_DAYS", self.DEFAULT_LOOKAHEAD_DAYS))
        )

    # ============== fetch ==============

    def fetch_raw(self) -> list[dict[str, Any]]:
        today = datetime.now(timezone.utc).date()
        end = today + timedelta(days=self.lookahead_days)

        # API usa filtros tipo `startsOn=GTE(YYYY-MM-DD)`. Campos retornados:
        #   id, name, shortDescription, longDescription, type, terms,
        #   startsOn, endsOn, occurrences, location, _registrationFrom,
        #   classificacaoEtaria, owner, etc.
        params = {
            "@select": (
                "id,name,shortDescription,terms,startsOn,endsOn,occurrences,"
                "location,classificacaoEtaria,site,singleUrl"
            ),
            "@order": "startsOn",
            "@offset": "0",
            "@limit": str(self.DEFAULT_PAGE_LIMIT),
            "startsOn": f"GTE({today.isoformat()})",
            "endsOn": f"LTE({end.isoformat()})",
        }

        url = f"{self.api_base}/event/find?{urlencode(params)}"
        logger.info("[sp-cultura] GET %s", url)

        all_items: list[dict[str, Any]] = []
        offset = 0

        # Paginação simples — pega até 5 páginas (500 eventos) por run.
        for page in range(5):
            params["@offset"] = str(offset)
            url = f"{self.api_base}/event/find?{urlencode(params)}"
            try:
                resp = requests.get(url, timeout=self.REQUEST_TIMEOUT)
                resp.raise_for_status()
                items = resp.json()
            except (requests.RequestException, ValueError) as e:
                logger.warning("[sp-cultura] página %d falhou: %s", page, e)
                break

            if not items or not isinstance(items, list):
                break

            all_items.extend(items)
            if len(items) < self.DEFAULT_PAGE_LIMIT:
                break  # última página
            offset += self.DEFAULT_PAGE_LIMIT

        return all_items

    # ============== normalize ==============

    def normalize(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        """Converte item do MapaCultural → payload do /events/ingest.

        MapaCultural format (parcial):
          {
            "id": 12345,
            "name": "Show ABC",
            "shortDescription": "...",
            "startsOn": "2026-05-10",
            "endsOn": "2026-05-10",
            "occurrences": [{ "rule": "...", "startsOn": "...", "endsOn": "...",
                              "_startsAt": "20:00", "space": {...} }],
            "location": "Lat,Lng" ou objeto geo,
            "terms": { "linguagem": ["música"], ... },
            "site": "https://...",
            "singleUrl": "/evento/12345/show-abc"
          }
        """
        nome = (raw.get("name") or "").strip()
        if not nome:
            return None

        # Data: usa startsOn. Se houver occurrences, prefere a primeira.
        starts_on = raw.get("startsOn")
        occurrences = raw.get("occurrences") or []
        if occurrences:
            first = occurrences[0]
            starts_on = first.get("startsOn") or starts_on
            # Quando rule tem horário, anexa
            time_str = first.get("_startsAt")
            if starts_on and time_str and "T" not in str(starts_on):
                starts_on = f"{starts_on}T{time_str}:00"

        if not starts_on:
            return None

        ends_on = raw.get("endsOn") or starts_on

        # Localização: pode vir em formatos variados
        lat, lng = self._extract_geo(raw)

        # Endereço: se tiver `space` no occurrence, usa
        endereco = ""
        if occurrences:
            space = occurrences[0].get("space") or {}
            if isinstance(space, dict):
                endereco = (
                    space.get("endereco")
                    or space.get("name")
                    or space.get("location")
                    or ""
                )

        # Categoria/terms
        categoria = None
        terms = raw.get("terms") or {}
        if isinstance(terms, dict):
            linguagem = terms.get("linguagem") or terms.get("area") or []
            if isinstance(linguagem, list) and linguagem:
                categoria = str(linguagem[0])

        site = raw.get("site") or raw.get("singleUrl")
        if site and site.startswith("/"):
            site = f"http://spcultura.prefeitura.sp.gov.br{site}"

        payload: dict[str, Any] = {
            "nome": nome[:255],
            "dataInicio": str(starts_on),
            "dataFim": str(ends_on),
            "enderecoCompleto": str(endereco)[:500],
            "cidade": "São Paulo",
            "estado": "SP",
            "categoria": categoria,
            "linkSiteOficial": site,
            "source": self.source,
            "sourceId": str(raw.get("id")) if raw.get("id") else None,
            "crawledUrl": site,
            "descricao": (raw.get("shortDescription") or "").strip()[:1000] or None,
        }

        if lat is not None and lng is not None:
            payload["latitude"] = lat
            payload["longitude"] = lng

        return payload

    # ============== helpers ==============

    @staticmethod
    def _extract_geo(raw: dict[str, Any]) -> tuple[float | None, float | None]:
        """Extrai lat/lng do item do MapaCultural — formato varia.

        Formatos comuns que aparecem:
          - location: "lat,lng" string
          - location: { latitude, longitude }
          - occurrences[0].space.location: idem
          - geoLocation: { type: "Point", coordinates: [lng, lat] }
        """
        # Tenta location de top-level
        loc = raw.get("location")
        if isinstance(loc, str) and "," in loc:
            try:
                lat_str, lng_str = loc.split(",", 1)
                return float(lat_str.strip()), float(lng_str.strip())
            except (ValueError, AttributeError):
                pass
        if isinstance(loc, dict):
            lat = loc.get("latitude") or loc.get("lat")
            lng = loc.get("longitude") or loc.get("lng")
            if lat is not None and lng is not None:
                try:
                    return float(lat), float(lng)
                except (ValueError, TypeError):
                    pass

        # geoLocation GeoJSON-like
        geo = raw.get("geoLocation")
        if isinstance(geo, dict):
            coords = geo.get("coordinates")
            if isinstance(coords, list) and len(coords) == 2:
                try:
                    # GeoJSON é [lng, lat]
                    return float(coords[1]), float(coords[0])
                except (ValueError, TypeError):
                    pass

        # Em occurrences[0].space
        occurrences = raw.get("occurrences") or []
        if occurrences and isinstance(occurrences[0], dict):
            space = occurrences[0].get("space") or {}
            if isinstance(space, dict):
                space_loc = space.get("location") or {}
                if isinstance(space_loc, dict):
                    lat = space_loc.get("latitude") or space_loc.get("lat")
                    lng = space_loc.get("longitude") or space_loc.get("lng")
                    if lat is not None and lng is not None:
                        try:
                            return float(lat), float(lng)
                        except (ValueError, TypeError):
                            pass

        return None, None


# ============== CLI ==============

def main() -> int:
    """Entry point CLI: `python -m urban_webscrapping.collectors.sp_cultura`.

    Variáveis de ambiente:
      URBAN_API_BASE / URBAN_COLLECTOR_EMAIL / URBAN_COLLECTOR_PASSWORD
        → necessárias se não for dry-run.
      SP_CULTURA_LOOKAHEAD_DAYS → janela em dias (default 60)
      DRY_RUN=true → só loga, não envia
    """
    from urban_webscrapping.collectors.base_collector import setup_logging

    setup_logging(os.environ.get("LOG_LEVEL", "INFO"))
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"

    logger.info("[sp-cultura] starting collector (dry_run=%s)", dry_run)

    collector = SpCulturaCollector(dry_run=dry_run)
    result: CollectorRunResult = collector.run()

    if result.errors:
        logger.warning("Errors: %s", result.errors[:5])
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
