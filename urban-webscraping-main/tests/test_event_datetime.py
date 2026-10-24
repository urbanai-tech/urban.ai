"""Convenção D3: datas de eventos com offset explícito de America/Sao_Paulo."""

import logging
from datetime import UTC, date, datetime
from unittest.mock import MagicMock

import pytest

from urban_webscrapping.collectors.api_football import ApiFootballCollector
from urban_webscrapping.collectors.base_collector import BaseCollector
from urban_webscrapping.utils.event_datetime import to_sp_iso, utc_to_sp_iso

# ============================ to_sp_iso ============================


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        # UTC -> São Paulo (21:30 BRT é 00:30Z do dia seguinte)
        ("2026-05-11T00:30:00+00:00", "2026-05-10T21:30:00-03:00"),
        ("2026-05-11T00:30:00Z", "2026-05-10T21:30:00-03:00"),
        # já em SP: preservado
        ("2026-05-10T21:30:00-03:00", "2026-05-10T21:30:00-03:00"),
        # outro offset: convertido
        ("2026-05-10T21:30:00+01:00", "2026-05-10T17:30:00-03:00"),
        # sem offset = horário de parede de SP
        ("2026-05-10 21:30:00", "2026-05-10T21:30:00-03:00"),
        ("2026-05-10T21:30:00", "2026-05-10T21:30:00-03:00"),
        # data pura permanece data pura
        ("2026-05-10", "2026-05-10"),
        (date(2026, 5, 10), "2026-05-10"),
        # vazio
        ("", None),
        ("   ", None),
        (None, None),
        # lixo é devolvido como veio (o backend decide)
        ("amanhã", "amanhã"),
    ],
)
def test_to_sp_iso(value, expected):
    assert to_sp_iso(value) == expected


def test_to_sp_iso_datetime_objects():
    assert (
        to_sp_iso(datetime(2026, 5, 11, 0, 30, tzinfo=UTC))
        == "2026-05-10T21:30:00-03:00"
    )
    assert to_sp_iso(datetime(2026, 5, 10, 21, 30)) == "2026-05-10T21:30:00-03:00"


def test_utc_to_sp_iso_trata_naive_como_utc():
    assert utc_to_sp_iso("2026-05-11 00:30:00") == "2026-05-10T21:30:00-03:00"
    assert utc_to_sp_iso("2026-05-11T00:30:00Z") == "2026-05-10T21:30:00-03:00"


# ============================ api-football ============================


def _fixture(date_str, city="São Paulo"):
    return {
        "fixture": {
            "id": 99,
            "date": date_str,
            "venue": {"name": "Allianz Parque", "city": city},
        },
        "teams": {"home": {"name": "Palmeiras"}, "away": {"name": "Santos"}},
    }


def test_api_football_converte_utc_para_sao_paulo_com_offset():
    c = ApiFootballCollector(dry_run=True)
    payload = c.normalize(_fixture("2026-05-11T00:30:00+00:00"))
    assert payload is not None
    # Bug original: virava "2026-05-11 00:30:00" (dia seguinte, sem fuso).
    assert payload["dataInicio"] == "2026-05-10T21:30:00-03:00"
    assert payload["source"] == "api-football"
    assert payload["sourceId"] == "99"


def test_api_football_descarta_sem_data_e_fora_de_sp():
    c = ApiFootballCollector(dry_run=True)
    assert c.normalize(_fixture(None)) is None
    assert c.normalize(_fixture("2026-05-11T00:30:00+00:00", city="Rio")) is None


# ============================ BaseCollector ============================


class _Collector(BaseCollector):
    source = "fake-d3"

    def __init__(self, raw, **kwargs):
        super().__init__(**kwargs)
        self._raw = raw

    def fetch_raw(self):
        return self._raw

    def normalize(self, raw):
        return raw


