"""Coletor São Paulo Expo — calendário público de feiras + congressos.

URL: https://www.saopauloexpo.com.br/agenda (ou similar)

Cobertura: maior centro de eventos da AL — Hospitalar, Bett Brasil, RD Summit,
Salão do Automóvel quando rola, Comic Con Experience (CCXP), Brasil Game Show
(BGS). Eventos de 50–300k pessoas em alguns dias.

Reusa `AnhembiCollector` heurística — sites de centros de evento têm padrões
muito similares (cards com data + título + link).
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


class SaoPauloExpoCollector(HtmlVenueCollector):
    """Scraping HTML do calendário SP Expo."""

    source = "sao-paulo-expo"
    LISTING_URL = "https://www.saopauloexpo.com.br/agenda"
    VENUE_NAME = "São Paulo Expo"
    DEFAULT_CATEGORY = "feira"

    def parse_listing(self, html: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        seen: set[str] = set()

        # Tenta cards primeiro
        for m in re.finditer(
            r'<(?:article|div|li)[^>]*class="[^"]*(?:event|evento|agenda|card)[^"]*"[^>]*>(.*?)</(?:article|div|li)>',
            html,
            re.IGNORECASE | re.DOTALL,
        ):
            block = m.group(1)
            event = self._parse_block(block)
            if event and event["title"].lower() not in seen:
                seen.add(event["title"].lower())
                items.append(event)

        # Fallback genérico (igual aos outros)
        if not items:
            for hm in re.finditer(
                r'<h[1-4][^>]*>(?:<a[^>]*href="([^"]+)"[^>]*>)?([^<]+)(?:</a>)?</h[1-4]>',
                html,
                re.IGNORECASE,
            ):
                url, title = hm.groups()
                title = (title or "").strip()
                if not title or len(title) < 3 or title.lower() in seen:
                    continue
                tail = html[hm.end():hm.end() + 600]
                d = self._extract_date(tail)
                if not d:
                    continue
                seen.add(title.lower())
                items.append({
                    "title": title[:255],
                    "starts_on": d,
                    "url": url,
                    "source_id": (url or title)[:128],
                })

        return items

    def _parse_block(self, block: str) -> dict[str, Any] | None:
        mt = re.search(
            r'<h[1-4][^>]*>(?:<a[^>]*href="([^"]+)"[^>]*>)?([^<]+)(?:</a>)?</h[1-4]>',
            block,
            re.IGNORECASE,
        )
        if not mt:
            return None
        url = mt.group(1)
        title = self._clean(mt.group(2))
        if not title or len(title) < 3:
            return None

        d = self._extract_date(block)
        if not d:
            return None

        md = re.search(r"<p[^>]*>([^<]{20,400})</p>", block, re.IGNORECASE)
        description = self._clean(md.group(1)) if md else None

        return {
            "title": title[:255],
            "starts_on": d,
            "url": url,
            "description": description,
            "source_id": (url or title)[:128],
        }

    @staticmethod
    def _extract_date(text: str) -> str | None:
        m = re.search(
            r"(\d{2}/\d{2}/\d{4}(?:\s*(?:às?\s*)?\d{1,2}:\d{2})?)",
            text,
        )
        if m:
            return m.group(1)
        m = re.search(
            r"(\d{1,2}\s*(?:a|–|-)\s*\d{1,2}\s*de\s*\w+\s*(?:de\s*)?\d{4})",
            text,
        )
        if m:
            return m.group(1)
        m = re.search(r"(\d{1,2}\s*de\s*\w+\s*(?:de\s*)?\d{4})", text)
        if m:
            return m.group(1)
        return None

    @staticmethod
    def _clean(s: str) -> str:
        import html as html_lib
        return html_lib.unescape(s).strip()


def main() -> int:
    setup_logging(os.environ.get("LOG_LEVEL", "INFO"))
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"
    logger.info("[sao-paulo-expo] starting (dry_run=%s)", dry_run)
    collector = SaoPauloExpoCollector(dry_run=dry_run)
    result: CollectorRunResult = collector.run()
    return 1 if result.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
