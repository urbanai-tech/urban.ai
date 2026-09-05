"""Verify atomic receipts using real isolated database transactions."""

import os
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pandas as pd
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from raw_data_pipeline.load.object_ingestion import ingest_object, prepare_target
from raw_data_pipeline.object_main import ingest_folder


@pytest.fixture
def engine(tmp_path):
    """Create a dedicated database; never reuse an application's schema."""
    mysql_url = os.environ.get("URBAN_INGESTION_TEST_MYSQL_URL")
    if mysql_url:
        url = make_url(mysql_url)
        if (
            url.drivername != "mysql+pymysql"
            or url.host != "127.0.0.1"
            or not url.port
            or url.port == 3306
            or url.database
        ):
            raise ValueError(
                "Use a dedicated loopback MySQL test port without a database"
            )
        database = "ingestion_test_" + uuid4().hex
        admin = create_engine(url)
        with admin.begin() as connection:
            connection.execute(text(f"CREATE DATABASE `{database}`"))
        instance = create_engine(url.set(database=database))
        try:
            yield instance
        finally:
            instance.dispose()
            with admin.begin() as connection:
                connection.execute(text(f"DROP DATABASE `{database}`"))
            admin.dispose()
        return
    instance = create_engine(
        f"sqlite:///{tmp_path / 'bronze.db'}", connect_args={"timeout": 15}
    )
    yield instance
    instance.dispose()


def ingest(engine, key="events/a.parquet", digest="a" * 64):
    """Ingest a synthetic observation."""
    return ingest_object(
        engine,
        pd.DataFrame({"value": [1, 2]}),
        target="events",
        bucket="test",
        object_key=key,
        content_sha256=digest,
        source="events",
    )


def counts(engine):
    """Count committed data and receipts."""
    with engine.connect() as connection:
        return tuple(
            connection.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            for table in ["events", "urban_ingestion_receipts"]
        )


def test_replay_and_changed_content_are_distinct(engine):
    """Deduplicate transport retries while preserving changed observations."""
    assert ingest(engine) == 2
    assert ingest(engine) == 0
    assert counts(engine) == (2, 1)
    assert ingest(engine, digest="b" * 64) == 2
    assert counts(engine) == (4, 2)
    with engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT COUNT(DISTINCT _ingestion_receipt) FROM events")
            ).scalar()
            == 2
        )


def test_same_basename_in_another_path_is_not_replay(engine):
    """Keep object identities scoped to their complete path."""
    ingest(engine)
    assert ingest(engine, key="events/day2/a.parquet") == 2
    assert counts(engine) == (4, 2)


def test_failure_after_rows_rolls_back_rows_and_receipt(engine):
    """Exercise an exception after actual insertion, before transaction commit."""
    original = pd.DataFrame.to_sql

    def insert_then_fail(frame, *args, **kwargs):
        result = original(frame, *args, **kwargs)
        if not frame.empty:
            raise RuntimeError("failure before commit")
        return result

    with patch.object(pd.DataFrame, "to_sql", insert_then_fail):
        with pytest.raises(RuntimeError, match="before commit"):
            ingest(engine)
    assert counts(engine) == (0, 0)
    assert ingest(engine) == 2


def test_legacy_data_requires_reconciliation(engine):
    """Do not duplicate an existing bronze table without an import history."""
    pd.DataFrame({"value": [99]}).to_sql("events", engine, index=False)
    with pytest.raises(RuntimeError, match="reconciliation"):
        ingest(engine)
    assert counts(engine) == (1, 0)


def test_concurrent_replays_have_one_committed_batch(engine):
    """Contend on the receipt key from independent connections."""
    prepare_target(
        engine, pd.DataFrame({"value": [1], "_ingestion_receipt": ["a" * 64]}), "events"
    )
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda _: ingest(engine), range(6)))
    assert sorted(results) == [0, 0, 0, 0, 0, 2]
    assert counts(engine) == (2, 1)


def test_folder_recovery_reads_every_file_and_replays_without_duplicates(engine):
    """Exercise extraction through persistence, including retry after corrupt data."""
    valid = []
    for index in range(5):
        output = BytesIO()
        pd.DataFrame({"value": [index]}).to_parquet(output, index=False)
        valid.append((f"events/{index}.parquet", output.getvalue()))
    helper = MagicMock(bkt_name="test")
    helper.iter_parquet_objects.return_value = iter(
        [valid[0], ("events/bad.parquet", b"invalid"), *valid[1:]]
    )
    with pytest.raises(RuntimeError, match="1 object"):
        ingest_folder(helper, engine, "events")
    assert counts(engine) == (5, 5)
    helper.iter_parquet_objects.return_value = iter(valid)
    assert ingest_folder(helper, engine, "events") == {
        "objects": 5,
        "inserted_rows": 0,
        "failed_objects": 0,
    }
    assert counts(engine) == (5, 5)
