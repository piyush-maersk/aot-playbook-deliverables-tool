"""Project operations – one function per API operation (blueprint 10.1: logic in the service layer).

| Endpoint                              | Function           |
|---------------------------------------|--------------------|
| GET    /projects                      | list_projects      |
| POST   /projects                      | create_project     |
| GET    /projects/{id}                 | get_project        |
| PUT    /projects/{id}                 | save_project       |
| DELETE /projects/{id}                 | delete_project     |
| POST   /projects/{id}/restore         | restore_project    |
| GET    /projects/{id}/versions        | list_versions      |
| GET    /projects/{id}/versions/{rev}  | get_version        |
| PUT    /projects/{id}/presence        | touch_presence     |
| DELETE /projects/{id}/presence        | leave_presence     |
| GET    /projects/{id}/audit           | list_audit         |
| GET    /reports/summary               | summary_report     |
"""
from __future__ import annotations

import logging
import uuid
from datetime import timedelta

from sqlalchemy import and_, delete, desc, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncConnection

from ..auth import User
from ..config import get_settings
from ..db import (as_utc, audit_log, get_engine, milestone_activities, project_presence,
                  project_snapshots, projects, utcnow, work_packages)
from ..schemas import CreateProjectRequest, ProjectDocument
from ..template_library import milestone_plan_template, work_package_library
from .progress import project_summary, work_package_completeness

log = logging.getLogger(__name__)


class NotFound(Exception):
    pass


class Gone(Exception):
    pass


class Forbidden(Exception):
    pass


class Conflict(Exception):
    def __init__(self, revision: int, updated_by: str, updated_at):
        super().__init__("revision conflict")
        self.payload = {"revision": revision, "updatedBy": updated_by,
                        "updatedAt": as_utc(updated_at).isoformat() if updated_at else None}


def _header_columns(doc: dict) -> dict:
    details = doc["artefacts"].get("overview", {}).get("projectDetails", {})
    return {
        "name": doc["project"]["name"],
        "status": doc["project"].get("status", "Planning"),
        "fbm_id": details.get("fbmId", "")[:40],
        "customer_name": details.get("customerName", "")[:200],
        "region": details.get("region", "")[:40],
        "location": details.get("location", "")[:200],
        "summary": project_summary(doc["artefacts"]),
    }


def _row_meta(row) -> dict:
    return {
        "revision": row.revision,
        "updatedAt": as_utc(row.updated_at).isoformat(),
        "updatedBy": row.updated_by,
        "createdAt": as_utc(row.created_at).isoformat(),
        "createdBy": row.created_by,
        "createdByEmail": row.created_by_email,
    }


async def _audit(conn: AsyncConnection, project_id: str, user: User, action: str, entity: str,
                 entity_id: str = "", details: str = "") -> None:
    await conn.execute(insert(audit_log).values(project_id=project_id, ts=utcnow(), actor=user.name,
                                                action=action, entity=entity, entity_id=entity_id,
                                                details=details[:2000]))


def seed_milestone_plan() -> list[dict]:
    rows = []
    for i, a in enumerate(milestone_plan_template()["activities"], start=1):
        rows.append({
            "id": f"MP-{i:03d}", **a, "challenge": "", "comments": "", "planStart": "", "startDate": "",
            "planDuration": "", "endDate": "", "responsible": "", "status": 0, "deliverableLink": "",
            "workPackageId": "",
        })
    return rows


def new_document(project_id: str, req: CreateProjectRequest) -> dict:
    doc = ProjectDocument.model_validate({
        "project": {"id": project_id, "name": req.name, "status": req.status, "description": req.description},
        "artefacts": {
            "overview": {"projectDetails": req.projectDetails.model_dump()},
            "milestonePlan": {"activities": seed_milestone_plan() if req.seedMilestonePlan else []},
        },
    })
    return doc.model_dump(mode="json")


async def list_projects(user: User) -> list[dict]:
    async with get_engine().connect() as conn:
        rows = (await conn.execute(
            select(projects).where(projects.c.deleted_at.is_(None)).order_by(desc(projects.c.updated_at))
        )).all()
    return [{"id": r.id, "name": r.name, "status": r.status, "fbmId": r.fbm_id,
             "customerName": r.customer_name, "region": r.region, "location": r.location,
             "summary": r.summary, **_row_meta(r)} for r in rows]


