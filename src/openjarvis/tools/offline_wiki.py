"""OfflineWikiTool — search/read the user's downloaded ZIM knowledge files."""

from __future__ import annotations

import json
from typing import Any

from openjarvis.core.registry import ToolRegistry
from openjarvis.core.types import ToolResult
from openjarvis.tools._stubs import BaseTool, ToolSpec


@ToolRegistry.register("offline_wiki")
class OfflineWikiTool(BaseTool):
    """Search and read offline Wikipedia/ZIM articles with no network."""

    @property
    def spec(self) -> ToolSpec:
        return ToolSpec(
            name="offline_wiki",
            description=(
                "Search and read the user's offline Wikipedia (Kiwix ZIM) "
                "files. Use for factual lookups when offline or when the user "
                "asks about the offline wiki/Wikipedia source."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["list", "search", "article"],
                        "description": "list files, search articles, or read one.",
                    },
                    "query": {
                        "type": "string",
                        "description": "Search query (for search).",
                    },
                    "path": {
                        "type": "string",
                        "description": "Entry path from a search result (for article).",
                    },
                    "zim": {
                        "type": "string",
                        "description": "Optional .zim filename to target.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max search results (default 10).",
                    },
                },
                "required": ["action"],
            },
            category="knowledge",
        )

    def execute(self, **params: Any) -> ToolResult:
        try:
            from openjarvis.server import wiki_routes as wr
        except Exception as exc:
            return self._fail(f"Wiki module unavailable: {exc}")
        action = params.get("action", "list")
        try:
            if action == "list":
                files = wr._zim_files()
                if not files:
                    return self._ok("No .zim files installed. Download one in Settings → Offline knowledge.")
                return self._ok("Offline wiki files:\n" + "\n".join(
                    f"- {p.name} ({p.stat().st_size / 1e6:.0f} MB)" for p in files
                ))
            if action == "search":
                q = params.get("query", "")
                if not q:
                    return self._fail("query is required for search")
                limit = int(params.get("limit") or 10)
                path = wr._resolve_zim(params.get("zim"))
                archive = wr._archive(path)
                try:
                    searcher = archive.get_searcher()
                    results = searcher.search(q)
                    lines = []
                    for i, result in enumerate(results):
                        if i >= limit:
                            break
                        try:
                            e = result.get_entry()
                            lines.append(f"- {getattr(e, 'title', '') or getattr(e, 'path', '')}  [{getattr(e, 'path', '')}]")
                        except Exception:
                            continue
                except Exception:
                    needle = q.lower()
                    lines = []
                    for entry in archive:
                        t = (getattr(entry, "title", "") or "").lower()
                        p = (getattr(entry, "path", "") or "").lower()
                        if needle in t or needle in p:
                            lines.append(f"- {getattr(entry, 'title', '') or p}  [{getattr(entry, 'path', '')}]")
                            if len(lines) >= limit:
                                break
                return self._ok("\n".join(lines) if lines else f"No results for '{q}'.")
            if action == "article":
                path = params.get("path", "")
                if not path:
                    return self._fail("path is required for article")
                zim_path = wr._resolve_zim(params.get("zim"))
                archive = wr._archive(zim_path)
                entry = archive.get_entry_by_path(path)
                item = entry.get_item()
                content = item.get_data().decode("utf-8", errors="replace")
                # Strip HTML tags crudely for readable text.
                import re as _re
                text = _re.sub(r"<[^>]+>", " ", content)
                text = _re.sub(r"\s+", " ", text).strip()
                return self._ok(text[:8000] if text else "(empty article)")
            return self._fail(f"Unknown action: {action}")
        except Exception as exc:
            return self._fail(str(exc))

    @staticmethod
    def _ok(content: str) -> ToolResult:
        return ToolResult(tool_name="offline_wiki", success=True, content=content)

    @staticmethod
    def _fail(content: str) -> ToolResult:
        return ToolResult(tool_name="offline_wiki", success=False, content=content)
