"""Offline, configurable data-quality checks for extracted DataFrames."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

import numpy as np
import pandas as pd
from pandas.api import types as pandas_types


@dataclass(frozen=True)
class NumericRange:
    """Inclusive numeric limits for a column."""

    minimum: float | None = None
    maximum: float | None = None


@dataclass(frozen=True)
class TemporalOrder:
    """Columns whose timestamps must be parseable and chronologically ordered."""

    starts_at: str
    ends_at: str


@dataclass(frozen=True)
class DataQualityContract:
    """Configurable rules applied to a batch before persistence."""

    required_columns: frozenset[str] = frozenset()
    column_types: dict[str, str] = field(default_factory=dict)
    non_nullable_columns: frozenset[str] = frozenset()
    unique_column_sets: tuple[tuple[str, ...], ...] = ()
    numeric_ranges: dict[str, NumericRange] = field(default_factory=dict)
    temporal_orders: tuple[TemporalOrder, ...] = ()
    provenance_column: str | None = None
    expected_provenance: str | None = None
    allow_extra_columns: bool = True
    enforce_consistent_schema: bool = True
    reject_exact_duplicates: bool = True


@dataclass(frozen=True)
class DataQualityIssue:
    """A value-free description of one quality violation."""

    code: str
    message: str
    column: str | None = None
    count: int = 0
    batch_index: int | None = None


@dataclass(frozen=True)
class DataQualityReport:
    """Structured result of an offline batch validation."""

    dataset: str
    row_count: int
    batch_count: int
    columns: tuple[str, ...]
    dtypes: dict[str, str]
    passed: bool
    issues: tuple[DataQualityIssue, ...]

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable report without row values."""
        return {
            "dataset": self.dataset,
            "row_count": self.row_count,
            "batch_count": self.batch_count,
            "columns": list(self.columns),
            "dtypes": self.dtypes,
            "passed": self.passed,
            "issues": [asdict(issue) for issue in self.issues],
        }


class DataQualityError(ValueError):
    """Raised when a batch violates its data-quality contract."""

    def __init__(self, report: DataQualityReport) -> None:
        self.report = report
        codes = sorted({issue.code for issue in report.issues})
        super().__init__(
            f"Data quality gate failed for {report.dataset}: "
            f"{len(report.issues)} issue(s) [{', '.join(codes)}]"
        )


def contract_for_dataframes(
    dataframes: list[pd.DataFrame], expected_source: str | None = None
) -> DataQualityContract:
    """Infer only rules supported by the observed schema.

    Event rules are enabled when ``event_id`` and ``title`` exist. Generic
    datasets still receive schema-consistency and exact-duplicate checks.
    """
    columns = {str(column) for dataframe in dataframes for column in dataframe.columns}
    required: set[str] = set()
    non_nullable: set[str] = set()
    column_types: dict[str, str] = {}
    unique_sets: tuple[tuple[str, ...], ...] = ()
    provenance_column = None
    provenance_value = None

    if {"event_id", "title"}.issubset(columns):
        required.update(("event_id", "title"))
        non_nullable.update(("event_id", "title"))
        column_types.update({"event_id": "string", "title": "string"})
        unique_sets = (("event_id",),)

    if "source" in columns:
        required.add("source")
        non_nullable.add("source")
        column_types["source"] = "string"
        provenance_column = "source"
        provenance_value = expected_source
        if "event_id" in columns:
            unique_sets = (("source", "event_id"),)

    ranges = {
        column: limits
        for column, limits in {
            "price": NumericRange(minimum=0),
            "lat": NumericRange(minimum=-90, maximum=90),
            "latitude": NumericRange(minimum=-90, maximum=90),
            "lng": NumericRange(minimum=-180, maximum=180),
            "longitude": NumericRange(minimum=-180, maximum=180),
        }.items()
        if column in columns
    }
    for column in ranges:
        column_types[column] = "numeric"

    temporal_orders = tuple(
        TemporalOrder(starts_at, ends_at)
        for starts_at, ends_at in (
            ("dataInicio", "dataFim"),
            ("starts_on", "ends_on"),
            ("start_at", "end_at"),
            ("start_date", "end_date"),
        )
        if {starts_at, ends_at}.issubset(columns)
    )

    return DataQualityContract(
        required_columns=frozenset(required),
        column_types=column_types,
        non_nullable_columns=frozenset(non_nullable),
        unique_column_sets=unique_sets,
        numeric_ranges=ranges,
        temporal_orders=temporal_orders,
        provenance_column=provenance_column,
        expected_provenance=provenance_value,
    )


