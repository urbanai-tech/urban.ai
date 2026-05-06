"""Classe base compartilhada para coletores que fazem scraping HTML simples
de calendários de venue (Allianz, Anhembi, SP Expo, etc.).

Todos esses sites têm estrutura similar: lista de eventos com data + título +
local. A maioria não exige JS pesado (não precisa Playwright/Firecrawl) —
HTML estático ou renderizado server-side.

Subclasses só implementam:
  - `LISTING_URL`: URL da página de listagem
  - `VENUE_INFO`: nome do venue (pra cruzar com venue_map e enriquecer)
  - `parse_listing(html)`: retorna lista de raw events (cada um já normalizado
    parcialmente — date, title, optional description)

A `BaseCollector.normalize` é implementada aqui — usa o `venue_map` pra
preencher lat/lng/venueType/venueCapacity automático, junta com o que veio
do parsing.
"""

from __future__ import annotations

import logging
from typing import Any

import requests

from urban_webscrapping.collectors.base_collector import BaseCollector
from urban_webscrapping.utils.venue_map import VenueInfo, match_venue


logger = logging.getLogger(__name__)


class HtmlVenueCollector(BaseCollector):
    """Esqueleto pra coletores HTML simples de venues conhecidos."""

    #: URL da página de listagem do calendário público do venue
    LISTING_URL: str = ""

    #: Nome do venue como aparece no `venue_map` (busca via match_venue).
    #: Ex: "Allianz Parque", "São Paulo Expo", "Distrito Anhembi"
    VENUE_NAME: str = ""

    #: Categoria default dos eventos deste venue. Subclass pode override
    #: por evento se conseguir detectar.
    DEFAULT_CATEGORY: str = "show"

    USER_AGENT = (
        "Mozilla/5.0 (compatible; UrbanAI-EventCollector/1.0)"
    )
    REQUEST_TIMEOUT = 20

    def __init__(self, client=None, dry_run=False):
        super().__init__(client=client, dry_run=dry_run)
        if not self.LISTING_URL or not self.VENUE_NAME:
            raise ValueError(
                f"{type(self).__name__}: LISTING_URL e VENUE_NAME são obrigatórios"
            )
        self._venue_info: VenueInfo | None = match_venue(self.VENUE_NAME)
        if not self._venue_info:
            logger.warning(
                "[%s] venue '%s' não está no venue_map — eventos vão sem geo (geocoder lazy resolve)",
                self.source,
                self.VENUE_NAME,
            )

    # ============== A subclasse implementa ==============

    def parse_listing(self, html: str) -> list[dict[str, Any]]:
        """Extrai eventos crus do HTML. Cada item dict deve ter ao menos:
          - title (str)
          - starts_on (str, formato livre — 'normalize' tenta parsear)
          - optional: description, ends_on, category, url
        """
        raise NotImplementedError

    # ============== fetch + normalize compartilhados ==============

    def fetch_raw(self) -> list[dict[str, Any]]:
        try:
            html = self._get(self.LISTING_URL)
        except Exception as e:
            logger.error("[%s] fetch falhou: %s", self.source, e)
            return []

        try:
            items = self.parse_listing(html)
        except Exception as e:
            logger.error("[%s] parse_listing crashed: %s", self.source, e)
            return []

        logger.info("[%s] %d eventos extraídos da listagem", self.source, len(items))
        return items

    def normalize(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        title = (raw.get("title") or "").strip()
        starts_on = raw.get("starts_on")
        if not title or not starts_on:
            return None

        # Normaliza data — tenta vários formatos comuns. Se subclass já passou
        # ISO 8601, mantém.
        starts_iso = self._parse_date_to_iso(starts_on)
        if not starts_iso:
            return None
        ends_iso = (
            self._parse_date_to_iso(raw.get("ends_on")) if raw.get("ends_on") else starts_iso
        )

        payload: dict[str, Any] = {
            "nome": title[:255],
            "dataInicio": starts_iso,
            "dataFim": ends_iso,
            "enderecoCompleto": self.VENUE_NAME,
            "cidade": "São Paulo",
            "estado": "SP",
            "categoria": raw.get("category") or self.DEFAULT_CATEGORY,
            "linkSiteOficial": raw.get("url") or self.LISTING_URL,
            "crawledUrl": raw.get("url") or self.LISTING_URL,
            "descricao": (raw.get("description") or "").strip()[:1000] or None,
            "source": self.source,
            "sourceId": raw.get("source_id"),
        }

        if self._venue_info:
            payload["latitude"] = self._venue_info.lat
            payload["longitude"] = self._venue_info.lng
            payload["venueType"] = self._venue_info.venue_type
            if self._venue_info.capacity is not None:
                payload["venueCapacity"] = self._venue_info.capacity

        return payload

    # ============== Helpers ==============

    def _get(self, url: str) -> str:
        resp = requests.get(
            url,
            headers={"User-Agent": self.USER_AGENT},
            timeout=self.REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.text

    @staticmethod
    def _parse_date_to_iso(value: Any) -> str | None:
        """Tenta vários formatos comuns pt-BR + ISO. Retorna 'YYYY-MM-DD HH:MM:SS'."""
        if not value:
            return None
        s = str(value).strip()
        if not s:
            return None

        # ISO direto (com ou sem hora)
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except (ValueError, TypeError):
            pass

        # DD/MM/YYYY HH:MM
        import re
        m = re.search(r"(\d{2})/(\d{2})/(\d{4})\s*(?:às?\s*)?(\d{1,2}):(\d{2})", s)
        if m:
            d, mo, y, h, mi = m.groups()
            try:
                from datetime import datetime
                dt = datetime(int(y), int(mo), int(d), int(h), int(mi))
                return dt.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass

        # DD/MM/YYYY (sem hora — default 20:00)
        m = re.search(r"(\d{2})/(\d{2})/(\d{4})", s)
        if m:
            d, mo, y = m.groups()
            try:
                from datetime import datetime
                dt = datetime(int(y), int(mo), int(d), 20, 0)
                return dt.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass

        # "DD de mês de YYYY"
        meses = {
            "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4,
            "maio": 5, "junho": 6, "julho": 7, "agosto": 8, "setembro": 9,
            "outubro": 10, "novembro": 11, "dezembro": 12,
        }
        m = re.search(
            r"(\d{1,2})\s*de\s*(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:de\s*)?(\d{4})?",
            s,
            re.IGNORECASE,
        )
        if m:
            d_str = m.group(1)
            mes_str = m.group(2).lower().replace("ç", "c")
            y_str = m.group(3) or str(__import__("datetime").datetime.now().year)
            month = meses.get(mes_str)
            if month:
                try:
                    from datetime import datetime
                    dt = datetime(int(y_str), month, int(d_str), 20, 0)
                    return dt.strftime("%Y-%m-%d %H:%M:%S")
                except ValueError:
                    pass

        return None
