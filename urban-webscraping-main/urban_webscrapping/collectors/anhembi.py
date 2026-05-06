"""Coletor Distrito Anhembi — calendário público de feiras + congressos + shows.

URL: https://distritoanhembi.com.br/eventos (ou similares /agenda)

Cobertura: feiras de grande porte (Comic Con CCXP, BGS, Salão do Imóvel),
congressos, eventos de moda (SPFW), exposições. Anhembi é um dos centros
de eventos mais movimentados de SP — ~25–35k pessoas em dias de feira.
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


class AnhembiCollector(HtmlVenueCollector):
    """Scraping HTML simples do calendário Anhembi."""

    source = "anhembi"
    LISTING_URL = "https://distritoanhembi.com.br/eventos"
    VENUE_NAME = "Distrito Anhembi"
    DEFAULT_CATEGORY = "feira"

    def parse_listing(self, html: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        seen_titles: set[str] = set()

        # Padrão típico card com classe "event-card", "evento-card", "card-evento"
        for block_match in re.finditer(
            r'<(?:article|div)[^>]*class="[^"]*(?:event|evento|card)[^"]*"[^>]*>(.*?)</(?:article|div)>',
            html,
            re.IGNORECASE | re.DOTALL,
        ):
            block = block_match.group(1)
            event = self._extract_event(block)
            if event and event["title"].lower() not in seen_titles:
                seen_titles.add(event["title"].lower())
                items.append(event)

        # Fallback genérico
        if not items:
            for h_match in re.finditer(
                r'<h[1-3][^>]*>(?:<a[^>]*href="([^"]+)"[^>]*>)?([^<]+)(?:</a>)?</h[1-3]>',
                html,
                re.IGNORECASE,
            ):
                url, title = h_match.groups()
                title = (title or "").strip()
                if not title or title.lower() in seen_titles or len(title) < 3:
                    continue
                tail = html[h_match.end():h_match.end() + 600]
                d = self._extract_date_from_text(tail)
                if not d:
                    continue
                seen_titles.add(title.lower())
                items.append({
                    "title": title[:255],
                    "starts_on": d,
                    "url": url,
                    "source_id": (url or title)[:128],
                })

        return items

    def _extract_event(self, block: str) -> dict[str, Any] | None:
        m_title = re.search(
            r'<h[1-4][^>]*>(?:<a[^>]*href="([^"]+)"[^>]*>)?([^<]+)(?:</a>)?</h[1-4]>',
            block,
            re.IGNORECASE,
        )
        if not m_title:
            return None
        url = m_title.group(1)
        title = self._clean_text(m_title.group(2))
        if not title or len(title) < 3:
            return None

        d = self._extract_date_from_text(block)
        if not d:
            return None

        m_desc = re.search(r"<p[^>]*>([^<]{20,400})</p>", block, re.IGNORECASE)
        description = self._clean_text(m_desc.group(1)) if m_desc else None

        return {
            "title": title[:255],
            "starts_on": d,
            "url": url,
            "description": description,
            "source_id": (url or title)[:128],
        }

    @staticmethod
    def _extract_date_from_text(text: str) -> str | None:
        # DD/MM/YYYY com opcional hora
        m = re.search(
            r"(\d{2}/\d{2}/\d{4}(?:\s*(?:às?\s*)?\d{1,2}:\d{2})?)",
            text,
        )
        if m:
            return m.group(1)
        # "DD a DD de mês de YYYY" — pega o primeiro DD
        m = re.search(
            r"(\d{1,2})\s*a\s*\d{1,2}\s*de\s*(\w+)\s*(?:de\s*)?(\d{4})?",
            text,
        )
        if m:
            year = m.group(3) or str(__import__("datetime").datetime.now().year)
            return f"{m.group(1)} de {m.group(2)} de {year}"
        # "DD de mês de YYYY"
        m = re.search(
            r"(\d{1,2}\s*de\s*\w+\s*(?:de\s*)?\d{4})",
            text,
        )
        if m:
            return m.group(1)
        return None

    @staticmethod
    def _clean_text(s: str) -> str:
        import html as html_lib
        return html_lib.unescape(s).strip()


def main() -> int:
    setup_logging(os.environ.get("LOG_LEVEL", "INFO"))
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"
    logger.info("[anhembi] starting (dry_run=%s)", dry_run)
    collector = AnhembiCollector(dry_run=dry_run)
    result: CollectorRunResult = collector.run()
    return 1 if result.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
