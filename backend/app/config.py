"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import Literal
import json
from urllib.parse import urlsplit, parse_qs

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Default dev URL (matches docker-compose host port 6380; avoids Homebrew Redis on 6379)
DEFAULT_REDIS_URL = "redis://localhost:6380"

# uvicorn runs with cwd=backend/; load repo-root .env first, then backend/.env
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_PROJECT_ROOT = _BACKEND_ROOT.parent


class Settings(BaseSettings):
    """All configuration is pulled from env vars or .env file."""

    model_config = SettingsConfigDict(
        env_file=(
            str(_PROJECT_ROOT / ".env"),
            str(_BACKEND_ROOT / ".env"),
        ),
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    ENVIRONMENT: Literal["development", "test", "production"] = "development"
    ALLOW_MEMORY_FALLBACK: bool = True

    # WhatsApp (Meta Cloud API)
    # Inbound webhooks are rejected unless they carry a valid X-Hub-Signature-256 made with this
    WHATSAPP_APP_SECRET: str = ""  # Meta app secret (App settings → Basic)
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_VERIFY_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_DISPLAY_NUMBER: str = "12057820175"

    # Gemini
    GEMINI_API_KEY: str = ""

    # Composio (for 1-tap OAuth connectors: Gmail, Calendar, Notion, GitHub, etc.)
    COMPOSIO_API_KEY: str = ""
    COMPOSIO_BASE_URL: str = "https://backend.composio.dev/api/v3"
    # JSON objects keyed by toolkit slug. Empty auth config disables that connector.
    COMPOSIO_AUTH_CONFIGS: dict[str, str] = {}
    COMPOSIO_TOOL_VERSIONS: dict[str, str] = {}

    # Redis
    REDIS_URL: str = DEFAULT_REDIS_URL

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:////tmp/yellai.db"
    BACKEND_DATABASE_URL: str = ""

    # Razorpay
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""  # Dashboard webhook secret; falls back to RAZORPAY_KEY_SECRET

    # Usage limits: Fair Usage Policy (FUP) & Tiers
    FREE_DAILY_LIMIT: int = 15  # Free tier: 15 tasks/day (ad-supported)
    PAID_DAILY_LIMIT: int = 80  # Pro plan (₹99/mo): 80 tasks/day FUP (~2,400 tasks/mo)
    BUSINESS_DAILY_LIMIT: int = 1000  # Business/Team plan (₹999/mo): 1,000 tasks/day enterprise
    ADS_ENABLED: bool = True

    # Pricing
    MONTHLY_PRICE_PAISE: int = 9900  # Pro: ₹99/mo (9900 paise)
    BUSINESS_PRICE_PAISE: int = 99900  # Business: ₹999/mo (99900 paise)

    # Production Hardening
    ADMIN_API_KEY: str = ""  # Admin routes refuse every request until this is set
    CORS_ALLOWED_ORIGINS: str = ""  # Defaults to the configured frontend origins
    APP_URL: str = "https://api.yell.nhancio.com"
    FRONTEND_URL: str = "https://yell.nhancio.com"
    APP_FRONTEND_URL: str = "https://yellapp.nhancio.com"

    # Firebase Phone Auth (Astra App login)
    FIREBASE_PROJECT_ID: str = "yell-ai-nhancio"
    RATE_LIMIT_PER_MINUTE: int = 60

    @property
    def effective_database_url(self) -> str:
        return self.BACKEND_DATABASE_URL or self.DATABASE_URL

    @property
    def memory_fallback_allowed(self) -> bool:
        return self.ENVIRONMENT != "production" and self.ALLOW_MEMORY_FALLBACK

    @model_validator(mode="after")
    def require_persistent_production_database(self):
        return self

    def production_environment(self) -> dict[str, str]:
        """Reject development defaults before any hosted deployment is attempted."""
        database = urlsplit(self.effective_database_url)
        redis = urlsplit(self.REDIS_URL)
        local_hosts = {None, "localhost", "127.0.0.1", "::1", "0.0.0.0"}
        cloud_sql_socket = parse_qs(database.query).get("host", [""])[0].startswith("/cloudsql/")
        if database.scheme != "postgresql+asyncpg" or (database.hostname in local_hosts and not cloud_sql_socket):
            raise ValueError("Set a hosted PostgreSQL BACKEND_DATABASE_URL before deploying")
        if redis.scheme not in {"redis", "rediss"} or redis.hostname in local_hosts:
            raise ValueError("Set a hosted REDIS_URL before deploying")
        if len(self.ADMIN_API_KEY) < 32 or self.ADMIN_API_KEY == "supersecretadmin123":
            raise ValueError("Set a random ADMIN_API_KEY of at least 32 characters")
        if "*" in self.CORS_ALLOWED_ORIGINS.split(","):
            raise ValueError("Configure explicit frontend origins before deploying")
        if self.WHATSAPP_TOKEN and (not self.WHATSAPP_APP_SECRET or not self.WHATSAPP_PHONE_NUMBER_ID
                                   or not self.WHATSAPP_VERIFY_TOKEN
                                   or self.WHATSAPP_VERIFY_TOKEN == "yellai-verify-token"):
            raise ValueError("Configure WHATSAPP_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID and a private WHATSAPP_VERIFY_TOKEN")
        values = self.model_dump()
        values.update(ENVIRONMENT="production", ALLOW_MEMORY_FALLBACK=False,
                      DATABASE_URL=self.effective_database_url, BACKEND_DATABASE_URL=self.effective_database_url)
        return {key: json.dumps(value) if isinstance(value, (bool, dict)) else str(value)
                for key, value in values.items()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
