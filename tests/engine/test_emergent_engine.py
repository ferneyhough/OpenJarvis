"""Emergent is an OpenAI-compatible engine keyed by EMERGENT_API_KEY."""

from __future__ import annotations

from openjarvis.engine.openai_compat_engines import EmergentEngine


def test_unhealthy_without_key_and_makes_no_request(monkeypatch):
    monkeypatch.delenv("EMERGENT_API_KEY", raising=False)
    engine = EmergentEngine()
    assert engine.health() is False


def test_healthy_with_key_and_uses_env_settings(monkeypatch):
    monkeypatch.setenv("EMERGENT_API_KEY", "sk-test")
    engine = EmergentEngine()
    assert engine.health() is True
    assert engine._host == "https://integrations.emergentagent.com/llm"
    assert engine._api_prefix == ""
    assert engine._headers == {"Authorization": "Bearer sk-test"}


def test_lists_fallback_models_when_server_has_no_model_list(monkeypatch):
    monkeypatch.setenv("EMERGENT_API_KEY", "sk-test")
    engine = EmergentEngine()
    monkeypatch.setattr(
        "openjarvis.engine._openai_compat._OpenAICompatibleEngine.list_models",
        lambda self: [],
    )
    assert "gpt-4o-mini" in engine.list_models()
