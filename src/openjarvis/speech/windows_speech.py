"""Windows built-in speech recognition backend (System.Speech / SAPI).

Uses the offline dictation grammar shipped with Windows — no model download,
no cloud calls. Audio is converted to 16 kHz mono PCM WAV (via the bundled
imageio-ffmpeg binary when needed) and transcribed with
``System.Speech.Recognition.SpeechRecognitionEngine``.
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys
import tempfile
from typing import List, Optional

from openjarvis.core.registry import SpeechRegistry
from openjarvis.speech._stubs import SpeechBackend, TranscriptionResult

logger = logging.getLogger(__name__)

_POWERSHELL_SCRIPT = r"""
Add-Type -AssemblyName System.Speech
$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$engine.SetInputToWaveFile($args[0])
$result = $engine.Recognize()
if ($result -and $result.Text) { [Console]::Out.Write($result.Text) }
$engine.Dispose()
"""


@SpeechRegistry.register("windows-speech")
class WindowsSpeechBackend(SpeechBackend):
    """Offline speech-to-text using Windows' built-in recognizer."""

    backend_id = "windows-speech"

    def __init__(self, timeout_seconds: int = 90) -> None:
        self._timeout = timeout_seconds
        self._last_error: Optional[str] = None

    @staticmethod
    def _supported() -> bool:
        return sys.platform == "win32"

    def _to_wav(self, audio: bytes, fmt: str, tmp_dir: str) -> str:
        """Return a path to a 16 kHz mono PCM WAV file for the audio."""
        suffix = f".{fmt}" if not fmt.startswith(".") else fmt
        src = os.path.join(tmp_dir, f"src{suffix}")
        with open(src, "wb") as fh:
            fh.write(audio)

        if fmt.lower() in ("wav", "wave"):
            # SAPI needs PCM; assume browser/recorded WAV is already fine, but
            # still normalize through ffmpeg when available to be safe.
            pass

        dst = os.path.join(tmp_dir, "audio.wav")
        ffmpeg = self._ffmpeg()
        if ffmpeg:
            cmd = [
                ffmpeg, "-y", "-i", src,
                "-ar", "16000", "-ac", "1", "-f", "wav", dst,
            ]
            proc = subprocess.run(
                cmd, capture_output=True, timeout=self._timeout,
            )
            if proc.returncode != 0 or not os.path.exists(dst):
                raise RuntimeError(
                    f"ffmpeg conversion failed: {proc.stderr.decode(errors='replace')[:300]}"
                )
            return dst

        if fmt.lower() in ("wav", "wave"):
            return src
        raise RuntimeError(
            "Windows speech needs WAV input and ffmpeg is unavailable for conversion"
        )

    @staticmethod
    def _ffmpeg() -> Optional[str]:
        try:
            import imageio_ffmpeg  # type: ignore[import-not-found]

            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            return None

    def transcribe(
        self,
        audio: bytes,
        *,
        format: str = "wav",
        language: Optional[str] = None,
    ) -> TranscriptionResult:
        """Transcribe audio bytes using Windows System.Speech."""
        if not self._supported():
            raise RuntimeError("windows-speech is only available on Windows")

        with tempfile.TemporaryDirectory(prefix="jarvis-stt-") as tmp_dir:
            wav_path = self._to_wav(audio, format or "wav", tmp_dir)
            script_path = os.path.join(tmp_dir, "transcribe.ps1")
            with open(script_path, "w", encoding="utf-8") as fh:
                fh.write(_POWERSHELL_SCRIPT)

            cmd = [
                "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                "-File", script_path, wav_path,
            ]
            try:
                proc = subprocess.run(
                    cmd, capture_output=True, timeout=self._timeout,
                    text=True, encoding="utf-8", errors="replace",
                )
            except subprocess.TimeoutExpired as exc:
                self._last_error = "Windows speech recognition timed out"
                raise RuntimeError(self._last_error) from exc

            if proc.returncode != 0:
                detail = (proc.stderr or "").strip()[:300]
                self._last_error = f"Windows speech failed: {detail or proc.returncode}"
                raise RuntimeError(self._last_error)

            text = (proc.stdout or "").strip()
            self._last_error = None if text else "No speech recognized"
            return TranscriptionResult(text=text, language=language, duration_seconds=0.0)

    def health(self) -> bool:
        """Check platform support and that System.Speech loads."""
        if not self._supported():
            return False
        try:
            proc = subprocess.run(
                [
                    "powershell", "-NoProfile", "-Command",
                    "Add-Type -AssemblyName System.Speech; "
                    "$e = New-Object System.Speech.Recognition.SpeechRecognitionEngine; "
                    "$e.Dispose()",
                ],
                capture_output=True, timeout=30,
            )
            return proc.returncode == 0
        except Exception as exc:
            logger.debug("windows-speech health check failed: %s", exc)
            return False

    def last_error(self) -> Optional[str]:
        return self._last_error

    def supported_formats(self) -> List[str]:
        return ["wav", "webm", "mp3", "m4a", "ogg", "flac", "opus"]
