import enum
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, enum.Enum):
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    project_name: str = "EduConnect"
    api_v1_str: str = "/api/v1"
    environment: Environment = Environment.DEVELOPMENT

    # Server configuration
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"

    # Placeholder for database connectivity to satisfy health checks in the future
    database_url: str | None = None
    redis_url: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    """Returns a cached instance of the settings."""
    return Settings()
