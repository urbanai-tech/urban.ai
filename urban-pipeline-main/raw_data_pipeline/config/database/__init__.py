"""
Database configuration module for raw data pipeline.

This module provides database connection management, configuration templates,
and secure integration with Prefect secrets.

Components:
- DatabaseCredentials: Secure credential management
- DatabaseConfig: Connection pooling and session management
- DatabaseTemplates: Pre-configured environment templates
- Prefect Integration: Secure secret loading from Prefect

Usage:
    >>> from raw_data_pipeline.config.database import (
    ...     DatabaseConfig,
    ...     setup_database_from_prefect,
    ... )

    >>> # Production usage with Prefect
    >>> db_config = setup_database_from_prefect("mysql-prod-url")

    >>> # Development usage
    >>> from raw_data_pipeline.config.database import DatabaseTemplates
    >>> db_config = DatabaseTemplates.development_mysql()
"""

from .config import DatabaseConfig
from .credentials import DatabaseCredentials
from .prefect_integration import (
    create_database_config_from_secret,
    setup_database_from_prefect,
)
from .templates import DatabaseTemplates

__all__ = [
    # Core classes
    "DatabaseConfig",
    "DatabaseCredentials",
    "DatabaseTemplates",
    # Prefect integration
    "setup_database_from_prefect",
    "create_database_config_from_secret",
]
