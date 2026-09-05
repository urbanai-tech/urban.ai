"""Disk-backed, at-least-once delivery queue without stored authentication secrets."""

import json
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from uuid import uuid4


class IngestOutbox:
    """Persist events until acknowledgment; lease batches across local workers."""

    def __init__(self, path: str, namespace: str):
        self.path = Path(path).expanduser().resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.namespace = namespace
        with closing(self._connect()) as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                "CREATE TABLE IF NOT EXISTS pending_events (id INTEGER PRIMARY KEY AUTOINCREMENT, namespace TEXT NOT NULL, payload TEXT NOT NULL, owner TEXT, lease_until REAL NOT NULL DEFAULT 0)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS pending_namespace ON pending_events(namespace, lease_until, id)"
            )
            connection.execute(
                "CREATE TABLE IF NOT EXISTS rejected_events (id INTEGER PRIMARY KEY AUTOINCREMENT, namespace TEXT NOT NULL, payload TEXT NOT NULL, reason TEXT NOT NULL, rejected_at REAL NOT NULL, requeued INTEGER NOT NULL DEFAULT 0)"
            )

    def _connect(self):
        return sqlite3.connect(str(self.path), timeout=30, isolation_level=None)

    def enqueue(self, event: dict) -> None:
        """Persist before acknowledging receipt to the collector."""
        payload = json.dumps(event, ensure_ascii=False, allow_nan=False)
        with closing(self._connect()) as connection:
            connection.execute(
                "INSERT INTO pending_events(namespace, payload) VALUES (?, ?)",
                (self.namespace, payload),
            )

    def claim(self, limit: int, lease_seconds: int = 600) -> tuple[str, list[dict]]:
        """Reserve a bounded batch; abandoned leases become eligible again."""
        owner = uuid4().hex
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                rows = connection.execute(
                    "SELECT id, payload FROM pending_events WHERE namespace = ? AND lease_until <= ? ORDER BY id LIMIT ?",
                    (self.namespace, time.time(), limit),
                ).fetchall()
                connection.executemany(
                    "UPDATE pending_events SET owner = ?, lease_until = ? WHERE id = ?",
                    [(owner, time.time() + lease_seconds, row[0]) for row in rows],
                )
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        return owner, [json.loads(row[1]) for row in rows]

    def acknowledge(self, owner: str, outcomes: list[dict] | None = None) -> None:
        """Atomically preserve rejected events before removing the acknowledged batch."""
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                if outcomes is not None:
                    rows = connection.execute(
                        "SELECT payload FROM pending_events WHERE namespace = ? AND owner = ? ORDER BY id",
                        (self.namespace, owner),
                    ).fetchall()
                    if len(rows) != len(outcomes):
                        raise RuntimeError(
                            "Batch ownership changed before acknowledgment"
                        )
                    for row, outcome in zip(rows, outcomes, strict=True):
                        if outcome.get("status") == "skipped":
                            connection.execute(
                                "INSERT INTO rejected_events(namespace, payload, reason, rejected_at) VALUES (?, ?, ?, ?)",
                                (
                                    self.namespace,
                                    row[0],
                                    str(outcome.get("reason") or "unspecified")[:1000],
                                    time.time(),
                                ),
                            )
                connection.execute(
                    "DELETE FROM pending_events WHERE namespace = ? AND owner = ?",
                    (self.namespace, owner),
                )
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def status(self) -> dict[str, int]:
        """Expose operational counts without event payloads or credentials."""
        with closing(self._connect()) as connection:
            pending = connection.execute(
                "SELECT COUNT(*), COALESCE(SUM(lease_until > ?), 0) FROM pending_events WHERE namespace = ?",
                (time.time(), self.namespace),
            ).fetchone()
            rejected = connection.execute(
                "SELECT COUNT(*) FROM rejected_events WHERE namespace = ? AND requeued = 0",
                (self.namespace,),
            ).fetchone()[0]
        return {"pending": pending[0], "leased": pending[1], "rejected": rejected}

    def requeue(self, rejection_id: int) -> bool:
        """Requeue a reviewed rejection once, preserving its historical record."""
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                row = connection.execute(
                    "SELECT payload FROM rejected_events WHERE namespace = ? AND id = ? AND requeued = 0",
                    (self.namespace, rejection_id),
                ).fetchone()
                if row:
                    connection.execute(
                        "INSERT INTO pending_events(namespace, payload) VALUES (?, ?)",
                        (self.namespace, row[0]),
                    )
                    connection.execute(
                        "UPDATE rejected_events SET requeued = 1 WHERE namespace = ? AND id = ?",
                        (self.namespace, rejection_id),
                    )
                connection.commit()
                return row is not None
            except Exception:
                connection.rollback()
                raise

    def release(self, owner: str) -> None:
        """Permit immediate retry after a known failure."""
        with closing(self._connect()) as connection:
            connection.execute(
                "UPDATE pending_events SET owner = NULL, lease_until = 0 WHERE namespace = ? AND owner = ?",
                (self.namespace, owner),
            )

    def count(self) -> int:
        """Count queued and leased events for this destination."""
        with closing(self._connect()) as connection:
            return connection.execute(
                "SELECT COUNT(*) FROM pending_events WHERE namespace = ?",
                (self.namespace,),
            ).fetchone()[0]


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Inspect local event delivery without sending requests"
    )
    parser.add_argument("path")
    parser.add_argument("--destination", required=True)
    options = parser.parse_args()
    if not Path(options.path).expanduser().is_file():
        parser.error("Outbox file does not exist")
    print(  # noqa: T201 - CLI emits only operational counts as JSON.
        json.dumps(IngestOutbox(options.path, options.destination.rstrip("/")).status())
    )
