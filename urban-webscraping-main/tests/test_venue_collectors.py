"""Tests dos 3 coletores HTML simples (Allianz, Anhembi, SP Expo).

Foco: parser HTML extrai cards corretamente. Não testa fetch real.
"""

from urban_webscrapping.collectors.allianz_parque import AllianzParqueCollector
from urban_webscrapping.collectors.anhembi import AnhembiCollector
from urban_webscrapping.collectors.sao_paulo_expo import SaoPauloExpoCollector


# ============== AllianzParqueCollector ==============


class TestAllianz:
    def test_parse_estrutura_event_card(self):
        c = AllianzParqueCollector(dry_run=True)
        html = """
        <html>
          <article class="event">
            <h2><a href="/eventos/coldplay">Coldplay World Tour</a></h2>
            <span class="event-date">15/06/2026 às 21:00</span>
            <p>Show épico no Allianz Parque</p>
          </article>
          <article class="event">
            <h2>Taylor Swift Eras Tour</h2>
            <span class="event-date">22/07/2026</span>
            <p>Sold out</p>
          </article>
        </html>
        """
        items = c.parse_listing(html)
        assert len(items) == 2
        assert items[0]["title"] == "Coldplay World Tour"
        assert "15/06/2026" in items[0]["starts_on"]
        assert items[0]["url"] == "/eventos/coldplay"

    def test_parse_dedup_por_title(self):
        c = AllianzParqueCollector(dry_run=True)
        html = """
        <article class="event">
          <h2>Show X</h2><span class="event-date">10/05/2026</span>
        </article>
        <article class="event">
          <h2>Show X</h2><span class="event-date">10/05/2026</span>
        </article>
        """
        items = c.parse_listing(html)
        assert len(items) == 1

    def test_parse_fallback_quando_classe_event_ausente(self):
        c = AllianzParqueCollector(dry_run=True)
        # HTML sem class="event" — usa fallback genérico h2 + data próxima
        html = """
        <h2><a href="/x">Show fallback</a></h2>
        <p>Acontece em 30/08/2026</p>
        <h3>Outro show</h3>
        <span>Data: 15/09/2026</span>
        """
        items = c.parse_listing(html)
        assert len(items) >= 1
        titles = [it["title"] for it in items]
        assert "Show fallback" in titles


# ============== AnhembiCollector ==============


class TestAnhembi:
    def test_parse_card_basico(self):
        c = AnhembiCollector(dry_run=True)
        html = """
        <div class="evento-card">
          <h3><a href="/eventos/ccxp">CCXP 2026</a></h3>
          <p>Comic Con Experience — 4 dias de feira no Distrito Anhembi</p>
          <span>05/12/2026 a 08/12/2026</span>
        </div>
        """
        items = c.parse_listing(html)
        assert len(items) == 1
        assert items[0]["title"] == "CCXP 2026"

    def test_parse_extrai_data_intervalo_dd_a_dd(self):
        c = AnhembiCollector(dry_run=True)
        html = """
        <div class="event">
          <h2>SPFW</h2>
          <p>15 a 18 de outubro de 2026 — moda</p>
        </div>
        """
        items = c.parse_listing(html)
        assert len(items) == 1
        # Pega o primeiro DD do intervalo
        assert "15" in items[0]["starts_on"]


# ============== SaoPauloExpoCollector ==============


class TestSpExpo:
    def test_parse_card_li(self):
        c = SaoPauloExpoCollector(dry_run=True)
        html = """
        <ul>
          <li class="agenda-item">
            <h3><a href="/eventos/hospitalar-2026">Hospitalar 2026</a></h3>
            <p>Maior feira de saúde da América Latina</p>
            <span>20/05/2026 a 23/05/2026</span>
          </li>
        </ul>
        """
        items = c.parse_listing(html)
        assert len(items) == 1
        assert items[0]["title"] == "Hospitalar 2026"
        assert items[0]["url"] == "/eventos/hospitalar-2026"

    def test_parse_dd_a_dd_de_mes(self):
        c = SaoPauloExpoCollector(dry_run=True)
        html = """
        <article class="evento">
          <h2>Bett Brasil 2026</h2>
          <p>Conferência de educação 12 a 14 de junho de 2026</p>
        </article>
        """
        items = c.parse_listing(html)
        assert len(items) == 1
        # Extraiu data por extenso
        assert items[0]["starts_on"]


# ============== normalize integrado ==============


def test_anhembi_normalize_aplica_venue_map():
    """Anhembi está no venue_map (Distrito Anhembi) — payload deve ter lat/lng."""
    c = AnhembiCollector(dry_run=True)
    p = c.normalize({
        "title": "CCXP 2026",
        "starts_on": "05/12/2026",
        "url": "https://distritoanhembi.com.br/ccxp",
    })
    assert p is not None
    assert p["latitude"] is not None
    assert p["longitude"] is not None
    assert p["venueType"] == "convention_center"
    assert p["source"] == "anhembi"


def test_sp_expo_normalize_aplica_venue_map():
    c = SaoPauloExpoCollector(dry_run=True)
    p = c.normalize({
        "title": "Hospitalar 2026",
        "starts_on": "20/05/2026",
        "url": "https://saopauloexpo.com.br/hospitalar",
    })
    assert p is not None
    assert p["latitude"] is not None
    assert p["venueType"] == "convention_center"
    assert p["source"] == "sao-paulo-expo"


def test_allianz_normalize_aplica_venue_map():
    c = AllianzParqueCollector(dry_run=True)
    p = c.normalize({
        "title": "Coldplay",
        "starts_on": "15/06/2026 21:00",
    })
    assert p is not None
    assert p["venueType"] == "stadium"
    assert p["venueCapacity"] == 43713
    assert p["source"] == "allianz-parque"
