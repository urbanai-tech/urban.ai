"""Tests do MarchaParaJesusCollector."""

from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from urban_webscrapping.collectors.marcha_para_jesus import MarchaParaJesusCollector


def test_normalize_payload_completo():
    c = MarchaParaJesusCollector(dry_run=True)
    raw = {
        "title": "Marcha para Jesus São Paulo",
        "starts_on": "2026-06-04 09:00:00",
        "ends_on": "2026-06-04 09:00:00",
        "url": "https://marchaparajesussp.com",
    }
    p = c.normalize(raw)
    assert p is not None
    assert p["nome"] == "Marcha para Jesus São Paulo"
    assert p["dataInicio"] == "2026-06-04 09:00:00"
    assert p["latitude"] == -23.5278
    assert p["longitude"] == -46.6359
    assert p["venueType"] == "outdoor"
    assert p["venueCapacity"] == 3_000_000
    assert p["expectedAttendance"] == 3_000_000
    assert p["categoria"] == "Religioso"
    assert p["source"] == "marcha-para-jesus"
    assert p["sourceId"].startswith("marcha-")


def test_heuristic_date_retorna_quinta_de_junho_no_futuro():
    c = MarchaParaJesusCollector(dry_run=True)
    iso = c._heuristic_date_for_current_year()
    assert iso is not None
    dt = datetime.strptime(iso, "%Y-%m-%d %H:%M:%S")
    # Deve ser quinta-feira (3)
    assert dt.weekday() == 3
    # Deve ser em junho
    assert dt.month == 6
    # Deve ser >= hoje
    assert dt.date() >= datetime.now().date()


def test_try_fetch_extrai_data_dd_mm_yyyy():
    c = MarchaParaJesusCollector(dry_run=True)
    future = datetime.now() + timedelta(days=60)
    fake_html = (
        f"<html>Marcha será no dia {future.strftime('%d/%m/%Y')}</html>"
    )

    mock_resp = MagicMock()
    mock_resp.text = fake_html
    mock_resp.raise_for_status = MagicMock()
    with patch(
        "urban_webscrapping.collectors.marcha_para_jesus.requests.get",
        return_value=mock_resp,
    ):
        iso = c._try_fetch_date_from_site()
    assert iso is not None
    assert iso.startswith(future.strftime("%Y-%m-%d"))


def test_try_fetch_descarta_data_passada():
    c = MarchaParaJesusCollector(dry_run=True)
    past = datetime.now() - timedelta(days=60)
    fake_html = (
        f"<html>Já aconteceu em {past.strftime('%d/%m/%Y')}</html>"
    )
    mock_resp = MagicMock()
    mock_resp.text = fake_html
    mock_resp.raise_for_status = MagicMock()
    with patch(
        "urban_webscrapping.collectors.marcha_para_jesus.requests.get",
        return_value=mock_resp,
    ):
        iso = c._try_fetch_date_from_site()
    assert iso is None


def test_try_fetch_extrai_data_por_extenso():
    c = MarchaParaJesusCollector(dry_run=True)
    next_year = datetime.now().year + 1
    fake_html = f"<html>Marcha 5 de junho de {next_year}</html>"
    mock_resp = MagicMock()
    mock_resp.text = fake_html
    mock_resp.raise_for_status = MagicMock()
    with patch(
        "urban_webscrapping.collectors.marcha_para_jesus.requests.get",
        return_value=mock_resp,
    ):
        iso = c._try_fetch_date_from_site()
    assert iso is not None
    assert f"{next_year}-06-05" in iso


def test_fetch_raw_quando_site_offline_usa_heuristica():
    c = MarchaParaJesusCollector(dry_run=True)
    import requests
    with patch(
        "urban_webscrapping.collectors.marcha_para_jesus.requests.get",
        side_effect=requests.RequestException("offline"),
    ):
        items = c.fetch_raw()
    assert len(items) == 1
    assert items[0]["title"] == "Marcha para Jesus São Paulo"
