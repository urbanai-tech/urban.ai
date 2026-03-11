"""
Database configuration and connection management.

This module provides the main DatabaseConfig class for managing database
connections, pools, and sessions.
"""

from pydantic import BaseModel, Field
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from ..settings import Settings
from .credentials import DatabaseCredentials


class DatabaseConfig(BaseModel):
    """Database configuration with connection management."""

    credentials: DatabaseCredentials
    pool_size: int = Field(default=5, description="Connection pool size")
    pool_recycle: int = Field(
        default=3600, description="Connection recycle time in seconds"
    )
    pool_pre_ping: bool = Field(
        default=True, description="Enable connection health checks"
    )
    echo: bool = Field(default=False, description="Enable SQL query logging")

    _engine: Engine | None = None
    _session_factory: sessionmaker[Session] | None = None

    class Config:
        arbitrary_types_allowed = True

    @classmethod
    def from_settings(cls, settings: Settings) -> "DatabaseConfig":
        """
        Create database configuration from application settings.

        Args:
            settings: Application settings instance

        Returns:
            DatabaseConfig: Configured database instance
        """
        if not settings.MYSQL_URL:
            raise ValueError("MYSQL_URL not configured in settings")

        # Parse MySQL URL format: mysql://user:password@host:port/database
        url_parts = settings.MYSQL_URL.replace("mysql://", "").split("/")
        database = url_parts[1] if len(url_parts) > 1 else "default"

        host_part = url_parts[0].split("@")
        host_port = host_part[1] if len(host_part) > 1 else "localhost:3306"
        user_pass = host_part[0] if len(host_part) > 1 else "root:"

        username = user_pass.split(":")[0]
        password = user_pass.split(":")[1] if ":" in user_pass else ""

        host = host_port.split(":")[0]
        port = int(host_port.split(":")[1]) if ":" in host_port else 3306

        credentials = DatabaseCredentials(
            host=host,
            port=port,
            username=username,
            password=password,
            database=database,
        )

        return cls(credentials=credentials)

    def get_engine(self) -> Engine:
        """
        Get or create SQLAlchemy engine instance.

        Returns:
            Engine: SQLAlchemy engine for database operations
        """
        if self._engine is None:
            connection_string = self.credentials.get_connection_string()
            self._engine = create_engine(
                connection_string,
                pool_size=self.pool_size,
                pool_recycle=self.pool_recycle,
                pool_pre_ping=self.pool_pre_ping,
                echo=self.echo,
            )
        return self._engine

    def get_session_factory(self) -> sessionmaker[Session]:
        """
        Get or create session factory for database operations.

        Returns:
            sessionmaker: Session factory for creating database sessions
        """
        if self._session_factory is None:
            engine = self.get_engine()
            self._session_factory = sessionmaker(bind=engine)
        return self._session_factory

    def create_session(self) -> Session:
        """
        Create new database session.

        Returns:
            Session: New database session instance
        """
        session_factory = self.get_session_factory()
        return session_factory()

    def test_connection(self) -> bool:
        """
        Test database connection.

        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            engine = self.get_engine()
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return True
        except Exception as e:
            print(f"Database connection test failed: {e}")
            return False

    def close_connections(self) -> None:
        """Close all database connections and clean up resources."""
        if self._engine:
            self._engine.dispose()
            self._engine = None
            self._session_factory = None
