"""Fila persistente: crash, lease, backoff, quarentena e teto, em arquivos SQLite reais."""

import json
import sqlite3
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import pytest

from urban_webscrapping.utils.ingest_outbox import IngestOutbox, backoff_seconds
from urban_webscrapping.utils.urban_backend_client import (
    UrbanBackendClient,
    UrbanBackendError,
)

TIME = "urban_webscrapping.utils.ingest_outbox.time.time"


def _ok(total: int) -> dict:
    return {
        "total": total,
        "created": total,
        "updated": 0,
        "skipped": 0,
        "results": [{"status": "created"}] * total,
    }


def test_failed_close_flush_survives_new_client_instance(tmp_path):
    """Perda de lote: close() falho NÃO descarta; outra execução entrega."""
    path = str(tmp_path / "pending.sqlite3")
    first = UrbanBackendClient(
        "https://api.invalid", ingest_api_key="secret", outbox_path=path
    )
    first.add_event({"nome": "persisted event", "source": "scraper-x"})
    with patch.object(first, "_post_ingest", side_effect=UrbanBackendError("offline")):
        with pytest.raises(UrbanBackendError):
            first.close()

    second = UrbanBackendClient(
        "https://api.invalid", ingest_api_key="rotated-secret", outbox_path=path
    )
    assert second.buffer_size() == 1
    # Backoff da falha anterior: ainda não elegível (30s).
    assert second.drain() is None
    with patch(TIME, return_value=10**10):
        with patch.object(second, "_post_ingest", return_value=_ok(1)) as send:
            second.close()
    assert send.call_args.args[0] == [
        {"nome": "persisted event", "source": "scraper-x"}
    ]
    assert second.buffer_size() == 0
    raw = (tmp_path / "pending.sqlite3").read_bytes()
    assert b"rotated-secret" not in raw
    assert b"secret" not in raw


def test_backend_down_then_up_delivers_everything_in_order(tmp_path):
    path = str(tmp_path / "queue.sqlite3")
    client = UrbanBackendClient(
        "https://api.invalid", batch_size=2, ingest_api_key="k", outbox_path=path
    )
    with patch.object(client, "_post_ingest", side_effect=UrbanBackendError("503")):
        client.add_event({"nome": "e1"})
        with pytest.raises(UrbanBackendError):
            client.add_event({"nome": "e2"})  # enche o lote e falha
        with pytest.raises(UrbanBackendError):
            client.add_event({"nome": "e3"})  # e1/e2 em backoff; e3 também falha
    assert client.buffer_size() == 3
    assert client.outbox_status()["deferred"] == 3
    sent = []

    def backend_up(events):
        sent.extend(e["nome"] for e in events)
        return _ok(len(events))

    with patch(TIME, return_value=10**10):
        with patch.object(client, "_post_ingest", side_effect=backend_up):
            summary = client.drain()
    assert sent == ["e1", "e2", "e3"]
    assert summary == {"total": 3, "created": 3, "updated": 0, "skipped": 0}
    assert client.buffer_size() == 0


def test_backoff_grows_and_is_capped():
    assert [backoff_seconds(n) for n in (1, 2, 3)] == [30, 60, 120]
    assert backoff_seconds(50) == 3600


def test_release_applies_backoff_per_attempt(tmp_path):
    queue = IngestOutbox(str(tmp_path / "queue.sqlite3"), "dest")
    queue.enqueue({"nome": "event"})
    with patch(TIME, return_value=1000):
        owner, _ = queue.claim(10)
        queue.release(owner, "boom")
        assert queue.claim(10)[1] == []  # em backoff
        assert queue.status()["deferred"] == 1
    with patch(TIME, return_value=1031):
        owner, events = queue.claim(10)
        assert len(events) == 1
        queue.release(owner, "boom again")  # 2ª falha: 60s
    with patch(TIME, return_value=1031 + 59):
        assert queue.claim(10)[1] == []
    with patch(TIME, return_value=1031 + 61):
        assert len(queue.claim(10)[1]) == 1


def test_crashed_worker_lease_expires_without_losing_event(tmp_path):
    queue = IngestOutbox(str(tmp_path / "queue.sqlite3"), "destination")
    queue.enqueue({"nome": "event"})
    with patch(TIME, return_value=1000):
        old_owner, first = queue.claim(10)
        assert len(first) == 1
        assert queue.claim(10)[1] == []
    with patch(TIME, return_value=1601):
        new_owner, second = queue.claim(10)
    assert second == first
    with pytest.raises(RuntimeError):
        queue.acknowledge(old_owner, [{"status": "created"}])
    assert queue.count() == 1
    queue.acknowledge(new_owner)
    assert queue.count() == 0


def test_concurrent_workers_claim_disjoint_batches(tmp_path):
    queue = IngestOutbox(str(tmp_path / "queue.sqlite3"), "destination")
    for index in range(20):
        queue.enqueue({"nome": str(index)})
    with ThreadPoolExecutor(max_workers=4) as pool:
        batches = list(pool.map(lambda _: queue.claim(5), range(4)))
    names = [event["nome"] for _, events in batches for event in events]
    assert len(names) == len(set(names)) == 20
    for owner, _ in batches:
        queue.acknowledge(owner)
    assert queue.count() == 0


def test_destinations_do_not_mix_in_the_same_file(tmp_path):
    path = str(tmp_path / "queue.sqlite3")
    first = IngestOutbox(path, "https://first.invalid")
    second = IngestOutbox(path, "https://second.invalid")
    first.enqueue({"nome": "first only"})
    assert second.claim(10)[1] == []
    assert second.count() == 0
    assert first.count() == 1


