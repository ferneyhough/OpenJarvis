"""System status tool — live CPU, memory, disk, and process stats via psutil."""

from __future__ import annotations

from typing import Any

from openjarvis.core.registry import ToolRegistry
from openjarvis.core.types import ToolResult
from openjarvis.tools._stubs import BaseTool, ToolSpec

_TOOL_NAME = "system_status"
_MAX_PROCESSES = 10


@ToolRegistry.register(_TOOL_NAME)
class SystemStatusTool(BaseTool):
    """Report live CPU and memory utilization for the host machine."""

    tool_id = _TOOL_NAME

    @property
    def spec(self) -> ToolSpec:
        return ToolSpec(
            name=_TOOL_NAME,
            description=(
                "Retrieves current CPU, memory, disk, and process stats "
                "for this machine."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "verbose": {
                        "type": "boolean",
                        "description": (
                            "Set to true to include the top processes by "
                            "CPU and memory usage."
                        ),
                    },
                },
                "required": [],
                "additionalProperties": False,
            },
            category="system",
            requires_confirmation=False,
        )

    def execute(self, verbose: bool = False, **params: Any) -> ToolResult:
        try:
            import psutil
        except ImportError:
            return self._failure("psutil is not installed; cannot read system stats.")

        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_count = psutil.cpu_count(logical=True) or 0
            mem = psutil.virtual_memory()
            swap = psutil.swap_memory()
            disk = psutil.disk_usage("/")
            boot_time = psutil.boot_time()
            stats = [
                f"CPU: {cpu_percent:.1f}% ({cpu_count} logical cores)",
                (
                    f"Memory: {mem.percent:.1f}% used "
                    f"({mem.used / 2**30:.1f}/{mem.total / 2**30:.1f} GB)"
                ),
                (
                    f"Swap: {swap.percent:.1f}% used "
                    f"({swap.used / 2**30:.1f}/{swap.total / 2**30:.1f} GB)"
                ),
                (
                    f"Disk: {disk.percent:.1f}% used "
                    f"({disk.used / 2**30:.1f}/{disk.total / 2**30:.1f} GB free "
                    f"{disk.free / 2**30:.1f} GB)"
                ),
                f"Uptime: {_format_uptime(boot_time)}",
                f"Processes: {len(psutil.pids())}",
            ]
            if verbose:
                stats.append("")
                stats.append("Active Processes:")
                stats.extend(_top_processes(psutil, _MAX_PROCESSES))
            return ToolResult(
                tool_name=self.tool_id,
                content="\n".join(stats),
                success=True,
            )
        except Exception as exc:
            return self._failure(f"Error executing tool: {exc}")

    @staticmethod
    def _failure(message: str) -> ToolResult:
        return ToolResult(tool_name=_TOOL_NAME, content=message, success=False)


def _format_uptime(boot_time: float) -> str:
    import time

    seconds = max(0, int(time.time() - boot_time))
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours or days:
        parts.append(f"{hours}h")
    parts.append(f"{minutes}m")
    return " ".join(parts)


def _top_processes(psutil: Any, limit: int) -> list[str]:
    import time

    # Per-process cpu_percent is only meaningful between two samples, so prime
    # every process once, wait briefly, then take the real reading.
    procs = []
    for proc in psutil.process_iter(["pid"]):
        try:
            proc.cpu_percent(interval=None)
            procs.append(proc)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    time.sleep(0.1)
    rows = []
    for proc in procs:
        try:
            rows.append(
                (
                    proc.cpu_percent(interval=None),
                    proc.memory_percent(),
                    proc.pid,
                    proc.name(),
                )
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    rows.sort(key=lambda row: (row[0], row[1]), reverse=True)
    return [
        f"  {name} (pid {pid}): {cpu:.1f}% CPU, {mem:.1f}% MEM"
        for cpu, mem, pid, name in rows[:limit]
    ]


__all__ = ["SystemStatusTool"]
