"""
Database configuration templates for different environments.

This module provides pre-configured database settings for development,
production, and testing environments.
"""

from .config import DatabaseConfig
from .credentials import DatabaseCredentials


class DatabaseTemplates:
    """Template configurations for different database environments."""

    @staticmethod
    def production_mysql() -> DatabaseConfig:
        """
        Production MySQL configuration template.

        Features:
        - SQL logging disabled for performance
        - Large connection pool for high load
        - Extended connection recycling for stability

        Returns:
            DatabaseConfig: Production-optimized configuration
        """
        credentials = DatabaseCredentials(
            host="prod-mysql.example.com",
            port=3306,
            username="prod_user",
            password="prod_password",
            database="urban_pipeline_prod",
        )
        return DatabaseConfig(
            credentials=credentials,
            echo=False,
            pool_size=10,
            pool_recycle=7200,
        )

    @staticmethod
    def testing_mysql() -> DatabaseConfig:
        """
        Testing MySQL configuration template.

        Features:
        - Minimal resource usage
        - Single connection for predictable testing
        - No SQL logging for clean test output

        Returns:
            DatabaseConfig: Testing-optimized configuration
        """
        credentials = DatabaseCredentials(
            host="localhost",
            port=3306,
            username="test_user",
            password="test_password",
            database="urban_pipeline_test",
        )
        return DatabaseConfig(
            credentials=credentials,
            echo=False,
            pool_size=1,  # Single connection for tests
        )

    @staticmethod
    def sqlite_memory() -> DatabaseConfig:
        """
        In-memory SQLite configuration for fast testing.

        Features:
        - No persistent storage
        - Ultra-fast for unit tests
        - No connection pooling needed

        Returns:
            DatabaseConfig: In-memory SQLite configuration
        """
        credentials = DatabaseCredentials(
            host="",
            port=0,
            username="",
            password="",
            database=":memory:",
        )

        config = DatabaseConfig(
            credentials=credentials,
            echo=False,
            pool_size=1,
        )

        config.credentials.get_connection_string = (
            lambda driver="sqlite": "sqlite:///:memory:"
        )

        return config
