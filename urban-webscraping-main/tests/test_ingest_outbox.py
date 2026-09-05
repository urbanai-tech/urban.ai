"""Persistent delivery and lease recovery against actual SQLite files."""

import json
import sqlite3
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import pytest

from urban_webscrapping.utils.ingest_outbox import IngestOutbox
from urban_webscrapping.utils.urban_backend_client import (
    UrbanBackendClient,
    UrbanBackendError,
)


def test_failed_delivery_survives_new_client_instance(tmp_path):
    path = str(tmp_path / "pending.sqlite3")
    first = UrbanBackendClient(
        "https://api.invalid", ingest_api_key="secret", outbox_path=path
    )
    first.add_event({"nome": "persisted event"})
    with patch.object(first, "_post_ingest", side_effect=UrbanBackendError("offline")):
        with pytest.raises(UrbanBackendError):
            first.close()
    second = UrbanBackendClient(
        "https://api.invalid", ingest_api_key="rotated-secret", outbox_path=path
    )
    assert second.buffer_size() == 1
    with patch.object(second, "_post_ingest", return_value={"total": 1}) as send:
        second.close()
    assert send.call_args.args[0] == [{"nome": "persisted event"}]
    assert second.buffer_size() == 0
    raw = (tmp_path / "pending.sqlite3").read_bytes()
    assert b"rotated-secret" not in raw


def test_crashed_worker_lease_expires_without_losing_event(tmp_path):
    queue = IngestOutbox(str(tmp_path / "queue.sqlite3"), "destination")
    queue.enqueue({"nome": "event"})
    with patch("urban_webscrapping.utils.ingest_outbox.time.time", return_value=1000):
        old_owner, first = queue.claim(10)
        assert len(first) == 1
        assert queue.claim(10)[1] == []
    with patch("urban_webscrapping.utils.ingest_outbox.time.time", return_value=1601):
        new_owner, second = queue.claim(10)
    assert second == first
    queue.acknowledge(old_owner)
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
    path = str(tmp_path / "crash.sqlite3")
    subprocess.run(
        [
            sys.executable,
            "-c",
            "import os,sys; from urban_webscrapping.utils.ingest_outbox import IngestOutbox; "
            "q=IngestOutbox(sys.argv[1], 'destination'); q.enqueue({'nome':'survived crash'}); os._exit(0)",
            path,
        ],
        check=True,
        timeout=20,
    )
    queue = IngestOutbox(path, "destination")
    assert queue.claim(10)[1] == [{"nome": "survived crash"}]


def test_partial_rejection_is_retained_and_requeued_only_once(tmp_path):
    queue = IngestOutbox(str(tmp_path / "queue.sqlite3"), "destination")
    queue.enqueue({"nome": "accepted"})
    queue.enqueue({"nome": "needs review"})
    owner, _ = queue.claim(10)
    queue.acknowledge(
        owner, [{"status": "created"}, {"status": "skipped", "reason": "invalid date"}]
    )
    assert queue.status() == {"pending": 0, "leased": 0, "rejected": 1}
    other = IngestOutbox(str(tmp_path / "queue.sqlite3"), "another destination")
    assert not other.requeue(1)
    assert queue.requeue(1)
    assert not queue.requeue(1)
    assert queue.claim(10)[1] == [{"nome": "needs review"}]
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
            "CREATE TRIGGER fail_ack BEFORE DELETE ON pending_events BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END"
        )
        connection.commit()
    finally:
        connection.close()
    with pytest.raises(sqlite3.IntegrityError, match="storage failure"):
        queue.acknowledge(owner, [{"status": "skipped", "reason": "invalid"}])
    assert queue.count() == 1
    assert queue.status()["rejected"] == 0


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
        timeout=20,
    )
    assert json.loads(result.stdout) == {"pending": 1, "leased": 0, "rejected": 0}
    assert "not for command output" not in result.stdout
