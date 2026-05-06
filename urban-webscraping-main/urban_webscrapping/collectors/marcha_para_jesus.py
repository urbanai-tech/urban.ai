"""Coletor Marcha para Jesus — evento anual fixo em São Paulo.

Por que coletor dedicado: a Marcha para Jesus reúne **3 milhões de pessoas em
um único dia** em SP, na Av. Tiradentes / Marginal Tietê. É um dos picos mais
extremos de demanda de hospedagem do ano. Sites genéricos como Eventbrite,
Sympla, Google Events frequentemente NÃO listam — é evento aberto, gratuito,
sem ticket, e a divulgação é via redes da igreja organizadora.

Estratégia: como o evento é ANUAL FIXO (sempre numa quinta-feira de
Corpus Christi, ou variante próxima), e o local é sempre o mesmo
(Estação da Luz / Av. Tiradentes), o coletor:

  1. Tenta scraping leve do site oficial https://marchaparajesussp.com
     pra confirmar data exata do ano corrente
  2. Se falhar, usa heurística: "primeira quinta-feira de junho"
     do ano corrente como fallback (data conservadora — Corpus Christi
     varia mas costuma cair em maio/junho)
  3. Manda 1 evento único por execução. dedupHash absorve duplicatas.

Dataset: 1 evento/ano, mas evento de magnitude máxima (capacidade 3M+).
Vale o coletor dedicado.
"""

from __future__ import annotations

import logging
import os
import re
from datetime import date, datetime, timedelta
from typing import Any

import requests
from urban_webscrapping.collectors.base_collector import (
    BaseCollector,
    CollectorRunResult,
)


logger = logging.getLogger(__name__)


class MarchaParaJesusCollector(BaseCollector):
    """Coletor anual fixo da Marcha para Jesus em SP."""

    source = "marcha-para-jesus"

    # Endereço fixo — Avenida Tiradentes / Estação da Luz
    EVENT_LAT = -23.5278
    EVENT_LNG = -46.6359
    EVENT_VENUE = "Avenida Tiradentes, Estação da Luz, São Paulo - SP"

    OFFICIAL_URL = "https://marchaparajesussp.com"
    REQUEST_TIMEOUT = 10
    USER_AGENT = (
        "Mozilla/5.0 (compatible; UrbanAI-EventCollector/1.0)"
    )

    def __init__(self, client=None, dry_run=False):
        super().__init__(client=client, dry_run=dry_run)

    def fetch_raw(self) -> list[dict[str, Any]]:
        # Tenta site oficial; fallback pra heurística de calendário
        date_iso = self._try_fetch_date_from_site()
        if not date_iso:
            date_iso = self._heuristic_date_for_current_year()

        if not date_iso:
            logger.warning(
                "[marcha-para-jesus] não conseguiu determinar data; pulando run",
            )
            return []

        return [
            {
                "title": "Marcha para Jesus São Paulo",
                "starts_on": date_iso,
                "ends_on": date_iso,
                "url": self.OFFICIAL_URL,
            }
        ]

    def normalize(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        return {
            "nome": raw["title"],
            "dataInicio": raw["starts_on"],
            "dataFim": raw["ends_on"],
            "enderecoCompleto": self.EVENT_VENUE,
            "cidade": "São Paulo",
            "estado": "SP",
            "latitude": self.EVENT_LAT,
            "longitude": self.EVENT_LNG,
            "categoria": "Religioso",
            "venueType": "outdoor",
            "venueCapacity": 3_000_000,
            "expectedAttendance": 3_000_000,
            "linkSiteOficial": raw.get("url"),
            "crawledUrl": raw.get("url"),
            "source": self.source,
            "sourceId": f"marcha-{raw['starts_on'][:10]}",
            "descricao": (
                "Marcha para Jesus — evento religioso anual realizado em São Paulo, "
                "Av. Tiradentes/Estação da Luz. Reúne tradicionalmente cerca de "
                "3 milhões de pessoas em uma única quinta-feira (geralmente "
                "Corpus Christi). Pico de demanda de hospedagem na região central "
                "e zona norte da cidade."
            ),
        }

    # ============== Helpers ==============

    def _try_fetch_date_from_site(self) -> str | None:
        """Tenta extrair data do site oficial. Retorna None se falhar."""
        try:
            resp = requests.get(
                self.OFFICIAL_URL,
                headers={"User-Agent": self.USER_AGENT},
                timeout=self.REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            html = resp.text
        except Exception as e:
            logger.info("[marcha-para-jesus] site oficial inacessível: %s", e)
            return None

        # Padrão DD/MM/YYYY próximo de "marcha"
        for m in re.finditer(r"(\d{2})/(\d{2})/(\d{4})", html):
            d, mo, y = m.groups()
            try:
                dt = datetime(int(y), int(mo), int(d), 9, 0)
                # Aceita só datas no futuro (próximos 18 meses)
                now = datetime.now()
                if dt > now and dt < now + timedelta(days=540):
                    return dt.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                continue

        # Padrão por extenso: "5 de junho de 2026"
        meses = {
            "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4,
            "maio": 5, "junho": 6, "julho": 7, "agosto": 8, "setembro": 9,
            "outubro": 10, "novembro": 11, "dezembro": 12,
        }
        m = re.search(
            r"(\d{1,2})\s*de\s*(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*de\s*(\d{4})",
            html,
            re.IGNORECASE,
        )
        if m:
            day = int(m.group(1))
            mes_str = m.group(2).lower().replace("ç", "c")
            month = meses.get(mes_str)
            year = int(m.group(3))
            if month:
                try:
                    dt = datetime(year, month, day, 9, 0)
                    if dt > datetime.now():
                        return dt.strftime("%Y-%m-%d %H:%M:%S")
                except ValueError:
                    pass

        return None

    def _heuristic_date_for_current_year(self) -> str | None:
        """Fallback: primeira quinta-feira de junho do ano corrente.

        A Marcha tradicionalmente cai em Corpus Christi (quinta de jun),
        mas pode variar por ano. Essa é uma estimativa conservadora pra
        gerar um evento "placeholder" — quando o site oficial atualizar,
        o dedupHash gera novo registro pq a data muda. Não é ideal, mas
        garante que não somos surpreendidos.
        """
        today = date.today()
        year = today.year

        # Primeira quinta de junho (weekday 3 = Thursday)
        d = date(year, 6, 1)
        while d.weekday() != 3:
            d = d + timedelta(days=1)

        # Se já passou neste ano, calcula próximo ano
        if d < today:
            d = date(year + 1, 6, 1)
            while d.weekday() != 3:
                d = d + timedelta(days=1)

        dt = datetime(d.year, d.month, d.day, 9, 0)
        return dt.strftime("%Y-%m-%d %H:%M:%S")


# ============== CLI ==============


def main() -> int:
    from urban_webscrapping.collectors.base_collector import setup_logging

    setup_logging(os.environ.get("LOG_LEVEL", "INFO"))
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"

    logger.info("[marcha-para-jesus] starting (dry_run=%s)", dry_run)
    collector = MarchaParaJesusCollector(dry_run=dry_run)
    result: CollectorRunResult = collector.run()

    if result.errors:
        logger.warning("Errors: %s", result.errors[:5])
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
