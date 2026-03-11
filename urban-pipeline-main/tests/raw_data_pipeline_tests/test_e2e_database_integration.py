"""
Database integration E2E tests for the raw data pipeline.

Tests database configuration, connection pooling, and data persistence
using the existing test infrastructure.
"""

# ruff: noqa: F811  # pytest fixtures appear as redefinitions

from unittest.mock import patch

import pandas as pd
import pytest
from sqlalchemy import create_engine, text

from raw_data_pipeline.config.database import (
    DatabaseConfig,
    DatabaseCredentials,
    DatabaseTemplates,
)
from raw_data_pipeline.load.load_on_mysql import (
    load_dataframe_to_mysql,
    load_multiple_dataframes_to_mysql,
)

# Import existing fixtures from conftest
from .conftest import (  # noqa: F401
    sqlite_database_config,
    test_database_config,
    test_database_credentials,
)


class TestDatabaseIntegrationE2E:
    """Test database integration scenarios."""

    def test_database_config_connection_lifecycle(
        self, sqlite_database_config: DatabaseConfig
    ):
        """Test complete database connection lifecycle."""
        db_config = sqlite_database_config

        # Test connection creation
        engine = db_config.get_engine()
        assert engine is not None

        # Test connection works
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            assert result.fetchone()[0] == 1

        # Test connection disposal
        engine.dispose()

    def test_database_table_creation_and_data_persistence(
        self, sqlite_database_config: DatabaseConfig
    ):
        """Test table creation and data persistence within the same connection."""
        # Create test data
        test_data = pd.DataFrame(
            {
                "id": [1, 2, 3],
                "name": ["Alice", "Bob", "Charlie"],
                "value": [10.5, 20.3, 30.7],
            }
        )

        # Use same engine to test within-session persistence
        engine = sqlite_database_config.get_engine()

        # Create table and insert data
        rows_inserted = test_data.to_sql(
            name="persistence_test",
            con=engine,
            if_exists="replace",
            index=False,
        )
        assert rows_inserted == 3

        # Verify data persists within same engine/connection
        retrieved_data = pd.read_sql("SELECT * FROM persistence_test", engine)

        assert len(retrieved_data) == 3
        assert list(retrieved_data.columns) == ["id", "name", "value"]
        assert retrieved_data["name"].tolist() == ["Alice", "Bob", "Charlie"]

        engine.dispose()

    def test_load_dataframe_integration(self, sqlite_database_config: DatabaseConfig):
        """Test load_dataframe_to_mysql function with real database."""
        # Create test DataFrame
        test_df = pd.DataFrame(
            {
                "event_id": ["evt_001", "evt_002", "evt_003"],
                "title": ["Concert A", "Theater B", "Sports C"],
                "price": [100.0, 75.5, 120.0],
                "venue": ["Venue 1", "Venue 2", "Venue 3"],
            }
        )

        # Mock database config loading using patch
        with patch(
            "raw_data_pipeline.load.load_on_mysql.setup_database_from_prefect"
        ) as mock_setup:
            mock_setup.return_value = sqlite_database_config

            # Test loading
            rows_loaded = load_dataframe_to_mysql(
                df=test_df,
                table_name="events_test",
                if_exists="replace",
            )

            assert rows_loaded == 3

            # Verify data in database
            engine = sqlite_database_config.get_engine()
            db_data = pd.read_sql("SELECT * FROM events_test", engine)

            assert len(db_data) == 3
            assert "event_id" in db_data.columns
            assert db_data["title"].tolist() == ["Concert A", "Theater B", "Sports C"]

    def test_load_multiple_dataframes_integration(
        self, sqlite_database_config: DatabaseConfig
    ):
        """Test load_multiple_dataframes_to_mysql with real database."""
        # Create multiple test DataFrames
        df1 = pd.DataFrame(
            {
                "id": [1, 2],
                "source": ["batch1", "batch1"],
                "value": [10, 20],
            }
        )
        df2 = pd.DataFrame(
            {
                "id": [3, 4],
                "source": ["batch2", "batch2"],
                "value": [30, 40],
            }
        )
        df3 = pd.DataFrame(
            {
                "id": [5, 6],
                "source": ["batch3", "batch3"],
                "value": [50, 60],
            }
        )

        dataframes = [df1, df2, df3]

        # Mock database config loading using patch
        with patch(
            "raw_data_pipeline.load.load_on_mysql.setup_database_from_prefect"
        ) as mock_setup:
            mock_setup.return_value = sqlite_database_config

            # Test loading multiple DataFrames
            total_rows = load_multiple_dataframes_to_mysql(
                dataframes=dataframes,
                table_name="batches_test",
                if_exists="replace",
            )

            assert total_rows == 6  # 2 + 2 + 2

            # Verify data in database
            engine = sqlite_database_config.get_engine()
            db_data = pd.read_sql("SELECT * FROM batches_test ORDER BY id", engine)

            assert len(db_data) == 6
            assert db_data["source"].tolist() == [
                "batch1",
                "batch1",
                "batch2",
                "batch2",
                "batch3",
                "batch3",
            ]
            assert db_data["value"].tolist() == [10, 20, 30, 40, 50, 60]

    def test_database_error_handling(
        self, test_database_credentials: DatabaseCredentials
    ):
        """Test database error handling scenarios."""
        # Test with invalid credentials
        invalid_credentials = DatabaseCredentials(
            host="nonexistent_host",
            port=9999,
            username="invalid_user",
            password="invalid_password",
            database="nonexistent_db",
        )

        invalid_config = DatabaseConfig(
            credentials=invalid_credentials,
            echo=False,
        )

        # Should be able to create engine but connection should fail
        engine = invalid_config.get_engine()

        with pytest.raises((ConnectionError, Exception)) as exc_info:
            engine.connect()
        # Should fail to connect to invalid host/database

    def test_database_templates_functionality(self):
        """Test database template configurations."""
        # Test production template
        prod_config = DatabaseTemplates.production_mysql()
        assert isinstance(prod_config, DatabaseConfig)
        assert prod_config.credentials.host == "prod-mysql.example.com"
        assert prod_config.echo is False  # No SQL logging in production
        assert prod_config.pool_size == 10

        # Test testing template
        test_config = DatabaseTemplates.testing_mysql()
        assert isinstance(test_config, DatabaseConfig)
        assert test_config.credentials.host == "localhost"
        assert test_config.echo is False
        assert test_config.pool_size == 1

        # Test SQLite template
        sqlite_config = DatabaseTemplates.sqlite_memory()
        assert isinstance(sqlite_config, DatabaseConfig)
        assert sqlite_config.credentials.database == ":memory:"
        assert sqlite_config.echo is False
        assert sqlite_config.pool_size == 1

    def test_connection_string_generation(
        self, test_database_credentials: DatabaseCredentials
    ):
        """Test database connection string generation."""
        connection_string = test_database_credentials.get_connection_string()

        # Should contain all necessary components
        assert "mysql+pymysql://" in connection_string
        assert test_database_credentials.username in connection_string
        assert test_database_credentials.host in connection_string
        assert str(test_database_credentials.port) in connection_string
        assert test_database_credentials.database in connection_string

    def test_database_concurrent_connections(
        self, sqlite_database_config: DatabaseConfig
    ):
        """Test multiple concurrent database connections."""
        # Create test data
        test_data = pd.DataFrame(
            {
                "id": range(100),
                "value": [f"value_{i}" for i in range(100)],
            }
        )

        # Create multiple engines (simulating concurrent access)
        engines = [sqlite_database_config.get_engine() for _ in range(3)]

        try:
            # Each engine inserts data to a different table
            for i, engine in enumerate(engines):
                table_name = f"concurrent_test_{i}"
                test_data.to_sql(
                    name=table_name,
                    con=engine,
                    if_exists="replace",
                    index=False,
                )

            # Verify all tables were created successfully
            for i, engine in enumerate(engines):
                table_name = f"concurrent_test_{i}"
                query = f"SELECT COUNT(*) as count FROM {table_name}"
                data = pd.read_sql(query, engine)
                assert data["count"].iloc[0] == 100

        finally:
            # Cleanup
            for engine in engines:
                engine.dispose()


