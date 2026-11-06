"""HubManageTool — let the agent add/remove hub pills and app tiles."""

from __future__ import annotations

import json
from typing import Any

from openjarvis.core import hub_custom
from openjarvis.core.registry import ToolRegistry
from openjarvis.core.types import ToolResult
from openjarvis.tools._stubs import BaseTool, ToolSpec


@ToolRegistry.register("hub_manage")
class HubManageTool(BaseTool):
    """Manage user-defined pills and app tiles on the chat-page hub."""

    @property
    def spec(self) -> ToolSpec:
        return ToolSpec(
            name="hub_manage",
            description=(
                "List, add, or remove custom pills (sections) and app tiles "
                "on the OpenJarvis chat-page hub. Use when the user asks to "
                "add an app, website, or pill to the hub. Built-in sections "
                "include: kids, crypto, games, social, music, browsers, "
                "media, record, remote, stores, ai, apps, smart_home, "
                "productivity, finance, news, health, travel, education, "
                "shopping, tools, privacy, mods, create."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": [
                            "list", "add_section", "add_app",
                            "remove_section", "remove_app",
                        ],
                        "description": "Action to perform.",
                    },
                    "label": {
                        "type": "string",
                        "description": "Pill label (for add_section).",
                    },
                    "icon": {
                        "type": "string",
                        "description": (
                            "Icon for a custom pill: star, heart, gamepad, "
                            "music, tv, globe, wrench, shield, home, "
                            "briefcase, plane, book, cart, bot, zap."
                        ),
                    },
                    "name": {
                        "type": "string",
                        "description": "App tile name (for add_app).",
                    },
                    "url": {
                        "type": "string",
                        "description": "App tile URL (for add_app).",
                    },
                    "section": {
                        "type": "string",
                        "description": (
                            "Target pill id or label for add_app, e.g. "
                            "'social', 'mods', or a custom section id."
                        ),
                    },
                    "color": {
                        "type": "string",
                        "description": "Optional hex color for the tile.",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional tile tooltip description.",
                    },
                    "id": {
                        "type": "string",
                        "description": "Section or app id (for remove_*).",
                    },
                },
                "required": ["action"],
            },
            category="hub",
        )

    def execute(self, **params: Any) -> ToolResult:
        action = params.get("action", "list")
        try:
            if action == "list":
                return self._ok(json.dumps(hub_custom.list_custom(), indent=2))
            if action == "add_section":
                section = hub_custom.add_section(
                    params.get("label", ""), params.get("icon", "star")
                )
                return self._ok(f"Created pill '{section['label']}' (id: {section['id']})")
            if action == "add_app":
                section = params.get("section", "")
                # Accept a section label too ("Social" -> "social").
                section = self._resolve_section(section)
                app = hub_custom.add_app(
                    params.get("name", ""),
                    params.get("url", ""),
                    section,
                    params.get("color", ""),
                    params.get("description", ""),
                )
                return self._ok(
                    f"Added '{app['name']}' to pill '{section}' "
                    f"(id: {app['id']})"
                )
            if action == "remove_section":
                if hub_custom.remove_section(params.get("id", "")):
                    return self._ok(f"Removed pill '{params.get('id')}'")
                return self._fail(f"Pill not found: {params.get('id')}")
            if action == "remove_app":
                if hub_custom.remove_app(params.get("id", "")):
                    return self._ok(f"Removed app '{params.get('id')}'")
                return self._fail(f"App not found: {params.get('id')}")
            return self._fail(f"Unknown action: {action}")
        except ValueError as exc:
            return self._fail(str(exc))

    def _resolve_section(self, section: str) -> str:
        section = (section or "").strip()
        if hub_custom.valid_section(section):
            return section
        # Try matching a custom section label case-insensitively.
        lowered = section.lower()
        for s in hub_custom.list_custom()["sections"]:
            if s.get("label", "").lower() == lowered or s.get("id") == lowered:
                return s["id"]
        raise ValueError(
            f"Unknown section '{section}'. Use a built-in pill id "
            "(social, mods, kids, ...) or create the pill first with "
            "add_section."
        )

    @staticmethod
    def _ok(content: str) -> ToolResult:
        return ToolResult(tool_name="hub_manage", success=True, content=content)

    @staticmethod
    def _fail(content: str) -> ToolResult:
        return ToolResult(tool_name="hub_manage", success=False, content=content)