def validate_dataframes_quality(  # noqa: C901, PLR0912, PLR0915
    dataframes: list[pd.DataFrame],
    contract: DataQualityContract,
    dataset: str,
) -> DataQualityReport:
    """Validate a batch without mutating it or contacting external services."""
    active_frames = [dataframe for dataframe in dataframes if not dataframe.empty]
    if not active_frames:
        return DataQualityReport(
            dataset=dataset,
            row_count=0,
            batch_count=len(dataframes),
            columns=(),
            dtypes={},
            passed=True,
            issues=(),
        )

    issues: list[DataQualityIssue] = []
    reference = active_frames[0]
    reference_columns = tuple(str(column) for column in reference.columns)
    reference_set = set(reference_columns)

    for batch_index, dataframe in enumerate(active_frames):
        columns = {str(column) for column in dataframe.columns}
        missing = sorted(contract.required_columns - columns)
        for column in missing:
            issues.append(
                DataQualityIssue(
                    code="missing_required_column",
                    message=f"Required column '{column}' is missing.",
                    column=column,
                    batch_index=batch_index,
                )
            )

        if contract.enforce_consistent_schema and columns != reference_set:
            issues.append(
                DataQualityIssue(
                    code="schema_drift",
                    message="Batch columns differ from the first non-empty batch.",
                    batch_index=batch_index,
                )
            )
        if not contract.allow_extra_columns:
            extras = sorted(columns - contract.required_columns)
            for column in extras:
                issues.append(
                    DataQualityIssue(
                        code="unexpected_column",
                        message=f"Unexpected column '{column}' is present.",
                        column=column,
                        batch_index=batch_index,
                    )
                )

        if contract.enforce_consistent_schema and batch_index > 0:
            for column in sorted(columns & reference_set):
                if _semantic_dtype(dataframe[column]) != _semantic_dtype(
                    reference[column]
                ):
                    issues.append(
                        DataQualityIssue(
                            code="type_drift",
                            message=f"Column '{column}' changed semantic type.",
                            column=column,
                            batch_index=batch_index,
                        )
                    )

    combined = pd.concat(active_frames, ignore_index=True, sort=False)

    for column in sorted(contract.non_nullable_columns & set(combined.columns)):
        invalid = combined[column].isna() | _blank_string_mask(combined[column])
        if invalid.any():
            issues.append(
                DataQualityIssue(
                    code="null_required_value",
                    message=f"Column '{column}' contains null or blank values.",
                    column=column,
                    count=int(invalid.sum()),
                )
            )

    for column, expected_type in contract.column_types.items():
        if column not in combined.columns:
            continue
        if not _matches_type(combined[column], expected_type):
            issues.append(
                DataQualityIssue(
                    code="invalid_column_type",
                    message=(
                        f"Column '{column}' does not satisfy type '{expected_type}'."
                    ),
                    column=column,
                    count=int(combined[column].notna().sum()),
                )
            )

    for unique_columns in contract.unique_column_sets:
        if not set(unique_columns).issubset(combined.columns):
            continue
        duplicate_count = int(
            combined.duplicated(subset=list(unique_columns), keep=False).sum()
        )
        if duplicate_count:
            issues.append(
                DataQualityIssue(
                    code="duplicate_key",
                    message=f"Duplicate key detected for columns {unique_columns}.",
                    column=",".join(unique_columns),
                    count=duplicate_count,
                )
            )

    if contract.reject_exact_duplicates:
        try:
            duplicate_count = int(combined.duplicated(keep=False).sum())
        except TypeError:
            duplicate_count = 0
        if duplicate_count:
            issues.append(
                DataQualityIssue(
                    code="duplicate_row",
                    message="Exact duplicate rows were detected.",
                    count=duplicate_count,
                )
            )

    for column, limits in contract.numeric_ranges.items():
        if column not in combined.columns:
            continue
        numeric = pd.to_numeric(combined[column], errors="coerce")
        invalid = combined[column].notna() & (
            numeric.isna() | ~np.isfinite(numeric.astype(float))
        )
        if limits.minimum is not None:
            invalid |= numeric < limits.minimum
        if limits.maximum is not None:
            invalid |= numeric > limits.maximum
        if invalid.any():
            issues.append(
                DataQualityIssue(
                    code="numeric_range_violation",
                    message=f"Column '{column}' contains invalid or out-of-range values.",
                    column=column,
                    count=int(invalid.sum()),
                )
            )

    for temporal_order in contract.temporal_orders:
        starts_at = temporal_order.starts_at
        ends_at = temporal_order.ends_at
        if not {starts_at, ends_at}.issubset(combined.columns):
            continue

        populated = combined[starts_at].notna() & combined[ends_at].notna()
        starts = pd.to_datetime(combined[starts_at], errors="coerce", utc=True)
        ends = pd.to_datetime(combined[ends_at], errors="coerce", utc=True)
        invalid = populated & (starts.isna() | ends.isna())
        if invalid.any():
            issues.append(
                DataQualityIssue(
                    code="invalid_temporal_value",
                    message=(
                        f"Columns '{starts_at}' and '{ends_at}' contain "
                        "unparseable timestamps."
                    ),
                    column=f"{starts_at},{ends_at}",
                    count=int(invalid.sum()),
                )
            )

        reversed_order = populated & ~invalid & (ends < starts)
        if reversed_order.any():
            issues.append(
                DataQualityIssue(
                    code="invalid_temporal_order",
                    message=f"Column '{ends_at}' precedes '{starts_at}'.",
                    column=f"{starts_at},{ends_at}",
                    count=int(reversed_order.sum()),
                )
            )

    provenance_column = contract.provenance_column
    if provenance_column:
        if provenance_column not in combined.columns:
            issues.append(
                DataQualityIssue(
                    code="missing_provenance",
                    message=f"Provenance column '{provenance_column}' is missing.",
                    column=provenance_column,
                )
            )
        elif contract.expected_provenance is not None:
            invalid = combined[provenance_column] != contract.expected_provenance
            if invalid.any():
                issues.append(
                    DataQualityIssue(
                        code="invalid_provenance",
                        message="Rows do not match the expected dataset provenance.",
                        column=provenance_column,
                        count=int(invalid.sum()),
                    )
                )

    return DataQualityReport(
        dataset=dataset,
        row_count=len(combined),
        batch_count=len(dataframes),
        columns=reference_columns,
        dtypes={str(column): str(dtype) for column, dtype in reference.dtypes.items()},
        passed=not issues,
        issues=tuple(issues),
    )


