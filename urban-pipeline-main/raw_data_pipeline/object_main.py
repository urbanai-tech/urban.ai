"""Complete S3 ingestion into an empty or previously enrolled bronze destination."""

import hashlib
from io import BytesIO

import pandas as pd
from prefect import flow
from sqlalchemy.engine import Engine

from raw_data_pipeline.config import get_logger, setup_database_from_prefect
from raw_data_pipeline.extractors.s3_extractor import S3Extractor
from raw_data_pipeline.load.object_ingestion import ingest_object
from raw_data_pipeline.utils.aws_helper import S3Helper

log = get_logger(__name__)


def ingest_folder(helper: S3Helper, engine: Engine, folder: str) -> dict[str, int]:
    """Process complete object versions independently, retaining failures for retries."""
    metrics = {"objects": 0, "inserted_rows": 0, "failed_objects": 0}
    target = folder.replace("-", "_").replace(" ", "_").lower()
    for key, content in helper.iter_parquet_objects(folder):
        metrics["objects"] += 1
        try:
            frame = pd.read_parquet(BytesIO(content))
            metrics["inserted_rows"] += ingest_object(
                engine,
                frame,
                target=target,
                bucket=helper.bkt_name,
                object_key=key,
                content_sha256=hashlib.sha256(content).hexdigest(),
                source=folder,
            )
        except Exception as error:
            metrics["failed_objects"] += 1
            log.error(
                "Object ingestion failed source=%s ordinal=%s identity=%s error=%s",
                folder,
                metrics["objects"],
                hashlib.sha256(key.encode()).hexdigest()[:16],
                type(error).__name__,
            )
    if metrics["failed_objects"]:
        raise RuntimeError(
            f"Source {folder}: {metrics['failed_objects']} object(s) failed; successful receipts retained"
        )
    return metrics


@flow(name="Raw Data Object Ingestion")
def object_ingestion_flow() -> dict[str, dict[str, int]]:
    """Use receipt-based ingestion; legacy nonempty destinations fail closed."""
    extractor = S3Extractor()
    folders = extractor.list_folders()
    results: dict[str, dict[str, int]] = {}
    if not folders:
        return results
    engine = setup_database_from_prefect("mysql-bronze-url").get_engine()
    failures = []
    try:
        for folder in folders:
            try:
                results[folder] = ingest_folder(extractor.s3_helper, engine, folder)
            except Exception:
                failures.append(folder)
        if failures:
            raise RuntimeError(
                f"Object ingestion incomplete: {len(failures)} source(s) failed"
            )
        return results
    finally:
        engine.dispose()


if __name__ == "__main__":
    object_ingestion_flow()
