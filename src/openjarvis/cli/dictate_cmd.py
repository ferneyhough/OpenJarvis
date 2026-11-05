"""``jarvis dictate`` — global push-to-talk dictation via local Whisper."""

from __future__ import annotations

import click
from rich.console import Console


@click.command("dictate")
@click.option(
    "--mode",
    type=click.Choice(["both", "type", "chat"], case_sensitive=False),
    default="both",
    help="Hotkey behaviour: type at cursor, send to Jarvis chat, or both.",
)
@click.option(
    "--preroll",
    type=float,
    default=0.5,
    show_default=True,
    help="Seconds of audio buffered before the hotkey press.",
)
def dictate(mode: str, preroll: float) -> None:
    """Dictate anywhere: hold Ctrl+Win to type at the cursor, Ctrl+Shift+Win
    to ask the running Jarvis server and hear the reply spoken back.

    Fully offline — transcription uses the configured local speech backend.
    """
    console = Console()

    try:
        import pynput  # noqa: F401
        import pyperclip  # noqa: F401
        import sounddevice  # noqa: F401
    except ImportError as exc:
        console.print(
            f"[red]Dictation needs extra packages ({exc.name}).[/red]\n"
            "Install with: pip install 'OpenJarvis[speech]'"
        )
        raise SystemExit(1) from exc

    from openjarvis.core.config import load_config
    from openjarvis.speech.dictation import DictationApp, DictationConfig

    config = load_config()
    server = getattr(config, "server", None)
    server_url = (
        f"http://{getattr(server, 'host', '127.0.0.1')}:{getattr(server, 'port', 8000)}"
    )
    model = getattr(getattr(config, "intelligence", None), "default_model", "") or ""

    def on_status(message: str) -> None:
        console.print(f"[dim cyan]{message}[/dim cyan]")

    def on_transcript(transcript_mode: str, text: str, _wav: bytes) -> None:
        if transcript_mode == "type":
            try:
                DictationApp.type_at_cursor(text)
                console.print("[dim]typed at cursor[/dim]")
            except Exception as exc:
                console.print(f"[red]Could not type at cursor: {exc}[/red]")

    def on_reply(reply: str) -> None:
        try:
            from openjarvis.cli._voice_chat import VoiceSession, speak

            speak(reply, console, VoiceSession(config))
        except Exception as exc:
            console.print(f"[dim yellow]TTS reply failed: {exc}[/dim yellow]")

    app = DictationApp(
        DictationConfig(
            type_enabled=mode in ("both", "type"),
            chat_enabled=mode in ("both", "chat"),
            preroll_seconds=preroll,
            server_url=server_url,
            model=model,
            on_transcript=on_transcript,
            on_reply=on_reply,
            on_status=on_status,
        )
    )

    console.print(
        "[bold]Dictation mode[/bold] — hold [cyan]Ctrl+Win[/cyan] to type at the "
        "cursor, hold [cyan]Ctrl+Shift+Win[/cyan] to ask Jarvis. Ctrl+C to quit."
    )
    try:
        app.run()
    except KeyboardInterrupt:
        console.print("\n[dim]Dictation stopped.[/dim]")
