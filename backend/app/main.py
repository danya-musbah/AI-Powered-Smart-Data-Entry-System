"""
main.py
FastAPI application entry point. Wires together routers, middleware,
and startup checks. Keep this file thin — real logic lives in
routes/ -> services/ -> (database / external providers).
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routes import documents, dashboard, templates
from app.utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)

app = FastAPI(
    title="AI-Powered Smart Data Entry System",
    description="Human-in-the-loop document intelligence API: OCR, AI field "
                "extraction, validation, and review workflow.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Never leak stack traces or internals to the client."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our end. Please try again."},
    )


@app.get("/api/health", tags=["system"])
async def health_check():
    """Used by the frontend (js/api.js) to detect whether the backend
    is reachable, falling back to Demo Mode if not."""
    return {
        "status": "ok",
        "environment": settings.app_env,
        "demo_mode": settings.demo_mode,
    }


app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
