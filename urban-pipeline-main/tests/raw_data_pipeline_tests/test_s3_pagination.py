"""Exercise complete S3 discovery without network access."""

from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest

from raw_data_pipeline.utils.aws_helper import S3Helper


def helper():
    """Build a helper with no AWS network calls."""
    with patch(
        "raw_data_pipeline.utils.aws_helper._building_s3_client",
        return_value=MagicMock(),
    ):
        return S3Helper()


def test_all_pages_and_nested_names_are_preserved():
    """Read beyond three files and retain complete keys."""
    subject = helper()
    prefix = "raw_data/parquet/events/"
    keys = [prefix + f"day-{i}/events.parquet" for i in range(5)]
    subject.client.list_objects_v2.side_effect = [
        {
            "Contents": [{"Key": key} for key in keys[:3]],
            "IsTruncated": True,
            "NextContinuationToken": "page-2",
        },
        {"Contents": [{"Key": key} for key in keys[3:]]},
    ]
    bodies = []

    def get_object(**kwargs):
        body = BytesIO(kwargs["Key"].encode())
        bodies.append(body)
        return {"Body": body}

    subject.client.get_object.side_effect = get_object
    assert list(subject.iter_parquet_objects("events")) == [
        (key, key.encode()) for key in keys
    ]
    assert all(body.closed for body in bodies)
    subject.client.list_objects_v2.assert_called_with(
        Bucket="urban-ai-data", Prefix=prefix, ContinuationToken="page-2"
    )


@pytest.mark.parametrize("token", [None, "", 1])
def test_truncated_pages_without_valid_token_fail(token):
    """Reject incomplete listings that cannot be continued."""
    subject = helper()
    subject.client.list_objects_v2.return_value = {
        "IsTruncated": True,
        "NextContinuationToken": token,
    }
    with pytest.raises(RuntimeError, match="continuation token"):
        list(subject.iter_parquet_objects("events"))


def test_folder_discovery_reads_later_pages_and_deduplicates():
    """Discover folders that were hidden past the first S3 page."""
    subject = helper()
    first = {"Prefix": "raw_data/parquet/first/"}
    second = {"Prefix": "raw_data/parquet/second/"}
    subject.client.list_objects_v2.side_effect = [
        {
            "CommonPrefixes": [first],
            "IsTruncated": True,
            "NextContinuationToken": "next",
        },
        {"CommonPrefixes": [first, second]},
    ]
    assert subject.list_spiders_folders() == [first["Prefix"], second["Prefix"]]


def test_repeated_page_token_fails_instead_of_looping():
    """Stop a broken continuation cycle."""
    subject = helper()
    subject.client.list_objects_v2.return_value = {
        "IsTruncated": True,
        "NextContinuationToken": "same",
    }
    with pytest.raises(RuntimeError, match="continuation token"):
        list(subject.iter_parquet_objects("events"))
    assert subject.client.list_objects_v2.call_count == 2


def test_read_failure_closes_stream_and_is_not_an_empty_result():
    """Close the response body even when reading fails."""
    subject = helper()
    subject.client.list_objects_v2.return_value = {
        "Contents": [{"Key": "raw_data/parquet/events/a.parquet"}]
    }
    body = MagicMock()
    body.read.side_effect = OSError("read failed")
    subject.client.get_object.return_value = {"Body": body}
    with pytest.raises(OSError, match="read failed"):
        list(subject.iter_parquet_objects("events"))
    body.close.assert_called_once()