async def create_project(req: CreateProjectRequest, user: User) -> dict:
    project_id = str(uuid.uuid4())
    doc = new_document(project_id, req)
    now = utcnow()
    async with get_engine().begin() as conn:
        await conn.execute(insert(projects).values(
            id=project_id, revision=1, created_by=user.id, created_by_email=user.email, created_at=now,
            updated_by=user.name, updated_at=now, **_header_columns(doc)))
        await conn.execute(insert(project_snapshots).values(
            project_id=project_id, revision=1, document=doc, saved_by=user.name, saved_by_id=user.id,
            saved_at=now))
        await _refresh_tables(conn, project_id, doc)
        await _audit(conn, project_id, user, "created", "project", project_id, req.name)
    return {"id": project_id, "revision": 1, "updatedAt": now.isoformat(), "updatedBy": user.name}


async def get_project(project_id: str) -> dict:
    async with get_engine().connect() as conn:
        row = (await conn.execute(select(projects).where(projects.c.id == project_id))).first()
        if row is None or row.deleted_at is not None:
            raise NotFound()
        snap = (await conn.execute(select(project_snapshots.c.document).where(and_(
            project_snapshots.c.project_id == project_id,
            project_snapshots.c.revision == row.revision)))).scalar()
    if snap is None:
        raise NotFound()
    return {**snap, **_row_meta(row)}


async def save_project(project_id: str, doc: ProjectDocument, base_revision: int | None, user: User) -> dict:
    s = get_settings()
    document = doc.model_dump(mode="json")
    now = utcnow()
    async with get_engine().begin() as conn:
        row = (await conn.execute(
            select(projects).where(projects.c.id == project_id).with_for_update())).first()
        if row is None:
            if base_revision is not None:
                raise NotFound()
            await conn.execute(insert(projects).values(
                id=project_id, revision=1, created_by=user.id, created_by_email=user.email,
                created_at=now, updated_by=user.name, updated_at=now, **_header_columns(document)))
            new_rev, previous = 1, None
        else:
            if row.deleted_at is not None:
                raise Gone()
            if base_revision != row.revision:
                raise Conflict(row.revision, row.updated_by, row.updated_at)
            new_rev = row.revision + 1
            previous = (await conn.execute(select(project_snapshots).where(
                project_snapshots.c.project_id == project_id).order_by(
                desc(project_snapshots.c.revision)).limit(1))).first()
            await conn.execute(update(projects).where(projects.c.id == project_id).values(
                revision=new_rev, updated_by=user.name, updated_at=now, **_header_columns(document)))

        # Version merge window: same user within N minutes replaces the latest snapshot.
        if previous is not None and previous.saved_by_id == user.id and \
                now - as_utc(previous.saved_at) < timedelta(minutes=s.version_merge_minutes):
            await conn.execute(delete(project_snapshots).where(and_(
                project_snapshots.c.project_id == project_id,
                project_snapshots.c.revision == previous.revision)))
        await conn.execute(insert(project_snapshots).values(
            project_id=project_id, revision=new_rev, document=document, saved_by=user.name,
            saved_by_id=user.id, saved_at=now))
        keep = (await conn.execute(select(project_snapshots.c.revision).where(
            project_snapshots.c.project_id == project_id).order_by(
            desc(project_snapshots.c.revision)).limit(s.keep_versions))).scalars().all()
        await conn.execute(delete(project_snapshots).where(and_(
            project_snapshots.c.project_id == project_id, project_snapshots.c.revision.not_in(keep))))

        for action, entity, entity_id, details in _diff(previous.document if previous else None, document):
            await _audit(conn, project_id, user, action, entity, entity_id, details)
        await _refresh_tables(conn, project_id, document)
    return {"revision": new_rev, "updatedAt": now.isoformat(), "updatedBy": user.name}


