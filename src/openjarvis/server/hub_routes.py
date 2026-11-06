"""REST API for user-defined hub pills and app tiles."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from openjarvis.core import hub_custom

hub_router = APIRouter(prefix="/v1/hub", tags=["hub"])


class SectionIn(BaseModel):
    label: str
    icon: str = "star"


class AppIn(BaseModel):
    name: str
    url: str
    section: str
    color: str = ""
    description: str = ""


@hub_router.get("/custom")
def get_custom() -> dict:
    return hub_custom.list_custom()


@hub_router.post("/custom/sections")
def create_section(body: SectionIn) -> dict:
    try:
        return hub_custom.add_section(body.label, body.icon)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@hub_router.delete("/custom/sections/{section_id}")
def delete_section(section_id: str) -> dict:
    if not hub_custom.remove_section(section_id):
        raise HTTPException(status_code=404, detail="Section not found")
    return {"deleted": section_id}


@hub_router.post("/custom/apps")
def create_app(body: AppIn) -> dict:
    try:
        return hub_custom.add_app(
            body.name, body.url, body.section, body.color, body.description
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@hub_router.delete("/custom/apps/{app_id}")
def delete_app(app_id: str) -> dict:
    if not hub_custom.remove_app(app_id):
        raise HTTPException(status_code=404, detail="App not found")
    return {"deleted": app_id}
