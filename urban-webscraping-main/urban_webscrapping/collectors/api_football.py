import logging
import os
from typing import Any

import requests
from dotenv import load_dotenv

from urban_webscrapping.collectors.base_collector import (
    BaseCollector,
    MissingApiKeyError,
    setup_logging,
)
from urban_webscrapping.utils.event_datetime import to_sp_iso

load_dotenv()
logger = logging.getLogger(__name__)


class ApiFootballCollector(BaseCollector):
    """Coletor para o API-Football, focado em jogos de futebol em São Paulo."""

    source = "api-football"

    def fetch_raw(self) -> list[dict[str, Any]]:
        api_key = os.getenv("API_FOOTBALL_KEY")
        if not api_key:
            raise MissingApiKeyError("API_FOOTBALL_KEY")

        headers = {"x-apisports-key": api_key, "v": "3"}

        # IDs dos principais times de SP
        sp_teams = [
            121,  # São Paulo
            128,  # Palmeiras
            131,  # Corinthians
        ]

        raw_events: list[dict[str, Any]] = []

        # Buscar próximos jogos desses times
        for team_id in sp_teams:
            try:
                url = (
                    f"https://v3.football.api-sports.io/fixtures?team={team_id}&next=10"
                )
                response = requests.get(url, headers=headers, timeout=15)
                response.raise_for_status()
                data = response.json()

                if data.get("response"):
                    raw_events.extend(data["response"])
            except Exception as e:
                logger.error("Erro ao buscar jogos para o time %s: %s", team_id, e)

        return raw_events

    def normalize(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        fixture = raw.get("fixture", {})
        teams = raw.get("teams", {})
        venue = fixture.get("venue", {})

        city = venue.get("city", "")
        if city and "sao paulo" not in city.lower() and "são paulo" not in city.lower():
            # Pula jogos que não são em São Paulo
            return None

        # Exemplo: "São Paulo vs Palmeiras"
        home_team = teams.get("home", {}).get("name", "Unknown")
        away_team = teams.get("away", {}).get("name", "Unknown")
        name = f"Futebol: {home_team} x {away_team}"

        date_str = fixture.get("date")
        if not date_str:
            return None

        # API-Football devolve UTC ("2026-05-11T00:30:00+00:00"). Convertemos para
        # o horário de São Paulo MANTENDO o offset ("2026-05-10T21:30:00-03:00");
        # antes o offset era descartado e um jogo das 21:30 BRT era gravado como
        # 00:30 do dia seguinte (D3).
        formatted_date = to_sp_iso(date_str)
        if not formatted_date:
            return None

        payload = {
            "nome": name,
            "dataInicio": formatted_date,
            "categoria": "Esportes",
            "source": self.source,
            "sourceId": str(fixture.get("id")),
        }

        venue_name = venue.get("name")
        if venue_name and city:
            payload["enderecoCompleto"] = f"{venue_name}, {city}, SP"

        return payload


if __name__ == "__main__":
    setup_logging()
    dry_run = os.environ.get("DRY_RUN", "").lower() == "true"
    collector = ApiFootballCollector(dry_run=dry_run)
    result = collector.run()
    raise SystemExit(1 if result.status in {"failed", "partial_failure"} else 0)
