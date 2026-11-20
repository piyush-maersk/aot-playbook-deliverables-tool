# AOT Playbook Deliverables Tool

Internal web app to prepare and track the AOT deliverables of every project: **Milestone Plan**, **Work Packages**
and **Checklists** (reserved). Built on the architecture in [`../BLUEPRINT.md`](../BLUEPRINT.md): one JSON project
document with optimistic concurrency, snapshot versioning, soft delete, presence, audit log and reporting projections.

- Sign-in with Microsoft Entra ID (MSAL), with a dev sign-in mode for local work
- Home page: portfolio dashboard + project list with progress per deliverable
- Project workspace: Project Information (shared Page 1 data + source documents), Milestone Plan, Work Packages, Checklists, Activity
- Work Package editor aligned 1:1 with the templates and master prompt (see [docs/TEMPLATE_ALIGNMENT.md](docs/TEMPLATE_ALIGNMENT.md))
- Upload BRD / Estimation / BOM / Concept / Layout files: fields and hardware rows are extracted as suggestions (no AI, never costs)

## Folder structure

```
aot-deliverables-tool/
├─ backend/                        FastAPI + SQLAlchemy (SQLite local, PostgreSQL prod)
│  ├─ app/
│  │  ├─ main.py                   app, lifespan (migrate), middleware
│  │  ├─ config.py                 env settings
│  │  ├─ auth.py                   Entra JWT validation / dev auth, roles
│  │  ├─ db.py                     tables (source of truth + projections)
│  │  ├─ schemas.py                typed project document (template field names)
│  │  ├─ routers/                  common (health, me, templates, reports), projects, documents
│  │  ├─ services/                 projects (1 function per endpoint), documents, extraction, progress
│  │  └─ template_library/         generated JSON: work package templates T1–T8, milestone plan seed
│  ├─ tests/                       pytest (concurrency, versions, delete, extraction, templates)
│  ├─ Dockerfile, gunicorn.conf.py, requirements*.txt, .env.example
├─ frontend/                       React + TypeScript + Vite
│  └─ src/
│     ├─ auth/                     MSAL config, AuthProvider, useCurrentUser
│     ├─ api/                      typed client (409/410), queries
│     ├─ store/                    project document store: autosave, baseRevision, conflict handling
│     ├─ domain/                   types, template types, factories, progress rules, work package renderer
│     ├─ modules/                  _registry, overview, milestones, workPackages (editor + steps), checklists
│     ├─ features/                 dashboard, documents, presence, versions
│     ├─ pages/ layout/ components/ styles/
├─ tools/                          extract_templates.py, extract_milestone_plan.py
└─ docs/                           TEMPLATE_ALIGNMENT.md
```

## Run locally

Backend (Python 3.12+):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m uvicorn app.main:app --port 8080 --reload
```

Frontend (Node 20+), in a second terminal:

```powershell
cd frontend
npm install
npm run dev          # http://localhost:5179 (proxies /api to :8080)
```

Tests:

```powershell
cd backend;  .\.venv\Scripts\python -m pytest -q
cd frontend; npm test; npm run build
```

## Regenerate the template library

When a `.docx` template or the milestone plan workbook changes:

```powershell
backend\.venv\Scripts\python tools\extract_templates.py
backend\.venv\Scripts\python tools\extract_milestone_plan.py
```

## Configuration

Backend (`backend/.env`, see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./aot_dev.db` or `postgresql+psycopg://…` |
| `AUTH_MODE` | `dev` (no token check, local only) or `entra` |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_AUDIENCE` | API app registration; tokens are checked for RS256 signature, audience, issuer (v1/v2), tenant and `oid` |
| `ADMIN_EMAILS` | Comma-separated bootstrap admins (app roles `Admin/Lead/Contributor/Viewer` in the token win) |
| `CORS_ORIGINS`, `PATH_PREFIX` | SPA origin(s); prefix stripped behind the API gateway |
| `KEEP_VERSIONS`, `VERSION_MERGE_MINUTES` | Snapshot retention and merge window |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Source document storage (swap for blob storage in prod) |

Frontend (`frontend/.env.local`, see `.env.example`): `VITE_AUTH_MODE`, `VITE_API_BASE_URL`, `VITE_ENTRA_TENANT_ID`,
`VITE_ENTRA_CLIENT_ID` (SPA app registration), `VITE_API_SCOPE` (e.g. `api://<api-client-id>/access_as_user`), `VITE_REDIRECT_URI`.

## API → service function

| Endpoint | Function |
|---|---|
| `GET /me` | `routers/common.me` |
| `GET /templates/work-packages`, `GET /templates/milestone-plan` | `template_library` |
| `GET /reports/summary` | `services/projects.summary_report` |
| `GET /projects`, `POST /projects` | `list_projects`, `create_project` |
| `GET / PUT / DELETE /projects/{id}` | `get_project`, `save_project` (200 / 409 / 410), `delete_project` (soft) |
| `POST /projects/{id}/restore` (Admin) | `restore_project` |
| `GET /projects/{id}/versions[/{rev}]` | `list_versions`, `get_version` |
| `PUT / DELETE /projects/{id}/presence` | `touch_presence`, `leave_presence` |
| `GET /projects/{id}/audit` | `list_audit` |
| `GET / POST /projects/{id}/documents`, `GET …/{doc}/file`, `POST …/{doc}/extract`, `DELETE …/{doc}` | `services/documents.*` |
| `GET /health`, `GET /ready` | liveness / DB readiness |

## Roles

| Role | Can |
|---|---|
| Admin | everything, restore deleted projects |
| Lead | edit, delete any project |
| Contributor (default) | create and edit projects, delete own projects |
| Viewer | read only |

## Next steps (not built yet)

- `.docx` export of a work package (the preview's view model in `domain/render.ts` is ready to reuse)
- Checklist templates and instances (module registered as "coming soon")
- Excel export of the Milestone Plan, per-project members / RBAC, blob storage for uploads, Prometheus metrics
