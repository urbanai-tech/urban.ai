"""
Prefect integration for secure database configuration.

This module provides functions to safely load database configuration
from Prefect secret blocks with proper error handling.
"""

from ..settings import Settings
from .config import DatabaseConfig


def setup_database_from_prefect(
    secret_name: str = "mysql-bronze-url",
    test_connection: bool = True,
    **config_overrides,
) -> DatabaseConfig:
    """
    Setup database configuration from Prefect secret with optional connection testing.

    Args:
        secret_name: Name of the Prefect secret block
        test_connection: Whether to test the connection before returning config
        **config_overrides: Additional configuration parameters

    Returns:
        DatabaseConfig: Configured and tested database instance

    Raises:
        ValueError: If configuration fails
        ConnectionError: If connection test fails

    Example:
        >>> # Basic usage
        >>> db_config = setup_database_from_prefect()

        >>> # With custom settings
        >>> db_config = setup_database_from_prefect(
        ...     secret_name="mysql-prod-url", echo=True, pool_size=20
        ... )
    """
    try:
        settings = Settings.create_with_prefect_db(secret_name)

        database_config = DatabaseConfig.from_settings(settings)

        if config_overrides:
            for key, value in config_overrides.items():
                if hasattr(database_config, key):
                    setattr(database_config, key, value)

        if test_connection:
            if database_config.test_connection():
                print(f"Database connection successful using secret '{secret_name}'.")
            else:
                raise ConnectionError(
                    f"Database connection failed using secret '{secret_name}'"
                )

        return database_config

    except Exception as e:
        raise ValueError(
            f"Failed to setup database from Prefect secret '{secret_name}': {e}"
        ) from e


def create_database_config_from_secret(secret_name: str) -> DatabaseConfig:
    """
    Create database configuration from Prefect secret without testing connection.

    This is useful when you want to create the configuration but test the
    connection separately or in a different context.

    Args:
        secret_name: Name of the Prefect secret block

    Returns:
        DatabaseConfig: Configured database instance (untested)

    Raises:
        ValueError: If configuration fails
    """
    try:
        settings = Settings.create_with_prefect_db(secret_name)
        return DatabaseConfig.from_settings(settings)
    except Exception as e:
        raise ValueError(
            f"Failed to create database config from secret '{secret_name}': {e}"
        ) from e
