"""Durable, owner-approved external actions shared by all future agent types."""

import uuid
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.models.tool_run import ToolRun
from app.services.composio_service import ComposioService, ConnectorError, normalize_phone


class ToolRunService:
    def __init__(self, connectors: ComposioService):
        self.connectors = connectors
        self.sessions = connectors.sessions

    @staticmethod
    def _public(run: ToolRun) -> dict[str, Any]:
        return {key: getattr(run, key) for key in
                ("id", "toolkit", "tool_slug", "version", "connection_id", "arguments",
                 "status", "result", "error")} | {
            "created_at": run.created_at.isoformat() if run.created_at else None,
            "updated_at": run.updated_at.isoformat() if run.updated_at else None,
        }

    async def _find(self, phone: str, *, run_id: str | None = None, key: str | None = None) -> ToolRun | None:
        await self.connectors.initialize()
        condition = ToolRun.id == run_id if run_id is not None else ToolRun.idempotency_key == key
        async with self.sessions() as session:
            return (await session.execute(select(ToolRun).where(
                ToolRun.phone_number == normalize_phone(phone), condition))).scalar_one_or_none()

    async def get(self, phone: str, run_id: str) -> dict:
        row = await self._find(phone, run_id=run_id)
        if row is None:
            raise ConnectorError("Tool run not found", 404)
        return self._public(row)

    async def list(self, phone: str, *, limit: int = 25) -> list[dict]:
        await self.connectors.initialize()
        async with self.sessions() as session:
            rows = (await session.execute(select(ToolRun).where(
                ToolRun.phone_number == normalize_phone(phone)).order_by(
                    ToolRun.created_at.desc(), ToolRun.id.desc()).limit(limit))).scalars().all()
        return [self._public(row) for row in rows]

    @staticmethod
    def _same_request(row: ToolRun, toolkit: str, tool_slug: str, arguments: dict) -> dict:
        if (row.toolkit, row.tool_slug, row.arguments) != (toolkit, tool_slug, arguments):
            raise ConnectorError("Idempotency key was already used for a different action", 409)
        return ToolRunService._public(row)

    async def create(self, phone: str, toolkit: str, tool_slug: str,
                     arguments: dict, idempotency_key: str) -> dict:
        phone = normalize_phone(phone)
        toolkit = self.connectors._toolkit(toolkit)
        if not idempotency_key.strip() or len(idempotency_key) > 128:
            raise ConnectorError("A request idempotency key of 1–128 characters is required", 400)
        previous = await self._find(phone, key=idempotency_key)
        if previous:
            return self._same_request(previous, toolkit, tool_slug, arguments)
        account = await self.connectors.get_active_connection(phone, toolkit)
        tool = await self.connectors.resolve_tool(toolkit, tool_slug)
        run = ToolRun(id=str(uuid.uuid4()), phone_number=phone, toolkit=toolkit,
                      tool_slug=tool_slug, version=tool["version"], connection_id=account["id"],
                      arguments=arguments, idempotency_key=idempotency_key, status="awaiting_approval")
        try:
            async with self.sessions() as session:
                session.add(run)
                await session.commit()
                await session.refresh(run)
                return self._public(run)
        except IntegrityError:
            # Another request may have won the unique owner/key constraint.
            previous = await self._find(phone, key=idempotency_key)
            if previous is None:
                raise
            return self._same_request(previous, toolkit, tool_slug, arguments)

    async def approve(self, phone: str, run_id: str) -> dict:
        run = await self.get(phone, run_id)
        # A committed conditional claim prevents duplicate executions across requests/workers.
        async with self.sessions() as session:
            claimed = await session.execute(update(ToolRun).where(
                ToolRun.id == run_id, ToolRun.phone_number == normalize_phone(phone),
                ToolRun.status == "awaiting_approval").values(status="running"))
            await session.commit()
            if claimed.rowcount != 1:
                return await self.get(phone, run_id)
        result, error = None, None
        try:
            result = await self.connectors.execute_action(
                phone, run["tool_slug"], run["arguments"], toolkit=run["toolkit"],
                version=run["version"], connection_id=run["connection_id"],
            )
            status = "succeeded" if result["successful"] else "failed"
            if status == "failed":
                error = "Provider reported that this action failed"
        except ConnectorError as exc:
            status = "unknown" if exc.uncertain else "failed"
            error = str(exc)
        # No retry after a timeout, cancellation, process crash, or uncertain provider outcome.
        # A crashed running run stays running for manual reconciliation.
        async with self.sessions() as session:
            await session.execute(update(ToolRun).where(
                ToolRun.id == run_id, ToolRun.phone_number == normalize_phone(phone),
                ToolRun.status == "running").values(status=status, result=result, error=error))
            await session.commit()
        return await self.get(phone, run_id)

    async def cancel(self, phone: str, run_id: str) -> dict:
        await self.get(phone, run_id)
        async with self.sessions() as session:
            cancelled = await session.execute(update(ToolRun).where(
                ToolRun.id == run_id, ToolRun.phone_number == normalize_phone(phone),
                ToolRun.status == "awaiting_approval").values(status="cancelled"))
            await session.commit()
        result = await self.get(phone, run_id)
        if cancelled.rowcount != 1 and result["status"] != "cancelled":
            raise ConnectorError("Only an action awaiting approval can be cancelled", 409)
        return result
