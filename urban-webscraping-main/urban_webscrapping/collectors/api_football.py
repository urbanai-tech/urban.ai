import os
import requests
import logging
from datetime import datetime
from dotenv import load_dotenv

from urban_webscrapping.collectors.base_collector import BaseCollector, setup_logging

load_dotenv()
logger = logging.getLogger(__name__)

class ApiFootballCollector(BaseCollector):
    """
    Coletor para o API-Football, focado em jogos de futebol em São Paulo.
    """
    source = "api-football"

    def fetch_raw(self) -> list[dict]:
        api_key = os.getenv("API_FOOTBALL_KEY")
        if not api_key:
            raise ValueError("API_FOOTBALL_KEY não encontrada no .env")

        headers = {
            "x-apisports-key": api_key,
            "v": "3"
        }

        # IDs dos principais times de SP
        sp_teams = [
            121, # São Paulo
            128, # Palmeiras
            131, # Corinthians
        ]

        raw_events = []
        
        # Buscar próximos jogos desses times
        for team_id in sp_teams:
            try:
                url = f"https://v3.football.api-sports.io/fixtures?team={team_id}&next=10"
                response = requests.get(url, headers=headers, timeout=15)
                response.raise_for_status()
                data = response.json()
                
                if data.get("response"):
                    raw_events.extend(data["response"])
            except Exception as e:
                logger.error("Erro ao buscar jogos para o time %s: %s", team_id, e)
                
        return raw_events

    def normalize(self, raw: dict) -> dict | None:
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

        # Convertendo "2026-05-10T20:00:00+00:00" para "YYYY-MM-DD HH:MM:SS" ou apenas manter ISO
        try:
            dt = datetime.fromisoformat(date_str)
            formatted_date = dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            formatted_date = date_str

        payload = {
            "nome": name,
            "dataInicio": formatted_date,
            "categoria": "Esportes",
            "source": self.source,
            "sourceId": str(fixture.get("id"))
        }

        venue_name = venue.get("name")
        if venue_name and city:
            payload["enderecoCompleto"] = f"{venue_name}, {city}, SP"

        return payload

if __name__ == "__main__":
    setup_logging()
    collector = ApiFootballCollector(dry_run=True)
    collector.run()
