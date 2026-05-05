"""Tests do UrbanBackendClient — auth, buffer, batch, retry, fail-soft."""

import os
from unittest.mock import MagicMock, patch

import pytest

from urban_webscrapping.utils.urban_backend_client import (
    UrbanBackendClient,
    UrbanBackendError,
)


@pytest.fixture
def client():
    return UrbanBackendClient(
        api_base="https://api.test",
        email="bot@test.com",
        password="secret",
        batch_size=3,
    )


def _mock_response(status: int, body: dict | str = ""):
    m = MagicMock()
    m.status_code = status
    m.json.return_value = body if isinstance(body, dict) else {}
    m.text = body if isinstance(body, str) else ""
    return m


# ============================ from_env ============================


def test_from_env_lança_se_credenciais_faltam(monkeypatch):
    monkeypatch.delenv("URBAN_COLLECTOR_EMAIL", raising=False)
    monkeypatch.delenv("URBAN_COLLECTOR_PASSWORD", raising=False)
    with pytest.raises(ValueError, match="URBAN_COLLECTOR"):
        UrbanBackendClient.from_env()


def test_from_env_constrói_quando_credenciais_presentes(monkeypatch):
    monkeypatch.setenv("URBAN_API_BASE", "https://api.x")
    monkeypatch.setenv("URBAN_COLLECTOR_EMAIL", "bot@x.com")
    monkeypatch.setenv("URBAN_COLLECTOR_PASSWORD", "p")
    c = UrbanBackendClient.from_env()
    assert c.api_base == "https://api.x"
    assert c.email == "bot@x.com"


# ============================ Buffer / batch ============================


def test_add_event_bufferiza_até_batch_size(client):
    with patch.object(client, "_post_ingest") as post:
        post.return_value = {"total": 3, "created": 3, "updated": 0, "skipped": 0}
        client.add_event({"nome": "A", "dataInicio": "2026-05-10"})
        client.add_event({"nome": "B", "dataInicio": "2026-05-10"})
        assert post.call_count == 0
        assert client.buffer_size() == 2

        # Terceiro dispara flush automático (batch_size=3)
        client.add_event({"nome": "C", "dataInicio": "2026-05-10"})
        assert post.call_count == 1
        assert client.buffer_size() == 0


def test_add_event_ignora_sem_nome(client):
    client.add_event({"dataInicio": "2026-05-10"})  # sem nome
    client.add_event({"nome": "", "dataInicio": "2026-05-10"})
    assert client.buffer_size() == 0


def test_flush_vazio_retorna_none(client):
    assert client.flush() is None


def test_flush_repõe_buffer_em_caso_de_erro(client):
    with patch.object(client, "_post_ingest", side_effect=UrbanBackendError("net")):
        client.add_event({"nome": "A", "dataInicio": "2026-05-10"})
        client.add_event({"nome": "B", "dataInicio": "2026-05-10"})
        # 2 events, batch_size=3, ainda sem auto-flush
        assert client.buffer_size() == 2

        # Flush explícito que falha → exception sobe MAS buffer é
        # restaurado para retry no próximo flush.
        with pytest.raises(UrbanBackendError):
            client.flush()
        assert client.buffer_size() == 2


# ============================ Login ============================


def test_login_seta_token_e_cacheia(client):
    with patch.object(client._session, "post") as post:
        post.return_value = _mock_response(200, {"accessToken": "tok-abc"})
        token = client._login()
        assert token == "tok-abc"
        assert client._token == "tok-abc"


def test_ensure_token_reutiliza_token_dentro_da_janela(client):
    with patch.object(client._session, "post") as post:
        post.return_value = _mock_response(200, {"accessToken": "first"})
        client._ensure_token()
        # Segunda chamada não deve refazer login
        client._ensure_token()
        assert post.call_count == 1


def test_login_falha_lança_UrbanBackendError(client):
    with patch.object(client._session, "post") as post:
        post.return_value = _mock_response(401, "invalid creds")
        with pytest.raises(UrbanBackendError, match="Login falhou"):
            client._login()


def test_login_sem_accessToken_no_response(client):
    with patch.object(client._session, "post") as post:
        post.return_value = _mock_response(200, {"foo": "bar"})
        with pytest.raises(UrbanBackendError, match="accessToken"):
            client._login()


# ============================ POST /events/ingest ============================


def test_post_ingest_inclui_authorization_header(client):
    with patch.object(client._session, "post") as post:
        # 1ª chamada = login, 2ª = ingest
        post.side_effect = [
            _mock_response(200, {"accessToken": "tok"}),
            _mock_response(
                200,
                {"total": 1, "created": 1, "updated": 0, "skipped": 0},
            ),
        ]
        client.add_event({"nome": "A", "dataInicio": "2026-05-10"})
        # batch_size=3, manualmente flush
        result = client.flush()
        assert result is not None
        assert result["created"] == 1

        # Conferir headers da 2ª chamada
        ingest_call = post.call_args_list[1]
        headers = ingest_call.kwargs["headers"]
        assert headers["Authorization"] == "Bearer tok"


def test_post_ingest_em_401_refaz_login_e_retenta(client):
    with patch.object(client._session, "post") as post:
        post.side_effect = [
            _mock_response(200, {"accessToken": "tok-velho"}),
            _mock_response(401, "expired"),
            _mock_response(200, {"accessToken": "tok-novo"}),
            _mock_response(
                200,
                {"total": 1, "created": 1, "updated": 0, "skipped": 0},
            ),
        ]
        client.add_event({"nome": "A", "dataInicio": "2026-05-10"})
        result = client.flush()
        assert result is not None
        # 4 chamadas: login, ingest 401, login refresh, ingest OK
        assert post.call_count == 4
