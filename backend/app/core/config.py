from typing import Annotated, Literal, Optional

from sqlalchemy.engine import make_url

from pydantic import AnyHttpUrl, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENVIRONMENT: Literal["development", "test", "production"] = "development"

    PROJECT_NAME: str = "University Attendance System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = Field(..., min_length=32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    ALGORITHM: str = "HS256"

    POSTGRES_SERVER: Optional[str] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    SQLALCHEMY_DATABASE_URI: Optional[str] = None

    RP_ID: str = Field(..., min_length=1)
    RP_NAME: str = "University Attendance System"
    ORIGIN: AnyHttpUrl
    BACKEND_CORS_ORIGINS: Annotated[list[str], NoDecode] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> list[str]:
        if value is None or value == "":
            return []
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        if isinstance(value, list):
            return [str(origin).strip() for origin in value if str(origin).strip()]
        raise ValueError("BACKEND_CORS_ORIGINS must be a comma-separated string or list.")

    @model_validator(mode="after")
    def finalize_settings(self) -> "Settings":
        if self.SQLALCHEMY_DATABASE_URI:
            self.SQLALCHEMY_DATABASE_URI = self._normalize_async_database_uri(self.SQLALCHEMY_DATABASE_URI)
        else:
            missing_fields = [
                name
                for name in ("POSTGRES_SERVER", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB")
                if not getattr(self, name)
            ]
            if missing_fields:
                raise ValueError(
                    "Set SQLALCHEMY_DATABASE_URI or provide all POSTGRES_* settings. "
                    f"Missing: {', '.join(missing_fields)}"
                )
            self.SQLALCHEMY_DATABASE_URI = (
                f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
                f"@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"
            )

        insecure_secret_values = {
            "supersecretkeychangeinprod",
            "change-this-in-production",
            "changeme",
        }
        if self.SECRET_KEY in insecure_secret_values:
            raise ValueError("SECRET_KEY must be set from the environment and cannot use a placeholder value.")

        if self.ENVIRONMENT == "production":
            if self.RP_ID in {"localhost", "127.0.0.1"}:
                raise ValueError("RP_ID must be your real domain in production.")
            if self.ORIGIN.scheme != "https":
                raise ValueError("ORIGIN must use https in production.")

        return self

    @property
    def cors_origins(self) -> list[str]:
        origins = [self.origin_str, *self.BACKEND_CORS_ORIGINS]
        deduped: list[str] = []
        for origin in origins:
            if origin not in deduped:
                deduped.append(origin)
        return deduped

    @property
    def origin_str(self) -> str:
        return str(self.ORIGIN).rstrip("/")

    @staticmethod
    def _normalize_async_database_uri(uri: str) -> str:
        url = make_url(uri)
        if url.drivername == "postgresql":
            url = url.set(drivername="postgresql+asyncpg")

        if url.drivername == "postgresql+asyncpg":
            query = dict(url.query)
            sslmode = query.pop("sslmode", None)
            query.pop("channel_binding", None)
            if sslmode and sslmode != "disable" and "ssl" not in query:
                query["ssl"] = "require"
            url = url.set(query=query)

        return url.render_as_string(hide_password=False)


settings = Settings()
