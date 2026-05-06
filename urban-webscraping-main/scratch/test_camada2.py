import logging
from dotenv import load_dotenv

from urban_webscrapping.collectors.api_football import ApiFootballCollector
from urban_webscrapping.collectors.serpapi_events import SerpApiEventsCollector
from urban_webscrapping.collectors.tavily_search import TavilySearchCollector
from urban_webscrapping.collectors.firecrawl_extractor import FirecrawlExtractor
from urban_webscrapping.collectors.base_collector import setup_logging

load_dotenv()
logger = logging.getLogger("test_camada2")

def main():
    setup_logging()

    # 1. Testar API-Football (foco SP)
    logger.info("=== Testando API-Football ===")
    football_collector = ApiFootballCollector(dry_run=False)
    res_foot = football_collector.run()
    logger.info(f"API-Football enviou {res_foot.sent} eventos.")

    # 2. Testar SerpAPI (Google Events - Jonas Brothers)
    logger.info("=== Testando SerpAPI ===")
    serpapi_collector = SerpApiEventsCollector(query="Jonas Brothers São Paulo", dry_run=False)
    res_serp = serpapi_collector.run()
    logger.info(f"SerpAPI enviou {res_serp.sent} eventos.")

    # 3. Testar Tavily Search (Jonas Brothers)
    logger.info("=== Testando Tavily ===")
    tavily_collector = TavilySearchCollector(query="Jonas Brothers show São Paulo", dry_run=False)
    res_tavily = tavily_collector.run()
    logger.info(f"Tavily enviou {res_tavily.sent} eventos.")

    # 4. Testar Firecrawl Search (Jonas Brothers)
    # Using dry_run because Firecrawl V2 API payload might differ
    logger.info("=== Testando Firecrawl ===")
    firecrawl_collector = FirecrawlExtractor(query="Jonas Brothers show São Paulo", dry_run=True)
    res_fire = firecrawl_collector.run()
    logger.info(f"Firecrawl extraiu {res_fire.normalized} eventos (dry-run).")

if __name__ == "__main__":
    main()
