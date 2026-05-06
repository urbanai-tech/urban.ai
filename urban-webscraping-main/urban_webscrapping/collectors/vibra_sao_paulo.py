"""Coletor Vibra São Paulo (ex-Credicard Hall) — shows e apresentações."""

from __future__ import annotations

import logging
import os

from urban_webscrapping.collectors._html_venue_base import HtmlVenueCollector
from urban_webscrapping.collectors.base_collector import (
    CollectorRunResult,
    setup_logging,
)


logger = logging.getLogger(__name__)


class VibraSaoPauloCollector(HtmlVenueCollector):
    source = "vibra-sao-paulo"
    LISTING_URL = "https://www.vibrasaopaulo.com.br/agenda"
    VENUE_NAME = "Vibra São Paulo"
    DEFAULT_CATEGORY = "show"


def main() -> int:
    setup_logging(os.environ.get("LOG_LEVEL", "INFO"))
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"
    logger.info("[vibra-sao-paulo] starting (dry_run=%s)", dry_run)
    result: CollectorRunResult = VibraSaoPauloCollector(dry_run=dry_run).run()
    return 1 if result.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
