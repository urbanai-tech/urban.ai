"""Tests da HtmlVenueCollector base + parser de data + normalize."""

from typing import Any
from unittest.mock import patch, MagicMock

import pytest

from urban_webscrapping.collectors._html_venue_base import HtmlVenueCollector


class _FakeVenueCollector(HtmlVenueCollector):
    """Subclasse mínima pra testar a base."""

    source = "fake-venue"
    LISTING_URL = "https://example.com/eventos"
    VENUE_NAME = "Allianz Parque"  # match em venue_map
    DEFAULT_CATEGORY = "show"

    def __init__(self, items=None, dry_run=True):
        super().__init__(dry_run=dry_run)
        self._items = items or []

    def parse_listing(self, html: str) -> list[dict[str, Any]]:
        return self._items


# ============== _parse_date_to_iso ==============


class TestParseDateToIso:
    def test_iso_8601_passa_direto(self):
        c = _FakeVenueCollector()
        assert c._parse_date_to_iso("2026-05-10T20:00:00") == "2026-05-10 20:00:00"

    def test_iso_com_z(self):
        c = _FakeVenueCollector()
        assert c._parse_date_to_iso("2026-05-10T20:00:00Z") == "2026-05-10 20:00:00"

    def test_dd_mm_yyyy_com_hora(self):
        c = _FakeVenueCollector()
        assert c._parse_date_to_iso("15/06/2026 às 14:30") == "2026-06-15 14:30:00"

    def test_dd_mm_yyyy_sem_hora_default_20h(self):
        c = _FakeVenueCollector()
        assert c._parse_date_to_iso("15/06/2026") == "2026-06-15 20:00:00"

    def test_extenso_com_ano(self):
        c = _FakeVenueCollector()
        assert c._parse_date_to_iso("5 de junho de 2026") == "2026-06-05 20:00:00"

    def test_extenso_sem_ano_usa_atual(self):
        c = _FakeVenueCollector()
        from datetime import datetime
        result = c._parse_date_to_iso("5 de junho")
        assert result is not None
        assert result.startswith(f"{datetime.now().year}-06-05")

    def test_string_vazia(self):
        c = _FakeVenueCollector()
        assert c._parse_date_to_iso("") is None
        assert c._parse_date_to_iso(None) is None

    def test_lixo(self):
        c = _FakeVenueCollector()
        assert c._parse_date_to_iso("lorem ipsum") is None


# ============== normalize ==============


class TestNormalize:
    def test_normalize_completo_com_venue_map(self):
        """Allianz Parque está no venue_map — deve preencher lat/lng/venueType."""
        c = _FakeVenueCollector()
        raw = {
            "title": "Coldplay World Tour",
            "starts_on": "2026-05-10 20:00:00",
            "url": "https://allianzparque.com.br/eventos/coldplay",
            "description": "Show épico",
        }
        p = c.normalize(raw)
        assert p is not None
        assert p["nome"] == "Coldplay World Tour"
        assert p["dataInicio"] == "2026-05-10 20:00:00"
        assert p["latitude"] == -23.5275
        assert p["longitude"] == -46.6783
        assert p["venueType"] == "stadium"
        assert p["venueCapacity"] == 43713
        assert p["categoria"] == "show"
        assert p["source"] == "fake-venue"
        assert p["cidade"] == "São Paulo"

    def test_normalize_sem_title_descarta(self):
        c = _FakeVenueCollector()
        assert c.normalize({"starts_on": "2026-05-10"}) is None
        assert c.normalize({"title": "", "starts_on": "2026-05-10"}) is None

    def test_normalize_sem_data_descarta(self):
        c = _FakeVenueCollector()
        assert c.normalize({"title": "Show X"}) is None

    def test_normalize_data_invalida_descarta(self):
        c = _FakeVenueCollector()
        assert c.normalize({"title": "Show X", "starts_on": "data invalida"}) is None

    def test_normalize_categoria_subclass_pode_override(self):
        c = _FakeVenueCollector()
        raw = {
            "title": "Defesa de doutorado",
            "starts_on": "15/06/2026 14:00",
            "category": "Acadêmico",
        }
        p = c.normalize(raw)
        assert p is not None
        assert p["categoria"] == "Acadêmico"  # raw veio com categoria, não usa default


# ============== fetch_raw + run integrados ==============


class TestFetchAndRun:
    def test_fetch_raw_chama_get_e_parse(self):
        c = _FakeVenueCollector(items=[
            {"title": "Show A", "starts_on": "10/05/2026"},
        ])
        with patch.object(c, "_get", return_value="<html></html>"):
            items = c.fetch_raw()
        assert len(items) == 1

    def test_fetch_raw_falha_de_rede_retorna_vazio_sem_lançar(self):
        c = _FakeVenueCollector()
        with patch.object(c, "_get", side_effect=Exception("DNS down")):
            items = c.fetch_raw()
        assert items == []


class TestVenueObrigatorio:
    def test_lança_quando_listing_url_vazio(self):
        class Bad(HtmlVenueCollector):
            source = "bad"
            VENUE_NAME = "Allianz Parque"

            def parse_listing(self, html):
                return []

        with pytest.raises(ValueError, match="LISTING_URL e VENUE_NAME"):
            Bad(dry_run=True)

    def test_lança_quando_venue_name_vazio(self):
        class Bad(HtmlVenueCollector):
            source = "bad"
            LISTING_URL = "https://example.com"

            def parse_listing(self, html):
                return []

        with pytest.raises(ValueError):
            Bad(dry_run=True)


class TestVenueDesconhecido:
    def test_venue_fora_do_map_avisa_mas_funciona(self, caplog):
        """Quando VENUE_NAME não bate em venue_map, normalize segue mas sem
        lat/lng. Backend marca pendingGeocode."""
        class UnknownVenue(HtmlVenueCollector):
            source = "unknown-venue"
            LISTING_URL = "https://x.com"
            VENUE_NAME = "Lugar Inventado XYZ Que Não Existe"

            def parse_listing(self, html):
                return []

        c = UnknownVenue(dry_run=True)
        # Constrói payload sem geo
        p = c.normalize({"title": "Show X", "starts_on": "10/05/2026"})
        assert p is not None
        assert "latitude" not in p
        assert "longitude" not in p