def _diff(old: dict | None, new: dict) -> list[tuple[str, str, str, str]]:
    if old is None:
        return [("created", "project", new["project"]["id"], new["project"]["name"])]
    out = []
    old_wps = {w["id"]: w for w in old.get("artefacts", {}).get("workPackages", [])}
    new_wps = {w["id"]: w for w in new["artefacts"].get("workPackages", [])}
    for wid in new_wps.keys() - old_wps.keys():
        out.append(("created", "workPackage", wid, ",".join(new_wps[wid].get("templateCodes", []))))
    for wid in old_wps.keys() - new_wps.keys():
        out.append(("deleted", "workPackage", wid, ""))
    for wid in new_wps.keys() & old_wps.keys():
        if new_wps[wid].get("status") != old_wps[wid].get("status"):
            out.append(("status", "workPackage", wid,
                        f"{old_wps[wid].get('status')} -> {new_wps[wid].get('status')}"))
    if old.get("project", {}).get("status") != new["project"].get("status"):
        out.append(("status", "project", new["project"]["id"],
                    f"{old.get('project', {}).get('status')} -> {new['project'].get('status')}"))
    return out


async def _refresh_tables(conn: AsyncConnection, project_id: str, doc: dict) -> None:
    """Rebuild reporting projections. Failures only warn; the save itself still succeeds."""
    try:
        async with conn.begin_nested():
            await conn.execute(delete(work_packages).where(work_packages.c.project_id == project_id))
            await conn.execute(delete(milestone_activities).where(
                milestone_activities.c.project_id == project_id))
            overview = doc["artefacts"].get("overview", {})
            names = {t["code"]: t["name"] for t in work_package_library()["templates"]}
            wp_rows = []
            for wp in doc["artefacts"].get("workPackages", []):
                codes = wp.get("templateCodes", [])
                title = wp.get("combinedTitle") if wp.get("mode") == "COMBINED" else \
                    (names.get(codes[0], "") if codes else "")
                wp_rows.append({"project_id": project_id, "id": wp["id"], "title": title or "",
                                "mode": wp.get("mode", "SEPARATE"), "template_codes": ",".join(codes),
                                "status": wp.get("status", "Draft"),
                                "completeness": work_package_completeness(wp, overview)})
            if wp_rows:
                await conn.execute(insert(work_packages), wp_rows)
            ms_rows = [{"project_id": project_id, "id": a["id"], "phase": a.get("phase", ""),
                        "milestone": a.get("milestone", ""), "activity": a.get("activity", ""),
                        "responsible": a.get("responsible", ""), "start_date": a.get("startDate", ""),
                        "end_date": a.get("endDate", ""), "status": float(a.get("status") or 0),
                        "is_group": bool(a.get("isGroup"))}
                       for a in doc["artefacts"].get("milestonePlan", {}).get("activities", [])]
            if ms_rows:
                await conn.execute(insert(milestone_activities), ms_rows)
    except Exception:
        log.warning("Projection refresh failed for project %s", project_id, exc_info=True)


async def delete_project(project_id: str, user: User) -> None:
    async with get_engine().begin() as conn:
        row = (await conn.execute(select(projects).where(projects.c.id == project_id).with_for_update())).first()
        if row is None or row.deleted_at is not None:
            raise NotFound()
        if not (user.is_admin or user.role == "Lead" or row.created_by == user.id):
            raise Forbidden()
        await conn.execute(update(projects).where(projects.c.id == project_id).values(
            deleted_at=utcnow(), revision=row.revision + 1, updated_by=user.name, updated_at=utcnow()))
        # Keep the snapshot readable at the bumped revision so restore works.
        snap = (await conn.execute(select(project_snapshots.c.document).where(and_(
            project_snapshots.c.project_id == project_id,
            project_snapshots.c.revision == row.revision)))).scalar()
        if snap is not None:
            await conn.execute(insert(project_snapshots).values(
                project_id=project_id, revision=row.revision + 1, document=snap, saved_by=user.name,
                saved_by_id=user.id, saved_at=utcnow()))
        await _audit(conn, project_id, user, "deleted", "project", project_id)


async def restore_project(project_id: str, user: User) -> dict:
    async with get_engine().begin() as conn:
        row = (await conn.execute(select(projects).where(projects.c.id == project_id))).first()
        if row is None or row.deleted_at is None:
            raise NotFound()
        await conn.execute(update(projects).where(projects.c.id == project_id).values(deleted_at=None))
        await _audit(conn, project_id, user, "restored", "project", project_id)
    return {"id": project_id, "revision": row.revision}


async def _ensure_live(conn: AsyncConnection, project_id: str) -> None:
    deleted = (await conn.execute(select(projects.c.deleted_at).where(projects.c.id == project_id))).first()
    if deleted is None or deleted[0] is not None:
        raise NotFound()


