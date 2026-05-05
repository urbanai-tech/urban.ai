"""Coletores de eventos para o motor Urban AI (F6.2 Plus).

Cada coletor é uma classe que herda de `BaseCollector` e implementa
`fetch_raw()` (busca eventos da fonte) + `normalize()` (transforma
no schema do POST /events/ingest).

Coletores ativos:
  - sp_cultura.SpCulturaCollector — Prefeitura SP (sem auth, gratuito)

Coletores planejados (aguardam credencial externa):
  - api_football.ApiFootballCollector — jogos Allianz/Morumbi/Itaquera
  - sympla.SymplaApiCollector — substitui scraper HTML
  - eventbrite.EventbriteCollector — conferências internacionais
  - firecrawl.FirecrawlCollector — sites sem API (Anhembi, RD Summit, etc.)
  - serpapi.SerpApiCollector — Google Events box (long tail)
"""

from urban_webscrapping.collectors.base_collector import BaseCollector

__all__ = ["BaseCollector"]
