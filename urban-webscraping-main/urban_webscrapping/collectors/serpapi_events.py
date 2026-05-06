import os
import requests
import logging
from dateutil import parser
from dotenv import load_dotenv

from urban_webscrapping.collectors.base_collector import BaseCollector, setup_logging

load_dotenv()
logger = logging.getLogger(__name__)

class SerpApiEventsCollector(BaseCollector):
    """
    Coletor para Google Events via SerpAPI.

    Faz múltiplas queries focadas em SP capital e usa o param `location`
    do SerpAPI pra forçar viés geográfico ao Google Events. Isso reduz
    drasticamente eventos de outras cidades vazando pro DB.
    """
    source = "serpapi_events"

    DEFAULT_QUERIES = [
        "shows São Paulo capital",
        "festivais São Paulo capital",
        "feiras congressos São Paulo Expo Anhembi",
        "esportes São Paulo Allianz Morumbi Itaquerão",
    ]

    def __init__(self, query=None, queries=None, client=None, dry_run=False):
        super().__init__(client=client, dry_run=dry_run)
        if query:
            self.queries = [query]
        elif queries:
            self.queries = queries
        else:
            self.queries = self.DEFAULT_QUERIES

    def fetch_raw(self) -> list[dict]:
        api_key = os.getenv("SERPAPI_KEY")
        if not api_key:
            raise ValueError("SERPAPI_KEY não encontrada no .env")

        url = "https://serpapi.com/search.json"
        all_events: list[dict] = []
        seen_titles: set[str] = set()

        for query in self.queries:
            params = {
                "engine": "google_events",
                "q": query,
                "hl": "pt",
                "gl": "br",
                # location força viés geográfico no Google Events
                "location": "São Paulo, State of São Paulo, Brazil",
                "api_key": api_key,
            }
            logger.info(f"SerpAPI query: {query}")
            try:
                response = requests.get(url, params=params, timeout=20)
                response.raise_for_status()
                data = response.json()
                events = data.get("events_results", []) or []
                # Dedup leve por título entre queries
                for ev in events:
                    title = (ev.get("title") or "").strip().lower()
                    if title and title not in seen_titles:
                        seen_titles.add(title)
                        all_events.append(ev)
            except Exception as e:
                logger.error("Erro SerpAPI '%s': %s", query, e)

        logger.info(f"SerpAPI total: {len(all_events)} eventos únicos.")
        return all_events

    def normalize(self, raw: dict) -> dict | None:
        title = raw.get("title")
        if not title:
            return None

        # Data vem como dicionário
        date_info = raw.get("date", {})
        start_date_str = date_info.get("start_date")
        
        if not start_date_str:
            # As vezes a data vem em string plain text em outro campo ou 'when'
            start_date_str = date_info.get("when")
            if not start_date_str:
                return None
                
        # Tentativa de parsing da data
        try:
            # "Apr 25", "May 13" -> precisamos adicionar o ano atual se não tiver
            # Mas o dateutil costuma ser inteligente
            dt = parser.parse(start_date_str, fuzzy=True)
            formatted_date = dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            # Se falhar o parse, usa string bruta (backend pode lidar ou dropar)
            formatted_date = start_date_str

        payload = {
            "nome": title,
            "dataInicio": formatted_date,
            "source": self.source,
        }

        # Endereço
        address = raw.get("address")
        if address:
            if isinstance(address, list):
                address = ", ".join(address)
            payload["enderecoCompleto"] = address
            
        venue = raw.get("venue", {}).get("name")
        if venue and not payload.get("enderecoCompleto"):
            payload["enderecoCompleto"] = venue

        # Metadados
        link = raw.get("link")
        if link:
            payload["crawledUrl"] = link

        description = raw.get("description")
        if description:
            # Podemos passar a description também se backend suportar
            pass

        return payload

if __name__ == "__main__":
    setup_logging()
    collector = SerpApiEventsCollector(query="Jonas Brothers São Paulo", dry_run=True)
    collector.run()
