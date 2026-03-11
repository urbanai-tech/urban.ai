"""Tests for Database configuration modules."""

import pytest

from raw_data_pipeline.config.database import (
    DatabaseConfig,
    DatabaseCredentials,
    DatabaseTemplates,
)


class TestDatabaseCredentials:
    """Test cases for DatabaseCredentials validation."""

    def test_valid_credentials(self) -> None:
        """Test creating valid database credentials."""
        credentials = DatabaseCredentials(
            username="testuser",
            password="testpass",
            host="localhost",
            port=3306,
            database="testdb",
        )

        assert credentials.username == "testuser"
        assert credentials.password == "testpass"
        assert credentials.host == "localhost"
        assert credentials.port == 3306
        assert credentials.database == "testdb"

    def test_credentials_connection_string(self) -> None:
        """Test database credentials connection string generation."""
        credentials = DatabaseCredentials(
            username="user",
            password="pass",
            host="example.com",
            port=3306,
            database="mydb",
        )

        expected_url = "mysql+pymysql://user:pass@example.com:3306/mydb"
        assert credentials.get_connection_string() == expected_url

    def test_credentials_with_special_characters(self) -> None:
        """Test credentials with special characters in password."""
        credentials = DatabaseCredentials(
            username="user",
            password="p@ss!w0rd",
            host="localhost",
            port=3306,
            database="testdb",
        )

        # URL should properly encode special characters
        connection_string = credentials.get_connection_string()
        assert "p%40ss%21w0rd" in connection_string  # @ becomes %40, ! becomes %21

    def test_credentials_different_driver(self) -> None:
        """Test credentials with different database driver."""
        credentials = DatabaseCredentials(
            username="user",
            password="pass",
            host="localhost",
            port=3306,
            database="testdb",
        )

        sqlite_string = credentials.get_connection_string("sqlite")
        assert sqlite_string.startswith("sqlite://")

    def test_credentials_repr_hides_password(self) -> None:
        """Test that string representation doesn't expose password."""
        credentials = DatabaseCredentials(
            username="user",
            password="secret_password",
            host="localhost",
            port=3306,
            database="testdb",
        )

        repr_str = repr(credentials)
        assert "secret_password" not in repr_str
        assert "user" in repr_str
        assert "localhost" in repr_str


class TestDatabaseConfig:
    """Test cases for DatabaseConfig."""

    def test_database_config_creation(self) -> None:
        """Test creating database configuration."""
        credentials = DatabaseCredentials(
            username="user",
            password="pass",
            host="localhost",
            port=3306,
            database="testdb",
        )

        config = DatabaseConfig(
            credentials=credentials,
            pool_size=10,
            pool_recycle=7200,
            echo=True,
        )

        assert config.credentials == credentials
        assert config.pool_size == 10
        assert config.pool_recycle == 7200
        assert config.echo is True

    def test_database_config_defaults(self) -> None:
        """Test database configuration default values."""
        credentials = DatabaseCredentials(
            username="user",
            password="pass",
            host="localhost",
            port=3306,
            database="testdb",
        )

        config = DatabaseConfig(credentials=credentials)

        # Check default values
        assert config.pool_size == 5
        assert config.pool_recycle == 3600
        assert config.pool_pre_ping is True
        assert config.echo is False

    def test_database_config_get_connection_string(self) -> None:
        """Test database configuration connection string via credentials."""
        credentials = DatabaseCredentials(
            username="user",
            password="pass",
            host="localhost",
            port=3306,
            database="testdb",
        )

        config = DatabaseConfig(credentials=credentials)
        connection_string = config.credentials.get_connection_string()

        expected_url = "mysql+pymysql://user:pass@localhost:3306/testdb"
        assert connection_string == expected_url

    def test_database_config_from_settings_missing_url(self) -> None:
        """Test database config creation with missing MySQL URL."""
        from raw_data_pipeline.config.settings import Settings

        settings = Settings()
        settings.MYSQL_URL = ""  # Empty URL

        with pytest.raises(ValueError, match="MYSQL_URL not configured"):
            DatabaseConfig.from_settings(settings)


class TestDatabaseTemplates:
    """Test cases for DatabaseTemplates."""

    def test_production_mysql_template(self) -> None:
        """Test production MySQL template."""
        config = DatabaseTemplates.production_mysql()

        assert isinstance(config, DatabaseConfig)
        assert config.credentials.host == "prod-mysql.example.com"
        assert config.credentials.database == "urban_pipeline_prod"
        assert config.pool_size == 10
        assert config.echo is False

    def test_testing_mysql_template(self) -> None:
        """Test testing MySQL template."""
        config = DatabaseTemplates.testing_mysql()

        assert isinstance(config, DatabaseConfig)
        assert config.credentials.host == "localhost"
        assert config.credentials.database == "urban_pipeline_test"
        assert config.pool_size == 1  # Single connection for tests
        assert config.echo is False

    def test_sqlite_memory_template(self) -> None:
        """Test SQLite memory template."""
        config = DatabaseTemplates.sqlite_memory()

        assert isinstance(config, DatabaseConfig)
        assert config.credentials.database == ":memory:"
        assert config.pool_size == 1
        assert config.echo is False

    def test_all_templates_return_valid_configs(self) -> None:
        """Test that all templates return valid database configurations."""
        templates = [
            DatabaseTemplates.production_mysql(),
            DatabaseTemplates.testing_mysql(),
            DatabaseTemplates.sqlite_memory(),
        ]

        for config in templates:
            assert isinstance(config, DatabaseConfig)
            assert config.credentials is not None
            assert config.pool_size > 0

    def test_template_credentials_connection_strings(self) -> None:
        """Test that template credentials can generate connection strings."""
        templates = [
            DatabaseTemplates.production_mysql(),
            DatabaseTemplates.testing_mysql(),
        ]

        for config in templates:
            connection_string = config.credentials.get_connection_string()
            assert isinstance(connection_string, str)
            assert len(connection_string) > 0
            # For MySQL templates, should contain mysql+pymysql
            if config.credentials.host != "":  # Skip SQLite
                assert "mysql+pymysql://" in connection_string


class TestDatabaseIntegration:
    """Integration tests for database configuration."""

    def test_credentials_and_config_integration(self) -> None:
        """Test integration between credentials and config."""
        credentials = DatabaseCredentials(
            username="integration_user",
            password="integration_pass",
            host="integration.host.com",
            port=3306,
            database="integration_db",
        )

        config = DatabaseConfig(
            credentials=credentials,
            pool_size=15,
            echo=True,
        )

        # Test that config properly holds credentials
        assert config.credentials.username == "integration_user"
        assert config.credentials.host == "integration.host.com"

        # Test connection string generation through config
        connection_string = config.credentials.get_connection_string()
        expected = "mysql+pymysql://integration_user:integration_pass@integration.host.com:3306/integration_db"
        assert connection_string == expected

    def test_template_modification(self) -> None:
        """Test modifying template configurations."""
        # Start with a template
        config = DatabaseTemplates.testing_mysql()

        # Verify original values
        assert config.pool_size == 1
        assert config.echo is False

        # Templates return new instances, so they can be modified
        config.pool_size = 5
        config.echo = True

        assert config.pool_size == 5
        assert config.echo is True

        # Original template should be unchanged
        fresh_config = DatabaseTemplates.testing_mysql()
        assert fresh_config.pool_size == 1
        assert fresh_config.echo is False
