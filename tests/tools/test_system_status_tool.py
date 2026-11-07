"""Tests for the system_status tool."""

from __future__ import annotations

import pytest

from openjarvis.core.types import ToolResult
from openjarvis.tools.system_status import SystemStatusTool


@pytest.fixture
def system_status_tool() -> SystemStatusTool:
    return SystemStatusTool()


def test_system_status_default_execution(
    system_status_tool: SystemStatusTool,
) -> None:
    result = system_status_tool.execute()
    assert isinstance(result, ToolResult)
    assert result.tool_name == "system_status"
    assert result.success is True
    assert "CPU:" in result.content
    assert "Memory:" in result.content


def test_system_status_verbose_execution(
    system_status_tool: SystemStatusTool,
) -> None:
    result = system_status_tool.execute(verbose=True)
    assert result.success is True
    assert "Active Processes:" in result.content
