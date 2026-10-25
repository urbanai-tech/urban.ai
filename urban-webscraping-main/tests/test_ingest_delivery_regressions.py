"""Regressões: habilitação só com API key, resposta validada, rejeições logadas."""

from unittest.mock import MagicMock, patch

import pytest
import requests

from urban_webscrapping.collectors import run_all
from urban_webscrapping.pipelines import UrbanIngestPipeline
from urban_webscrapping.utils.urban_backend_client import (
    UrbanBackendClient,
    UrbanBackendError,
)

ENV_KEYS = (
    "URBAN_EVENTS_INGEST_API_KEY",
    "URBAN_COLLECTOR_EMAIL",
    "URBAN_COLLECTOR_PASSWORD",
    "ENVIRONMENT",
    "APP_ENV",
    "NODE_ENV",
    "RAILWAY_ENVIRONMENT",
    "RAILWAY_ENVIRONMENT_NAME",
)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for key in ENV_KEYS:
        monkeypatch.delenv(key, raising=False)


def _response(body, status=200):
    response = MagicMock(status_code=status, text="detail")
    response.json.return_value = body
    return response


def _skipped(reason="invalid date"):
    return {
        "total": 1,
        "created": 0,
        "updated": 0,
        "skipped": 1,
        "results": [{"status": "skipped", "reason": reason}],
    }


# ---------------------------------------------------------------- habilitação


def test_pipeline_activates_with_only_scoped_api_key(monkeypatch):
    monkeypatch.setenv("URBAN_EVENTS_INGEST_API_KEY", "synthetic-key")
    with patch.object(
        UrbanBackendClient, "from_env", return_value=MagicMock(outbox_degraded=False)
    ) as factory:
        pipeline = UrbanIngestPipeline()
    assert pipeline.enabled
    factory.assert_called_once()


def test_pipeline_ignores_legacy_email_password(monkeypatch):
    monkeypatch.setenv("URBAN_COLLECTOR_EMAIL", "bot@x.com")
    monkeypatch.setenv("URBAN_COLLECTOR_PASSWORD", "p")
    pipeline = UrbanIngestPipeline()
    assert not pipeline.enabled
    assert pipeline.client is None


def test_pipeline_fails_loudly_in_production_without_key(monkeypatch, caplog):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")
    stats = MagicMock()
    with caplog.at_level("ERROR"):
        pipeline = UrbanIngestPipeline(stats=stats)
    assert not pipeline.enabled
    assert "NÃO configurada em produção" in caplog.text
    stats.set_value.assert_called_with("urban_ingest/misconfigured", 1)


def test_pipeline_only_warns_in_dev_without_key(caplog):
    stats = MagicMock()
    with caplog.at_level("WARNING"):
        UrbanIngestPipeline(stats=stats)
    assert not any(r.levelname == "ERROR" for r in caplog.records)
    stats.set_value.assert_not_called()


def test_pipeline_reports_pending_events_after_failed_close(
    monkeypatch, tmp_path, caplog
):
    monkeypatch.setenv("URBAN_EVENTS_INGEST_API_KEY", "k")
    monkeypatch.setenv("URBAN_INGEST_OUTBOX_PATH", str(tmp_path / "q.sqlite3"))
    stats = MagicMock()
    pipeline = UrbanIngestPipeline(stats=stats)
    pipeline.client.add_event({"nome": "A", "source": "scraper-x"})
    spider = MagicMock()
    spider.name = "x"
    with patch.object(
        pipeline.client, "_post_ingest", side_effect=UrbanBackendError("offline")
    ):
        with caplog.at_level("ERROR"):
            pipeline.close_spider(spider)
    values = {c.args[0]: c.args[1] for c in stats.set_value.call_args_list}
    assert values["urban_ingest/delivery_failed"] == 1
    assert values["urban_ingest/pending_after_close"] == 1
    assert "NÃO confirmados" in caplog.text


def test_run_all_requires_api_key_not_email_password(monkeypatch, capsys):
    monkeypatch.setenv("URBAN_COLLECTOR_EMAIL", "bot@x.com")
    monkeypatch.setenv("URBAN_COLLECTOR_PASSWORD", "p")
    monkeypatch.delenv("DRY_RUN", raising=False)
    with patch.object(run_all, "load_dotenv"):
        assert run_all.main() == 1
    assert "URBAN_EVENTS_INGEST_API_KEY" in capsys.readouterr().out


# ----------------------------------------------------- lote não confirmado


