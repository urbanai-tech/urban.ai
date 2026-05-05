"""Mapa hardcoded de venues conhecidos em São Paulo.

Quando um spider raspa um evento e o endereço/local contém o nome de um
desses venues, conseguimos preencher gratuitamente:
  - lat/lng (evita ida ao geocoder)
  - venue_capacity (capacidade física do local)
  - venue_type (stadium, convention_center, theater, etc.)

Os spiders chamam `match_venue(endereco_or_local)` que retorna VenueInfo
ou None. Se None, o item é enviado sem geo e o backend marca pendingGeocode.

Mantém ordenado por especificidade (nomes longos primeiro). Mantém
normalizado em lowercase e ASCII pra match robusto.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class VenueInfo:
    name: str
    lat: float
    lng: float
    capacity: int | None
    venue_type: str  # 'stadium' | 'convention_center' | 'theater' | 'arena' | 'park' | 'other'


# Lista canônica de venues SP. Ordem: nomes longos primeiro pra match correto
# (evita 'Allianz Parque' bater com 'Parque').
VENUES: list[tuple[list[str], VenueInfo]] = [
    # ============ Estádios / Arenas ============
    (
        ["allianz parque", "arena palmeiras", "allianz"],
        VenueInfo("Allianz Parque", -23.5275, -46.6783, 43713, "stadium"),
    ),
    (
        ["morumbi", "estadio do morumbi", "estadio cicero pompeu de toledo"],
        VenueInfo("Estádio do Morumbi", -23.6004, -46.7203, 67428, "stadium"),
    ),
    (
        ["neo quimica arena", "neoquimica arena", "arena corinthians", "itaquerao", "itaquera"],
        VenueInfo("Neo Química Arena", -23.5453, -46.4742, 49205, "stadium"),
    ),
    (
        ["pacaembu", "estadio do pacaembu"],
        VenueInfo("Estádio do Pacaembu", -23.5475, -46.6644, 40199, "stadium"),
    ),
    (
        ["interlagos", "autodromo de interlagos"],
        VenueInfo("Autódromo de Interlagos", -23.7036, -46.6997, 60000, "stadium"),
    ),
    (
        ["arena anhembi", "anhembi arena"],
        VenueInfo("Arena Anhembi", -23.5081, -46.6380, 40000, "arena"),
    ),

    # ============ Centros de Convenção ============
    (
        ["sao paulo expo", "sp expo"],
        VenueInfo("São Paulo Expo", -23.6258, -46.6469, 90000, "convention_center"),
    ),
    (
        ["expo center norte", "expocenter norte"],
        VenueInfo("Expo Center Norte", -23.5179, -46.6193, 50000, "convention_center"),
    ),
    (
        ["transamerica expo", "transamerica expo center"],
        VenueInfo("Transamérica Expo", -23.6233, -46.7050, 30000, "convention_center"),
    ),
    (
        ["distrito anhembi", "anhembi", "centro de exposicoes anhembi"],
        VenueInfo("Anhembi", -23.5079, -46.6377, 35000, "convention_center"),
    ),
    (
        ["frei caneca shopping e centro de convencoes", "frei caneca", "shopping frei caneca"],
        VenueInfo("Frei Caneca", -23.5538, -46.6492, 5000, "convention_center"),
    ),
    (
        ["wtc sao paulo", "world trade center", "wtc events"],
        VenueInfo("WTC São Paulo", -23.6064, -46.6989, 8000, "convention_center"),
    ),
    (
        ["centro de convencoes rebouças", "reboucas"],
        VenueInfo("Centro de Convenções Rebouças", -23.5666, -46.6707, 3000, "convention_center"),
    ),

    # ============ Casas de Show / Arenas Cobertas ============
    (
        ["espaco unimed", "espaco das americas"],
        VenueInfo("Espaço Unimed", -23.5320, -46.6997, 8000, "arena"),
    ),
    (
        ["audio club", "audio sao paulo"],
        VenueInfo("Audio", -23.5414, -46.7009, 5000, "arena"),
    ),
    (
        ["vibra sao paulo", "credicard hall"],
        VenueInfo("Vibra São Paulo", -23.6239, -46.7089, 7300, "arena"),
    ),
    (
        ["tokio marine hall"],
        VenueInfo("Tokio Marine Hall", -23.5829, -46.6947, 5000, "arena"),
    ),

    # ============ Teatros ============
    (
        ["teatro municipal de sao paulo", "theatro municipal"],
        VenueInfo("Theatro Municipal", -23.5455, -46.6388, 1500, "theater"),
    ),
    (
        ["teatro bradesco"],
        VenueInfo("Teatro Bradesco", -23.5301, -46.6925, 1500, "theater"),
    ),
    (
        ["teatro alfa"],
        VenueInfo("Teatro Alfa", -23.6235, -46.7059, 1100, "theater"),
    ),
    (
        ["teatro renault"],
        VenueInfo("Teatro Renault", -23.5503, -46.6432, 1500, "theater"),
    ),

    # ============ Parques / Outdoors ============
    (
        ["parque ibirapuera", "ibirapuera"],
        VenueInfo("Parque Ibirapuera", -23.5874, -46.6576, None, "park"),
    ),
    (
        ["parque villa lobos", "villa lobos"],
        VenueInfo("Parque Villa-Lobos", -23.5455, -46.7244, None, "park"),
    ),

    # ============ Universidades / Acadêmicos ============
    (
        ["fgv eaesp", "fgv sao paulo", "fgv-sp"],
        VenueInfo("FGV São Paulo", -23.5586, -46.6486, 2000, "convention_center"),
    ),
    (
        ["insper"],
        VenueInfo("Insper", -23.5994, -46.6882, 3000, "convention_center"),
    ),
    (
        ["usp", "cidade universitaria"],
        VenueInfo("USP — Cidade Universitária", -23.5605, -46.7320, 5000, "convention_center"),
    ),
]


def _normalize(s: str) -> str:
    """Normaliza string pra comparação: lowercase, ASCII, espaços únicos."""
    if not s:
        return ""
    # Remove acentos
    nfkd = unicodedata.normalize("NFKD", s)
    ascii_str = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(ascii_str.lower().split())


def match_venue(text: str) -> VenueInfo | None:
    """Procura venue conhecido em `text` (geralmente endereço ou local).

    Args:
        text: string de busca, ex: "Allianz Parque - Av. Francisco Matarazzo"

    Returns:
        VenueInfo se reconheceu, None caso contrário.

    Estratégia: itera pela lista canônica em ordem (nomes longos primeiro).
    Primeiro alias que aparece em `text` (substring match) ganha.
    """
    if not text:
        return None

    needle = _normalize(text)

    for aliases, info in VENUES:
        for alias in aliases:
            if alias in needle:
                return info

    return None


def venue_count() -> int:
    """Quantos venues catalogados (útil pra logs/healthcheck)."""
    return len(VENUES)
