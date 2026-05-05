"""Tests do BaseCollector — orquestração genérica."""

from typing import Any
from unittest.mock import MagicMock

import pytest

from urban_webscrapping.collectors.base_collector import (
    BaseCollector,
    CollectorRunResult,
)


class _FakeCollector(BaseCollector):
    """Coletor de teste — devolve raw_items configuráveis."""

    source = "fake-test"

    def __init__(self, raw_items, normalize_fn=None, **kwargs):
        super().__init__(**kwargs)
        self._raw = raw_items
        self._normalize_fn = normalize_fn or (
            lambda r: {
                "nome": r.get("name"),
                "dataInicio": r.get("date"),
                "enderecoCompleto": r.get("address", ""),
            }
            if r.get("name")
            else None
        )

    def fetch_raw(self):
        if isinstance(self._raw, Exception):
            raise self._raw
        return self._raw

    def normalize(self, raw):
        return self._normalize_fn(raw)


def test_source_obrigatorio():
    class Bad(BaseCollector):
        source = ""

        def fetch_raw(self):
            return []

        def normalize(self, raw):
            return None

    with pytest.raises(ValueError, match="source"):
        Bad(dry_run=True)


def test_dry_run_nao_chama_client():
    raw = [{"name": "Show A", "date": "2026-05-10", "address": "Allianz Parque"}]
    c = _FakeCollector(raw_items=raw, dry_run=True)
    result = c.run()
    assert result.fetched == 1
    assert result.normalized == 1
    assert result.sent == 0  # dry run não envia


def test_run_envia_via_client():
    raw = [
        {"name": "Show A", "date": "2026-05-10", "address": "Allianz Parque"},
        {"name": "Show B", "date": "2026-05-11", "address": "Morumbi"},
    ]
    client = MagicMock()
    c = _FakeCollector(raw_items=raw, client=client)
    result = c.run()
    assert result.fetched == 2
    assert result.sent == 2
    assert client.add_event.call_count == 2
    client.flush.assert_called_once()


def test_run_filtra_normalize_none():
    raw = [
        {"name": "Show A", "date": "2026-05-10"},
        {"name": "", "date": "2026-05-11"},  # filtrado
        {"name": None, "date": "2026-05-12"},  # filtrado
    ]
    client = MagicMock()
    c = _FakeCollector(raw_items=raw, client=client)
    result = c.run()
    assert result.fetched == 3
    assert result.normalized == 1
    assert result.skipped_empty == 2


def test_run_captura_excecao_em_normalize():
    raw = [
        {"name": "Show A", "date": "2026-05-10"},
        {"name": "Show B"},  # vai dar erro propositalmente
    ]

    def normalize(r):
        if "date" not in r:
            raise ValueError("no date!")
        return {"nome": r["name"], "dataInicio": r["date"]}

    client = MagicMock()
    c = _FakeCollector(raw_items=raw, client=client, normalize_fn=normalize)
    result = c.run()
    assert result.normalized == 1
    assert result.skipped_invalid == 1
    assert any("normalize" in e for e in result.errors)


def test_run_captura_excecao_em_fetch():
    c = _FakeCollector(raw_items=Exception("network down"), dry_run=True)
    result = c.run()
    assert result.fetched == 0
    assert result.normalized == 0
    assert any("fetch_raw" in e for e in result.errors)


def test_enrich_with_venue_preenche_quando_faltando():
    c = _FakeCollector(raw_items=[], dry_run=True)
    payload = {
        "nome": "Show no Allianz",
        "enderecoCompleto": "Allianz Parque",
    }
    enriched = c.enrich_with_venue(payload)
    assert "latitude" in enriched
    assert "longitude" in enriched
    assert enriched["venueType"] == "stadium"
    assert enriched["venueCapacity"] == 43713


def test_enrich_with_venue_nao_sobrescreve_geo_existente():
    c = _FakeCollector(raw_items=[], dry_run=True)
    payload = {
        "nome": "Show no Allianz",
        "enderecoCompleto": "Allianz Parque",
        "latitude": -23.0,  # valores absurdos pra detectar override
        "longitude": -46.0,
    }
    enriched = c.enrich_with_venue(payload)
    assert enriched["latitude"] == -23.0  # preservado
    assert enriched["longitude"] == -46.0
    # Mas pega metadados que faltavam
    assert enriched["venueType"] == "stadium"


def test_run_seta_source_padrao_quando_normalize_esquece():
    raw = [{"name": "Show A", "date": "2026-05-10"}]

    def normalize_sem_source(r):
        return {"nome": r["name"], "dataInicio": r["date"]}  # sem 'source'!

    client = MagicMock()
    c = _FakeCollector(raw_items=raw, client=client, normalize_fn=normalize_sem_source)
    c.run()

    sent = client.add_event.call_args[0][0]
    assert sent["source"] == "fake-test"  # base preencheu por default
