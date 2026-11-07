"""Verify a ReAct agent actually dispatches a tool call end to end.

NativeReActAgent parses ``Thought:/Action:/Action Input:`` text from the
engine — there is no OpenAI-style ``tool_calls`` field — so the mock engine
returns scripted ReAct responses and we assert on the ``AgentResult``'s
``tool_results``.
"""

from __future__ import annotations

from unittest.mock import MagicMock

from openjarvis.agents.native_react import NativeReActAgent
from openjarvis.tools.system_status import SystemStatusTool


def _engine_response(content: str) -> dict:
    return {
        "content": content,
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_tokens": 15,
        },
        "model": "test-model",
        "finish_reason": "stop",
    }


def test_llm_tool_call_dispatch() -> None:
    engine = MagicMock(engine_id="mock")
    engine.generate.side_effect = [
        _engine_response(
            "Thought: The user wants system stats.\n"
            "Action: system_status\n"
            'Action Input: {"verbose": true}'
        ),
        _engine_response(
            "Thought: I have the stats.\nFinal Answer: Your system looks healthy."
        ),
    ]

    agent = NativeReActAgent(engine, "test-model", tools=[SystemStatusTool()])
    result = agent.run("Check my system performance details.")

    assert len(result.tool_results) == 1
    tool_result = result.tool_results[0]
    assert tool_result.tool_name == "system_status"
    assert tool_result.success is True
    assert "Active Processes:" in tool_result.content
    assert result.content == "Your system looks healthy."
    assert engine.generate.call_count == 2
