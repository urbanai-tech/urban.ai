"""Regressions for API-key activation and unacknowledged batch retention."""

from unittest.mock import MagicMock, patch

import pytest
import requests

from urban_webscrapping.pipelines import UrbanIngestPipeline
from urban_webscrapping.utils.urban_backend_client import (
    UrbanBackendClient,
    UrbanBackendError,
)


def test_pipeline_activates_with_only_scoped_api_key(monkeypatch):
    monkeypatch.setenv("URBAN_EVENTS_INGEST_API_KEY", "synthetic-key")
    monkeypatch.delenv("URBAN_COLLECTOR_EMAIL", raising=False)
    monkeypatch.delenv("URBAN_COLLECTOR_PASSWORD", raising=False)
    with patch.object(
        UrbanBackendClient, "from_env", return_value=MagicMock()
    ) as factory:
        pipeline = UrbanIngestPipeline()
    assert pipeline.enabled
    factory.assert_called_once()


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
    with patch.object(client, "_post_ingest", return_value={"total": 2}) as post:
        client.flush()
    assert post.call_args.args[0] == [{"nome": "first"}, {"nome": "second"}]
    assert client.buffer_size() == 0


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"total": 1, "created": 0, "updated": 0, "skipped": 0},
        {"total": True, "created": 1, "updated": 0, "skipped": 0},
    ],
)
def test_http_success_without_matching_counts_does_not_acknowledge_batch(body):
    client = UrbanBackendClient("https://api.invalid", ingest_api_key="synthetic")
    client.add_event({"nome": "first"})
    response = MagicMock(status_code=200)
    response.json.return_value = body
    with patch.object(client._session, "post", return_value=response):
        with pytest.raises(UrbanBackendError, match="confirmação"):
            client.flush()
    assert client.buffer_size() == 1


@pytest.mark.parametrize("results", [None, [], [{"status": "created"}]])
def test_skipped_count_requires_consistent_per_event_results(results):
    client = UrbanBackendClient("https://api.invalid", ingest_api_key="synthetic")
    client.add_event({"nome": "pending"})
    response = MagicMock(status_code=200)
    response.json.return_value = {
        "total": 1,
        "created": 0,
        "updated": 0,
        "skipped": 1,
        "results": results,
    }
    with patch.object(client._session, "post", return_value=response):
        with pytest.raises(UrbanBackendError):
            client.flush()
    assert client.buffer_size() == 1


def test_http_partial_rejection_is_saved_by_persistent_client(tmp_path):
    client = UrbanBackendClient(
        "https://api.invalid",
        ingest_api_key="synthetic",
        outbox_path=str(tmp_path / "queue.sqlite3"),
    )
    client.add_event({"nome": "rejected"})
    response = MagicMock(status_code=200)
    response.json.return_value = {
        "total": 1,
        "created": 0,
        "updated": 0,
        "skipped": 1,
        "results": [{"status": "skipped", "reason": "invalid date"}],
    }
    with patch.object(client._session, "post", return_value=response):
        client.flush()
    assert client._outbox.status() == {"pending": 0, "leased": 0, "rejected": 1}
