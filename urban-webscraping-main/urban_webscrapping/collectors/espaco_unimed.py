"""Coletor Espaço Unimed (ex-Espaço das Américas) — arena coberta 8k pessoas.

Mais tradicional pra shows internacionais e nacionais grandes.
"""

from __future__ import annotations

import logging
import os

from urban_webscrapping.collectors._html_venue_base import HtmlVenueCollector
from urban_webscrapping.collectors.base_collector import (
    CollectorRunResult,
    setup_logging,
)


logger = logging.getLogger(__name__)


class EspacoUnimedCollector(HtmlVenueCollector):
    source = "espaco-unimed"
    LISTING_URL = "https://www.espacounimed.com.br/agenda"
    VENUE_NAME = "Espaço Unimed"
    DEFAULT_CATEGORY = "show"


def main() -> int:
    setup_logging(os.environ.get("LOG_LEVEL", "INFO"))
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"
    logger.info("[espaco-unimed] starting (dry_run=%s)", dry_run)
    result: CollectorRunResult = EspacoUnimedCollector(dry_run=dry_run).run()
    return 1 if result.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
