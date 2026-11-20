from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text

from ..auth import User, get_current_user
from ..db import get_engine
from ..services import projects as project_svc
from ..template_library import milestone_plan_template, work_package_library

router = APIRouter()


@router.get("/", tags=["root"])
async def root():
    return {"name": "AOT Playbook Deliverables API"}


@router.get("/health", tags=["root"])
async def health():
    return {"status": "ok"}


@router.get("/ready", tags=["root"])
async def ready():
    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"status": "error", "database": "unavailable"})


@router.get("/me", tags=["me"])
async def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role}


@router.get("/templates/work-packages", tags=["templates"])
async def work_package_templates(user: User = Depends(get_current_user)):
    return work_package_library()


@router.get("/templates/milestone-plan", tags=["templates"])
async def milestone_plan(user: User = Depends(get_current_user)):
    return milestone_plan_template()


@router.get("/reports/summary", tags=["reports"])
async def summary(user: User = Depends(get_current_user)):
    return await project_svc.summary_report()
