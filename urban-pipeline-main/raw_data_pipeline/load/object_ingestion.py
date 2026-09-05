"""Transactional, versioned object ingestion for a reconciled bronze destination."""

import hashlib
import json
import re
from datetime import UTC, datetime

import pandas as pd
from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    inspect,
    select,
    text,
)
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from raw_data_pipeline.quality import contract_for_dataframes, enforce_data_quality

_metadata = MetaData()
_TRANSACTIONAL_TABLE_COUNT = 3
_MAX_BUCKET_LENGTH = 255
_targets = Table(
    "urban_ingestion_targets",
    _metadata,
    Column("target", String(64), primary_key=True),
    mysql_engine="InnoDB",
)
_receipts = Table(
    "urban_ingestion_receipts",
    _metadata,
    Column("id", String(64), primary_key=True),
    Column("target", String(64), nullable=False),
    Column("bucket", String(255), nullable=False),
    Column("object_key", Text, nullable=False),
    Column("content_sha256", String(64), nullable=False),
    Column("rows", Integer, nullable=False),
    Column("imported_at", DateTime, nullable=False),
    mysql_engine="InnoDB",
)


def _require_transactional_tables(engine: Engine, target: str) -> None:
    if engine.dialect.name == "sqlite":
        return
    if engine.dialect.name != "mysql":
        raise ValueError(
            "Object ingestion supports MySQL/InnoDB or isolated SQLite tests"
        )
    with engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (:target, :receipts, :targets)"
            ),
            {"target": target, "receipts": _receipts.name, "targets": _targets.name},
        ).all()
    if len(rows) != _TRANSACTIONAL_TABLE_COUNT or any(
        str(row[1]).lower() != "innodb" for row in rows
    ):
        raise RuntimeError("All ingestion tables must use InnoDB")


def prepare_target(engine: Engine, frame: pd.DataFrame, target: str) -> None:
    """Create an empty target or enroll one only after proving it has no old rows."""
    if not re.fullmatch(r"[a-z][a-z0-9_]{0,63}", target) or target.startswith(
        "urban_ingestion_"
    ):
        raise ValueError("Invalid ingestion target")
    _metadata.create_all(engine)
    if not inspect(engine).has_table(target):
        frame.head(0).to_sql(target, engine, index=False, if_exists="fail")
    _require_transactional_tables(engine, target)
    with engine.begin() as connection:
        registered = connection.execute(
            select(_targets.c.target).where(_targets.c.target == target)
        ).first()
        if registered:
            return
        if connection.execute(text(f"SELECT 1 FROM `{target}` LIMIT 1")).first():
            raise RuntimeError(
                "Existing bronze data requires reconciliation before object ingestion"
            )
        connection.execute(_targets.insert().values(target=target))


def ingest_object(  # noqa: PLR0913 - explicit source identity and destination fields
    engine: Engine,
    frame: pd.DataFrame,
    *,
    target: str,
    bucket: str,
    object_key: str,
    content_sha256: str,
    source: str,
) -> int:
    """Commit one object version and its receipt atomically; replay inserts zero rows.

    A changed content hash represents a new observation, not an overwrite of the
    original rows. Each row carries its receipt ID for provenance and reconciliation.
    """
    if (
        not bucket
        or len(bucket) > _MAX_BUCKET_LENGTH
        or not object_key
        or not re.fullmatch(r"[0-9a-f]{64}", content_sha256)
    ):
        raise ValueError("Object identity and SHA-256 are required")
    if "_ingestion_receipt" in frame.columns:
        raise ValueError("Input cannot supply the reserved ingestion receipt column")
    enforce_data_quality(
        [frame], contract_for_dataframes([frame], expected_source=source), target
    )
    receipt_id = hashlib.sha256(
        json.dumps(
            [target, bucket, object_key, content_sha256], separators=(",", ":")
        ).encode()
    ).hexdigest()
    rows = frame.copy()
    rows["_ingestion_receipt"] = receipt_id
    prepare_target(engine, rows, target)
    try:
        with engine.begin() as connection:
            connection.execute(
                _receipts.insert().values(
                    id=receipt_id,
                    target=target,
                    bucket=bucket,
                    object_key=object_key,
                    content_sha256=content_sha256,
                    rows=len(rows),
                    imported_at=datetime.now(UTC).replace(tzinfo=None),
                )
            )
            if not rows.empty:
                rows.to_sql(
                    target,
                    connection,
                    if_exists="append",
                    index=False,
                    method="multi",
                    chunksize=1000,
                )
        return len(rows)
    except IntegrityError:
        # Only a committed receipt proves replay. Row constraint failures propagate.
        with engine.connect() as connection:
            existing = connection.execute(
                select(_receipts.c.id).where(_receipts.c.id == receipt_id)
            ).first()
        if existing:
            return 0
        raise
