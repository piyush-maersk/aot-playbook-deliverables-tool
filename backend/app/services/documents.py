"""Uploaded source documents (BRD, Estimation, BOM, Concept Design, layouts, other).

Files are stored on disk under UPLOAD_DIR/<project_id>/ (swap for blob storage in prod – blueprint gap 5).
"""
from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import and_, desc, insert, select, update

from ..auth import User
from ..config import get_settings
from ..db import as_utc, documents, get_engine, projects, utcnow
from ..schemas import DOC_ROLES
from .extraction import extract
from .projects import NotFound, _audit

ALLOWED_EXT = {".xlsx", ".xlsm", ".docx", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
               ".csv", ".txt", ".pptx", ".vsdx"}


class InvalidUpload(Exception):
    pass


def _safe_name(name: str) -> str:
    name = Path(name).name
    return re.sub(r"[^\w.\- ()&]", "_", name)[:200] or "file"


def _public(row) -> dict:
    return {"id": row.id, "filename": row.filename, "role": row.role, "contentType": row.content_type,
            "size": row.size, "uploadedBy": row.uploaded_by, "uploadedAt": as_utc(row.uploaded_at).isoformat(),
            "extraction": row.extraction}


async def _ensure_project(conn, project_id: str) -> None:
    row = (await conn.execute(select(projects.c.deleted_at).where(projects.c.id == project_id))).first()
    if row is None or row[0] is not None:
        raise NotFound()


async def upload_document(project_id: str, file: UploadFile, role: str, user: User) -> dict:
    s = get_settings()
    if role not in DOC_ROLES:
        raise InvalidUpload(f"role must be one of {', '.join(DOC_ROLES)}")
    filename = _safe_name(file.filename or "file")
    if Path(filename).suffix.lower() not in ALLOWED_EXT:
        raise InvalidUpload(f"File type not allowed: {Path(filename).suffix}")
    async with get_engine().connect() as conn:
        await _ensure_project(conn, project_id)
    doc_id = str(uuid.uuid4())
    folder = s.upload_dir / project_id
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"{doc_id}_{filename}"
    size, limit = 0, s.max_upload_mb * 1024 * 1024
    with target.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                out.close()
                target.unlink(missing_ok=True)
                raise InvalidUpload(f"File exceeds {s.max_upload_mb} MB")
            out.write(chunk)
    # Extract under the original file name so suggestions cite it as the source.
    extraction = await run_in_threadpool(_extract_named, target, filename, role)
    async with get_engine().begin() as conn:
        await conn.execute(insert(documents).values(
            id=doc_id, project_id=project_id, filename=filename, role=role,
            content_type=file.content_type or "", size=size, storage_path=str(target),
            extraction=extraction, uploaded_by=user.name, uploaded_at=utcnow()))
        await _audit(conn, project_id, user, "uploaded", "document", doc_id, f"{role}: {filename}")
        row = (await conn.execute(select(documents).where(documents.c.id == doc_id))).first()
    return _public(row)


def _extract_named(path: Path, filename: str, role: str) -> dict:
    result = extract(path, role)
    for s in result["suggestions"]:
        s["source"] = filename
    for b in result["bom"]:
        b["source"] = b["source"].replace(path.name, filename)
    if Path(filename).suffix.lower() in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"):
        result["isLayoutCandidate"] = role == "Layout" or "layout" in filename.lower()
    return result


async def list_documents(project_id: str) -> list[dict]:
    async with get_engine().connect() as conn:
        await _ensure_project(conn, project_id)
        rows = (await conn.execute(select(documents).where(and_(
            documents.c.project_id == project_id, documents.c.deleted_at.is_(None))).order_by(
            desc(documents.c.uploaded_at)))).all()
    return [_public(r) for r in rows]


async def get_document_file(project_id: str, doc_id: str) -> tuple[Path, str, str]:
    async with get_engine().connect() as conn:
        await _ensure_project(conn, project_id)
        row = (await conn.execute(select(documents).where(and_(
            documents.c.id == doc_id, documents.c.project_id == project_id,
            documents.c.deleted_at.is_(None))))).first()
    if row is None or not Path(row.storage_path).exists():
        raise NotFound()
    return Path(row.storage_path), row.filename, row.content_type or "application/octet-stream"


async def reextract_document(project_id: str, doc_id: str, role: str | None, user: User) -> dict:
    path, filename, _ = await get_document_file(project_id, doc_id)
    async with get_engine().connect() as conn:
        current = (await conn.execute(select(documents.c.role).where(documents.c.id == doc_id))).scalar()
    role = role or current
    if role not in DOC_ROLES:
        raise InvalidUpload(f"role must be one of {', '.join(DOC_ROLES)}")
    extraction = await run_in_threadpool(_extract_named, path, filename, role)
    async with get_engine().begin() as conn:
        await conn.execute(update(documents).where(documents.c.id == doc_id).values(
            role=role, extraction=extraction))
        row = (await conn.execute(select(documents).where(documents.c.id == doc_id))).first()
    return _public(row)


async def delete_document(project_id: str, doc_id: str, user: User) -> None:
    async with get_engine().begin() as conn:
        await _ensure_project(conn, project_id)
        result = await conn.execute(update(documents).where(and_(
            documents.c.id == doc_id, documents.c.project_id == project_id,
            documents.c.deleted_at.is_(None))).values(deleted_at=utcnow()))
        if result.rowcount == 0:
            raise NotFound()
        await _audit(conn, project_id, user, "deleted", "document", doc_id)
