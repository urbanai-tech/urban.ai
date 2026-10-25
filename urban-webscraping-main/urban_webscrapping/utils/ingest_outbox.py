"""Fila SQLite em disco para entrega pelo menos uma vez ao /events/ingest.

Garantias:
  - ``enqueue`` só retorna depois do commit em disco (WAL), então um crash do
    processo depois disso não perde o evento.
  - ``claim`` reserva (lease) um lote; lease abandonado por processo morto
    expira e o lote volta a ser elegível.
  - ``release`` devolve o lote com backoff exponencial por tentativa.
  - ``acknowledge`` remove o lote e põe em quarentena (``rejected_events``) os
    itens que o backend rejeitou em definitivo, junto com o motivo.
  - Tetos de tamanho: ``max_pending`` (rotação: o mais antigo vai para a
    quarentena com motivo ``outbox_cap_exceeded``) e ``max_rejected``.

A idempotência de reenvio é do backend (dedupHash); aqui só garantimos que
nada some sem registro. Nenhum segredo de autenticação é gravado no arquivo.
"""

import json
import logging
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from uuid import uuid4

logger = logging.getLogger(__name__)

DEFAULT_MAX_PENDING = 50_000
DEFAULT_MAX_REJECTED = 10_000
BACKOFF_BASE_SECONDS = 30
BACKOFF_MAX_SECONDS = 3600
REASON_MAX_CHARS = 1000


def backoff_seconds(attempts: int) -> int:
    """Espera antes da próxima tentativa: 30s, 60s, 120s ... até 1h."""
    return min(BACKOFF_BASE_SECONDS * (2 ** max(attempts - 1, 0)), BACKOFF_MAX_SECONDS)


