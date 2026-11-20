from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .config import get_settings
from .db import dispose, migrate
from .routers import common, documents, projects

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    s = get_settings()
    s.upload_dir.mkdir(parents=True, exist_ok=True)
    if s.run_migrations:
        await migrate()
    if s.auth_mode == "dev":
        logging.getLogger(__name__).warning("AUTH_MODE=dev – token validation is DISABLED")
    yield
    await dispose()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title=s.app_name, lifespan=lifespan,
                  openapi_url="/openapi.json" if s.auth_mode == "dev" else None)
    app.add_middleware(GZipMiddleware, minimum_size=2048)
    if s.cors_origin_list:
        app.add_middleware(CORSMiddleware, allow_origins=s.cors_origin_list, allow_credentials=True,
                           allow_methods=["*"], allow_headers=["*"])

    if s.path_prefix:
        prefix = "/" + s.path_prefix.strip("/")

        @app.middleware("http")
        async def strip_prefix(request, call_next):  # noqa: ANN001
            path = request.scope["path"]
            if path.startswith(prefix):
                request.scope["path"] = path[len(prefix):] or "/"
            return await call_next(request)

    app.include_router(common.router)
    app.include_router(projects.router)
    app.include_router(documents.router)
    return app


app = create_app()
