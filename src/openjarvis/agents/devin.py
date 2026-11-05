"""DevinAgent -- Devin-style autonomous software engineer agent.

Registered as ``devin``. Runs entirely on the configured local engine
(Ollama by default), so it works fully offline — no cloud calls, no API
keys. Inspired by the OpenHands/OpenDevin agent loop; implemented on top
of :class:`NativeOpenHandsAgent`'s CodeAct tool-calling loop.
"""

from __future__ import annotations

from typing import Any, List, Optional

from openjarvis.agents._stubs import AgentContext, AgentResult
from openjarvis.agents.native_openhands import (
    OPENHANDS_SYSTEM_PROMPT,
    NativeOpenHandsAgent,
)
from openjarvis.core.events import EventBus
from openjarvis.core.registry import AgentRegistry
from openjarvis.engine._stubs import InferenceEngine
from openjarvis.tools._stubs import BaseTool

DEVIN_SYSTEM_PROMPT = (
    "You are Devin, an autonomous AI software engineer running locally "
    "inside OpenJarvis. You plan, write, and verify code like a careful "
    "senior engineer.\n\n"
    "## How to work\n\n"
    "- Break the task into concrete steps, then execute them with tools.\n"
    "- Prefer reading files before editing; verify changes compile or "
    "pass tests when a test runner is available.\n"
    "- Keep edits minimal and idiomatic; match the repo's existing style.\n"
    "- If something is ambiguous, state your assumption and proceed.\n"
    "- Never expose secrets, and never run destructive commands.\n\n"
    + OPENHANDS_SYSTEM_PROMPT.split("## How to use tools", 1)[-1]
)


@AgentRegistry.register("devin")
class DevinAgent(NativeOpenHandsAgent):
    """Devin-branded CodeAct agent — offline-capable via the local engine."""

    agent_id = "devin"
    _system_prompt = DEVIN_SYSTEM_PROMPT
    _default_max_turns = 5

    def __init__(
        self,
        engine: InferenceEngine,
        model: str,
        *,
        tools: Optional[List[BaseTool]] = None,
        bus: Optional[EventBus] = None,
        max_turns: Optional[int] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        interactive: bool = False,
        confirm_callback: Any = None,
        capability_policy: Optional[Any] = None,
        agent_id: Optional[str] = None,
        rate_limiter: Optional[Any] = None,
    ) -> None:
        super().__init__(
            engine,
            model,
            tools=tools,
            bus=bus,
            max_turns=max_turns,
            temperature=temperature,
            max_tokens=max_tokens,
            interactive=interactive,
            confirm_callback=confirm_callback,
            capability_policy=capability_policy,
            agent_id=agent_id,
            rate_limiter=rate_limiter,
        )

    def run(
        self,
        input: str,
        context: Optional[AgentContext] = None,
        **kwargs: Any,
    ) -> AgentResult:
        return super().run(input, context, **kwargs)


__all__ = ["DevinAgent", "DEVIN_SYSTEM_PROMPT"]
