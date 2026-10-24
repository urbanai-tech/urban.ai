"""Datas de eventos com fuso explícito (convenção D3).

Convenção do Urban AI para o campo `dataInicio`/`dataFim` enviado ao backend:

* **datetime** -> ISO-8601 COM offset de America/Sao_Paulo
  (ex.: ``2026-05-10T21:30:00-03:00``). Fontes em UTC (API-Football,
  Ticketmaster) são convertidas para o horário de São Paulo; fontes que só dão
  "horário de parede" (sem fuso) são interpretadas como São Paulo.
* **data pura** (``YYYY-MM-DD`` ou ``datetime.date``) -> permanece data pura
  (evento de dia inteiro); o backend a trata como dia inteiro em São Paulo.
* Valor ilegível -> devolvido como veio (o backend rejeita/pula).

O backend aceita qualquer ISO com offset como instante absoluto, então a escolha
"offset de SP" (e não ``Z``) é só de legibilidade: o dia de calendário do
payload é o dia que o usuário vê.
"""

from __future__ import annotations

import re
from datetime import UTC, date, datetime, timedelta, timezone, tzinfo
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

try:  # tzdata pode faltar em ambientes mínimos (ex.: Windows sem pacote tzdata)
    SP_TZ: tzinfo = ZoneInfo("America/Sao_Paulo")
except ZoneInfoNotFoundError:  # pragma: no cover - depende do ambiente
    # Brasil não tem horário de verão desde 2019: offset fixo UTC-3 é exato
    # para eventos futuros.
    SP_TZ = timezone(timedelta(hours=-3), "America/Sao_Paulo")

_DATE_ONLY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def to_sp_iso(value: Any) -> str | None:
    """Converte `value` para a representação ISO da convenção D3.

    Aceita ``datetime`` (aware ou naive), ``date`` e ``str`` ISO-8601.
    Retorna ``None`` para vazio. Strings não-ISO são devolvidas inalteradas.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return _datetime_to_sp_iso(value)
    if isinstance(value, date):
        return value.isoformat()

    text = str(value).strip()
    if not text or _DATE_ONLY_RE.match(text):
        # vazio -> None; data pura (válida ou não) segue como veio
        return text or None

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return text
    return _datetime_to_sp_iso(parsed)


def _datetime_to_sp_iso(value: datetime) -> str:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        aware = value.replace(tzinfo=SP_TZ)
    else:
        aware = value.astimezone(SP_TZ)
    return aware.replace(microsecond=0).isoformat()


def utc_to_sp_iso(value: str) -> str:
    """Como `to_sp_iso`, mas trata texto SEM offset como UTC (não São Paulo)."""
    text = value.strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return text
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return _datetime_to_sp_iso(parsed)
