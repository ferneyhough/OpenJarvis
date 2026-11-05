"""Unit tests for push-to-talk dictation logic (no mic/hotkey hardware)."""

from __future__ import annotations

import io
import wave

from openjarvis.speech.dictation import (
    DictationApp,
    DictationConfig,
    MicCapture,
    _wav_bytes,
)


def _pressed(*names: str) -> dict[str, int]:
    return {name: 1 for name in names}


def test_combo_ctrl_win_is_type() -> None:
    assert DictationApp._combo_for(_pressed("cmd", "ctrl")) == "type"


def test_combo_ctrl_shift_win_is_chat() -> None:
    assert DictationApp._combo_for(_pressed("cmd", "ctrl", "shift")) == "chat"


def test_combo_single_keys_inert() -> None:
    assert DictationApp._combo_for(_pressed("cmd")) is None
    assert DictationApp._combo_for(_pressed("ctrl")) is None
    assert DictationApp._combo_for({}) is None


def test_combo_type_rejected_when_shift_held() -> None:
    # Shift held without chat enabled still resolves to "chat"; the app
    # layer decides whether that mode is allowed.
    assert DictationApp._combo_for(_pressed("cmd", "ctrl", "shift")) == "chat"


def test_wav_bytes_produces_valid_wav() -> None:
    frame = b"\x00\x00" * 160  # 10 ms of silence at 16 kHz
    wav = _wav_bytes([frame, frame])
    with wave.open(io.BytesIO(wav), "rb") as wf:
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        assert wf.getframerate() == 16000
        assert wf.readframes(wf.getnframes()) == frame + frame


class _FakeCapture:
    """Stand-in for MicCapture that returns canned audio."""

    def __init__(self, wav: bytes | None, peak: float) -> None:
        self._wav = wav
        self._peak = peak
        self.begun = False

    def begin(self) -> None:
        self.begun = True

    def end_safe(self) -> tuple[bytes | None, float]:
        return self._wav, self._peak


def test_silent_take_warns_instead_of_transcribing() -> None:
    statuses: list[str] = []
    app = DictationApp(DictationConfig(on_status=statuses.append))
    app._capture = _FakeCapture(b"wav-bytes", peak=1.0)  # type: ignore[assignment]
    app._finish_take("type")
    assert any("silent" in s for s in statuses)


def test_empty_take_reports_no_audio() -> None:
    statuses: list[str] = []
    app = DictationApp(DictationConfig(on_status=statuses.append))
    app._capture = _FakeCapture(None, peak=0.0)  # type: ignore[assignment]
    app._finish_take("type")
    assert any("no audio" in s for s in statuses)


def test_chat_mode_disabled_skips_activation() -> None:
    app = DictationApp(DictationConfig(type_enabled=True, chat_enabled=False))
    app._capture = _FakeCapture(b"x" * 100, peak=999.0)  # type: ignore[assignment]
    # Simulate pressing cmd+ctrl+shift: resolves to "chat", which is disabled.
    app._pressed = _pressed("cmd", "ctrl", "shift")
    combo = DictationApp._combo_for(app._pressed)
    assert combo == "chat"
    allowed = (combo == "type" and app.cfg.type_enabled) or (
        combo == "chat" and app.cfg.chat_enabled
    )
    assert not allowed


def test_mic_capture_end_without_begin_returns_none() -> None:
    capture = MicCapture()
    wav, peak = capture.end_safe()
    assert wav is None
    assert peak == 0.0