class TestDatabaseConnectionPooling:
    """Test database connection pooling behavior."""

    def test_connection_pool_configuration(
        self, sqlite_database_config: DatabaseConfig
    ):
        """Test connection pool configuration options."""
        # Use SQLite config to avoid needing MySQL server
        engine = sqlite_database_config.get_engine()

        # Verify pool configuration exists
        assert hasattr(engine.pool, "size")
        # Test that we can create connections
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            assert result.fetchone()[0] == 1

    def test_connection_reuse(self, sqlite_database_config: DatabaseConfig):
        """Test that connections are properly reused from the pool."""
        engine = sqlite_database_config.get_engine()

        # Perform multiple operations
        for i in range(5):
            with engine.connect() as conn:
                result = conn.execute(text(f"SELECT {i} as value"))
                assert result.fetchone()[0] == i

        # All operations should have succeeded with connection reuse
        # In SQLite, this mainly tests that connections work correctly
        engine.dispose()


class TestDatabaseMigrationScenarios:
    """Test database migration and schema change scenarios."""

    def test_table_schema_evolution(self, sqlite_database_config: DatabaseConfig):
        """Test handling of table schema changes."""
        engine = sqlite_database_config.get_engine()

        # Create initial table
        initial_data = pd.DataFrame(
            {
                "id": [1, 2, 3],
                "name": ["A", "B", "C"],
            }
        )

        initial_data.to_sql(
            name="evolution_test",
            con=engine,
            if_exists="replace",
            index=False,
        )

        # Read back to verify
        with engine.connect() as conn:
            result = pd.read_sql("SELECT * FROM evolution_test", conn)
            assert len(result) == 3
            assert list(result.columns) == ["id", "name"]

        # For schema evolution, we need to handle it differently
        # First, let's add the new column using ALTER TABLE
        with engine.connect() as conn:
            # Add new columns to the existing table
            conn.execute(text("ALTER TABLE evolution_test ADD COLUMN category TEXT"))
            conn.execute(text("ALTER TABLE evolution_test ADD COLUMN timestamp TEXT"))
            conn.commit()

        # Now add the evolved data
        evolved_data = pd.DataFrame(
            {
                "id": [4, 5, 6],
                "name": ["D", "E", "F"],
                "category": ["X", "Y", "Z"],
                "timestamp": pd.to_datetime(
                    ["2024-01-01", "2024-01-02", "2024-01-03"]
                ).astype(str),
            }
        )

        # This should now work with the evolved schema
        evolved_data.to_sql(
            name="evolution_test",
            con=engine,
            if_exists="append",
            index=False,
        )

        # Verify data
        final_data = pd.read_sql("SELECT * FROM evolution_test", engine)
        assert len(final_data) == 6

        engine.dispose()

    def test_data_type_handling(self, sqlite_database_config: DatabaseConfig):
        """Test various data types in database operations."""
        # Create DataFrame with various data types
        diverse_data = pd.DataFrame(
            {
                "int_col": [1, 2, 3],
                "float_col": [1.1, 2.2, 3.3],
                "str_col": ["a", "b", "c"],
                "bool_col": [True, False, True],
                "datetime_col": pd.to_datetime(
                    ["2024-01-01", "2024-01-02", "2024-01-03"]
                ),
            }
        )

        engine = sqlite_database_config.get_engine()

        # Insert data
        diverse_data.to_sql(
            name="types_test",
            con=engine,
            if_exists="replace",
            index=False,
        )

        # Retrieve and verify
        retrieved_data = pd.read_sql("SELECT * FROM types_test", engine)

        assert len(retrieved_data) == 3
        assert retrieved_data["int_col"].dtype.name.startswith(("int", "Int"))
        assert retrieved_data["float_col"].dtype.name.startswith("float")
        assert retrieved_data["str_col"].dtype == "object"

        engine.dispose()
