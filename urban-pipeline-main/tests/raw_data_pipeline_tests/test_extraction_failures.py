"""Infrastructure failures must not be reported as an empty successful source."""

import importlib
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from botocore.exceptions import NoCredentialsError

from raw_data_pipeline.extractors.s3_extractor import S3Extractor, extract_from_s3


def test_missing_credentials_are_not_an_empty_folder_list():
    """Keep a missing AWS identity visible to Prefect and operators."""
    with patch("raw_data_pipeline.extractors.s3_extractor.S3Helper") as helper:
        helper.return_value.list_spiders_folders.side_effect = NoCredentialsError()
        with pytest.raises(NoCredentialsError):
            S3Extractor().list_folders()


def test_valid_empty_source_remains_distinct_from_failure():
    """An authenticated empty source is a valid empty observation."""
    with patch("raw_data_pipeline.extractors.s3_extractor.S3Helper") as helper:
        helper.return_value.list_spiders_folders.return_value = []
        helper.return_value.get_data_from_s3.return_value = None
        extractor = S3Extractor()
        assert extractor.list_folders() == []
        assert extractor.get_dataframes_from_folder("empty") == []


def test_corrupt_parquet_does_not_silently_drop_part_of_a_folder():
    """A folder with partial corruption must fail before loading partial rows."""
    with (
        patch("raw_data_pipeline.extractors.s3_extractor.S3Helper") as helper,
        patch("raw_data_pipeline.extractors.s3_extractor.pd.read_parquet") as read,
    ):
        helper.return_value.get_data_from_s3.return_value = {
            "good.parquet": b"a",
            "bad.parquet": b"b",
        }
        read.side_effect = [pd.DataFrame({"id": [1]}), ValueError("corrupt parquet")]
        with pytest.raises(RuntimeError, match="1 file"):
            S3Extractor().get_dataframes_from_folder("events")


def test_legacy_extractor_propagates_transport_errors():
    """Legacy task callers also receive a failure, never a misleading None."""
    with patch("raw_data_pipeline.extractors.s3_extractor.S3Extractor") as extractor:
        extractor.return_value.get_dataframes_from_folder.side_effect = RuntimeError(
            "transport failure"
        )
        with pytest.raises(RuntimeError, match="transport failure"):
            extract_from_s3.fn(["events"])


def test_partial_pipeline_completion_is_reported_as_failure():
    """Continue independent folders but fail the overall incomplete run."""
    module = importlib.import_module("raw_data_pipeline.main")
    extractor = MagicMock()
    extractor.list_folders.return_value = ["bad", "good"]
    extractor.get_dataframes_from_folder.side_effect = [
        RuntimeError("unavailable"),
        [pd.DataFrame({"id": [1]})],
    ]
    with (
        patch.object(module, "S3Extractor", return_value=extractor),
        patch.object(module, "contract_for_dataframes", return_value=MagicMock()),
        patch.object(
            module, "load_multiple_dataframes_to_mysql", return_value=1
        ) as load,
    ):
        with pytest.raises(RuntimeError, match="1/2 folders failed; 1 succeeded"):
            module.main()
        assert load.call_count == 1
