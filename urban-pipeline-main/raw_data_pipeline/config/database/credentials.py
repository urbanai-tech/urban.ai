"""
Database credentials management.

This module provides secure credential handling and connection string generation
for database connections.
"""

from dataclasses import dataclass
from urllib.parse import quote_plus


@dataclass
class DatabaseCredentials:
    """Database connection credentials with connection string generation."""

    host: str
    port: int
    username: str
    password: str
    database: str

    def get_connection_string(self, driver: str = "mysql+pymysql") -> str:
        """
        Generate database connection string.

        Args:
            driver: Database driver string (default: mysql+pymysql)

        Returns:
            str: Formatted connection string
        """
        encoded_password = quote_plus(self.password)
        return (
            f"{driver}://{self.username}:{encoded_password}"
            f"@{self.host}:{self.port}/{self.database}"
        )

    def __repr__(self) -> str:
        """Safe string representation without exposing password."""
        return (
            f"DatabaseCredentials(host='{self.host}', port={self.port}, "
            f"username='{self.username}', database='{self.database}')"
        )
