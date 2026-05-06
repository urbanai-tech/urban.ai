"""Tests do UspEventosCollector — focados em parsing HTML deterministico."""

from urban_webscrapping.collectors.usp_eventos import UspEventosCollector


def test_extract_event_urls_pega_links_unicos():
    c = UspEventosCollector(dry_run=True)
    html = """
    <html>
      <article><a href="https://eventos.usp.br/eventos/area-x/seminario-a/">Seminário A</a></article>
      <article><a href="https://eventos.usp.br/eventos/area-y/defesa-b/">Defesa B</a></article>
      <a href="https://eventos.usp.br/categoria/">Categoria (deve descartar)</a>
      <article><a href="https://eventos.usp.br/eventos/area-x/seminario-a/">Seminário A duplicado</a></article>
    </html>
    """
    urls = c._extract_event_urls(html)
    # Categoria curta foi descartada, duplicata foi removida
    assert len(urls) == 2
    assert all("eventos.usp.br" in u for u in urls)


def test_parse_event_detail_extrai_title_e_data():
    c = UspEventosCollector(dry_run=True)
    html = """
    <html>
      <head>
        <meta property="og:title" content="Defesa de Doutorado: Métodos de IA" />
        <meta property="og:description" content="Defesa pública de doutorado." />
      </head>
      <body>
        <h1>Defesa de Doutorado: Métodos de IA</h1>
        <p>Data: 15/06/2026 às 14:00</p>
        <p class="venue">Auditório FFCL - Cidade Universitária</p>
      </body>
    </html>
    """
    data = c._parse_event_detail(html, "https://eventos.usp.br/eventos/x/defesa/")
    assert data is not None
    assert "Métodos de IA" in data["title"]
    assert data["starts_on"] == "2026-06-15 14:00:00"
    assert data["category"] == "Acadêmico"


def test_parse_event_detail_retorna_none_sem_data():
    c = UspEventosCollector(dry_run=True)
    html = """<html><h1>Evento sem data clara</h1></html>"""
    data = c._parse_event_detail(html, "https://eventos.usp.br/eventos/x/y/")
    assert data is None


def test_normalize_descarta_outros_campi():
    c = UspEventosCollector(dry_run=True)
    raw = {
        "title": "Defesa em Ribeirão Preto",
        "starts_on": "2026-06-15 14:00:00",
        "ends_on": "2026-06-15 14:00:00",
        "location": "FFCLRP - Ribeirão Preto - SP",
        "url": "https://eventos.usp.br/eventos/ribeirao/x/",
        "source_id": "x",
        "description": None,
        "category": "Acadêmico",
    }
    payload = c.normalize(raw)
    assert payload is None  # outro campus, fora da cobertura SP capital


def test_normalize_aceita_cidade_universitaria():
    c = UspEventosCollector(dry_run=True)
    raw = {
        "title": "Seminário FFLCH",
        "starts_on": "2026-06-15 14:00:00",
        "ends_on": "2026-06-15 14:00:00",
        "location": "Auditório FFLCH - Cidade Universitária - São Paulo",
        "url": "https://eventos.usp.br/eventos/fflch/seminario/",
        "source_id": "seminario",
        "description": "Seminário sobre tema X",
        "category": "Acadêmico",
    }
    payload = c.normalize(raw)
    assert payload is not None
    assert payload["nome"] == "Seminário FFLCH"
    assert payload["cidade"] == "São Paulo"
    assert payload["source"] == "usp-eventos"


def test_extract_date_pt_br_formato_padrao():
    c = UspEventosCollector(dry_run=True)
    iso = c._extract_date("Data: 20/07/2026 às 09:30")
    assert iso == "2026-07-20 09:30:00"


def test_extract_date_iso_8601():
    c = UspEventosCollector(dry_run=True)
    iso = c._extract_date('"startDate": "2026-08-15T10:00:00-03:00"')
    assert iso is not None
    assert "2026-08-15" in iso


def test_extract_date_dd_mm_yyyy_sem_hora_default_19h():
    c = UspEventosCollector(dry_run=True)
    iso = c._extract_date("Data: 30/12/2026")
    assert iso == "2026-12-30 19:00:00"