async def list_versions(project_id: str) -> list[dict]:
    async with get_engine().connect() as conn:
        await _ensure_live(conn, project_id)
        rows = (await conn.execute(select(
            project_snapshots.c.revision, project_snapshots.c.saved_at, project_snapshots.c.saved_by
        ).where(project_snapshots.c.project_id == project_id).order_by(desc(project_snapshots.c.revision)))).all()
    return [{"revision": r.revision, "savedAt": as_utc(r.saved_at).isoformat(), "savedBy": r.saved_by}
            for r in rows]


async def get_version(project_id: str, revision: int) -> dict:
    async with get_engine().connect() as conn:
        await _ensure_live(conn, project_id)  # blueprint gap 2: no reads of deleted projects
        doc = (await conn.execute(select(project_snapshots.c.document).where(and_(
            project_snapshots.c.project_id == project_id,
            project_snapshots.c.revision == revision)))).scalar()
    if doc is None:
        raise NotFound()
    return doc


async def touch_presence(project_id: str, user: User, mode: str) -> dict:
    s = get_settings()
    now = utcnow()
    async with get_engine().begin() as conn:
        updated = await conn.execute(update(project_presence).where(and_(
            project_presence.c.project_id == project_id, project_presence.c.user_id == user.id
        )).values(mode=mode, last_seen=now, name=user.name, email=user.email))
        if updated.rowcount == 0:
            await conn.execute(insert(project_presence).values(
                project_id=project_id, user_id=user.id, name=user.name, email=user.email, mode=mode,
                since=now, last_seen=now))
        await conn.execute(delete(project_presence).where(
            project_presence.c.last_seen < now - timedelta(minutes=10)))
        rows = (await conn.execute(select(project_presence).where(and_(
            project_presence.c.project_id == project_id, project_presence.c.user_id != user.id,
            project_presence.c.last_seen >= now - timedelta(seconds=s.presence_online_seconds))))).all()
    others = sorted(rows, key=lambda r: (r.mode != "editing", r.name))
    return {"others": [{"name": r.name, "email": r.email, "mode": r.mode,
                        "since": as_utc(r.since).isoformat()} for r in others]}


async def leave_presence(project_id: str, user: User) -> None:
    async with get_engine().begin() as conn:
        await conn.execute(delete(project_presence).where(and_(
            project_presence.c.project_id == project_id, project_presence.c.user_id == user.id)))


async def list_audit(project_id: str, limit: int = 200) -> list[dict]:
    async with get_engine().connect() as conn:
        await _ensure_live(conn, project_id)
        rows = (await conn.execute(select(audit_log).where(audit_log.c.project_id == project_id).order_by(
            desc(audit_log.c.id)).limit(limit))).all()
    return [{"ts": as_utc(r.ts).isoformat(), "actor": r.actor, "action": r.action, "entity": r.entity,
             "entityId": r.entity_id, "details": r.details} for r in rows]


async def summary_report() -> dict:
    async with get_engine().connect() as conn:
        rows = (await conn.execute(select(projects.c.status, projects.c.summary).where(
            projects.c.deleted_at.is_(None)))).all()
        wp_status = (await conn.execute(select(work_packages.c.status, func.count()).join(
            projects, projects.c.id == work_packages.c.project_id).where(
            projects.c.deleted_at.is_(None)).group_by(work_packages.c.status))).all()
    summaries = [r.summary or {} for r in rows]

    def avg(values):
        values = list(values)
        return round(sum(values) / len(values), 1) if values else 0.0

    return {
        "projects": len(rows),
        "byStatus": {st: sum(1 for r in rows if r.status == st) for st in {r.status for r in rows}},
        "workPackages": {"count": sum(s.get("workPackages", {}).get("count", 0) for s in summaries),
                         "avgCompleteness": avg(s["workPackages"]["progress"] for s in summaries
                                                if s.get("workPackages", {}).get("count")),
                         "byStatus": {st: n for st, n in wp_status}},
        "milestonePlan": {"avgProgress": avg(s.get("milestonePlan", {}).get("progress", 0) for s in summaries),
                          "overdue": sum(s.get("milestonePlan", {}).get("overdue", 0) for s in summaries)},
        "checklists": {"count": sum(s.get("checklists", {}).get("count", 0) for s in summaries)},
    }
