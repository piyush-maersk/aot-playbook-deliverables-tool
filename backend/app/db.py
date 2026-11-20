"""Async engine + table definitions.

Source of truth is `projects` + `project_snapshots` (full JSON document per revision), exactly as in the
blueprint. `work_packages` and `milestone_activities` are reporting projections rebuilt on every save.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import (JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, MetaData,
                        PrimaryKeyConstraint, String, Table, Text, event)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from .config import get_settings

log = logging.getLogger(__name__)
metadata = MetaData()
JsonType = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


app_users = Table(
    "app_users", metadata,
    Column("id", String(64), primary_key=True),            # Entra oid
    Column("email", String(320), nullable=False, unique=True),
    Column("display_name", String(200), nullable=False, default=""),
    Column("role", String(20), nullable=False, default="Contributor"),  # Admin/Lead/Contributor/Viewer
    Column("last_login_at", DateTime(timezone=True)),
)

projects = Table(
    "projects", metadata,
    Column("id", String(64), primary_key=True),
    Column("name", String(200), nullable=False),
    Column("status", String(40), nullable=False, default="Planning"),
    Column("fbm_id", String(40), default=""),
    Column("customer_name", String(200), default=""),
    Column("region", String(40), default=""),
    Column("location", String(200), default=""),
    Column("summary", JsonType, nullable=False, default=dict),   # progress rollups for the dashboard
    Column("revision", Integer, nullable=False, default=1),
    Column("created_by", String(64), nullable=False),
    Column("created_by_email", String(320), default=""),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_by", String(200), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("deleted_at", DateTime(timezone=True)),
)

project_snapshots = Table(
    "project_snapshots", metadata,
    Column("project_id", String(64), ForeignKey("projects.id"), nullable=False),
    Column("revision", Integer, nullable=False),
    Column("document", JsonType, nullable=False),
    Column("saved_by", String(200), nullable=False),
    Column("saved_by_id", String(64), nullable=False),
    Column("saved_at", DateTime(timezone=True), nullable=False),
    PrimaryKeyConstraint("project_id", "revision"),
)

# No FK on purpose: a project can be open in the browser before its first save (blueprint 6).
project_presence = Table(
    "project_presence", metadata,
    Column("project_id", String(64), nullable=False),
    Column("user_id", String(64), nullable=False),
    Column("name", String(200), default=""),
    Column("email", String(320), default=""),
    Column("mode", String(10), nullable=False, default="viewing"),
    Column("since", DateTime(timezone=True), nullable=False),
    Column("last_seen", DateTime(timezone=True), nullable=False),
    PrimaryKeyConstraint("project_id", "user_id"),
)

documents = Table(
    "documents", metadata,
    Column("id", String(64), primary_key=True),
    Column("project_id", String(64), ForeignKey("projects.id"), nullable=False, index=True),
    Column("filename", String(400), nullable=False),
    Column("role", String(30), nullable=False, default="Other"),   # BRD/Estimation/BOM/Concept/Layout/Other
    Column("content_type", String(200), default=""),
    Column("size", Integer, nullable=False, default=0),
    Column("storage_path", Text, nullable=False),
    Column("extraction", JsonType, nullable=False, default=dict),
    Column("uploaded_by", String(200), nullable=False),
    Column("uploaded_at", DateTime(timezone=True), nullable=False),
    Column("deleted_at", DateTime(timezone=True)),
)

audit_log = Table(
    "audit_log", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("project_id", String(64), nullable=False, index=True),
    Column("ts", DateTime(timezone=True), nullable=False),
    Column("actor", String(200), nullable=False),
    Column("action", String(40), nullable=False),
    Column("entity", String(40), nullable=False),
    Column("entity_id", String(64), default=""),
    Column("details", Text, default=""),
)

work_packages = Table(
    "work_packages", metadata,
    Column("project_id", String(64), nullable=False),
    Column("id", String(20), nullable=False),
    Column("title", String(300), default=""),
    Column("mode", String(10), default="SEPARATE"),
    Column("template_codes", String(60), default=""),
    Column("status", String(20), default="Draft"),
    Column("completeness", Float, default=0),
    PrimaryKeyConstraint("project_id", "id"),
)

milestone_activities = Table(
    "milestone_activities", metadata,
    Column("project_id", String(64), nullable=False),
    Column("id", String(20), nullable=False),
    Column("phase", String(40), default=""),
    Column("milestone", String(10), default=""),
    Column("activity", Text, default=""),
    Column("responsible", String(200), default=""),
    Column("start_date", String(10), default=""),
    Column("end_date", String(10), default=""),
    Column("status", Float, default=0),
    Column("is_group", Boolean, default=False),
    PrimaryKeyConstraint("project_id", "id"),
)

_engine: AsyncEngine | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        s = get_settings()
        kwargs = {} if s.is_sqlite else {"pool_size": 2, "max_overflow": max(s.db_pool_max - 2, 0),
                                          "pool_pre_ping": True}
        _engine = create_async_engine(s.database_url, **kwargs)
        if s.is_sqlite:
            @event.listens_for(_engine.sync_engine, "connect")
            def _fk_on(dbapi_conn, _):  # noqa: ANN001
                cur = dbapi_conn.cursor()
                cur.execute("PRAGMA foreign_keys=ON")
                cur.close()
    return _engine


async def migrate() -> None:
    """Idempotent schema creation (create-if-not-exists), safe to run on every start."""
    try:
        async with get_engine().begin() as conn:
            await conn.run_sync(metadata.create_all)
    except Exception:  # pragma: no cover - mirrors blueprint: log and continue on existing schema
        log.exception("Schema migration failed; continuing with existing schema")


async def dispose() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None
