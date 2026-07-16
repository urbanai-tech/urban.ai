"""Prefect integration for secure database configuration.

This module provides functions to safely load database configuration
from Prefect secret blocks with proper error handling.
"""

import logging
from typing import Any, cast

from ..settings import Settings
from .config import DatabaseConfig

log = logging.getLogger(__name__)

PrefectSecret: Any
try:
    from prefect.blocks.system import Secret as _PrefectSecret
except Exception:  # pragma: no cover - surfaced when setup is called
    PrefectSecret = None
else:
    PrefectSecret = _PrefectSecret

# Backward-compatible module alias used by existing integrations and tests.
Secret: Any = PrefectSecret


def _load_secret_value(secret_name: str) -> str:
    """Load a synchronous Prefect Secret value with a stable string type."""
    if Secret is None:
        raise ValueError("Prefect Secret block is not available")
    secret_block = cast(Any, Secret.load(secret_name))
    return str(secret_block.get())


def setup_database_from_prefect(
    secret_name: str = "mysql-bronze-url",
    test_connection: bool = True,
    **config_overrides: Any,
) -> DatabaseConfig:
    """Setup database configuration from Prefect secret with optional connection testing.

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
        settings = Settings()
        settings.MYSQL_URL = _load_secret_value(secret_name)

        database_config = DatabaseConfig.from_settings(settings)

        if config_overrides:
            for key, value in config_overrides.items():
                if hasattr(database_config, key):
                    setattr(database_config, key, value)

        if test_connection:
            if database_config.test_connection():
                log.info("Database connection successful using Prefect configuration.")
            else:
                raise ConnectionError("Database connection failed.")

        return database_config

    except Exception as e:
        raise ValueError("Failed to setup database from Prefect configuration.") from e


def create_database_config_from_secret(secret_name: str) -> DatabaseConfig:
    """Create database configuration from Prefect secret without testing connection.

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
        settings = Settings()
        settings.MYSQL_URL = _load_secret_value(secret_name)
        return DatabaseConfig.from_settings(settings)
    except Exception as e:
        raise ValueError(
            f"Failed to create database config from secret '{secret_name}': {e}"
        ) from e
