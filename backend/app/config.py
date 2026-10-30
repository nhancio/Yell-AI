"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

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
    )

    # WhatsApp Provider: "kapso" or "meta"
    WHATSAPP_PROVIDER: str = "kapso"

    # Kapso AI (preferred)
    KAPSO_API_KEY: str = ""

    # Meta Direct (fallback)
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_VERIFY_TOKEN: str = "yellai-verify-token"
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_DISPLAY_NUMBER: str = "12057820175"

    # Gemini
    GEMINI_API_KEY: str = ""

    # Composio (for 1-tap OAuth connectors: Gmail, Calendar, Notion, GitHub, etc.)
    COMPOSIO_API_KEY: str = ""
    COMPOSIO_BASE_URL: str = "https://backend.composio.dev/api/v1"

    # Redis
    REDIS_URL: str = DEFAULT_REDIS_URL

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:////tmp/yellai.db"

    # Razorpay
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # Usage limits (India mass-market: generous free tier supported by contextual ads)
    FREE_DAILY_LIMIT: int = 25
    PAID_DAILY_LIMIT: int = 1000
    ADS_ENABLED: bool = True

    # Pricing (₹99/mo default = 9900 paise for mass adoption via UPI)
    MONTHLY_PRICE_PAISE: int = 9900  # INR 99

    # Production Hardening
    ADMIN_API_KEY: str = "supersecretadmin123"  # Change in production
    CORS_ALLOWED_ORIGINS: str = "*"  # Comma-separated list
    APP_URL: str = "https://api.yell.nhancio.com"
    FRONTEND_URL: str = "https://yell.nhancio.com"
    APP_FRONTEND_URL: str = "https://yellapp.nhancio.com"

    # Firebase Phone Auth (Yell App login)
    FIREBASE_PROJECT_ID: str = "yell-ai-nhancio"
    RATE_LIMIT_PER_MINUTE: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
