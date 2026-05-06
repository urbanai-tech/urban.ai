"""Coletor Allianz Parque — calendário público de shows + jogos do Palmeiras.

URL: https://www.allianzparque.com.br/eventos

Cobertura: shows (Coldplay, Taylor Swift, etc., 60–80k pessoas) + jogos do
Palmeiras quando o estádio está liberado pra calendário público.

Os jogos do Palmeiras também vêm via api-football quando a key estiver ativa,
mas Allianz tem shows individuais que api-football não cobre (não é esporte).
Por isso o coletor próprio.

Estratégia: scraping HTML simples. O site renderiza calendário server-side
em layout WordPress padrão. Quando layout mudar, fácil migrar pra Firecrawl
+ LLM extraction (já temos infra).
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from urban_webscrapping.collectors._html_venue_base import HtmlVenueCollector
from urban_webscrapping.collectors.base_collector import (
    CollectorRunResult,
    setup_logging,
)


logger = logging.getLogger(__name__)


class AllianzParqueCollector(HtmlVenueCollector):
    """Scraping HTML do calendário público do Allianz Parque."""

    source = "allianz-parque"
    LISTING_URL = "https://www.allianzparque.com.br/eventos"
    VENUE_NAME = "Allianz Parque"
    DEFAULT_CATEGORY = "show"

    def parse_listing(self, html: str) -> list[dict[str, Any]]:
        """Extrai eventos. Padrão típico WordPress:

            <article class="event">
              <h2><a href="/eventos/show-x">Show X</a></h2>
              <span class="event-date">15/06/2026</span>
              <p>Descrição curta</p>
            </article>

        Quando classes mudarem, fallback pra padrão genérico (h2 + data DD/MM/YYYY
        próximo).
        """
        items: list[dict[str, Any]] = []
        seen_titles: set[str] = set()

        # Padrão 1: estrutura típica com classe "event"
        # Captura blocos com h2/h3 + data próxima
        # Regex multi-line + non-greedy
        pattern1 = re.compile(
            r'<(?:article|div)[^>]*class="[^"]*event[^"]*"[^>]*>(.*?)</(?:article|div)>',
            re.IGNORECASE | re.DOTALL,
        )
        for block_match in pattern1.finditer(html):
            block = block_match.group(1)
            event = self._extract_from_block(block)
            if event and event["title"].lower() not in seen_titles:
                seen_titles.add(event["title"].lower())
                items.append(event)

        # Fallback: se não pegou nada, tenta padrão genérico de título + data
        if not items:
            for h_match in re.finditer(
                r'<h[23][^>]*>(?:<a[^>]*href="([^"]+)"[^>]*>)?([^<]+)(?:</a>)?</h[23]>',
                html,
                re.IGNORECASE,
            ):
                url, title = h_match.groups()
                title = (title or "").strip()
                if not title or title.lower() in seen_titles:
                    continue

                # Procura data próxima (até 500 chars depois)
                tail = html[h_match.end():h_match.end() + 500]
                date_match = re.search(r"(\d{2}/\d{2}/\d{4})", tail)
                if not date_match:
                    continue

                seen_titles.add(title.lower())
                items.append({
                    "title": title[:255],
                    "starts_on": date_match.group(1),
                    "url": url,
                    "source_id": (url or title)[:128],
                })

        return items

    def _extract_from_block(self, block_html: str) -> dict[str, Any] | None:
        """Extrai title + data + url + descrição de um bloco HTML de evento."""
        # Title
        m_title = re.search(
            r'<h[23][^>]*>(?:<a[^>]*href="([^"]+)"[^>]*>)?([^<]+)(?:</a>)?</h[23]>',
            block_html,
            re.IGNORECASE,
        )
        if not m_title:
            return None
        url = m_title.group(1)
        title = self._clean_text(m_title.group(2))
        if not title or len(title) < 2:
            return None

        # Data — várias possibilidades
        m_date = re.search(
            r'class="[^"]*event-?date[^"]*"[^>]*>([^<]+)',
            block_html,
            re.IGNORECASE,
        )
        if not m_date:
            m_date = re.search(r"(\d{2}/\d{2}/\d{4}(?:\s*(?:às?\s*)?\d{1,2}:\d{2})?)", block_html)
        if not m_date:
            return None
        date_str = self._clean_text(m_date.group(1))

        # Descrição (primeiro parágrafo)
        m_desc = re.search(r"<p[^>]*>([^<]+)</p>", block_html, re.IGNORECASE)
        description = self._clean_text(m_desc.group(1)) if m_desc else None

        return {
            "title": title[:255],
            "starts_on": date_str,
            "url": url,
            "description": description,
            "source_id": (url or title)[:128],
        }

    @staticmethod
    def _clean_text(s: str) -> str:
        import html as html_lib
        return html_lib.unescape(s).strip()


def main() -> int:
    setup_logging(os.environ.get("LOG_LEVEL", "INFO"))
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"
    logger.info("[allianz-parque] starting (dry_run=%s)", dry_run)
    collector = AllianzParqueCollector(dry_run=dry_run)
    result: CollectorRunResult = collector.run()
    return 1 if result.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