class IngestOutbox:
    """Persiste eventos até o acknowledge; leases entre workers locais."""

    def __init__(
        self,
        path: str,
        namespace: str,
        *,
        max_pending: int = DEFAULT_MAX_PENDING,
        max_rejected: int = DEFAULT_MAX_REJECTED,
    ):
        self.path = Path(path).expanduser().resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.namespace = namespace
        self.max_pending = max_pending
        self.max_rejected = max_rejected
        with closing(self._connect()) as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                "CREATE TABLE IF NOT EXISTS pending_events ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, namespace TEXT NOT NULL, "
                "payload TEXT NOT NULL, owner TEXT, "
                "lease_until REAL NOT NULL DEFAULT 0, "
                "attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS pending_namespace "
                "ON pending_events(namespace, lease_until, id)"
            )
            connection.execute(
                "CREATE TABLE IF NOT EXISTS rejected_events ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, namespace TEXT NOT NULL, "
                "payload TEXT NOT NULL, reason TEXT NOT NULL, "
                "source TEXT, rejected_at REAL NOT NULL, "
                "requeued INTEGER NOT NULL DEFAULT 0)"
            )

    def _connect(self):
        return sqlite3.connect(str(self.path), timeout=30, isolation_level=None)

    @staticmethod
    def _source_of(payload: str) -> str | None:
        try:
            value = json.loads(payload).get("source")
        except (ValueError, AttributeError):
            return None
        return str(value)[:200] if value else None

    def _quarantine(self, connection, payload: str, reason: str) -> None:
        connection.execute(
            "INSERT INTO rejected_events"
            "(namespace, payload, reason, source, rejected_at) VALUES (?, ?, ?, ?, ?)",
            (
                self.namespace,
                payload,
                (reason or "unspecified")[:REASON_MAX_CHARS],
                self._source_of(payload),
                time.time(),
            ),
        )

    def _trim_rejected(self, connection) -> None:
        connection.execute(
            "DELETE FROM rejected_events WHERE namespace = ? AND id NOT IN ("
            "SELECT id FROM rejected_events WHERE namespace = ? "
            "ORDER BY id DESC LIMIT ?)",
            (self.namespace, self.namespace, self.max_rejected),
        )

    def enqueue(self, event: dict) -> int:
        """Persiste antes de confirmar ao coletor.

        Retorna quantos eventos antigos foram rotacionados para a quarentena
        por estouro do teto (normalmente 0).
        """
        payload = json.dumps(event, ensure_ascii=False, allow_nan=False, default=str)
        evicted = 0
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                new_id = connection.execute(
                    "INSERT INTO pending_events(namespace, payload) VALUES (?, ?)",
                    (self.namespace, payload),
                ).lastrowid
                total = connection.execute(
                    "SELECT COUNT(*) FROM pending_events WHERE namespace = ?",
                    (self.namespace,),
                ).fetchone()[0]
                overflow = total - self.max_pending
                if overflow > 0:
                    # Só evicta itens sem lease (nunca o recém-inserido); os mais
                    # antigos primeiro. Em lease: o teto estoura temporariamente.
                    rows = connection.execute(
                        "SELECT id, payload FROM pending_events "
                        "WHERE namespace = ? AND owner IS NULL AND id <> ? "
                        "ORDER BY id LIMIT ?",
                        (self.namespace, new_id, overflow),
                    ).fetchall()
                    for row_id, old_payload in rows:
                        self._quarantine(connection, old_payload, "outbox_cap_exceeded")
                        connection.execute(
                            "DELETE FROM pending_events WHERE id = ?", (row_id,)
                        )
                    evicted = len(rows)
                    self._trim_rejected(connection)
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        if evicted:
            logger.error(
                "Outbox de ingestão acima do teto (%s): %s evento(s) antigo(s) "
                "movidos para quarentena (outbox_cap_exceeded)",
                self.max_pending,
                evicted,
            )
        return evicted

    def claim(self, limit: int, lease_seconds: int = 600) -> tuple[str, list[dict]]:
        """Reserva um lote limitado; leases abandonados voltam a ser elegíveis."""
        owner = uuid4().hex
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                now = time.time()
                rows = connection.execute(
                    "SELECT id, payload FROM pending_events "
                    "WHERE namespace = ? AND lease_until <= ? ORDER BY id LIMIT ?",
                    (self.namespace, now, limit),
                ).fetchall()
                connection.executemany(
                    "UPDATE pending_events SET owner = ?, lease_until = ? WHERE id = ?",
                    [(owner, now + lease_seconds, row[0]) for row in rows],
                )
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        return owner, [json.loads(row[1]) for row in rows]

    def acknowledge(self, owner: str, outcomes: list[dict] | None = None) -> int:
        """Remove o lote confirmado; itens ``skipped`` vão para a quarentena.

        Retorna quantos itens foram para a quarentena. Se ``outcomes`` não
        casar com o lote, nada é removido (RuntimeError).
        """
        quarantined = 0
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                if outcomes is not None:
                    rows = connection.execute(
                        "SELECT payload FROM pending_events "
                        "WHERE namespace = ? AND owner = ? ORDER BY id",
                        (self.namespace, owner),
                    ).fetchall()
                    if len(rows) != len(outcomes):
                        raise RuntimeError(
                            "Batch ownership changed before acknowledgment"
                        )
                    for row, outcome in zip(rows, outcomes, strict=True):
                        if outcome.get("status") == "skipped":
                            self._quarantine(
                                connection, row[0], str(outcome.get("reason") or "")
                            )
                            quarantined += 1
                    if quarantined:
                        self._trim_rejected(connection)
                connection.execute(
                    "DELETE FROM pending_events WHERE namespace = ? AND owner = ?",
                    (self.namespace, owner),
                )
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        return quarantined

    def release(self, owner: str, error: str | None = None) -> None:
        """Devolve o lote após falha transitória, com backoff exponencial."""
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                now = time.time()
                rows = connection.execute(
                    "SELECT id, attempts FROM pending_events "
                    "WHERE namespace = ? AND owner = ?",
                    (self.namespace, owner),
                ).fetchall()
                connection.executemany(
                    "UPDATE pending_events SET owner = NULL, attempts = ?, "
                    "lease_until = ?, last_error = ? WHERE id = ?",
                    [
                        (
                            attempts + 1,
                            now + backoff_seconds(attempts + 1),
                            (error or "")[:REASON_MAX_CHARS] or None,
                            row_id,
                        )
                        for row_id, attempts in rows
                    ],
                )
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def status(self) -> dict[str, int]:
        """Contagens operacionais, sem payloads nem credenciais."""
        now = time.time()
        with closing(self._connect()) as connection:
            pending, leased, deferred = connection.execute(
                "SELECT COUNT(*), "
                "COALESCE(SUM(owner IS NOT NULL AND lease_until > ?), 0), "
                "COALESCE(SUM(owner IS NULL AND lease_until > ?), 0) "
                "FROM pending_events WHERE namespace = ?",
                (now, now, self.namespace),
            ).fetchone()
            rejected = connection.execute(
                "SELECT COUNT(*) FROM rejected_events "
                "WHERE namespace = ? AND requeued = 0",
                (self.namespace,),
            ).fetchone()[0]
        return {
            "pending": pending,
            "leased": leased,
            "deferred": deferred,
            "rejected": rejected,
        }

    def rejections(self, limit: int = 50) -> list[dict]:
        """Itens em quarentena (mais recentes primeiro) para revisão humana."""
        with closing(self._connect()) as connection:
            rows = connection.execute(
                "SELECT id, source, reason, rejected_at FROM rejected_events "
                "WHERE namespace = ? AND requeued = 0 ORDER BY id DESC LIMIT ?",
                (self.namespace, limit),
            ).fetchall()
        return [
            {"id": r[0], "source": r[1], "reason": r[2], "rejected_at": r[3]}
            for r in rows
        ]

    def requeue(self, rejection_id: int) -> bool:
        """Reenfileira uma rejeição revisada uma única vez."""
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                row = connection.execute(
                    "SELECT payload FROM rejected_events "
                    "WHERE namespace = ? AND id = ? AND requeued = 0",
                    (self.namespace, rejection_id),
                ).fetchone()
                if row:
                    connection.execute(
                        "INSERT INTO pending_events(namespace, payload) VALUES (?, ?)",
                        (self.namespace, row[0]),
                    )
                    connection.execute(
                        "UPDATE rejected_events SET requeued = 1 "
                        "WHERE namespace = ? AND id = ?",
                        (self.namespace, rejection_id),
                    )
                connection.commit()
                return row is not None
            except Exception:
                connection.rollback()
                raise

    def count(self) -> int:
        """Eventos na fila (em lease, em backoff ou prontos) deste destino."""
        with closing(self._connect()) as connection:
            return connection.execute(
                "SELECT COUNT(*) FROM pending_events WHERE namespace = ?",
                (self.namespace,),
            ).fetchone()[0]


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Inspeciona a fila local de ingestão sem enviar requisições"
    )
    parser.add_argument("path")
    parser.add_argument("--destination", required=True)
    parser.add_argument(
        "--rejections", action="store_true", help="lista motivos da quarentena"
    )
    options = parser.parse_args()
    if not Path(options.path).expanduser().is_file():
        parser.error("Outbox file does not exist")
    inspected = IngestOutbox(options.path, options.destination.rstrip("/"))
    output = inspected.rejections() if options.rejections else inspected.status()
    print(json.dumps(output))  # noqa: T201 - CLI emite só contagens/motivos em JSON.
