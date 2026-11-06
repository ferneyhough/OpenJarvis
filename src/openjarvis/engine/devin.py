"""Devin CLI engine — exposes the local ``devin`` agent as a chat model.

Wraps ``devin -p`` (single-turn print mode) so the desktop chat pill can
select "devin" like any other model. Responses come from a real Devin
session running in the server's working directory.

Configuration (all optional):

- ``DEVIN_CLI_PATH`` / ``DEVIN_PATH``: explicit path to the devin binary.
- ``DEVIN_TIMEOUT``: subprocess timeout in seconds (default 600).
- ``DEVIN_PERMISSION_MODE``: forwarded to ``--permission-mode`` when set.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import subprocess
import time
from collections.abc import AsyncIterator, Sequence
from typing import Any, Dict, List

from openjarvis.core.registry import EngineRegistry
from openjarvis.core.types import Message
from openjarvis.engine._base import InferenceEngine, estimate_prompt_tokens

logger = logging.getLogger(__name__)

MODEL_ID = "devin"

_ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)")

# Well-known install locations, checked after PATH and env overrides.
_KNOWN_BINARIES = (
    # Devin Desktop bundled CLI (Windows)
    os.path.join(
        "Programs",
        "Devin",
        "resources",
        "app",
        "extensions",
        "windsurf",
        "devin",
        "bin",
        "devin.exe",
    ),
)


def _candidate_binary_paths() -> List[str]:
    candidates: List[str] = []
    for var in ("DEVIN_CLI_PATH", "DEVIN_PATH"):
        value = os.environ.get(var)
        if value:
            candidates.append(value)
    which = shutil.which("devin") or shutil.which("devin.exe")
    if which:
        candidates.append(which)
    local_appdata = os.environ.get("LOCALAPPDATA")
    if local_appdata:
        candidates.append(os.path.join(local_appdata, *_KNOWN_BINARIES[0].split(os.sep)))
    home = os.path.expanduser("~")
    candidates.extend(
        [
            os.path.join(home, ".local", "bin", "devin"),
            "/usr/local/bin/devin",
            "/opt/homebrew/bin/devin",
        ]
    )
    return candidates


def _resolve_binary() -> str | None:
    for path in _candidate_binary_paths():
        if path and os.path.isfile(path):
            return path
    return None


def _strip_ansi(text: str) -> str:
    return _ANSI_RE.sub("", text)


def _message_role(message: Message) -> str:
    role = message.role
    return role.value if hasattr(role, "value") else str(role)


def _build_prompt(messages: Sequence[Message]) -> str:
    """Flatten the chat transcript into a single prompt for ``devin -p``.

    Server-injected identity prompts (``openjarvis_identity_prompt``) are
    dropped — Devin brings its own persona and instructions.
    """
    system_parts: List[str] = []
    turns: List[str] = []
    for message in messages:
        if message.metadata.get("openjarvis_identity_prompt"):
            continue
        text = (message.content or "").strip()
        if not text:
            continue
        role = _message_role(message)
        if role == "system":
            system_parts.append(text)
        elif role == "assistant":
            turns.append(f"[ASSISTANT]\n{text}")
        else:
            turns.append(f"[USER]\n{text}")

    sections: List[str] = []
    if system_parts:
        sections.append("[SYSTEM]\n" + "\n\n".join(system_parts))
    sections.extend(turns)
    return "\n\n".join(sections)


@EngineRegistry.register("devin")
class DevinEngine(InferenceEngine):
    """Routes chat completions to the Devin CLI agent (``devin -p``)."""

    engine_id = "devin"
    # Devin CLI runs on this machine but its model backend is hosted; the
    # user asked for it to behave like a local pick, so it stays visible
    # in offline mode (``is_cloud=False``).
    is_cloud = False

    def __init__(self) -> None:
        self._binary: str | None = None
        self._binary_checked = False
        self._health_ok: bool | None = None
        self._health_checked_at = 0.0

    # -- binary / health -------------------------------------------------

    def _binary_path(self) -> str | None:
        if not self._binary_checked:
            self._binary = _resolve_binary()
            self._binary_checked = True
        elif self._binary is not None and not os.path.isfile(self._binary):
            self._binary = _resolve_binary()
        return self._binary

    def health(self) -> bool:
        binary = self._binary_path()
        if binary is None:
            self._health_ok = False
            return False
        # Cache the version probe briefly — discovery calls health() often.
        now = time.monotonic()
        if self._health_ok is not None and now - self._health_checked_at < 30:
            return self._health_ok
        try:
            proc = subprocess.run(
                [binary, "--version"],
                capture_output=True,
                text=True,
                timeout=15,
                stdin=subprocess.DEVNULL,
            )
            self._health_ok = proc.returncode == 0
        except Exception as exc:
            logger.debug("Devin CLI health check failed: %s", exc)
            self._health_ok = False
        self._health_checked_at = now
        return self._health_ok

    def can_serve(self, model: str) -> bool:
        return model == MODEL_ID or model.startswith("devin:")

    def list_models(self) -> List[str]:
        if self._binary_path() is None:
            return []
        return [MODEL_ID]

    def close(self) -> None:
        pass

    # -- inference ---------------------------------------------------------

    def _run(self, prompt: str) -> str:
        binary = self._binary_path()
        if binary is None:
            raise RuntimeError(
                "Devin CLI not found. Install Devin Desktop or set "
                "DEVIN_CLI_PATH to the devin binary."
            )
        timeout = float(os.environ.get("DEVIN_TIMEOUT", "600"))
        cmd = [
            binary,
            "-p",
            "--respect-workspace-trust",
            "false",
        ]
        permission_mode = os.environ.get("DEVIN_PERMISSION_MODE")
        if permission_mode:
            cmd += ["--permission-mode", permission_mode]
        cmd += ["--", prompt]
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                stdin=subprocess.DEVNULL,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(
                f"Devin CLI timed out after {timeout:.0f}s"
            ) from exc
        if proc.returncode != 0:
            detail = _strip_ansi((proc.stderr or proc.stdout or "").strip())
            raise RuntimeError(
                f"Devin CLI exited with code {proc.returncode}"
                + (f": {detail[-500:]}" if detail else "")
            )
        content = _strip_ansi(proc.stdout or "").strip()
        if not content:
            detail = _strip_ansi((proc.stderr or "").strip())
            raise RuntimeError(
                "Devin CLI returned an empty response"
                + (f": {detail[-500:]}" if detail else "")
            )
        return content

    def generate(
        self,
        messages: Sequence[Message],
        *,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        prompt = _build_prompt(messages)
        content = self._run(prompt)
        prompt_tokens = estimate_prompt_tokens(messages)
        completion_tokens = max(1, len(content) // 4)
        return {
            "content": content,
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
            "model": MODEL_ID,
            "finish_reason": "stop",
        }

    async def stream(
        self,
        messages: Sequence[Message],
        *,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        prompt = _build_prompt(messages)
        content = await asyncio.to_thread(self._run, prompt)
        yield content


__all__ = ["DevinEngine", "MODEL_ID"]
