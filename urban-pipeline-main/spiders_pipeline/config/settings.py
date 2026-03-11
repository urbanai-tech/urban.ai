from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="./.env", env_file_encoding="utf-8", case_sensitive=True
    )

    WEBSCRAPPING_API_URL: str = ""
    PREFECT_API_URL: str = ""


settings = Settings()
