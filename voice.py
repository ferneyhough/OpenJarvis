"""Voice I/O — fully local.
STT: faster-whisper 'base' (int8 CPU) with Google speech recognition fallback.
TTS: Kokoro 'bm_george' (local) with Windows SAPI voice fallback.
Wake word: always detected with the free recognizer so idle listening costs nothing.
"""
import asyncio
import io
import os
import queue
import sys
import threading
import time
import wave
from pathlib import Path

# Keep voice models inside the install folder.
os.environ.setdefault("HF_HOME", str(Path(__file__).resolve().parent / "models" / "huggingface"))

GEORGE_VOICE = "bm_george"
GEORGE_SPEED = 0.9


class Voice:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.speaking = threading.Event()
        self.busy = threading.Event()
        self.last_error = ""
        self._mic_lock = threading.Lock()
        self._q: queue.Queue = queue.Queue()
        self._stop = threading.Event()
        self._wake_on = threading.Event()
        self._wake_thread = None
        self._sr = None
        self._recognizer = None
        self._mic = None
        self._kokoro = None
        self._whisper = None
        self._loop = asyncio.new_event_loop()
        threading.Thread(target=self._loop.run_forever, daemon=True).start()
        threading.Thread(target=self._tts_worker, daemon=True).start()

    # ---------- helpers ----------
    def _run(self, coro, timeout=60):
        return asyncio.run_coroutine_threadsafe(coro, self._loop).result(timeout)

    # ---------- TTS ----------
    def _init_sapi(self):
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty("rate", self.cfg.get("voice_rate", 185))
        engine.setProperty("volume", self.cfg.get("voice_volume", 1.0))
        voices = engine.getProperty("voices")
        idx = self.cfg.get("voice_index", 0)
        if voices and 0 <= idx < len(voices):
            engine.setProperty("voice", voices[idx].id)
        return engine

    def _speak_george(self, text: str) -> bool:
        """Speak with the local Kokoro British voice 'bm_george' (the only AI voice)."""
        try:
            import numpy as np
            if self._kokoro is None:
                from kokoro import KPipeline
                self._kokoro = KPipeline(lang_code="b")
            speed = float(self.cfg.get("voice_speed", GEORGE_SPEED))
            chunks = [np.asarray(a) for _, _, a in
                      self._kokoro(text[:4000], voice=GEORGE_VOICE, speed=speed)]
            if not chunks:
                return False
            pcm = (np.concatenate(chunks) * 32767).astype("<i2").tobytes()
            self._play_wav(pcm_to_wav(pcm))
            return True
        except Exception as e:
            self.last_error = f"George voice failed, using Windows voice: {e}"
            print(f"[voice] {self.last_error}")
            return False

    def _local_transcribe(self, audio) -> str:
        """Transcribe captured audio with local faster-whisper (int8 CPU)."""
        if self._whisper is None:
            from faster_whisper import WhisperModel
            self._whisper = WhisperModel("base", device="cpu", compute_type="int8")
        import tempfile
        import numpy as np
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio.get_wav_data())
            tmp = f.name
        try:
            segments, _ = self._whisper.transcribe(
                tmp, language=self.cfg.get("stt_language", "en-US")[:2] or None,
                beam_size=1, vad_filter=True)
            return " ".join(s.text for s in segments).strip()
        finally:
            try:
                os.unlink(tmp)
            except OSError:
                pass

    def _play_wav(self, wav_bytes: bytes):
        if sys.platform == "win32":
            import winsound
            winsound.PlaySound(wav_bytes, winsound.SND_MEMORY)
            return
        import tempfile

        import pygame
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(wav_bytes)
        pygame.mixer.init()
        pygame.mixer.music.load(f.name)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            time.sleep(0.1)

    def _tts_worker(self):
        if sys.platform == "win32":
            import ctypes
            ctypes.windll.ole32.CoInitialize(None)
        engine = None
        while not self._stop.is_set():
            try:
                text = self._q.get(timeout=0.2)
            except queue.Empty:
                continue
            if text is None:
                break
            self.speaking.set()
            try:
                if not self._speak_george(text):
                    engine = engine or self._init_sapi()
                    engine.say(text)
                    engine.runAndWait()
            except Exception as e:
                print(f"[voice] TTS error: {e}")
            finally:
                if self._q.empty():
                    time.sleep(0.3)
                    self.speaking.clear()

    def speak(self, text: str):
        text = (text or "").strip()
        if text:
            self._q.put(text)

    # ---------- STT ----------
    def _ensure_mic(self) -> bool:
        if self._recognizer is not None:
            return True
        try:
            import speech_recognition as sr
            self._sr = sr
            self._recognizer = sr.Recognizer()
            self._recognizer.pause_threshold = 0.8
            self._recognizer.dynamic_energy_threshold = True
            self._mic = sr.Microphone()
            with self._mic as source:
                self._recognizer.adjust_for_ambient_noise(source, duration=0.8)
            return True
        except Exception as e:
            self.last_error = f"microphone not available: {e}"
            print(f"[voice] {self.last_error}")
            return False

    def _capture(self, timeout: float, limit: float):
        with self._mic_lock:
            with self._mic as source:
                return self._recognizer.listen(source, timeout=timeout, phrase_time_limit=limit)

    def _free_transcribe(self, audio) -> str:
        return self._recognizer.recognize_google(audio, language=self.cfg.get("stt_language", "en-US"))

    def listen_once(self, timeout: float = 8.0, phrase_time_limit: float = 25.0) -> str:
        if not self._ensure_mic():
            return ""
        try:
            audio = self._capture(timeout, phrase_time_limit)
        except Exception:
            return ""
        try:
            text = self._local_transcribe(audio)
            if text:
                return text
        except Exception as e:
            self.last_error = f"local Whisper failed, using free recognizer: {e}"
            print(f"[voice] {self.last_error}")
        try:
            return self._free_transcribe(audio)
        except Exception:
            return ""

    # ---------- wake word ----------
    def wake_running(self) -> bool:
        return self._wake_on.is_set()

    def start_wake(self, on_command, on_wake=None) -> bool:
        if self._wake_on.is_set():
            return True
        if not self._ensure_mic():
            return False
        self._wake_on.set()
        self._wake_thread = threading.Thread(target=self._wake_loop, args=(on_command, on_wake), daemon=True)
        self._wake_thread.start()
        return True

    def stop_wake(self):
        self._wake_on.clear()

    def _wake_loop(self, on_command, on_wake):
        word = (self.cfg.get("wake_word") or "jarvis").lower().strip()
        while self._wake_on.is_set() and not self._stop.is_set():
            if self.speaking.is_set() or self.busy.is_set():
                time.sleep(0.2)
                continue
            try:
                audio = self._capture(timeout=4, limit=12)
                heard = self._free_transcribe(audio).lower()
            except Exception:
                continue
            idx = heard.find(word)
            if idx < 0:
                continue
            command = heard[idx + len(word):].strip(" ,.!?")
            if not command:
                if on_wake:
                    on_wake()
                beep()
                command = self.listen_once(timeout=6)
            if command and self._wake_on.is_set():
                on_command(command)

    def shutdown(self):
        self._wake_on.clear()
        self._stop.set()
        self._q.put(None)


def pcm_to_wav(pcm: bytes, rate: int = 24000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def beep():
    if sys.platform == "win32":
        try:
            import winsound
            winsound.Beep(880, 140)
        except Exception:
            pass
