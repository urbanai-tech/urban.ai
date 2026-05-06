"""Coletor WTC São Paulo — eventos B2B + congressos no World Trade Center.

URL: https://www.wtcsaopaulo.com.br/eventos
Capacidade: ~8k pessoas. Cobre eventos corporate, conferências B2B,
lançamentos de produto.
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


class WtcSaoPauloCollector(HtmlVenueCollector):
    source = "wtc-sao-paulo"
    LISTING_URL = "https://www.wtcsaopaulo.com.br/eventos"
    VENUE_NAME = "WTC São Paulo"
    DEFAULT_CATEGORY = "conferencia"


def main() -> int:
    setup_logging(os.environ.get("LOG_LEVEL", "INFO"))
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"
    logger.info("[wtc-sao-paulo] starting (dry_run=%s)", dry_run)
    result: CollectorRunResult = WtcSaoPauloCollector(dry_run=dry_run).run()
    return 1 if result.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
