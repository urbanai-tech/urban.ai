"""Offline tests for the pre-load data-quality gate."""

from unittest.mock import patch

import pandas as pd
import pytest

from raw_data_pipeline.load.load_on_mysql import load_multiple_dataframes_to_mysql
from raw_data_pipeline.quality import (
    DataQualityContract,
    DataQualityError,
    NumericRange,
    TemporalOrder,
    contract_for_dataframes,
    enforce_data_quality,
    validate_dataframes_quality,
)


def _valid_events() -> pd.DataFrame:
    """Build a small valid event batch."""
    return pd.DataFrame(
        {
            "event_id": ["evt-1", "evt-2"],
            "title": ["Event One", "Event Two"],
            "source": ["eventim", "eventim"],
            "price": [0.0, 150.0],
            "date": pd.to_datetime(["2026-08-01", "2026-08-02"]),
        }
    )


def test_valid_batch_returns_structured_report() -> None:
    """A valid event batch passes and exposes a value-free report."""
    dataframe = _valid_events()
    contract = contract_for_dataframes([dataframe], expected_source="eventim")

    report = enforce_data_quality([dataframe], contract, "eventim")

    assert report.passed is True
    assert report.row_count == len(dataframe)
    assert report.to_dict()["issues"] == []
    assert report.to_dict()["columns"] == list(dataframe.columns)


def test_schema_and_type_drift_are_reported() -> None:
    """Column and semantic-type drift across files are rejected."""
    first = _valid_events()
    second = _valid_events().drop(columns="title")
    second["price"] = ["free", "paid"]
    contract = contract_for_dataframes([first], expected_source="eventim")

    report = validate_dataframes_quality([first, second], contract, "eventim")
    codes = {issue.code for issue in report.issues}

    assert report.passed is False
    assert "schema_drift" in codes
    assert "type_drift" in codes
    assert "missing_required_column" in codes


def test_invalid_values_report_nulls_duplicates_ranges_and_provenance() -> None:
    """Invalid values produce aggregate issue metadata without row contents."""
    dataframe = pd.DataFrame(
        {
            "event_id": [None, "duplicate", "duplicate", "other-id"],
            "title": ["", "Valid", "Valid too", "Other source"],
            "source": ["eventim", "eventim", "eventim", "other"],
            "price": [-1.0, float("inf"), "invalid", 10.0],
        }
    )
    contract = contract_for_dataframes([dataframe], expected_source="eventim")

    with pytest.raises(DataQualityError) as error:
        enforce_data_quality([dataframe], contract, "eventim")

    report = error.value.report
    codes = {issue.code for issue in report.issues}
    assert {
        "duplicate_key",
        "invalid_column_type",
        "invalid_provenance",
        "null_required_value",
        "numeric_range_violation",
    }.issubset(codes)
    assert "Valid too" not in str(report.to_dict())


def test_loader_rejects_invalid_batch_before_database_access() -> None:
    """The integration point fails before credentials or engine access."""
    dataframe = pd.DataFrame({"id": [1, 1], "score": [101, 101]})
    contract = DataQualityContract(
        required_columns=frozenset({"id", "score"}),
        non_nullable_columns=frozenset({"id", "score"}),
        unique_column_sets=(("id",),),
        numeric_ranges={"score": NumericRange(minimum=0, maximum=100)},
    )

    with (
        patch(
            "raw_data_pipeline.load.load_on_mysql.setup_database_from_prefect"
        ) as database_setup,
        pytest.raises(DataQualityError),
    ):
        load_multiple_dataframes_to_mysql(
            [dataframe], "scores", quality_contract=contract
        )

    database_setup.assert_not_called()


def test_inferred_event_contract_rejects_temporal_order_regression() -> None:
    """An event end before its start is rejected using UTC-normalized timestamps."""
    dataframe = pd.DataFrame(
        {
            "event_id": ["evt-1"],
            "title": ["Event One"],
            "source": ["eventim"],
            "starts_on": ["2026-08-02T23:00:00-03:00"],
            "ends_on": ["2026-08-02T22:00:00-03:00"],
        }
    )

    report = validate_dataframes_quality(
        [dataframe],
        contract_for_dataframes([dataframe], expected_source="eventim"),
        "eventim",
    )

    assert report.passed is False
    assert {issue.code for issue in report.issues} == {"invalid_temporal_order"}


def test_temporal_contract_reports_invalid_values_without_exposing_values() -> None:
    """Malformed timestamps fail closed and remain absent from the report."""
    dataframe = pd.DataFrame(
        {"observed_at": ["private-malformed-value"], "available_at": ["2026-08-01"]}
    )
    contract = DataQualityContract(
        temporal_orders=(TemporalOrder("observed_at", "available_at"),)
    )

    report = validate_dataframes_quality([dataframe], contract, "features")

    assert {issue.code for issue in report.issues} == {"invalid_temporal_value"}
    assert "private-malformed-value" not in str(report.to_dict())
