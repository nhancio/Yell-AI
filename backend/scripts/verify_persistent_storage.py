"""One-off Cloud Run job: restore verified phone bindings and prove shared storage.

Run prepare once, then verify from a separate job execution after deployment.
Only counts and the check result are logged; account phone numbers are never logged.
"""

import asyncio
import json
import os

import google.auth
from google.auth.transport.requests import AuthorizedSession
from sqlalchemy import text

from app.models.database import engine, ensure_tables
from app.models.user import VerifiedWhatsAppAccount
from app.models.database import async_session
from app.services.composio_service import normalize_phone


def verified_firebase_phones():
    credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    project = os.environ["FIREBASE_PROJECT_ID"]
    with AuthorizedSession(credentials) as client:
        page = None
        while True:
            params = {"maxResults": 1000}
            if page:
                params["nextPageToken"] = page
            response = client.get(
                f"https://identitytoolkit.googleapis.com/v1/projects/{project}/accounts:batchGet",
                params=params, timeout=30,
            )
            if response.status_code != 200:
                raise RuntimeError(f"Firebase account lookup failed ({response.status_code})")
            data = response.json()
            for account in data.get("users", []):
                if account.get("disabled") or not account.get("phoneNumber"):
                    continue
                if any(provider.get("providerId") == "phone" for provider in account.get("providerUserInfo", [])):
                    yield normalize_phone(account["phoneNumber"])
            page = data.get("nextPageToken")
            if not page:
                return


async def main():
    if engine.dialect.name != "postgresql":
        raise RuntimeError("Storage check requires PostgreSQL")
    mode, marker = os.environ["CHECK_MODE"], os.environ["CHECK_MARKER"]
    if mode not in {"prepare", "verify"}:
        raise RuntimeError("Unknown storage check mode")
    try:
        await ensure_tables()
        restored = 0
        if mode == "prepare":
            phones = list(verified_firebase_phones())
            async with async_session() as session:
                for phone in phones:
                    await session.merge(VerifiedWhatsAppAccount(phone_number=phone))
                await session.commit()
            restored = len(phones)
            async with engine.begin() as connection:
                await connection.execute(text("CREATE TABLE IF NOT EXISTS app_storage_checks (name VARCHAR(64) PRIMARY KEY, value VARCHAR(128) NOT NULL)"))
                await connection.execute(text("INSERT INTO app_storage_checks (name, value) VALUES ('activation', :marker) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value"), {"marker": marker})
        async with engine.connect() as connection:
            saved = await connection.scalar(text("SELECT value FROM app_storage_checks WHERE name = 'activation'"))
            bindings = await connection.scalar(text("SELECT count(*) FROM verified_whatsapp_accounts"))
        if saved != marker:
            raise RuntimeError("Persistent storage marker did not survive")
        print(json.dumps({"mode": mode, "postgresql": True, "marker_verified": True,
                          "verified_phone_bindings": bindings, "firebase_bindings_restored": restored}), flush=True)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as error:
        # Database exception tracebacks may contain bound account phone numbers.
        print(json.dumps({"storage_check_failed": type(error).__name__}), flush=True)
        raise SystemExit(1) from None
