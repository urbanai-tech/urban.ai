"""Test configuration for the raw data pipeline tests."""

import os
import sqlite3
import sys
import tempfile
from collections.abc import Generator
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pandas as pd
import pytest

# Disable Prefect logging during tests
os.environ["PREFECT_SILENCE_LOGS"] = "true"
os.environ["PREFECT_LOGGING_LEVEL"] = "ERROR"

# Import after setting environment variables
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from raw_data_pipeline.config.database import (
    DatabaseConfig,
    DatabaseCredentials,
    DatabaseTemplates,
)


@pytest.fixture(autouse=True)
def mock_env_vars() -> Generator[None, None, None]:
    """Mock environment variables for testing."""
    env_vars = {
        "AWS_ACCESS_KEY_ID": "test-access-key",
        "AWS_SECRET_ACCESS_KEY": "test-secret-key",
        "AWS_REGION": "us-west-2",
        "ASSUME_ROLE_ARN": "",
        "ASSUME_ROLE_EXTERNAL_ID": "",
    }

    with patch.dict(os.environ, env_vars, clear=False):
        yield


@pytest.fixture
def mock_mysql_config() -> dict[str, Any]:
    """Mock MySQL configuration for testing (legacy compatibility)."""
    return {
        "user": "test_user",
        "password": "test_password",
        "host": "localhost",
        "port": 3306,
        "database": "test_db",
    }


@pytest.fixture
def test_database_credentials() -> DatabaseCredentials:
    """Create test database credentials."""
    return DatabaseCredentials(
        username="test_user",
        password="test_password",
        host="localhost",
        port=3306,
        database="test_db",
    )


@pytest.fixture
def test_database_config(
    test_database_credentials: DatabaseCredentials,
) -> DatabaseConfig:
    """Create test database configuration."""
    return DatabaseConfig(
        credentials=test_database_credentials,
        pool_size=5,
        max_overflow=10,
        pool_recycle=3600,
        echo=False,
    )


@pytest.fixture
def production_database_config() -> DatabaseConfig:
    """Create production database configuration using templates."""
    return DatabaseTemplates.production_mysql()


@pytest.fixture
def test_mysql_database_config() -> DatabaseConfig:
    """Create test MySQL database configuration using templates."""
    return DatabaseTemplates.test_mysql()


@pytest.fixture
def sqlite_database_config() -> DatabaseConfig:
    """Create SQLite database configuration using templates."""
    return DatabaseTemplates.sqlite_memory()


@pytest.fixture
def sample_s3_objects() -> list[dict[str, str]]:
    """Sample S3 objects for testing."""
    return [
        {"Key": "raw_data/parquet/events/2024-01-15.parquet"},
        {"Key": "raw_data/parquet/events/2024-01-16.parquet"},
        {"Key": "raw_data/parquet/events/2024-01-17.parquet"},
        {"Key": "raw_data/parquet/events/2024-01-18.parquet"},
        {"Key": "raw_data/parquet/events/2024-01-19.parquet"},
    ]
