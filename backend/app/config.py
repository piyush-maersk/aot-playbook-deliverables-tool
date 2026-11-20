"""All settings come from environment variables (twelve-factor). See README for the full list."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AOT Playbook Deliverables API"
    # sqlite+aiosqlite:///./aot_dev.db for local dev, postgresql+psycopg://user:pass@host/db in prod.
    database_url: str = "sqlite+aiosqlite:///./aot_dev.db"
    db_pool_max: int = 10
    run_migrations: bool = True

    # "entra" validates Microsoft Entra ID tokens; "dev" accepts a fixed local user (never use in prod).
    auth_mode: str = "dev"
    entra_tenant_id: str = ""
    entra_client_id: str = ""            # API app registration (client) id
    entra_audience: str = ""             # e.g. api://<client-id>; defaults to entra_client_id
    admin_emails: str = ""               # comma separated bootstrap admins
    dev_user_email: str = "dev.user@maersk.com"
    dev_user_name: str = "Dev User"

    cors_origins: str = "http://localhost:5179"
    path_prefix: str = ""                # stripped when running behind the API gateway
    keep_versions: int = 50
    version_merge_minutes: int = 10
    presence_online_seconds: int = 75

    upload_dir: Path = Path("./uploads")
    max_upload_mb: int = 25

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
