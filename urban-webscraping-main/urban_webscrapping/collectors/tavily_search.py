import os
import requests
import logging
from dotenv import load_dotenv
from typing import Any

from urban_webscrapping.utils.llm_extractor import extract_event_from_text

from urban_webscrapping.collectors.base_collector import BaseCollector, setup_logging

load_dotenv()
logger = logging.getLogger(__name__)

class TavilySearchCollector(BaseCollector):
    """
    Coletor para Tavily API (REST). Múltiplas queries focadas em SP capital.
    O LLM extractor aplica is_in_scope=true como segundo filtro.
    """
    source = "tavily"

    DEFAULT_QUERIES = [
        "shows São Paulo capital 2026",
        "festivais São Paulo capital 2026",
        "feiras congressos São Paulo Expo Anhembi 2026",
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
        api_key = os.getenv("TAVILY_API_KEY")
        if not api_key:
            raise ValueError("TAVILY_API_KEY não encontrada no .env")

        headers = {"Content-Type": "application/json"}
        url = "https://api.tavily.com/search"
        all_results: list[dict[str, Any]] = []
        seen_urls: set[str] = set()

        for q in self.queries:
            logger.info(f"Tavily query: {q}")
            payload = {
                "api_key": api_key,
                "query": q,
                "search_depth": "advanced",
                "include_answer": False,
                "include_images": False,
                "include_raw_content": False,
                "max_results": 5,
            }
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=30)
                response.raise_for_status()
                data = response.json()
                results = data.get("results", []) or []
                for r in results:
                    u = (r.get("url") or "").strip().lower()
                    if u and u not in seen_urls:
                        seen_urls.add(u)
                        all_results.append(r)
            except Exception as e:
                logger.error("Erro Tavily '%s': %s", q, e)

        logger.info(f"Tavily total: {len(all_results)} resultados únicos.")
        return all_results

    def normalize(self, raw: dict[str, Any]) -> dict[str, Any] | None:
        """
        Tavily retorna { title, url, content, raw_content, score }.
        Utiliza Gemini LLM para extrair os dados reais da string.
        """
        title = raw.get("title")
        content = raw.get("content", "")
        if not title:
            return None

        # Tenta usar o Gemini
        text_to_analyze = f"Title: {title}\nContent: {content}"
        llm_data = extract_event_from_text(text_to_analyze)
        
        if llm_data:
            payload = llm_data
            payload["source"] = self.source
            payload["crawledUrl"] = raw.get("url")
            return payload

        # Fallback caso falhe ou Gemini não confirme ser evento
        return None

if __name__ == "__main__":
    setup_logging()
    collector = TavilySearchCollector(query="Jonas Brothers São Paulo", dry_run=True)
    collector.run()
