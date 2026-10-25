"""Tests do UrbanBackendClient — API key, buffer, batch, validação de resposta."""

from unittest.mock import MagicMock, patch

import pytest

from urban_webscrapping.utils.urban_backend_client import (
    UrbanBackendClient,
    UrbanBackendError,
)


def _ok(total: int = 1, created: int | None = None) -> dict:
    created = total if created is None else created
    return {
        "total": total,
        "created": created,
        "updated": total - created,
        "skipped": 0,
        "results": [{"status": "created"}] * created
        + [{"status": "updated"}] * (total - created),
    }


@pytest.fixture
def client():
    return UrbanBackendClient(
        api_base="https://api.test", ingest_api_key="synthetic-key", batch_size=3
    )


def _mock_response(status: int, body: dict | str = ""):
    m = MagicMock()
    m.status_code = status
    m.json.return_value = body if isinstance(body, dict) else {}
    m.text = body if isinstance(body, str) else ""
    return m


# ============================ from_env ============================


def test_from_env_lança_sem_api_key(monkeypatch):
    monkeypatch.delenv("URBAN_EVENTS_INGEST_API_KEY", raising=False)
    # Credenciais legadas não bastam mais: o backend só aceita a API key.
    monkeypatch.setenv("URBAN_COLLECTOR_EMAIL", "bot@x.com")
    monkeypatch.setenv("URBAN_COLLECTOR_PASSWORD", "p")
    with pytest.raises(ValueError, match="URBAN_EVENTS_INGEST_API_KEY"):
        UrbanBackendClient.from_env()


def test_from_env_usa_api_key_e_outbox(monkeypatch, tmp_path):
    outbox = tmp_path / "queue.sqlite3"
    monkeypatch.setenv("URBAN_API_BASE", "https://api.x")
    monkeypatch.setenv("URBAN_EVENTS_INGEST_API_KEY", "ingest-secret")
    monkeypatch.setenv("URBAN_COLLECTOR_NAME", "sp-cultura")
    monkeypatch.setenv("URBAN_COLLECTOR_VERSION", "sha-123")
    monkeypatch.setenv("URBAN_INGEST_RUN_ID", "run-1")
    monkeypatch.setenv("URBAN_INGEST_OUTBOX_PATH", str(outbox))

    c = UrbanBackendClient.from_env()

    assert c.api_base == "https://api.x"
    assert c.ingest_api_key == "ingest-secret"
    assert c.collector_name == "sp-cultura"
    assert c.collector_version == "sha-123"
    assert c.ingest_run_id == "run-1"
    assert outbox.exists()
    assert not c.outbox_degraded


def test_from_env_degrada_para_memoria_com_erro_se_outbox_inacessivel(
    monkeypatch, tmp_path, caplog
):
    blocker = tmp_path / "arquivo"
    blocker.write_text("não é diretório")
    monkeypatch.setenv("URBAN_EVENTS_INGEST_API_KEY", "k")
    monkeypatch.setenv("URBAN_INGEST_OUTBOX_PATH", str(blocker / "q.sqlite3"))
    with caplog.at_level("ERROR"):
        c = UrbanBackendClient.from_env()
    assert c.outbox_degraded
    assert "SEM durabilidade" in caplog.text


def test_construtor_exige_api_key():
    with pytest.raises(ValueError, match="URBAN_EVENTS_INGEST_API_KEY"):
        UrbanBackendClient("https://api.x")


def test_constructor_rejeita_batch_size_invalido():
    with pytest.raises(ValueError, match="batch_size"):
        UrbanBackendClient("https://api.x", 0, ingest_api_key="k")


# ============================ Buffer / batch ============================


def test_add_event_bufferiza_até_batch_size(client):
    with patch.object(client, "_post_ingest") as post:
        post.return_value = _ok(3)
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
        assert client.buffer_size() == 2
        with pytest.raises(UrbanBackendError):
            client.flush()
        assert client.buffer_size() == 2


# ============================ POST /events/ingest ============================


def test_post_ingest_usa_api_key_e_metadados():
    client = UrbanBackendClient(
        api_base="https://api.test",
        ingest_api_key="ingest-secret",
        collector_name="sp-cultura",
        collector_version="sha-123",
        ingest_run_id="run-1",
        batch_size=3,
    )

    with patch.object(client._session, "post") as post:
        post.return_value = _mock_response(200, _ok(1))
        client.add_event({"nome": "A", "dataInicio": "2026-05-10"})
        result = client.flush()
        assert result is not None

        assert post.call_count == 1
        headers = post.call_args.kwargs["headers"]
        assert headers["x-urban-events-ingest-key"] == "ingest-secret"
        assert headers["x-urban-collector"] == "sp-cultura"
        assert headers["x-urban-collector-version"] == "sha-123"
        assert headers["x-urban-ingest-run-id"] == "run-1"
        assert "Authorization" not in headers


@pytest.mark.parametrize("status", [401, 403])
def test_post_ingest_recusa_da_chave_preserva_lote_sem_retry(client, status):
    with patch.object(client._session, "post") as post:
        post.return_value = _mock_response(status, "invalid key")
        client.add_event({"nome": "A", "dataInicio": "2026-05-10"})

        with pytest.raises(UrbanBackendError, match="recusou a API key"):
            client.flush()

        assert post.call_count == 1
    assert client.buffer_size() == 1
