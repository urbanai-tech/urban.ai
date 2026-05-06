#!/bin/bash
set -e

echo "Iniciando bateria de coletores REST (Camada 1 + 2)..."

# Camada 1 — APIs oficiais e fontes públicas
uv run python -m urban_webscrapping.collectors.api_football       || echo "Aviso: api_football falhou"
uv run python -m urban_webscrapping.collectors.sp_cultura         || echo "Aviso: sp_cultura falhou"
uv run python -m urban_webscrapping.collectors.usp_eventos        || echo "Aviso: usp_eventos falhou"
uv run python -m urban_webscrapping.collectors.marcha_para_jesus  || echo "Aviso: marcha_para_jesus falhou"

# Camada 1 — venues conhecidos SP (scraping HTML simples, sem credencial)
uv run python -m urban_webscrapping.collectors.allianz_parque     || echo "Aviso: allianz_parque falhou"
uv run python -m urban_webscrapping.collectors.anhembi            || echo "Aviso: anhembi falhou"
uv run python -m urban_webscrapping.collectors.sao_paulo_expo     || echo "Aviso: sao_paulo_expo falhou"
uv run python -m urban_webscrapping.collectors.expo_center_norte  || echo "Aviso: expo_center_norte falhou"
uv run python -m urban_webscrapping.collectors.transamerica_expo  || echo "Aviso: transamerica_expo falhou"
uv run python -m urban_webscrapping.collectors.vibra_sao_paulo    || echo "Aviso: vibra_sao_paulo falhou"
uv run python -m urban_webscrapping.collectors.tokio_marine_hall  || echo "Aviso: tokio_marine_hall falhou"
uv run python -m urban_webscrapping.collectors.espaco_unimed      || echo "Aviso: espaco_unimed falhou"
uv run python -m urban_webscrapping.collectors.wtc_sao_paulo      || echo "Aviso: wtc_sao_paulo falhou"

# Camada 2 — Web search + LLM extraction
uv run python -m urban_webscrapping.collectors.serpapi_events || echo "Aviso: serpapi_events falhou"
uv run python -m urban_webscrapping.collectors.tavily_search || echo "Aviso: tavily_search falhou"
uv run python -m urban_webscrapping.collectors.firecrawl_extractor || echo "Aviso: firecrawl_extractor falhou"

echo "Disparando Spiders do Scrapyd (legados — tickets/shows)..."
SPIDERS=("blue_ticket" "even_three" "eventim" "ingresse" "sympla" "ticket_360" "ticket_master")
for spider in "${SPIDERS[@]}"; do
  echo "Agendando spider: $spider"
  curl -s -X POST "http://127.0.0.1:6801/schedule.json" -d "project=urban_webscrapping" -d "spider=$spider" || echo "Aviso: Falha ao agendar $spider"
done

echo "Todos os coletores e spiders foram engatilhados com sucesso!"
