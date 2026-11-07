"""Unreal Engine Remote Control tool — drive a running UE5 editor over HTTP."""

from __future__ import annotations

from typing import Any

from openjarvis.core.registry import ToolRegistry
from openjarvis.core.types import ToolResult
from openjarvis.tools._stubs import BaseTool, ToolSpec

_TOOL_NAME = "unreal_remote_control"
_DEFAULT_HOST = "127.0.0.1"
_DEFAULT_PORT = 3010
_VALID_ACCESS = frozenset({"READ", "WRITE"})
_MAX_VALUE_LENGTH = 100_000


@ToolRegistry.register(_TOOL_NAME)
class UnrealRemoteControlTool(BaseTool):
    """Read or write properties in a running Unreal Engine 5 scene."""

    tool_id = _TOOL_NAME
    is_local = False

    @property
    def spec(self) -> ToolSpec:
        return ToolSpec(
            name=_TOOL_NAME,
            description=(
                "Controls properties in a running Unreal Engine 5 scene "
                "via the Remote Control API (enable it in the editor under "
                "Edit > Plugins > Remote Control)."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "object_path": {
                        "type": "string",
                        "description": (
                            "Full object path, e.g. "
                            "'/Game/Maps/Main.Main:PersistentLevel.Actor'."
                        ),
                    },
                    "property_name": {
                        "type": "string",
                        "description": (
                            "Property to read or write, e.g. 'RelativeLocation'."
                        ),
                    },
                    "property_value": {
                        "type": "string",
                        "description": (
                            "New value as a string "
                            "(JSON literals allowed for structs)."
                        ),
                    },
                    "access": {
                        "type": "string",
                        "enum": sorted(_VALID_ACCESS),
                        "description": (
                            "READ to query, WRITE to set. Defaults to WRITE."
                        ),
                    },
                    "host": {
                        "type": "string",
                        "description": (
                            f"Remote Control host. Defaults to {_DEFAULT_HOST}."
                        ),
                    },
                    "port": {
                        "type": "integer",
                        "description": (
                            f"Remote Control port. Defaults to {_DEFAULT_PORT}."
                        ),
                    },
                },
                "required": ["object_path", "property_name"],
                "additionalProperties": False,
            },
            category="unreal_engine",
            requires_confirmation=True,
            timeout_seconds=10.0,
        )

    def execute(
        self,
        object_path: str,
        property_name: str,
        property_value: str = "",
        access: str = "WRITE",
        host: str = _DEFAULT_HOST,
        port: int = _DEFAULT_PORT,
        **params: Any,
    ) -> ToolResult:
        if not isinstance(object_path, str) or not object_path.strip():
            return self._failure("object_path must be a non-empty string.")
        if not isinstance(property_name, str) or not property_name.strip():
            return self._failure("property_name must be a non-empty string.")
        access = str(access or "WRITE").upper()
        if access not in _VALID_ACCESS:
            return self._failure("access must be 'READ' or 'WRITE'.")
        if access == "WRITE" and not isinstance(property_value, str):
            return self._failure("property_value must be a string for WRITE access.")
        if isinstance(property_value, str) and len(property_value) > _MAX_VALUE_LENGTH:
            return self._failure(
                f"property_value exceeds {_MAX_VALUE_LENGTH} characters."
            )
        if (
            not isinstance(port, int)
            or isinstance(port, bool)
            or not (1 <= port <= 65535)
        ):
            return self._failure("port must be an integer between 1 and 65535.")
        if not isinstance(host, str) or not host.strip():
            return self._failure("host must be a non-empty string.")

        import requests

        endpoint = f"http://{host.strip()}:{port}/remote/object/property"
        payload: dict[str, Any] = {
            "objectPath": object_path.strip(),
            "propertyName": property_name.strip(),
            "access": access,
        }
        if access == "WRITE":
            payload["value"] = property_value

        try:
            if access == "READ":
                response = requests.get(endpoint, params=payload, timeout=5)
            else:
                response = requests.put(endpoint, json=payload, timeout=5)
        except requests.RequestException as exc:
            return self._failure(
                f"Unreal Remote Control request failed: {exc}. "
                "Is the editor running with the Remote Control plugin enabled?"
            )

        ok = response.status_code == 200
        return ToolResult(
            tool_name=self.tool_id,
            content=response.text if response.text else f"HTTP {response.status_code}",
            success=ok,
        )

    @staticmethod
    def _failure(message: str) -> ToolResult:
        return ToolResult(tool_name=_TOOL_NAME, content=message, success=False)


__all__ = ["UnrealRemoteControlTool"]
