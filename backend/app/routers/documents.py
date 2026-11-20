from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..auth import User, get_current_user, require_editor
from ..services import documents as svc
from ..services.projects import NotFound

router = APIRouter(prefix="/projects/{project_id}/documents", tags=["documents"])


class ReextractRequest(BaseModel):
    role: str | None = None


@router.get("")
async def list_documents(project_id: str, user: User = Depends(get_current_user)):
    try:
        return await svc.list_documents(project_id)
    except NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_document(project_id: str, file: UploadFile = File(...), role: str = Form("Other"),
                          user: User = Depends(require_editor)):
    try:
        return await svc.upload_document(project_id, file, role, user)
    except NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    except svc.InvalidUpload as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))


@router.get("/{doc_id}/file")
async def download_document(project_id: str, doc_id: str, user: User = Depends(get_current_user)):
    try:
        path, filename, content_type = await svc.get_document_file(project_id, doc_id)
    except NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return FileResponse(path, media_type=content_type, filename=filename)


@router.post("/{doc_id}/extract")
async def reextract_document(project_id: str, doc_id: str, body: ReextractRequest,
                             user: User = Depends(require_editor)):
    try:
        return await svc.reextract_document(project_id, doc_id, body.role, user)
    except NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    except svc.InvalidUpload as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(project_id: str, doc_id: str, user: User = Depends(require_editor)):
    try:
        await svc.delete_document(project_id, doc_id, user)
    except NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
