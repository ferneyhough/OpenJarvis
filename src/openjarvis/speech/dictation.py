"""Push-to-talk dictation: global hotkey -> local Whisper -> type or chat.

Hold ``Ctrl+Win`` anywhere to dictate into the focused app (transcript is
pasted at the cursor). Hold ``Ctrl+Shift+Win`` to send the transcript to the
running OpenJarvis chat server instead and speak the reply. Audio capture uses
the same faster-whisper backend as the rest of the speech stack, so it works
fully offline.
"""

from __future__ import annotations

import io
import json
import logging
import threading
import time
import urllib.request
import wave
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

_SAMPLE_RATE = 16000
_CHANNELS = 1
_CHUNK = 1024
_DEFAULT_PREROLL_SECONDS = 0.5
_MAX_RECORD_SECONDS = 120.0
# RMS of int16 PCM; below this the mic is effectively silent.
_SILENCE_RMS = 50.0

# Canonical modifier names tracked from pynput events.
_MOD_CMD = "cmd"  # Windows key
_MOD_CTRL = "ctrl"
_MOD_SHIFT = "shift"
_MOD_ALT = "alt"


def _wav_bytes(frames: list[bytes], sample_rate: int = _SAMPLE_RATE) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(_CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"".join(frames))
    return buf.getvalue()


def _rms(data: bytes) -> float:
    import struct

    n = len(data) // 2
    if n == 0:
        return 0.0
    shorts = struct.unpack(f"{n}h", data[: n * 2])
    return (sum(s * s for s in shorts) / n) ** 0.5


class MicCapture:
    """Continuous mic capture with a pre-roll ring buffer.

    The input stream runs for the lifetime of the object so the ~0.5 s before
    the hotkey press is already buffered — the first word is never clipped.
    """

    def __init__(self, preroll_seconds: float = _DEFAULT_PREROLL_SECONDS) -> None:
        self._preroll_seconds = preroll_seconds
        self._lock = threading.Lock()
        self._stream: Any = None
        self._preroll: deque[bytes] = deque()
        self._recording: list[bytes] | None = None
        self._record_start = 0.0
        self._peak = 0.0
        self._entered = False

    def __enter__(self) -> MicCapture:
        import sounddevice as sd

        preroll_chunks = max(1, int(self._preroll_seconds * _SAMPLE_RATE / _CHUNK))
        self._preroll = deque(maxlen=preroll_chunks)
        self._stream = sd.InputStream(
            samplerate=_SAMPLE_RATE,
            channels=_CHANNELS,
            dtype="int16",
            blocksize=_CHUNK,
            callback=self._on_audio,
        )
        self._stream.start()
        self._entered = True
        return self

    def __exit__(self, *exc: object) -> None:
        self._entered = False
        if self._stream is not None:
            self._stream.stop()
            self._stream.close()
            self._stream = None

    def _on_audio(self, indata: Any, frames: int, time_info: Any, status: Any) -> None:
        data = bytes(indata)
        rms = _rms(data)
        with self._lock:
            self._peak = max(self._peak, rms)
            self._preroll.append(data)
            if self._recording is not None:
                self._recording.append(data)

    def begin(self) -> None:
        """Start a take; the pre-roll tail is prepended on ``end``."""
        with self._lock:
            self._recording = []
            self._record_start = time.monotonic()
            self._peak = 0.0

    def end(self) -> tuple[bytes, float] | None:
        """Stop the take and return (WAV bytes, peak RMS), or None if idle."""
        with self._lock:
            take = self._recording
            self._recording = None
            elapsed = time.monotonic() - self._record_start
            preroll = list(self._preroll)
            peak = self._peak
        if take is None:
            return None
        # Drop preroll older than the configured window edge case: deque is
        # already capped, so just prepend all of it.
        frames = preroll + take
        if elapsed > _MAX_RECORD_SECONDS + self._preroll_seconds:
            keep = int(_MAX_RECORD_SECONDS * _SAMPLE_RATE / _CHUNK)
            frames = frames[-keep:]
        return _wav_bytes(frames), peak

    def end_safe(self) -> tuple[Optional[bytes], float]:
        """Like ``end`` but never raises; returns (wav_or_none, peak_rms)."""
        try:
            result = self.end()
        except Exception:
            logger.exception("dictation: failed to finalize audio take")
            return None, 0.0
        if result is None:
            return None, 0.0
        return result


