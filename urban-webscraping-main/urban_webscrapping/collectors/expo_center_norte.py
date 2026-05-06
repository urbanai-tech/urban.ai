"""Coletor Expo Center Norte — feiras gerais e eventos empresariais.

URL: https://www.expocenternorte.com.br/eventos
Capacidade: ~50k pessoas. Cobre FIT, eventos B2B, exposições.

Usa heurística genérica `parse_default_listing` da base — suficiente
pra layout WordPress padrão. Quando virar caso específico, override
`parse_listing()` localmente.
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


class ExpoCenterNorteCollector(HtmlVenueCollector):
    source = "expo-center-norte"
    LISTING_URL = "https://www.expocenternorte.com.br/eventos"
    VENUE_NAME = "Expo Center Norte"
    DEFAULT_CATEGORY = "feira"


def main() -> int:
    setup_logging(os.environ.get("LOG_LEVEL", "INFO"))
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"
    logger.info("[expo-center-norte] starting (dry_run=%s)", dry_run)
    result: CollectorRunResult = ExpoCenterNorteCollector(dry_run=dry_run).run()
    return 1 if result.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
