"""Claude Sonnet 5.5 brain via emergentintegrations."""
import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

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


class Brain:
    def __init__(self, api_key: str, session_id: str, provider: str = "anthropic", model: str = "claude-sonnet-5-5", history: list | None = None):
        self.api_key = api_key
        self.session_id = session_id
        self.provider = provider
        self.model = model
        self._loop = asyncio.new_event_loop()
        self._chat = self._make_chat(history or [])

    def _make_chat(self, history: list) -> LlmChat:
        chat = LlmChat(
            api_key=self.api_key,
            session_id=self.session_id,
            system_message=SYSTEM_PROMPT,
        ).with_model(self.provider, self.model)
        # Seed prior turns (best-effort; library replays via send/stream, but we at least set recent context)
        # The library maintains its own history; passing initial_messages isn't exposed, so we rely on the loop.
        return chat

    async def stream_reply(self, user_text: str):
        """Async generator yielding text deltas."""
        async for ev in self._chat.stream_message(UserMessage(text=user_text)):
            if isinstance(ev, TextDelta):
                yield ev.content
            elif isinstance(ev, StreamDone):
                break

    def reply(self, user_text: str, on_delta=None) -> str:
        """Blocking helper: collects the full reply, calling on_delta(text) for each chunk."""
        full_parts: list[str] = []

        async def _run():
            async for delta in self.stream_reply(user_text):
                full_parts.append(delta)
                if on_delta:
                    on_delta(delta)

        try:
            self._loop.run_until_complete(_run())
        except Exception as e:
            return f"[BRAIN ERROR] {e}"
        return "".join(full_parts)