@dataclass
class DictationConfig:
    """Runtime options for one dictation session."""

    type_enabled: bool = True
    chat_enabled: bool = True
    preroll_seconds: float = _DEFAULT_PREROLL_SECONDS
    server_url: str = "http://127.0.0.1:8000"
    model: str = ""
    # Called with (mode, transcript, wav_bytes) after each take.
    on_transcript: Optional[Callable[[str, str, bytes], None]] = None
    # Called with the assistant reply text for chat-mode takes.
    on_reply: Optional[Callable[[str], None]] = None
    # Called with short human-readable status messages.
    on_status: Optional[Callable[[str], None]] = field(default=None)


class DictationApp:
    """Global push-to-talk listener backed by :class:`MicCapture`."""

    def __init__(self, config: DictationConfig | None = None) -> None:
        self.cfg = config or DictationConfig()
        # Multiset of held canonical modifiers; left/right variants of the
        # same modifier count separately so releasing one doesn't drop state.
        self._pressed: dict[str, int] = {}
        self._active_mode: str | None = None  # "type" | "chat"
        self._busy = False
        self._listener: Any = None
        self._capture: MicCapture | None = None
        self._stt_backend: Any = None
        self._stt_resolved = False

    # -- hotkey plumbing -------------------------------------------------

    def _key_name(self, key: Any) -> str | None:
        """Map a pynput key to a canonical modifier name, or None."""
        from pynput import keyboard

        if key in (keyboard.Key.cmd, keyboard.Key.cmd_r):
            return _MOD_CMD
        if key in (keyboard.Key.ctrl, keyboard.Key.ctrl_r, keyboard.Key.ctrl_l):
            return _MOD_CTRL
        if key in (keyboard.Key.shift, keyboard.Key.shift_r, keyboard.Key.shift_l):
            return _MOD_SHIFT
        if key in (keyboard.Key.alt, keyboard.Key.alt_r, keyboard.Key.alt_l):
            return _MOD_ALT
        return None

    @staticmethod
    def _held_names(pressed: dict[str, int]) -> set[str]:
        return {name for name, count in pressed.items() if count > 0}

    @classmethod
    def _combo_for(cls, pressed: dict[str, int]) -> str | None:
        """Return the dictation mode the current modifiers request, if any."""
        held = cls._held_names(pressed)

        def has(*names: str) -> bool:
            return all(n in held for n in names)

        if has(_MOD_CMD, _MOD_CTRL, _MOD_SHIFT):
            return "chat"
        if has(_MOD_CMD, _MOD_CTRL) and _MOD_SHIFT not in held:
            return "type"
        return None

    def _on_press(self, key: Any) -> None:
        name = self._key_name(key)
        if name is None:
            return
        self._pressed[name] = self._pressed.get(name, 0) + 1
        combo = self._combo_for(self._pressed)
        if combo and self._active_mode is None and not self._busy:
            if (combo == "type" and not self.cfg.type_enabled) or (
                combo == "chat" and not self.cfg.chat_enabled
            ):
                return
            self._active_mode = combo
            if self._capture is not None:
                self._capture.begin()
            self._status(f"● recording ({combo}) — release to send")

    def _on_release(self, key: Any) -> None:
        name = self._key_name(key)
        if name is None:
            return
        count = self._pressed.get(name, 0)
        if count <= 1:
            self._pressed.pop(name, None)
        else:
            self._pressed[name] = count - 1
        if self._active_mode is not None and self._combo_for(self._pressed) != (
            self._active_mode
        ):
            mode = self._active_mode
            self._active_mode = None
            self._status("transcribing…")
            threading.Thread(
                target=self._finish_take, args=(mode,), daemon=True
            ).start()

    # -- take pipeline ---------------------------------------------------

    def _finish_take(self, mode: str) -> None:
        self._busy = True
        try:
            self._finish_take_inner(mode)
        finally:
            self._busy = False

    def _finish_take_inner(self, mode: str) -> None:
        capture = self._capture
        if capture is None:
            return
        wav, peak = capture.end_safe()
        if wav is None:
            self._status("no audio captured")
            return
        if peak < _SILENCE_RMS:
            self._status("microphone appears silent — check input device")
            return
        backend = self._get_stt_backend()
        if backend is None:
            self._status("no speech-to-text backend available")
            return
        try:
            from openjarvis.core.config import load_config

            config = load_config()
            language = (getattr(config.speech, "language", "") or "").strip() or None
            result = backend.transcribe(wav, format="wav", language=language)
        except Exception as exc:
            self._status(f"transcription failed: {exc}")
            return
        text = (getattr(result, "text", "") or "").strip()
        if not text:
            self._status("nothing heard")
            return
        self._status(f"you ({mode}): {text}")
        if self.cfg.on_transcript is not None:
            try:
                self.cfg.on_transcript(mode, text, wav)
            except Exception:
                logger.exception("dictation: on_transcript callback failed")
        if mode == "chat":
            self._send_to_chat(text)

    def _send_to_chat(self, text: str) -> None:
        model = self.cfg.model
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": text}],
            "stream": False,
        }
        url = f"{self.cfg.server_url.rstrip('/')}/v1/chat/completions"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            self._status(f"chat failed (is `jarvis serve` running?): {exc}")
            return
        reply = ""
        try:
            reply = body["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError, AttributeError):
            pass
        if reply:
            self._status(f"jarvis: {reply}")
            if self.cfg.on_reply is not None:
                try:
                    self.cfg.on_reply(reply)
                except Exception:
                    logger.exception("dictation: on_reply callback failed")

    def _get_stt_backend(self) -> Any:
        if not self._stt_resolved:
            from openjarvis.core.config import load_config
            from openjarvis.speech._discovery import get_speech_backend

            self._stt_backend = get_speech_backend(load_config())
            self._stt_resolved = True
        return self._stt_backend

    # -- delivery helpers -------------------------------------------------

    @staticmethod
    def type_at_cursor(text: str) -> None:
        """Paste ``text`` at the current cursor position, then restore clipboard."""
        import pyperclip
        from pynput import keyboard

        try:
            previous = pyperclip.paste()
        except Exception:
            previous = None
        pyperclip.copy(text)
        controller = keyboard.Controller()
        controller.press(keyboard.Key.ctrl)
        controller.press("v")
        controller.release("v")
        controller.release(keyboard.Key.ctrl)
        if previous is not None:

            def _restore() -> None:
                try:
                    pyperclip.copy(previous)
                except Exception:
                    pass

            threading.Timer(0.5, _restore).start()

    def _status(self, message: str) -> None:
        logger.info("dictation: %s", message)
        if self.cfg.on_status is not None:
            try:
                self.cfg.on_status(message)
            except Exception:
                logger.exception("dictation: on_status callback failed")

    # -- lifecycle -------------------------------------------------------

    def run(self) -> None:
        """Block, listening for the hotkey until KeyboardInterrupt."""
        from pynput import keyboard

        capture = MicCapture(self.cfg.preroll_seconds)
        capture.__enter__()
        self._capture = capture
        self._listener = keyboard.Listener(
            on_press=self._on_press, on_release=self._on_release
        )
        self._listener.start()
        self._status(
            "dictation ready — hold Ctrl+Win to type, Ctrl+Shift+Win to ask Jarvis"
        )
        try:
            while self._listener.is_alive():
                time.sleep(0.5)
        except KeyboardInterrupt:
            pass
        finally:
            self._listener.stop()
            capture.__exit__(None, None, None)


__all__ = [
    "DictationApp",
    "DictationConfig",
    "MicCapture",
]
