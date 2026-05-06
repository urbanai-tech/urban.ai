"""Coletor Transamérica Expo Center — feiras + eventos corporativos."""

from __future__ import annotations

import logging
import os

from urban_webscrapping.collectors._html_venue_base import HtmlVenueCollector
from urban_webscrapping.collectors.base_collector import (
    CollectorRunResult,
    setup_logging,
)


logger = logging.getLogger(__name__)


class TransamericaExpoCollector(HtmlVenueCollector):
    source = "transamerica-expo"
    LISTING_URL = "https://www.transamericaexpo.com.br/eventos"
    VENUE_NAME = "Transamérica Expo"
    DEFAULT_CATEGORY = "feira"


def main() -> int:
    setup_logging(os.environ.get("LOG_LEVEL", "INFO"))
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"
    logger.info("[transamerica-expo] starting (dry_run=%s)", dry_run)
    result: CollectorRunResult = TransamericaExpoCollector(dry_run=dry_run).run()
    return 1 if result.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
