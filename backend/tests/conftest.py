from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

_tmp = Path(tempfile.mkdtemp(prefix="aot-tests-"))
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{(_tmp / 'test.db').as_posix()}"
os.environ["AUTH_MODE"] = "dev"
os.environ["UPLOAD_DIR"] = str(_tmp / "uploads")
os.environ["CORS_ORIGINS"] = ""

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402

KNOWLEDGEBASE = Path(__file__).resolve().parents[3] / "Knowledgebase" / "Workpackage templates"


@pytest.fixture(scope="session")
def client():
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture
def project(client):
    r = client.post("/projects", json={"name": "Test site", "projectDetails": {"fbmId": "4661"}})
    assert r.status_code == 201
    return client.get(f"/projects/{r.json()['id']}").json()
