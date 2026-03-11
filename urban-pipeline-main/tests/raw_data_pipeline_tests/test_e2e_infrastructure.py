"""
End-to-end test infrastructure for urban pipeline.

This module provides comprehensive testing infrastructure for E2E tests,
including database and S3 mocking capabilities.
"""

import contextlib
import tempfile
from collections.abc import Generator
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from moto import mock_aws
from sqlalchemy import create_engine, text
from testcontainers.mysql import MySqlContainer

from raw_data_pipeline.config.database import (
    DatabaseConfig,
    DatabaseCredentials,
)


class E2ETestDatabase:
    """
    End-to-end test database management.
    
    Provides database instances for testing with proper lifecycle management.
    """

    def __init__(self) -> None:
        self.container: MySqlContainer | None = None
        self.engine: Any = None
        self.db_config: DatabaseConfig | None = None

    def start(self) -> DatabaseConfig:
        """
        Start MySQL container and return database configuration.
        
        Returns:
            DatabaseConfig: Configuration for the test database
        """
        self.container = MySqlContainer("mysql:8.0")
        self.container.start()
        
        # Create database configuration from container
        credentials = DatabaseCredentials(
            host=self.container.get_container_host_ip(),
            port=self.container.get_exposed_port(3306),
            username=self.container.username,
            password=self.container.password,
            database=self.container.dbname,
        )
        
        self.db_config = DatabaseConfig(
            credentials=credentials,
            echo=True,  # Enable SQL logging for debugging
            pool_size=2,  # Small pool for testing
            pool_recycle=3600,
        )
        
        self.engine = self.db_config.get_engine()
        
        # Verify connection
        with self.engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            assert result.fetchone()[0] == 1
        
        return self.db_config

    def stop(self) -> None:
        """Stop and cleanup MySQL container."""
        if self.engine:
            self.engine.dispose()
        if self.container:
            self.container.stop()

    def reset_database(self) -> None:
        """Reset database by dropping and recreating all tables."""
        # Get engine from either self.engine or self.db_config
        engine = None
        if self.engine:
            engine = self.engine
        elif self.db_config:
            engine = self.db_config.get_engine()
        else:
            raise RuntimeError("Database not started")
        
        with engine.connect() as conn:
            # Check if this is SQLite or MySQL and handle accordingly
            try:
                # Try SQLite approach first
                result = conn.execute(text(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ))
                tables = [row[0] for row in result.fetchall()]
                
                # Drop tables for SQLite
                for table in tables:
                    if table != 'sqlite_sequence':  # Skip system table
                        conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
                conn.commit()
                        
            except Exception:
                # Fall back to MySQL approach
                try:
                    result = conn.execute(text("SHOW TABLES"))
                    tables = [row[0] for row in result.fetchall()]
                    
                    # Drop tables for MySQL
                    for table in tables:
                        conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
                    conn.commit()
                except Exception:
                    # If both fail, just continue - might be an empty database
                    pass

    def get_table_data(self, table_name: str) -> pd.DataFrame:
        """
        Get all data from a specific table.
        
        Args:
            table_name: Name of the table to query
            
        Returns:
            pd.DataFrame: All data from the table
        """
        engine = (
            self.engine or 
            (self.db_config.get_engine() if self.db_config else None)
        )
        if not engine:
            raise RuntimeError("Database not started")
        
        return pd.read_sql(f"SELECT * FROM {table_name}", engine)


class E2ETestS3:
    """
    End-to-end S3 testing with moto mock.
    
    Provides mock S3 service for testing S3 operations.
    """

    def __init__(self) -> None:
        self.mock_aws_context = None
        self.bucket_name = "urban-ai-data"
        self.prefix = "raw_data/parquet/"

    def start(self) -> None:
        """Start mock AWS S3 service."""
        self.mock_aws_context = mock_aws()
        self.mock_aws_context.start()
        
        # Create mock S3 bucket
        import boto3
        s3_client = boto3.client("s3", region_name="us-east-1")
        s3_client.create_bucket(Bucket=self.bucket_name)

    def stop(self) -> None:
        """Stop mock AWS S3 service."""
        if self.mock_aws_context:
            self.mock_aws_context.stop()

    def upload_test_file(self, key: str, content: bytes) -> None:
        """
        Upload test file to mock S3.
        
        Args:
            key: S3 object key
            content: File content as bytes
        """
        import boto3
        s3_client = boto3.client("s3", region_name="us-east-1")
        s3_client.put_object(Bucket=self.bucket_name, Key=key, Body=content)

    def create_test_folder_structure(
        self, datasets: dict[str, pd.DataFrame]
    ) -> dict[str, list[str]]:
        """
        Create test folder structure in S3.
        
        Args:
            datasets: Dictionary mapping folder names to DataFrames
            
        Returns:
            dict: Mapping of folder names to list of uploaded file keys
        """
        uploaded_files = {}
        
        for folder_name, df in datasets.items():
            # Convert DataFrame to parquet bytes
            parquet_buffer = df.to_parquet()
            
            # Create S3 key
            key = f"{self.prefix}{folder_name}/data.parquet"
            
            # Upload to mock S3
            self.upload_test_file(key, parquet_buffer)
            
            uploaded_files[folder_name] = [key]
        
        return uploaded_files


