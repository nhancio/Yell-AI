"""Yell AI — FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.models.database import Base, engine
from app.routes import health, payment, webhook, admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables on startup, set up Redis, clean up on shutdown."""
    logger.info("Starting Yell AI...")

    # Database
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables ready")
    except Exception as exc:
        logger.error("Database initialization failed: %s — app might not track usage correctly", exc)

    # Redis — test connection
    from app.services.memory import MemoryService
    memory = MemoryService()
    try:
        r = await memory._get_redis()
        await r.ping()
        logger.info("Redis connected")
    except Exception as exc:
        logger.warning("Redis not available: %s — memory will fail gracefully", exc)

    yield

    # Shutdown
    try:
        await memory.close()
    except Exception:
        pass
    await engine.dispose()
    logger.info("Yell AI shut down")


app = FastAPI(
    title="Yell AI",
    description="Emotional + Action-based AI assistant on WhatsApp",
    version="1.0.0",
    lifespan=lifespan,
)

from app.config import get_settings

settings = get_settings()
allowed_origins = [o.strip() for o in settings.CORS_ALLOWED_ORIGINS.split(",")]

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(webhook.router)
app.include_router(payment.router)
app.include_router(health.router)
app.include_router(admin.router)

