#!/bin/bash
set -euo pipefail

echo "Iniciando bateria de coletores Urban AI..."
uv run python -m urban_webscrapping.collectors.run_all
