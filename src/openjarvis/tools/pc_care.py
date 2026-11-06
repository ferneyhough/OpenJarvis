"""PCCareTool — let Jarvis scan/clean/defrag the PC and browse files."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

HOME = Path.home()

from openjarvis.core.registry import ToolRegistry
from openjarvis.core.types import ToolResult
from openjarvis.tools._stubs import BaseTool, ToolSpec


@ToolRegistry.register("pc_care")
class PCCareTool(BaseTool):
    """Scan for junk/empty folders/dead links, clean them, defrag, browse files."""

    @property
    def spec(self) -> ToolSpec:
        return ToolSpec(
            name="pc_care",
            description=(
                "PC maintenance: scan for temp junk, empty folders and dead "
                "shortcuts; clean them (only with explicit user request); "
                "start/check disk optimization; browse local files."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": [
                            "scan", "clean", "defrag_start", "defrag_status",
                            "browse", "launch", "info", "drives", "processes",
                            "kill_process", "startup", "startup_toggle",
                            "registry_orphans", "duplicates", "ports", "shred",
                            "power",
                        ],
                        "description": "What to do.",
                    },
                    "temp": {"type": "boolean", "description": "clean: remove temp junk files"},
                    "dead_links": {"type": "boolean", "description": "clean: remove dead shortcuts"},
                    "empty_dirs": {"type": "boolean", "description": "clean: remove empty folders"},
                    "path": {"type": "string", "description": "browse/duplicates/shred: path"},
                    "app": {"type": "string", "description": "launch/power: app or action name"},
                    "pid": {"type": "integer", "description": "processes: pid to kill (action kill_process)"},
                    "confirm": {"type": "boolean", "description": "power/shred: required confirmation"},
                },
                "required": ["action"],
            },
            category="system",
        )

    def execute(self, **params: Any) -> ToolResult:
        try:
            from openjarvis.server import pc_care_routes as pc
        except Exception as exc:
            return self._fail(f"PC care module unavailable: {exc}")
        action = params.get("action", "scan")
        try:
            if action == "scan":
                data = pc.scan()
                temp = data["temp"]
                return self._ok(
                    f"Scan done in {data['duration_s']}s. Disk free: {data['disk']['free_gb']} GB.\n"
                    f"- Temp junk: {temp['count']} files, {temp['bytes'] / 1e6:.0f} MB\n"
                    f"- Empty folders: {data['empty_dirs']['count']}\n"
                    f"- Dead shortcuts: {data['dead_links']['count']}\n"
                    "Ask the user which categories to clean before deleting anything."
                )
            if action == "clean":
                class _B:
                    pass
                body = _B()
                body.temp = bool(params.get("temp"))
                body.dead_links = bool(params.get("dead_links"))
                body.empty_dirs = bool(params.get("empty_dirs"))
                if not (body.temp or body.dead_links or body.empty_dirs):
                    return self._fail("Pick at least one category: temp, dead_links, empty_dirs")
                data = pc.clean(body)
                return self._ok(
                    f"Cleaned: {data['removed_files']} files, {data['removed_dirs']} folders, "
                    f"freed {data['freed_bytes'] / 1e6:.1f} MB ({data['errors']} errors)."
                )
            if action == "defrag_start":
                return self._ok(json.dumps(pc.defrag_start()))
            if action == "defrag_status":
                return self._ok(json.dumps(pc.defrag_status()))
            if action == "browse":
                data = pc._browse(str(params.get("path") or ""))
                lines = [f"{data['path']}"]
                lines += [f"  [dir]  {d['name']}" for d in data["dirs"]]
                lines += [f"  {f['size'] / 1e6:.1f}MB  {f['name']}" for f in data["files"]]
                return self._ok("\n".join(lines[:200]))
            if action == "launch":
                class _L:
                    pass
                body = _L()
                body.app = str(params.get("app", ""))
                return self._ok(json.dumps(pc.launch_system(body)))
            if action == "info":
                return self._ok(json.dumps(pc.system_info(), indent=None))
            if action == "drives":
                return self._ok(json.dumps(pc.drives()))
            if action == "processes":
                data = pc.processes()
                top = data["processes"][:15]
                lines = [f"{p['pid']:>7} {p['mem_mb']:>8} MB  {p['name']}" for p in top]
                return self._ok(f"Top processes ({data['total']} total):\n" + "\n".join(lines))
            if action == "kill_process":
                pid = int(params.get("pid") or 0)
                if pid <= 0:
                    return self._fail("pid is required")
                return self._ok(json.dumps(pc.kill_process({"pid": pid})))
            if action == "startup":
                data = pc.startup_items()
                lines = [f"- [{i['hive']}] {i['name']} ({'on' if i['enabled'] == 'true' else 'OFF'})" for i in data["items"]]
                return self._ok("Startup items:\n" + "\n".join(lines))
            if action == "startup_toggle":
                class _S:
                    pass
                body = _S()
                body.name = str(params.get("app") or params.get("path") or "")
                body.hive = str(params.get("path") or "HKCU").split("|")[0] or "HKCU"
                body.enable = bool(params.get("temp"))
                return self._ok(json.dumps(pc.startup_toggle(body)))
            if action == "registry_orphans":
                data = pc.registry_orphans()
                names = ", ".join(o["name"] for o in data["orphans"][:15])
                return self._ok(f"{data['count']} orphaned uninstall entries of {data['total_programs']} programs.\n{names}")
            if action == "duplicates":
                p = str(params.get("path") or str(HOME))
                data = pc.duplicates(p)
                return self._ok(
                    f"{data['group_count']} duplicate groups under {p}, "
                    f"~{data['wasted_bytes'] / 1e9:.2f} GB reclaimable."
                )
            if action == "ports":
                data = pc.listening_ports()
                lines = [f"- {p['process']} on {p['addr']}:{p['port']} (pid {p['pid']})" for p in data["ports"][:30]]
                return self._ok(f"{data['count']} listening ports:\n" + "\n".join(lines))
            if action == "shred":
                p = str(params.get("path") or "")
                if not params.get("confirm"):
                    return self._fail("Shredding is destructive — get explicit user confirmation, then pass confirm:true")
                class _Sh:
                    pass
                body = _Sh()
                body.path = p
                body.passes = 3
                return self._ok(json.dumps(pc.shred(body)))
            if action == "power":
                class _P:
                    pass
                body = _P()
                body.action = str(params.get("app") or "")
                body.confirm = bool(params.get("confirm"))
                return self._ok(json.dumps(pc.power(body)))
            return self._fail(f"Unknown action: {action}")
        except Exception as exc:
            return self._fail(str(exc))

    @staticmethod
    def _ok(content: str) -> ToolResult:
        return ToolResult(tool_name="pc_care", success=True, content=content)

    @staticmethod
    def _fail(content: str) -> ToolResult:
        return ToolResult(tool_name="pc_care", success=False, content=content)
