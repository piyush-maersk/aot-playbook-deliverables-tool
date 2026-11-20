"""Bearer token -> Entra ID JWT validation -> User. Mirrors blueprint 7.1.

AUTH_MODE=dev skips token validation and returns a fixed local user (for local development only).
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select, update
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .config import Settings, get_settings
from .db import app_users, get_engine, utcnow

log = logging.getLogger(__name__)
ROLES = ("Admin", "Lead", "Contributor", "Viewer")
_UPSERT_EVERY_S = 600
_last_upsert: dict[str, float] = {}
_role_cache: dict[str, tuple[str, float]] = {}


@dataclass(frozen=True)
class User:
    id: str
    email: str
    name: str
    role: str = "Contributor"

    @property
    def can_edit(self) -> bool:
        return self.role != "Viewer"

    @property
    def is_admin(self) -> bool:
        return self.role == "Admin"


@lru_cache
def _jwks_client(tenant: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys",
                           cache_keys=True, lifespan=3600)


def _verify_entra(token: str, s: Settings) -> dict:
    key = _jwks_client(s.entra_tenant_id).get_signing_key_from_jwt(token).key
    audiences = [a for a in {s.entra_audience, s.entra_client_id,
                             f"api://{s.entra_client_id}" if s.entra_client_id else ""} if a]
    claims = jwt.decode(token, key, algorithms=["RS256"], audience=audiences,
                        options={"require": ["exp", "iss", "aud"]})
    valid_issuers = {f"https://login.microsoftonline.com/{s.entra_tenant_id}/v2.0",
                     f"https://sts.windows.net/{s.entra_tenant_id}/"}
    if claims.get("iss") not in valid_issuers or claims.get("tid") != s.entra_tenant_id:
        raise jwt.InvalidIssuerError("Unexpected issuer or tenant")
    if not claims.get("oid"):
        raise jwt.InvalidTokenError("Missing oid")
    return claims


async def _upsert_and_get_role(user_id: str, email: str, name: str, s: Settings,
                               token_roles: list[str]) -> str:
    now = time.monotonic()
    if now - _last_upsert.get(user_id, 0) > _UPSERT_EVERY_S:
        values = {"id": user_id, "email": email, "display_name": name, "last_login_at": utcnow()}
        dialect_insert = sqlite_insert if s.is_sqlite else pg_insert
        stmt = dialect_insert(app_users).values(**values, role="Contributor")
        stmt = stmt.on_conflict_do_update(index_elements=["id"], set_={
            "email": email, "display_name": name, "last_login_at": values["last_login_at"]})
        async with get_engine().begin() as conn:
            await conn.execute(stmt)
            if email.lower() in s.admin_email_set:
                await conn.execute(update(app_users).where(app_users.c.id == user_id).values(role="Admin"))
        _last_upsert[user_id] = now
        _role_cache.pop(user_id, None)
    # App roles in the token win over DB roles (avoids a DB hit, blueprint gap 9).
    for r in ROLES:
        if r in token_roles:
            return r
    cached = _role_cache.get(user_id)
    if cached and now - cached[1] < 60:
        return cached[0]
    async with get_engine().connect() as conn:
        role = (await conn.execute(select(app_users.c.role).where(app_users.c.id == user_id))).scalar()
    role = role if role in ROLES else "Contributor"
    _role_cache[user_id] = (role, now)
    return role


async def get_current_user(request: Request, s: Settings = Depends(get_settings)) -> User:
    if s.auth_mode == "dev":
        email = request.headers.get("X-Dev-User", s.dev_user_email)
        name = s.dev_user_name if email == s.dev_user_email else email.split("@")[0]
        user_id = "dev-" + email.lower()
        role = await _upsert_and_get_role(user_id, email, name, s, ["Admin"] if email == s.dev_user_email else [])
        return User(id=user_id, email=email, name=name, role=role)

    header = request.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        claims = await run_in_threadpool(_verify_entra, header[7:], s)
    except jwt.PyJWTError as exc:
        log.info("Token rejected: %s", exc)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc
    email = claims.get("preferred_username") or claims.get("upn") or claims.get("email") or ""
    name = claims.get("name") or email
    role = await _upsert_and_get_role(claims["oid"], email, name, s, claims.get("roles", []))
    return User(id=claims["oid"], email=email, name=name, role=role)


def require_editor(user: User = Depends(get_current_user)) -> User:
    if not user.can_edit:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Viewer role cannot modify projects")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")
    return user