def enforce_data_quality(
    dataframes: list[pd.DataFrame],
    contract: DataQualityContract,
    dataset: str,
) -> DataQualityReport:
    """Return a passing report or raise ``DataQualityError``."""
    report = validate_dataframes_quality(dataframes, contract, dataset)
    if not report.passed:
        raise DataQualityError(report)
    return report


def _blank_string_mask(series: pd.Series) -> pd.Series:
    """Return a boolean mask for empty or whitespace-only strings."""
    return series.map(lambda value: isinstance(value, str) and not value.strip())


def _matches_type(series: pd.Series, expected_type: str) -> bool:
    """Check a small stable vocabulary of semantic types."""
    values = series.dropna()
    if values.empty:
        return True
    if expected_type == "string":
        return bool(values.map(lambda value: isinstance(value, str)).all())
    if expected_type == "numeric":
        return pandas_types.is_numeric_dtype(
            values.dtype
        ) and not pandas_types.is_bool_dtype(values.dtype)
    if expected_type == "integer":
        return bool(pandas_types.is_integer_dtype(values.dtype))
    if expected_type == "datetime":
        return bool(pandas_types.is_datetime64_any_dtype(values.dtype))
    if expected_type == "boolean":
        return bool(pandas_types.is_bool_dtype(values.dtype))
    raise ValueError(f"Unsupported quality contract type: {expected_type}")


def _semantic_dtype(series: pd.Series) -> str:
    """Normalize pandas dtypes for stable drift comparisons."""
    if pandas_types.is_bool_dtype(series.dtype):
        return "boolean"
    if pandas_types.is_numeric_dtype(series.dtype):
        return "numeric"
    if pandas_types.is_datetime64_any_dtype(series.dtype):
        return "datetime"
    values = series.dropna()
    if values.empty or values.map(lambda value: isinstance(value, str)).all():
        return "string"
    return "mixed"
