"""Project endpoints. Each endpoint calls exactly one service function (see services/projects.py)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse

from ..auth import User, get_current_user, require_admin, require_editor
from ..schemas import CreateProjectRequest, PresenceRequest, SaveRequest
from ..services import projects as svc

router = APIRouter(prefix="/projects", tags=["projects"])


def _not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")


@router.get("")
async def list_projects(user: User = Depends(get_current_user)):
    return await svc.list_projects(user)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(body: CreateProjectRequest, user: User = Depends(require_editor)):
    return await svc.create_project(body, user)


@router.get("/{project_id}")
async def get_project(project_id: str, user: User = Depends(get_current_user)):
    try:
        return await svc.get_project(project_id)
    except svc.NotFound:
        raise _not_found()


@router.put("/{project_id}")
async def save_project(project_id: str, body: SaveRequest, user: User = Depends(require_editor)):
    if body.project.id != project_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "project.id does not match the URL")
    try:
        return await svc.save_project(project_id, body, body.baseRevision, user)
    except svc.Conflict as c:
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=c.payload)
    except svc.Gone:
        raise HTTPException(status.HTTP_410_GONE, "Project was deleted")
    except svc.NotFound:
        raise _not_found()


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, user: User = Depends(require_editor)):
    try:
        await svc.delete_project(project_id, user)
    except svc.NotFound:
        raise _not_found()
    except svc.Forbidden:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the creator, a Lead or an Admin can delete")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{project_id}/restore")
async def restore_project(project_id: str, user: User = Depends(require_admin)):
    try:
        return await svc.restore_project(project_id, user)
    except svc.NotFound:
        raise _not_found()


@router.get("/{project_id}/versions")
async def list_versions(project_id: str, user: User = Depends(get_current_user)):
    try:
        return await svc.list_versions(project_id)
    except svc.NotFound:
        raise _not_found()


@router.get("/{project_id}/versions/{revision}")
async def get_version(project_id: str, revision: int, user: User = Depends(get_current_user)):
    try:
        return await svc.get_version(project_id, revision)
    except svc.NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Version not found")


@router.put("/{project_id}/presence")
async def touch_presence(project_id: str, body: PresenceRequest, user: User = Depends(get_current_user)):
    return await svc.touch_presence(project_id, user, body.mode)


@router.delete("/{project_id}/presence", status_code=status.HTTP_204_NO_CONTENT)
async def leave_presence(project_id: str, user: User = Depends(get_current_user)):
    await svc.leave_presence(project_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/audit")
async def list_audit(project_id: str, user: User = Depends(get_current_user)):
    try:
        return await svc.list_audit(project_id)
    except svc.NotFound:
        raise _not_found()
