"""Tests do SpCulturaCollector — normalização do formato MapaCultural."""

from unittest.mock import MagicMock, patch

from urban_webscrapping.collectors.sp_cultura import SpCulturaCollector


# ============================ normalize ============================


def test_normalize_basico():
    c = SpCulturaCollector(dry_run=True)
    raw = {
        "id": 12345,
        "name": "Show ABC",
        "shortDescription": "Show maneiro",
        "startsOn": "2026-05-10",
        "endsOn": "2026-05-10",
        "occurrences": [
            {
                "startsOn": "2026-05-10",
                "_startsAt": "20:00",
                "space": {"name": "CEU Pereira", "endereco": "Av. X, 100"},
            }
        ],
        "site": "/evento/12345/show-abc",
    }
    payload = c.normalize(raw)
    assert payload is not None
    assert payload["nome"] == "Show ABC"
    assert payload["dataInicio"] == "2026-05-10T20:00:00"
    assert payload["enderecoCompleto"] == "Av. X, 100"
    assert payload["cidade"] == "São Paulo"
    assert payload["estado"] == "SP"
    assert payload["sourceId"] == "12345"
    # site relativo é convertido pro absoluto da Prefeitura
    assert payload["linkSiteOficial"].startswith("http://spcultura")


def test_normalize_descarta_sem_nome():
    c = SpCulturaCollector(dry_run=True)
    assert c.normalize({"name": "", "startsOn": "2026-05-10"}) is None
    assert c.normalize({"name": None, "startsOn": "2026-05-10"}) is None


def test_normalize_descarta_sem_data():
    c = SpCulturaCollector(dry_run=True)
    assert c.normalize({"name": "Show X", "startsOn": None}) is None
    assert c.normalize({"name": "Show X"}) is None


def test_normalize_extrai_geo_string():
    c = SpCulturaCollector(dry_run=True)
    raw = {
        "name": "Show X",
        "startsOn": "2026-05-10",
        "location": "-23.5275,-46.6783",
    }
    payload = c.normalize(raw)
    assert payload["latitude"] == -23.5275
    assert payload["longitude"] == -46.6783


def test_normalize_extrai_geo_objeto():
    c = SpCulturaCollector(dry_run=True)
    raw = {
        "name": "Show X",
        "startsOn": "2026-05-10",
        "location": {"latitude": -23.5, "longitude": -46.6},
    }
    payload = c.normalize(raw)
    assert payload["latitude"] == -23.5
    assert payload["longitude"] == -46.6


def test_normalize_extrai_geo_geojson():
    c = SpCulturaCollector(dry_run=True)
    raw = {
        "name": "Show X",
        "startsOn": "2026-05-10",
        "geoLocation": {"type": "Point", "coordinates": [-46.6, -23.5]},  # [lng, lat]
    }
    payload = c.normalize(raw)
    assert payload["latitude"] == -23.5
    assert payload["longitude"] == -46.6


def test_normalize_extrai_categoria_de_terms():
    c = SpCulturaCollector(dry_run=True)
    raw = {
        "name": "Show",
        "startsOn": "2026-05-10",
        "terms": {"linguagem": ["música", "show"]},
    }
    payload = c.normalize(raw)
    assert payload["categoria"] == "música"


def test_normalize_sem_geo_aceita_endereco_pra_geocoding_lazy():
    c = SpCulturaCollector(dry_run=True)
    raw = {
        "name": "Show",
        "startsOn": "2026-05-10",
        "occurrences": [
            {
                "startsOn": "2026-05-10",
                "space": {"endereco": "Rua Y, 200, Vila Mariana"},
            }
        ],
    }
    payload = c.normalize(raw)
    assert payload["enderecoCompleto"]
    # Sem latitude/longitude → backend marca pendingGeocode
    assert payload.get("latitude") is None
    assert payload.get("longitude") is None


def test_normalize_seta_source_e_crawled_url():
    c = SpCulturaCollector(dry_run=True)
    raw = {
        "name": "Show",
        "startsOn": "2026-05-10",
        "id": 999,
        "singleUrl": "/evento/999/x",
    }
    payload = c.normalize(raw)
    assert payload["source"] == "sp-cultura"
    assert payload["sourceId"] == "999"
    assert payload["crawledUrl"]


# ============================ fetch_raw (mockado) ============================


def test_fetch_raw_pagina_corretamente():
    """Simula 2 páginas (250 + 30 items), garante que paginação funciona."""
    c = SpCulturaCollector(dry_run=True)
    page1 = [{"id": i, "name": f"E{i}", "startsOn": "2026-05-10"} for i in range(100)]
    page2 = [{"id": i, "name": f"E{i}", "startsOn": "2026-05-10"} for i in range(100, 200)]
    page3 = [{"id": i, "name": f"E{i}", "startsOn": "2026-05-10"} for i in range(200, 250)]  # < 100, última

    with patch("urban_webscrapping.collectors.sp_cultura.requests.get") as mock_get:
        responses = [MagicMock(json=lambda items=p: items, raise_for_status=MagicMock()) for p in [page1, page2, page3]]
        mock_get.side_effect = responses
        items = c.fetch_raw()

    assert len(items) == 250
    assert mock_get.call_count == 3


def test_fetch_raw_falha_de_rede_retorna_vazio_sem_lançar():
    c = SpCulturaCollector(dry_run=True)
    import requests
    with patch("urban_webscrapping.collectors.sp_cultura.requests.get") as mock_get:
        mock_get.side_effect = requests.RequestException("DNS down")
        items = c.fetch_raw()
    assert items == []
