import os
import requests
import logging
from dotenv import load_dotenv
from typing import Any

from urban_webscrapping.utils.llm_extractor import extract_event_from_text

from urban_webscrapping.collectors.base_collector import BaseCollector, setup_logging

load_dotenv()
logger = logging.getLogger(__name__)

class FirecrawlExtractor(BaseCollector):
    """
    Coletor para Firecrawl API (REST). Faz busca + extração de eventos.

    Múltiplas queries focadas em SP capital. O LLM extractor depois aplica
    is_in_scope=true como segundo filtro pra descartar resultados que
    vazaram de outras cidades.
    """
    source = "firecrawl"

    DEFAULT_QUERIES = [
        "shows São Paulo Allianz Morumbi 2026",
        "festivais São Paulo capital 2026",
        "conferências feiras São Paulo Expo Anhembi 2026",
    ]

    def __init__(self, query=None, queries=None, client=None, dry_run=False):
        super().__init__(client=client, dry_run=dry_run)
        if query:
            self.queries = [query]
        elif queries:
            self.queries = queries
        else:
            self.queries = self.DEFAULT_QUERIES

    def fetch_raw(self) -> list[dict[str, Any]]:
        api_key = os.getenv("FIRECRAWL_API_KEY")
        if not api_key:
            raise ValueError("FIRECRAWL_API_KEY não encontrada no .env")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        url = "https://api.firecrawl.dev/v2/search"
        all_results: list[dict[str, Any]] = []
        seen_urls: set[str] = set()

        for q in self.queries:
            logger.info(f"Firecrawl query: {q}")
            payload = {
                "query": q,
                "limit": 5,
                "scrapeOptions": {"formats": ["markdown"]},
            }
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=30)
                response.raise_for_status()
                data = response.json()
                results = data.get("data", {}).get("web", []) or []
                for r in results:
                    u = (r.get("url") or "").strip().lower()
                    if u and u not in seen_urls:
                        seen_urls.add(u)
                        all_results.append(r)
            except Exception as e:
                logger.error("Erro Firecrawl '%s': %s", q, e)

        logger.info(f"Firecrawl total: {len(all_results)} resultados únicos.")
        return all_results

    def normalize(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        """
        O Firecrawl /search retorna { title, description, url, markdown }.
        Utiliza Gemini LLM para extrair os dados reais da string.
        """
        title = raw.get("title")
        description = raw.get("description", "")
        if not title:
            return None

        # Tenta usar o Gemini
        text_to_analyze = f"Title: {title}\nDescription: {description}"
        llm_data = extract_event_from_text(text_to_analyze)
        
        if llm_data:
            payload = llm_data
            payload["source"] = self.source
            payload["crawledUrl"] = raw.get("url")
            return payload

        return None

if __name__ == "__main__":
    setup_logging()
    collector = FirecrawlExtractor(query="Jonas Brothers São Paulo", dry_run=True)
    collector.run()
