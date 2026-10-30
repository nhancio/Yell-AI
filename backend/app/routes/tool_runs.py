"""Authenticated, product-independent tools and action history."""

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.services.auth import current_phone
from app.services.composio_service import ComposioService
from app.services.tool_runs import ToolRunService

router = APIRouter(prefix="/api/me", tags=["tools"])
connectors = ComposioService()
runs = ToolRunService(connectors)


class CreateRun(BaseModel):
    toolkit: str = Field(min_length=1, max_length=64)
    tool_slug: str = Field(min_length=1, max_length=128)
    arguments: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str = Field(min_length=1, max_length=128)


@router.get("/connectors")
async def list_connections(phone: str = Depends(current_phone)) -> dict:
    return {"connections": await connectors.get_user_connections(phone)}


@router.post("/connectors/{toolkit}/confirm")
async def confirm_connection(toolkit: str, phone: str = Depends(current_phone)) -> dict:
    return await connectors.mark_connected(phone, toolkit)


@router.delete("/connectors/{toolkit}")
async def disconnect(toolkit: str, phone: str = Depends(current_phone)) -> dict:
    return await connectors.disconnect(phone, toolkit)


@router.get("/connectors/{toolkit}/tools")
async def discover_tools(toolkit: str, query: str = Query("", max_length=256),
                         cursor: str | None = Query(None, max_length=1024),
                         phone: str = Depends(current_phone)) -> dict:
    await connectors.get_active_connection(phone, toolkit)
    return await connectors.list_tools(toolkit, query=query, cursor=cursor)


@router.post("/tool-runs", status_code=201)
async def preview_run(body: CreateRun, phone: str = Depends(current_phone)) -> dict:
    return await runs.create(phone, body.toolkit, body.tool_slug, body.arguments, body.idempotency_key)


@router.get("/tool-runs")
async def list_runs(limit: int = Query(25, ge=1, le=100), phone: str = Depends(current_phone)) -> dict:
    return {"runs": await runs.list(phone, limit=limit)}


@router.get("/tool-runs/{run_id}")
async def get_run(run_id: str, phone: str = Depends(current_phone)) -> dict:
    return await runs.get(phone, run_id)


@router.post("/tool-runs/{run_id}/approve")
async def approve_run(run_id: str, phone: str = Depends(current_phone)) -> dict:
    return await runs.approve(phone, run_id)


@router.post("/tool-runs/{run_id}/cancel")
async def cancel_run(run_id: str, phone: str = Depends(current_phone)) -> dict:
    return await runs.cancel(phone, run_id)
