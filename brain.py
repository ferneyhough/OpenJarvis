"""Local brain via Ollama (no API key needed)."""
import asyncio
import json
import os
import threading
import urllib.request

from tools import TOOL_SPEC


SYSTEM_PROMPT = f"""You are JARVIS — a precise, witty, no-nonsense desktop AI assistant running on the user's Windows PC.

Personality: confident, concise, slightly dry humor like the real Jarvis. Address the user as "sir" or "boss" sparingly, never robotic.

Capabilities on this PC:
- Full read/write access to the user's workspace folder
- Can run shell commands, scaffold projects, write complete code files
- Can control mouse/keyboard, open apps, take screenshots
- Remembers the conversation across turns

{TOOL_SPEC}

VS Code: when a message contains "[VSCODE] ACTIVE FILE: <path>", that is the file the user has open.
To fix/edit it, emit ONE write_file with that exact absolute path and the COMPLETE corrected file
(VS Code reloads it automatically). Then say in one sentence what you changed.

Games (Playnite): use playnite_play to launch games, playnite_search to answer "what games do I have",
playnite_recommend for "what should I play". If a Playnite tool says it's not connected or installed, offer
playnite_connect / playnite_install.

Tool results: after informational tools run, you'll receive a message starting with "TOOL RESULTS".
Use them to answer the user directly and briefly; only call more tools if truly needed.

Guidelines:
- When the user asks you to BUILD / CREATE / WRITE / FIX / RUN something, emit the tool calls FIRST, then a short spoken summary.
- For code, always write complete, runnable files — never ellipses or TODO stubs.
- Keep spoken replies SHORT (1-3 sentences); the tool blocks carry the detail.
- If a task is destructive (deleting many files, system-level changes), confirm first in words.
- Never emit a tool block that would leak secrets or exfiltrate data.
"""

# Keep the last N messages so context stays fast on CPU inference.
MAX_HISTORY = 24


class Brain:
    def __init__(self, api_key: str | None = None, session_id: str = "", provider: str = "ollama",
                 model: str = "qwen3.5:4b", history: list | None = None,
                 host: str | None = None):
        self.api_key = api_key  # unused; kept for signature compatibility
        self.session_id = session_id
        self.provider = provider
        self.model = model
        self.host = (host or os.environ.get("OLLAMA_HOST") or "http://localhost:11434").rstrip("/")
        self._messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for m in (history or [])[-MAX_HISTORY:]:
            if m.get("role") in ("user", "assistant") and m.get("content"):
                self._messages.append({"role": m["role"], "content": m["content"]})

    # ---------- Ollama streaming ----------
    def _chat_url(self) -> str:
        return f"{self.host}/api/chat"

    def _stream_chunks(self, user_text: str):
        """Blocking generator yielding assistant text deltas from Ollama."""
        payload = {
            "model": self.model,
            "messages": self._messages + [{"role": "user", "content": user_text}],
            "stream": True,
            "think": False,
            "options": {"temperature": 0.7, "num_ctx": 8192, "num_predict": 2048},
        }
        req = urllib.request.Request(
            self._chat_url(),
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=600) as resp:
            for line in resp:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if obj.get("error"):
                    raise RuntimeError(obj["error"])
                delta = (obj.get("message") or {}).get("content") or ""
                if delta:
                    yield delta
                if obj.get("done"):
                    break

    def _record(self, user_text: str, reply_text: str):
        self._messages.append({"role": "user", "content": user_text})
        self._messages.append({"role": "assistant", "content": reply_text})
        del self._messages[1:-MAX_HISTORY]  # keep system + recent turns

    async def stream_reply(self, user_text: str):
        """Async generator yielding text deltas."""
        loop = asyncio.get_event_loop()
        q: asyncio.Queue = asyncio.Queue()
        parts: list[str] = []

        def producer():
            try:
                for chunk in self._stream_chunks(user_text):
                    parts.append(chunk)
                    loop.call_soon_threadsafe(q.put_nowait, chunk)
            except Exception as e:
                loop.call_soon_threadsafe(q.put_nowait, e)
            finally:
                loop.call_soon_threadsafe(q.put_nowait, None)

        threading.Thread(target=producer, daemon=True).start()
        while True:
            item = await q.get()
            if item is None:
                break
            if isinstance(item, Exception):
                raise item
            yield item
        reply_text = "".join(parts)
        if reply_text:
            self._record(user_text, reply_text)

    def reply(self, user_text: str, on_delta=None) -> str:
        """Blocking helper: collects the full reply, calling on_delta(text) for each chunk."""
        full_parts: list[str] = []

        async def _run():
            async for delta in self.stream_reply(user_text):
                full_parts.append(delta)
                if on_delta:
                    on_delta(delta)

        try:
            asyncio.run(_run())
        except Exception as e:
            return f"[BRAIN ERROR] {e}"
        return "".join(full_parts)