def test_abrupt_process_exit_preserves_committed_event(tmp_path):
    """Crash no meio do lote: processo morre sem fechar nada."""
    path = str(tmp_path / "crash.sqlite3")
    subprocess.run(
        [
            sys.executable,
            "-c",
            "import os,sys; from urban_webscrapping.utils.ingest_outbox import IngestOutbox; "
            "q=IngestOutbox(sys.argv[1], 'destination'); q.enqueue({'nome':'a'}); "
            "q.enqueue({'nome':'survived crash'}); q.claim(1); os._exit(0)",
            path,
        ],
        check=True,
        timeout=30,
    )
    queue = IngestOutbox(path, "destination")
    assert queue.count() == 2
    with patch(TIME, return_value=10**10):  # lease do processo morto expirou
        assert [e["nome"] for e in queue.claim(10)[1]] == ["a", "survived crash"]


def test_wal_mode_enabled(tmp_path):
    path = tmp_path / "queue.sqlite3"
    IngestOutbox(str(path), "dest")
    connection = sqlite3.connect(str(path))
    try:
        assert connection.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    finally:
        connection.close()


def test_quarantine_keeps_rejected_with_reason_and_source(tmp_path):
    queue = IngestOutbox(str(tmp_path / "queue.sqlite3"), "destination")
    queue.enqueue({"nome": "accepted", "source": "scraper-a"})
    queue.enqueue({"nome": "needs review", "source": "scraper-b"})
    owner, _ = queue.claim(10)
    quarantined = queue.acknowledge(
        owner, [{"status": "created"}, {"status": "skipped", "reason": "invalid date"}]
    )
    assert quarantined == 1
    assert queue.status() == {"pending": 0, "leased": 0, "deferred": 0, "rejected": 1}
    [rejection] = queue.rejections()
    assert rejection["source"] == "scraper-b"
    assert rejection["reason"] == "invalid date"
    other = IngestOutbox(str(tmp_path / "queue.sqlite3"), "another destination")
    assert not other.requeue(rejection["id"])
    assert queue.requeue(rejection["id"])
    assert not queue.requeue(rejection["id"])
    assert queue.claim(10)[1] == [{"nome": "needs review", "source": "scraper-b"}]
    assert queue.status()["rejected"] == 0


def test_acknowledgment_mismatch_preserves_pending_batch(tmp_path):
    queue = IngestOutbox(str(tmp_path / "queue.sqlite3"), "destination")
    queue.enqueue({"nome": "pending"})
    owner, _ = queue.claim(10)
    with pytest.raises(RuntimeError, match="ownership"):
        queue.acknowledge(owner, [])
    assert queue.count() == 1
    assert queue.status()["rejected"] == 0


def test_failure_removing_batch_rolls_back_rejection_record(tmp_path):
    path = str(tmp_path / "queue.sqlite3")
    queue = IngestOutbox(path, "destination")
    queue.enqueue({"nome": "pending"})
    owner, _ = queue.claim(10)
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            "CREATE TRIGGER fail_ack BEFORE DELETE ON pending_events "
            "BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END"
        )
        connection.commit()
    finally:
        connection.close()
    with pytest.raises(sqlite3.IntegrityError, match="storage failure"):
        queue.acknowledge(owner, [{"status": "skipped", "reason": "invalid"}])
    assert queue.count() == 1
    assert queue.status()["rejected"] == 0


def test_size_cap_rotates_oldest_pending_into_quarantine(tmp_path, caplog):
    queue = IngestOutbox(str(tmp_path / "queue.sqlite3"), "dest", max_pending=3)
    with caplog.at_level("ERROR"):
        evicted = [queue.enqueue({"nome": f"e{i}", "source": "s"}) for i in range(5)]
    assert evicted == [0, 0, 0, 1, 1]
    assert queue.count() == 3
    owner, events = queue.claim(10)
    assert [e["nome"] for e in events] == ["e2", "e3", "e4"]
    assert {r["reason"] for r in queue.rejections()} == {"outbox_cap_exceeded"}
    assert queue.status()["rejected"] == 2
    assert "acima do teto" in caplog.text


def test_cap_never_evicts_events_under_lease(tmp_path):
    queue = IngestOutbox(str(tmp_path / "queue.sqlite3"), "dest", max_pending=2)
    queue.enqueue({"nome": "leased-1"})
    queue.enqueue({"nome": "leased-2"})
    queue.claim(10)
    queue.enqueue({"nome": "new"})  # excede, mas só há itens em lease
    assert queue.count() == 3
    assert queue.status()["rejected"] == 0


def test_rejected_table_is_trimmed(tmp_path):
    queue = IngestOutbox(str(tmp_path / "queue.sqlite3"), "dest", max_rejected=2)
    for i in range(4):
        queue.enqueue({"nome": f"e{i}"})
    owner, _ = queue.claim(10)
    queue.acknowledge(
        owner, [{"status": "skipped", "reason": f"r{i}"} for i in range(4)]
    )
    assert [r["reason"] for r in queue.rejections()] == ["r3", "r2"]


def test_status_command_exposes_counts_without_event_contents(tmp_path):
    path = str(tmp_path / "queue.sqlite3")
    queue = IngestOutbox(path, "https://api.invalid")
    queue.enqueue({"nome": "not for command output"})
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "urban_webscrapping.utils.ingest_outbox",
            path,
            "--destination",
            "https://api.invalid/",
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert json.loads(result.stdout) == {
        "pending": 1,
        "leased": 0,
        "deferred": 0,
        "rejected": 0,
    }
    assert "not for command output" not in result.stdout
