"""Tests do venue_map — match de venues conhecidos em SP."""

from urban_webscrapping.utils.venue_map import VENUES, match_venue, venue_count


def test_venue_count_positive():
    assert venue_count() > 20  # mínimo razoável da lista catalogada


def test_match_allianz_parque_full_address():
    info = match_venue("Allianz Parque - Av. Francisco Matarazzo, São Paulo, SP")
    assert info is not None
    assert info.name == "Allianz Parque"
    assert info.venue_type == "stadium"
    assert info.capacity == 43713
    assert -23.6 < info.lat < -23.5
    assert -47 < info.lng < -46


def test_match_morumbi_alias():
    info = match_venue("Estádio do Morumbi")
    assert info is not None
    assert info.venue_type == "stadium"


def test_match_neo_quimica_arena():
    # Aliases: 'neoquimica arena', 'arena corinthians', 'itaquerao'
    for alias in [
        "Neo Química Arena",
        "Arena Corinthians, Itaquera",
        "Itaquerão lotado",
    ]:
        info = match_venue(alias)
        assert info is not None, f"falhou pra: {alias}"
        assert info.venue_type == "stadium"


def test_match_convention_centers():
    for name, expected in [
        ("São Paulo Expo", "São Paulo Expo"),
        ("Expo Center Norte, Vila Guilherme", "Expo Center Norte"),
        ("Distrito Anhembi", "Anhembi"),
        ("WTC São Paulo events", "WTC São Paulo"),
    ]:
        info = match_venue(name)
        assert info is not None, f"falhou pra: {name}"
        assert info.name == expected
        assert info.venue_type == "convention_center"


def test_match_normalizacao_acentos_e_caixa():
    # Mesmo venue com acentos, caixa diferente, espaços extras
    a = match_venue("ALLIANZ PARQUE")
    b = match_venue("Allianz   Parque")
    c = match_venue("allianz parque")
    assert a is not None and a.name == "Allianz Parque"
    assert b is not None and b.name == "Allianz Parque"
    assert c is not None and c.name == "Allianz Parque"


def test_match_returns_none_quando_desconhecido():
    assert match_venue("Bar Esquina do João, Vila Mariana") is None
    assert match_venue("") is None
    assert match_venue(None) is None  # type: ignore[arg-type]


def test_match_prefere_alias_mais_especifico():
    # 'Allianz Parque' deve bater com 'allianz parque' antes de qualquer
    # alias mais genérico que possa ter
    info = match_venue("Allianz Parque - sector vermelho")
    assert info is not None
    assert info.name == "Allianz Parque"


def test_venues_data_sanity():
    """Cada VenueInfo deve ter dados plausíveis."""
    for aliases, info in VENUES:
        assert info.name and len(info.name) > 2
        assert -25 < info.lat < -22, f"{info.name} lat fora de SP"
        assert -47 < info.lng < -45, f"{info.name} lng fora de SP"
        assert info.venue_type in {
            "stadium",
            "convention_center",
            "theater",
            "arena",
            "park",
            "other",
        }, f"{info.name} venue_type inválido: {info.venue_type}"
        if info.capacity is not None:
            assert info.capacity > 0
        # Aliases não vazios e em lowercase
        assert len(aliases) > 0
        for a in aliases:
            assert a == a.lower(), f"alias deve estar lowercase: '{a}'"
            assert a == " ".join(a.split()), f"alias com espaços extras: '{a}'"
