"""User-defined hub pills and app tiles.

Custom sections (pills) and apps are stored as JSON under the OpenJarvis
root (``~/.openjarvis/hub_custom.json``) so both the REST API and the
``hub_manage`` agent tool read/write the same data the desktop/web UI
renders on the chat page.
"""

from __future__ import annotations

import json
import re
import threading
import time
from pathlib import Path
from typing import Any

from openjarvis.core.paths import get_config_dir

_lock = threading.Lock()

# Sections the built-in UI already provides. Custom apps may target these
# ids as well as user-created section ids.
BUILTIN_SECTIONS = {
    "kids", "crypto", "games", "social", "music", "browsers", "media",
    "record", "remote", "stores", "ai", "developer", "apps",
    "smart_home", "productivity", "finance", "news", "health", "travel",
    "education", "shopping", "tools", "privacy", "mods", "create",
}

# Icons the frontend knows how to render for custom pills.
ALLOWED_ICONS = {
    "star", "heart", "gamepad", "music", "tv", "globe", "wrench",
    "shield", "home", "briefcase", "plane", "book", "cart", "bot", "zap",
}


def _store_path() -> Path:
    return get_config_dir() / "hub_custom.json"


def _slug(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")
    return slug or f"custom-{int(time.time())}"


def _load() -> dict[str, Any]:
    path = _store_path()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    data.setdefault("sections", [])
    data.setdefault("apps", [])
    return data


def _save(data: dict[str, Any]) -> None:
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(path)


def list_custom() -> dict[str, Any]:
    with _lock:
        data = _load()
        return {"sections": list(data["sections"]), "apps": list(data["apps"])}


def valid_section(section: str) -> bool:
    return section in BUILTIN_SECTIONS or any(
        s.get("id") == section for s in _load()["sections"]
    )


def add_section(label: str, icon: str = "star") -> dict[str, Any]:
    label = label.strip()
    if not label:
        raise ValueError("Section label is required")
    icon = icon if icon in ALLOWED_ICONS else "star"
    with _lock:
        data = _load()
        section_id = _slug(label)
        base, n = section_id, 2
        existing = {s.get("id") for s in data["sections"]}
        while section_id in existing or section_id in BUILTIN_SECTIONS:
            section_id = f"{base}-{n}"
            n += 1
        section = {"id": section_id, "label": label, "icon": icon}
        data["sections"].append(section)
        _save(data)
        return section


def remove_section(section_id: str) -> bool:
    with _lock:
        data = _load()
        before = len(data["sections"])
        data["sections"] = [s for s in data["sections"] if s.get("id") != section_id]
        # Apps targeting a deleted pill are removed with it.
        data["apps"] = [a for a in data["apps"] if a.get("section") != section_id]
        if len(data["sections"]) == before:
            return False
        _save(data)
        return True


def add_app(
    name: str,
    url: str,
    section: str,
    color: str = "",
    description: str = "",
) -> dict[str, Any]:
    name = name.strip()
    url = url.strip()
    if not name or not url:
        raise ValueError("App name and URL are required")
    if not url.startswith(("http://", "https://")):
        raise ValueError("App URL must start with http:// or https://")
    with _lock:
        data = _load()
        if not valid_section(section):
            raise ValueError(f"Unknown section: {section}")
        app_id = _slug(name)
        base, n = app_id, 2
        existing = {a.get("id") for a in data["apps"]}
        while app_id in existing:
            app_id = f"{base}-{n}"
            n += 1
        app = {
            "id": app_id,
            "name": name,
            "url": url,
            "section": section,
            "color": color or "#22d3ee",
            "description": description or name,
        }
        data["apps"].append(app)
        _save(data)
        return app


def remove_app(app_id: str) -> bool:
    with _lock:
        data = _load()
        before = len(data["apps"])
        data["apps"] = [a for a in data["apps"] if a.get("id") != app_id]
        if len(data["apps"]) == before:
            return False
        _save(data)
        return True
