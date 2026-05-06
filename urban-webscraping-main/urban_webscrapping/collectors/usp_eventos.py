"""Coletor USP — eventos do calendário público da Universidade de São Paulo.

A USP mantém o portal `eventos.usp.br` com agenda pública de:
  - Defesas de mestrado / doutorado / qualificação
  - Palestras, seminários, simpósios
  - Cursos abertos, escolas de verão, oficinas
  - Eventos culturais (CINUSP, MAC, MAE, EACH)
  - Congressos científicos sediados na cidade universitária

Estratégia: scraping HTML simples (sem JS, sem Playwright) — o portal serve
HTML estático. Página de listagem tem links para detalhes; cada detalhe tem
data, local e descrição em padrão consistente.

Quando funcionar mal, é candidato fácil de migrar para Firecrawl + LLM
extractor (já temos infra) — mas começamos com scraping leve pra economizar
$ Firecrawl.

Filtro: o `LLM extractor` em utils detecta is_in_scope=true só pra eventos
em SP/Grande SP. Eventos de outros campi USP (Ribeirão, Bauru, Pirassununga,
São Carlos, Lorena, Piracicaba) ficam fora — desejado pra Urban AI.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urljoin

import requests
from urban_webscrapping.collectors.base_collector import (
    BaseCollector,
    CollectorRunResult,
)


logger = logging.getLogger(__name__)


class UspEventosCollector(BaseCollector):
    """Coleta eventos do portal eventos.usp.br."""

    source = "usp-eventos"

    # Portal de eventos USP — listagem padrão
    LISTING_URL = "https://eventos.usp.br/?wpv-listagem-de-eventos=feature"
    USER_AGENT = (
        "Mozilla/5.0 (compatible; UrbanAI-EventCollector/1.0; +https://urbanai.com)"
    )
    REQUEST_TIMEOUT = 20
    MAX_PAGES = 5  # cap conservador

    def __init__(self, client=None, dry_run=False, max_events: int = 100):
        super().__init__(client=client, dry_run=dry_run)
        self.max_events = max_events

    # ============== fetch ==============

    def fetch_raw(self) -> list[dict[str, Any]]:
        """Faz scraping da listagem + página individual de cada evento.

        Retorna lista de dicts cru com campos do portal — `normalize` cuida
        de mapear pro schema do /events/ingest.
        """
        try:
            html = self._get(self.LISTING_URL)
        except Exception as e:
            logger.error("[usp-eventos] falha no fetch da listagem: %s", e)
            return []

        # Extrai URLs dos cards de evento.
        # Padrão típico: <article><a href="/.../evento-x/">Título</a></article>
        event_urls = self._extract_event_urls(html)
        logger.info("[usp-eventos] encontrei %d URLs de eventos na listagem", len(event_urls))

        events: list[dict[str, Any]] = []
        for url in event_urls[: self.max_events]:
            try:
                detail_html = self._get(url)
                event_data = self._parse_event_detail(detail_html, url)
                if event_data:
                    events.append(event_data)
            except Exception as e:
                logger.warning("[usp-eventos] falha em %s: %s", url, e)

        return events

    def normalize(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        nome = (raw.get("title") or "").strip()
        if not nome:
            return None

        starts_on = raw.get("starts_on")
        if not starts_on:
            return None

        ends_on = raw.get("ends_on") or starts_on

        endereco = raw.get("location") or "Cidade Universitária - Butantã - São Paulo - SP"
        # Heurística: se aparece "São Paulo" ou "USP" ou "Cidade Universitária", manter.
        # Se aparecer outro campus famoso (Ribeirão, Pirassununga, Bauru, São Carlos,
        # Lorena, Piracicaba, ICMC), descarta — fora da cobertura SP capital.
        lower_loc = endereco.lower()
        out_of_sp_campus = any(
            kw in lower_loc
            for kw in [
                "ribeirão preto",
                "ribeirao preto",
                "pirassununga",
                "bauru",
                "são carlos",
                "sao carlos",
                "lorena",
                "piracicaba",
                "icmc",
                "esalq",
            ]
        )
        if out_of_sp_campus:
            return None

        payload: dict[str, Any] = {
            "nome": nome[:255],
            "dataInicio": starts_on,
            "dataFim": ends_on,
            "enderecoCompleto": endereco[:500],
            "cidade": "São Paulo",
            "estado": "SP",
            "categoria": raw.get("category") or "Acadêmico",
            "linkSiteOficial": raw.get("url"),
            "crawledUrl": raw.get("url"),
            "descricao": (raw.get("description") or "").strip()[:1000] or None,
            "source": self.source,
            "sourceId": raw.get("source_id"),
        }
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

    def _extract_event_urls(self, html: str) -> list[str]:
        """Extrai URLs únicas de cards de evento da listagem.

        Aceita 2 padrões mais comuns no WordPress da USP:
          - <a href="https://eventos.usp.br/eventos/.../" class="event-card">
          - <article><a href="...">
        """
        import re

        seen: set[str] = set()
        urls: list[str] = []

        # Padrão genérico: links que apontam pra subpath /eventos/ ou contém /20XX/
        pattern = re.compile(
            r'href="(https?://[^"]*eventos\.usp\.br/[^"#?]*)"',
            re.IGNORECASE,
        )
        for match in pattern.finditer(html):
            url = match.group(1).rstrip("/")
            # Filtra URLs muito curtas (provavelmente categorias/listagens, não detalhe)
            path_parts = url.split("/")
            if len(path_parts) < 5:
                continue
            if url not in seen:
                seen.add(url)
                urls.append(url)

        return urls

    def _parse_event_detail(self, html: str, url: str) -> dict[str, Any] | None:
        """Extrai campos do HTML de detalhe do evento.

        Heurísticas leves — quando layout muda, não quebra completamente, só
        retorna campos parciais. Quando faltar nome ou data, retorna None.
        """
        import re

        # Title — tag h1 ou og:title
        title = self._first_match(
            html,
            [
                r'<meta property="og:title" content="([^"]+)"',
                r'<h1[^>]*>([^<]+)</h1>',
                r'<title>([^<]+)</title>',
            ],
        )
        if title:
            title = self._clean_text(title)

        # Description
        description = self._first_match(
            html,
            [
                r'<meta property="og:description" content="([^"]+)"',
                r'<meta name="description" content="([^"]+)"',
            ],
        )
        if description:
            description = self._clean_text(description)

        # Data — formatos comuns "DD/MM/YYYY HH:MM" ou "DD de mês de YYYY"
        starts_on = self._extract_date(html)

        # Localização
        location = self._first_match(
            html,
            [
                r'class="[^"]*event-?location[^"]*"[^>]*>([^<]+)<',
                r'class="[^"]*venue[^"]*"[^>]*>([^<]+)<',
                r'(?:Local|Onde):\s*</[^>]+>\s*<[^>]+>([^<]+)',
            ],
        )
        if location:
            location = self._clean_text(location)

        # ID a partir da URL slug (último segmento)
        source_id = url.rstrip("/").split("/")[-1][:128]

        if not title or not starts_on:
            return None

        return {
            "title": title,
            "description": description,
            "starts_on": starts_on,
            "ends_on": None,
            "location": location,
            "category": "Acadêmico",
            "url": url,
            "source_id": source_id,
        }

    @staticmethod
    def _first_match(html: str, patterns: list[str]) -> str | None:
        import re
        for p in patterns:
            m = re.search(p, html, re.IGNORECASE | re.DOTALL)
            if m:
                return m.group(1)
        return None

    @staticmethod
    def _clean_text(s: str) -> str:
        import html as html_lib
        return html_lib.unescape(s).strip().replace("\n", " ").replace("  ", " ")

    @staticmethod
    def _extract_date(html: str) -> str | None:
        """Tenta extrair data início. Suporta formatos pt-BR comuns."""
        import re
        from datetime import datetime as _dt

        # Padrão 1: "DD/MM/YYYY HH:MM"
        m = re.search(
            r"(\d{2})/(\d{2})/(\d{4})\s*(?:às?\s*)?(\d{1,2}):(\d{2})",
            html,
        )
        if m:
            d, mo, y, h, mi = m.groups()
            try:
                dt = _dt(int(y), int(mo), int(d), int(h), int(mi))
                return dt.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass

        # Padrão 2: "DD/MM/YYYY" sem hora
        m = re.search(r"(\d{2})/(\d{2})/(\d{4})", html)
        if m:
            d, mo, y = m.groups()
            try:
                dt = _dt(int(y), int(mo), int(d), 19, 0)  # default 19h
                return dt.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass

        # Padrão 3: ISO 8601
        m = re.search(r'"(?:datePublished|startDate)":\s*"([^"]+)"', html)
        if m:
            return m.group(1)

        return None


# ============== CLI ==============


def main() -> int:
    from urban_webscrapping.collectors.base_collector import setup_logging

    setup_logging(os.environ.get("LOG_LEVEL", "INFO"))
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"

    logger.info("[usp-eventos] starting (dry_run=%s)", dry_run)
    collector = UspEventosCollector(dry_run=dry_run)
    result: CollectorRunResult = collector.run()

    if result.errors:
        logger.warning("Errors: %s", result.errors[:5])
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