@pytest.mark.parametrize(
    "failure", [ValueError("invalid JSON"), requests.ConnectionError("refresh failed")]
)
def test_nonstandard_failure_keeps_entire_batch_for_retry(failure):
    client = UrbanBackendClient(
        "https://api.invalid", ingest_api_key="synthetic", batch_size=2
    )
    with patch.object(client, "_post_ingest", side_effect=failure):
        client.add_event({"nome": "first"})
        with pytest.raises(UrbanBackendError, match="preservado"):
            client.add_event({"nome": "second"})
    assert client.buffer_size() == 2
    ok = {
        "total": 2,
        "created": 2,
        "updated": 0,
        "skipped": 0,
        "results": [{"status": "created"}] * 2,
    }
    with patch.object(client, "_post_ingest", return_value=ok) as post:
        client.flush()
    assert post.call_args.args[0] == [{"nome": "first"}, {"nome": "second"}]
    assert client.buffer_size() == 0


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"total": 1, "created": 0, "updated": 0, "skipped": 0},
        {"total": True, "created": 1, "updated": 0, "skipped": 0},
        {"total": 2, "created": 2, "updated": 0, "skipped": 0},  # lote tinha 1
    ],
)
def test_http_success_without_matching_counts_does_not_acknowledge_batch(body):
    client = UrbanBackendClient("https://api.invalid", ingest_api_key="synthetic")
    client.add_event({"nome": "first"})
    with patch.object(client._session, "post", return_value=_response(body)):
        with pytest.raises(UrbanBackendError, match="confirmação"):
            client.flush()
    assert client.buffer_size() == 1


def test_non_json_success_body_keeps_batch():
    client = UrbanBackendClient("https://api.invalid", ingest_api_key="synthetic")
    client.add_event({"nome": "first"})
    broken = MagicMock(status_code=200)
    broken.json.side_effect = ValueError("no json")
    with patch.object(client._session, "post", return_value=broken):
        with pytest.raises(UrbanBackendError):
            client.flush()
    assert client.buffer_size() == 1


@pytest.mark.parametrize("results", [None, [], [{"status": "created"}]])
def test_skipped_count_requires_consistent_per_event_results(results):
    client = UrbanBackendClient("https://api.invalid", ingest_api_key="synthetic")
    client.add_event({"nome": "pending"})
    body = {
        "total": 1,
        "created": 0,
        "updated": 0,
        "skipped": 1,
        "results": results,
    }
    with patch.object(client._session, "post", return_value=_response(body)):
        with pytest.raises(UrbanBackendError):
            client.flush()
    assert client.buffer_size() == 1


# ------------------------------------------------- rejeições e quarentena


def test_partial_rejection_is_quarantined_and_logged_with_source_and_reason(
    tmp_path, caplog
):
    client = UrbanBackendClient(
        "https://api.invalid",
        ingest_api_key="synthetic",
        outbox_path=str(tmp_path / "queue.sqlite3"),
    )
    client.add_event({"nome": "rejected", "source": "scraper-sympla"})
    with patch.object(client._session, "post", return_value=_response(_skipped())):
        with caplog.at_level("WARNING"):
            client.flush()
    assert client.outbox_status() == {
        "pending": 0,
        "leased": 0,
        "deferred": 0,
        "rejected": 1,
    }
    assert "source=scraper-sympla" in caplog.text
    assert "reason=invalid date" in caplog.text
    assert client.stats["rejected"] == 1
    assert client.stats["received"] == 1


def test_mixed_batch_counts_received_created_updated_rejected(tmp_path):
    client = UrbanBackendClient(
        "https://api.invalid",
        ingest_api_key="synthetic",
        outbox_path=str(tmp_path / "queue.sqlite3"),
    )
    for name in ("a", "b", "c"):
        client.add_event({"nome": name, "source": "s"})
    body = {
        "total": 3,
        "created": 1,
        "updated": 1,
        "skipped": 1,
        "results": [
            {"status": "created"},
            {"status": "updated"},
            {"status": "skipped", "reason": "no coordinates"},
        ],
    }
    with patch.object(client._session, "post", return_value=_response(body)):
        client.flush()
    assert client.stats == {
        "received": 3,
        "created": 1,
        "updated": 1,
        "rejected": 1,
        "failed_flushes": 0,
    }
    assert client.buffer_size() == 0


def test_permanent_http_422_isolates_bad_event_and_delivers_the_rest(tmp_path):
    client = UrbanBackendClient(
        "https://api.invalid",
        ingest_api_key="synthetic",
        outbox_path=str(tmp_path / "queue.sqlite3"),
    )
    for name in ("good-1", "poison", "good-2", "good-3"):
        client.add_event({"nome": name, "source": "s"})

    def fake_post(url, headers, json, timeout):
        events = json["events"]
        if any(e["nome"] == "poison" for e in events):
            return _response({}, status=422)
        return _response(
            {
                "total": len(events),
                "created": len(events),
                "updated": 0,
                "skipped": 0,
                "results": [{"status": "created"}] * len(events),
            }
        )

    with patch.object(client._session, "post", side_effect=fake_post):
        summary = client.drain()
    assert summary["total"] == 4
    assert summary["created"] == 3
    assert summary["skipped"] == 1
    assert client.buffer_size() == 0
    [rejection] = client._outbox.rejections()
    assert rejection["reason"].startswith("http_422")


def test_5xx_is_transient_and_never_quarantines(tmp_path):
    client = UrbanBackendClient(
        "https://api.invalid",
        ingest_api_key="synthetic",
        outbox_path=str(tmp_path / "queue.sqlite3"),
    )
    client.add_event({"nome": "A"})
    with patch.object(client._session, "post", return_value=_response({}, status=503)):
        with pytest.raises(UrbanBackendError):
            client.flush()
    assert client.outbox_status()["rejected"] == 0
    assert client.buffer_size() == 1