def test_run_normaliza_datas_para_offset_de_sao_paulo():
    client = MagicMock()
    c = _Collector(
        [
            {
                "nome": "A",
                "dataInicio": "2026-05-11 00:30:00+00:00",
                "source": "fake-d3",
            },
            {"nome": "B", "dataInicio": "2026-05-10 21:30:00", "source": "fake-d3"},
            {"nome": "C", "dataInicio": "2026-05-10", "source": "fake-d3"},
        ],
        client=client,
    )
    result = c.run()
    assert result.sent == 3
    sent = [call.args[0]["dataInicio"] for call in client.add_event.call_args_list]
    assert sent == [
        "2026-05-10T21:30:00-03:00",
        "2026-05-10T21:30:00-03:00",
        "2026-05-10",
    ]


def test_validate_aceita_inicio_com_hora_e_fim_data_pura():
    c = _Collector([], dry_run=True)
    errors = c.validate_payload(
        {
            "nome": "A",
            "source": "fake-d3",
            "dataInicio": "2026-05-10T20:00:00-03:00",
            "dataFim": "2026-05-10",
        }
    )
    assert errors == []


def test_validate_rejeita_fim_data_pura_anterior_ao_inicio():
    c = _Collector([], dry_run=True)
    errors = c.validate_payload(
        {
            "nome": "A",
            "source": "fake-d3",
            "dataInicio": "2026-05-11T20:00:00-03:00",
            "dataFim": "2026-05-10",
        }
    )
    assert errors == ["invalid_temporal_order"]


# ============================ D2: ZERO_ITEMS ============================


def test_run_com_zero_itens_loga_warning_com_nome_da_fonte(caplog):
    c = _Collector([], dry_run=True)
    with caplog.at_level(logging.WARNING):
        result = c.run()
    assert result.status == "no_data"
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert any(
        "fake-d3" in r.getMessage() and "ZERO_ITEMS" in r.getMessage() for r in warnings
    )


def test_run_com_itens_brutos_mas_nenhum_utilizavel_loga_warning(caplog):
    c = _Collector([{"x": 1}], dry_run=True)
    c.normalize = lambda raw: None  # type: ignore[method-assign]
    with caplog.at_level(logging.WARNING):
        c.run()
    assert any(
        "ZERO_ITEMS" in r.getMessage() and "fake-d3" in r.getMessage()
        for r in caplog.records
    )


def test_run_com_itens_nao_loga_zero_items(caplog):
    c = _Collector(
        [{"nome": "A", "dataInicio": "2026-05-10", "source": "fake-d3"}], dry_run=True
    )
    with caplog.at_level(logging.WARNING):
        c.run()
    assert not any("ZERO_ITEMS" in r.getMessage() for r in caplog.records)


def test_pipeline_ingest_loga_warning_quando_spider_fecha_sem_itens(caplog):
    from urban_webscrapping.pipelines import UrbanIngestPipeline

    pipeline = UrbanIngestPipeline()
    spider = MagicMock()
    spider.name = "sympla"
    with caplog.at_level(logging.WARNING):
        pipeline.close_spider(spider)
    assert any(
        "ZERO_ITEMS" in r.getMessage() and "sympla" in r.getMessage()
        for r in caplog.records
    )


def test_pipeline_ingest_nao_loga_warning_quando_houve_itens(caplog):
    from urban_webscrapping.pipelines import UrbanIngestPipeline

    pipeline = UrbanIngestPipeline()
    spider = MagicMock()
    spider.name = "sympla"
    pipeline.process_item({"nome": "A"}, spider)
    with caplog.at_level(logging.WARNING):
        pipeline.close_spider(spider)
    assert not any("ZERO_ITEMS" in r.getMessage() for r in caplog.records)


def test_pipeline_formata_datas_com_offset_de_sao_paulo():
    from urban_webscrapping.pipelines import UrbanIngestPipeline

    fmt = UrbanIngestPipeline._format_date
    assert fmt(datetime(2026, 5, 11, 0, 30, tzinfo=UTC)) == "2026-05-10T21:30:00-03:00"
    assert fmt(datetime(2026, 5, 10, 21, 30)) == "2026-05-10T21:30:00-03:00"
    assert fmt(date(2026, 5, 10)) == "2026-05-10"
    assert fmt("2026-05-11T00:30:00Z") == "2026-05-10T21:30:00-03:00"