class E2ETestDataFactory:
    """
    Factory for creating test datasets.
    
    Provides standardized test data for E2E testing scenarios.
    """

    def create_valid_dataset(self, size: int = 100) -> pd.DataFrame:
        """
        Create a valid test dataset.
        
        Args:
            size: Number of rows to generate
            
        Returns:
            pd.DataFrame: Valid test dataset
        """
        return pd.DataFrame({
            "id": range(1, size + 1),
            "name": [f"Name_{i}" for i in range(1, size + 1)],
            "value": [i * 10.5 for i in range(1, size + 1)],
            "category": ["A", "B", "C"] * (size // 3 + 1),
            "created_at": pd.date_range("2024-01-01", periods=size, freq="D"),
        })[:size]

    def create_dataset_with_nulls(self, size: int = 50) -> pd.DataFrame:
        """
        Create dataset with null values for testing.
        
        Args:
            size: Number of rows to generate
            
        Returns:
            pd.DataFrame: Dataset containing null values
        """
        df = self.create_valid_dataset(size)
        # Introduce nulls in some columns
        df.loc[::5, "name"] = None
        df.loc[::7, "value"] = None
        return df

    def create_large_dataset(self, size: int = 10000) -> pd.DataFrame:
        """
        Create large dataset for performance testing.
        
        Args:
            size: Number of rows to generate
            
        Returns:
            pd.DataFrame: Large test dataset
        """
        return self.create_valid_dataset(size)

    def create_test_datasets(self) -> dict[str, pd.DataFrame]:
        """
        Create multiple test datasets for folder structure testing.
        
        Returns:
            dict: Mapping of folder names to DataFrames
        """
        return {
            "events": self.create_valid_dataset(50),
            "users": self.create_dataset_with_nulls(30),
            "transactions": self.create_large_dataset(100),
        }

    def create_invalid_dataset(self) -> pd.DataFrame:
        """
        Create dataset with various data quality issues.
        
        Returns:
            pd.DataFrame: Dataset with data quality issues
        """
        return pd.DataFrame({
            "event_id": [None, "", "valid_id", "duplicate_id", "duplicate_id"],
            "title": ["", None, "Valid Title", "Another Title", "Final Title"],
            "price": [None, -50.0, 100.0, "invalid_price", float("inf")],
            "date": [None, "invalid_date", "2024-12-31", "2024-02-30", "2024-01-01"],
        })


@pytest.fixture(scope="session")
def e2e_database() -> Generator[E2ETestDatabase, None, None]:
    """
    Pytest fixture for E2E database testing.
    
    Provides a database instance for the entire test session.
    Uses SQLite for simplicity in CI/CD environments.
    """
    from raw_data_pipeline.config.database import (
        DatabaseConfig,
        DatabaseCredentials,
    )
    
    db = E2ETestDatabase()
    temp_db_path = None
    
    try:
        # Create a temporary SQLite database
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as temp_db:
            temp_db_path = temp_db.name
        
        credentials = DatabaseCredentials(
            host="",
            port=0,
            database=temp_db_path,
            username="",
            password="",
        )
        
        db.db_config = DatabaseConfig(
            credentials=credentials,
            driver="sqlite",
        )
        
        yield db
    finally:
        if temp_db_path:
            with contextlib.suppress(Exception):
                Path(temp_db_path).unlink(missing_ok=True)


@pytest.fixture(scope="function")
def clean_database(e2e_database: E2ETestDatabase) -> E2ETestDatabase:
    """
    Pytest fixture that provides a clean database for each test.
    
    Args:
        e2e_database: Session-scoped database fixture
        
    Returns:
        E2ETestDatabase: Clean database instance
    """
    e2e_database.reset_database()
    return e2e_database


@pytest.fixture(scope="function")
def e2e_s3() -> Generator[E2ETestS3, None, None]:
    """
    Pytest fixture for mock S3 service.
    
    Provides a mock S3 service for each test function.
    """
    s3 = E2ETestS3()
    try:
        s3.start()
        yield s3
    finally:
        s3.stop()


@pytest.fixture(scope="function")
def test_data_factory() -> E2ETestDataFactory:
    """Pytest fixture for test data factory."""
    return E2ETestDataFactory()


@pytest.fixture(scope="function")
def populated_s3(
    e2e_s3: E2ETestS3, test_data_factory: E2ETestDataFactory
) -> tuple[E2ETestS3, dict[str, list[str]]]:
    """
    Pytest fixture that provides S3 with pre-populated test data.
    
    Args:
        e2e_s3: Mock S3 service
        test_data_factory: Test data factory
        
    Returns:
        tuple: (S3 service, mapping of folder names to uploaded files)
    """
    test_datasets = test_data_factory.create_test_datasets()
    uploaded_files = e2e_s3.create_test_folder_structure(test_datasets)
    return e2e_s3, uploaded_files


@pytest.fixture(scope="function")
def mock_prefect_secrets(clean_database: E2ETestDatabase):
    """
    Mock Prefect secrets to use test database configuration.
    
    Args:
        clean_database: Clean test database instance
    """
    def mock_secret_load(secret_name: str):
        """Mock secret loading to return test database URL."""
        mock_secret = MagicMock()
        mock_secret.get.return_value = clean_database.db_config.get_connection_string()
        return mock_secret
    
    with patch(
        "raw_data_pipeline.config.database.prefect_integration.Secret.load",
        side_effect=mock_secret_load
    ):
        yield


@pytest.fixture(scope="function")
def mock_aws_credentials():
    """Mock AWS credentials for testing."""
    with patch.dict(
        "os.environ",
        {
            "AWS_ACCESS_KEY_ID": "test-key",
            "AWS_SECRET_ACCESS_KEY": "test-secret",
            "AWS_DEFAULT_REGION": "us-east-1",
        },
    ):
        yield


@pytest.fixture(scope="function")
def sample_s3_objects() -> list[dict[str, Any]]:
    """Sample S3 objects for testing."""
    return [
        {"Key": "raw_data/parquet/events/data1.parquet", "Size": 1024},
        {"Key": "raw_data/parquet/events/data2.parquet", "Size": 2048},
        {"Key": "raw_data/parquet/users/users.parquet", "Size": 512},
    ]