"""Astra AI — FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.models.database import engine, ensure_tables
from app.services.memory import memory_service
from app.routes import admin, brands, connectors, health, me, onboarding, payment, tool_runs, webhook
from app.services.composio_service import ConnectorError
from app.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables on startup, seed India ad campaigns, set up Redis, clean up on shutdown."""
    logger.info("Starting Astra AI (India WhatsApp Super-Agent)...")

    # Do not accept traffic without durable storage.
    await ensure_tables()
    logger.info("Database tables ready")

    try:
        from app.services.ads_service import AdsService
        await AdsService().ensure_seeded()
    except Exception as exc:
        logger.warning("Ad seeding skipped: %s", exc)

    if await memory_service.ping():
        logger.info("Shared memory ready")
    elif not get_settings().memory_fallback_allowed:
        await memory_service.close()
        await engine.dispose()
        raise RuntimeError("Shared memory must be available before accepting traffic")
    else:
        logger.warning("Redis unavailable; using the database for shared memory")

    try:
        yield
    finally:
        try:
            await memory_service.close()
        finally:
            await engine.dispose()
        logger.info("Astra AI shut down")


app = FastAPI(
    title="Astra AI — WhatsApp Super-Agent for India",
    description="Instinct + Poke + Backdoor for India on WhatsApp, powered by Composio & Gemini",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
)

settings = get_settings()

origin_urls = settings.CORS_ALLOWED_ORIGINS.split(",") if settings.CORS_ALLOWED_ORIGINS else [
    settings.FRONTEND_URL, settings.APP_FRONTEND_URL,
    *(["http://localhost:3000", "http://127.0.0.1:3000"] if settings.ENVIRONMENT != "production" else []),
]
allowed_origins = [f"{urlsplit(o.strip()).scheme}://{urlsplit(o.strip()).netloc}"
                   for o in origin_urls if urlsplit(o.strip()).scheme in {"http", "https"}]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Admin-Key"],
)

app.include_router(webhook.router)
app.include_router(connectors.router)
app.include_router(me.router)
app.include_router(onboarding.router)
app.include_router(tool_runs.router)
app.include_router(payment.router)
app.include_router(health.router)
app.include_router(admin.router)
app.include_router(brands.router)


@app.exception_handler(ConnectorError)
async def connector_error_handler(request, exc: ConnectorError):
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})
