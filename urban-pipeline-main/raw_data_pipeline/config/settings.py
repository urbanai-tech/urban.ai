from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings with secure Prefect secret integration.

    This class provides centralized configuration management with lazy loading
    of Prefect secrets to avoid runtime errors during import.
    """

    model_config = SettingsConfigDict(
        env_file="./.env", env_file_encoding="utf-8", case_sensitive=True
    )

    # Prefect
    PREFECT_API_URL: str = ""

    # Database - will be populated from Prefect secret when needed
    MYSQL_URL: str = ""

    # AWS Configuration - will be populated from environment or Prefect secrets
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-2"
    ASSUME_ROLE_ARN: str = ""
    ASSUME_ROLE_EXTERNAL_ID: str = ""
    ROLE_SESSION_NAME: str = "urban-pipeline-session"

    @property
    def assume_role_arn(self) -> str:
        """Get the assume role ARN."""
        return self.ASSUME_ROLE_ARN

    @property
    def assume_role_external_id(self) -> str:
        """Get the assume role external ID."""
        return self.ASSUME_ROLE_EXTERNAL_ID

    @property
    def role_session_name(self) -> str:
        """Get the role session name."""
        return self.ROLE_SESSION_NAME

    def load_database_url_from_prefect(
        self, secret_name: str = "mysql-bronze-url"
    ) -> str:
        """
        Safely load database URL from Prefect secret.

        Args:
            secret_name: Name of the Prefect secret block

        Returns:
            str: Database URL from Prefect secret

        Raises:
            ValueError: If secret cannot be loaded
        """
        try:
            from prefect.blocks.system import Secret

            database_url = Secret.load(secret_name).get()
            self.MYSQL_URL = database_url
            return database_url

        except Exception as e:
            raise ValueError(
                f"Failed to load database URL from Prefect secret '{secret_name}': {e}"
            ) from e

    @classmethod
    def create_with_prefect_db(
        cls, secret_name: str = "mysql-bronze-url"
    ) -> "Settings":
        """
        Create Settings instance with database URL loaded from Prefect secret.

        Args:
            secret_name: Name of the Prefect secret block

        Returns:
            Settings: Configured settings instance
        """
        settings = cls()
        settings.load_database_url_from_prefect(secret_name)
        return settings
