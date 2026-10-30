"""Security check for the public connector endpoints.

Run from backend/:  DATABASE_URL=sqlite+aiosqlite:////tmp/yell_test.db python -m tests.test_connector_confirm
"""

import asyncio

from app.main import app
from app.services.composio_service import ComposioService


async def check_confirm_is_verified() -> None:
    svc = ComposioService()
    phone, toolkit = "919000000001", "gmail"

    async def not_connected(*_):
        return False

    async def connected(*_):
        return True

    # A caller can't mark an app connected (or trigger a WhatsApp message) unless Composio agrees
    svc.is_active_on_composio = not_connected
    res = await svc.mark_connected(phone, toolkit)
    assert res["status"] == "pending" and not res["newly_active"], res

    # First verified confirmation messages the user once; repeats don't
    svc.is_active_on_composio = connected
    assert (await svc.mark_connected(phone, toolkit))["newly_active"]
    assert not (await svc.mark_connected(phone, toolkit))["newly_active"]


def test_execute_endpoint_removed() -> None:
    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/api/connectors/execute" not in paths


def test_confirm_is_verified() -> None:
    asyncio.run(check_confirm_is_verified())


if __name__ == "__main__":
    test_execute_endpoint_removed()
    test_confirm_is_verified()
    print("OK: execute endpoint gone; confirm only trusts Composio")
