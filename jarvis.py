"""OPEN JARVIS — desktop AI assistant.
Tkinter HUD wiring brain (Claude) <-> memory (SQLite) <-> tools (files/shell/PC/VS Code/Playnite) <-> voice.
"""
import os
import re
import sys
import json
import uuid
import shutil
import threading
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
from pathlib import Path
from datetime import datetime

FROZEN = getattr(sys, "frozen", False)
APP_DIR = Path(sys.executable).parent if FROZEN else Path(__file__).parent.resolve()
RES_DIR = Path(getattr(sys, "_MEIPASS", APP_DIR))
sys.path.insert(0, str(RES_DIR))
if FROZEN:
    appdata = os.environ.get("APPDATA")
    data_root = Path(appdata) if appdata else Path.home() / "AppData" / "Roaming"
    APP_DATA_DIR = data_root / "OpenJarvis"
else:
    APP_DATA_DIR = APP_DIR

if FROZEN and sys.stdout is None:
    sys.stdout = sys.stderr = open(APP_DIR / "jarvis.log", "a", encoding="utf-8", buffering=1)

from memory import Memory
from brain import Brain
from voice import Voice
from tools import execute_tool_calls, strip_tool_blocks, needs_followup
import vscode
import playnite

CONFIG_PATH = APP_DATA_DIR / "config.json"


def prepare_user_data() -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    if FROZEN:
        legacy_config = APP_DIR / "config.json"
        legacy_memory = APP_DIR / "data" / "memory.db"
        new_memory = APP_DATA_DIR / "data" / "memory.db"
        if not CONFIG_PATH.exists() and legacy_config.is_file():
            shutil.copy2(legacy_config, CONFIG_PATH)
        if not new_memory.exists() and legacy_memory.is_file():
            new_memory.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(legacy_memory, new_memory)
    example_config = RES_DIR / "config.example.json"
    if not CONFIG_PATH.exists() and example_config.is_file():
        shutil.copy2(example_config, CONFIG_PATH)


def load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8")) if CONFIG_PATH.exists() else {}


def save_config(cfg: dict):
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")


CYAN, BG, BG2, CARD = "#00F0FF", "#04070D", "#0A101D", "#0F172A"
TEXT, MUTED, AMBER, GREEN = "#F0F6FF", "#94A3B8", "#FF8800", "#00FF9D"
MAX_TOOL_ROUNDS = 3


def label(parent, text, **kw):
    return tk.Label(parent, text=text, bg=kw.pop("bg", BG), fg=kw.pop("fg", CYAN),
                    font=kw.pop("font", ("Consolas", 10, "bold")), **kw)


def check(parent, text, var):
    return tk.Checkbutton(parent, text=text, variable=var, bg=BG, fg=TEXT, selectcolor=BG,
                          activebackground=BG, activeforeground=CYAN, font=("Consolas", 10))


def button(parent, text, cmd, primary=False):
    return tk.Button(parent, text=text, command=cmd, bg=CYAN if primary else CARD,
                     fg=BG if primary else CYAN, font=("Consolas", 10, "bold"),
                     borderwidth=0, padx=14, pady=6, cursor="hand2")


class JarvisApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.cfg = load_config()
        self.session_id = f"jarvis-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}"
        self.workspace = Path(self.cfg.get("workspace_dir", "~/JarvisWorkspace")).expanduser()
        self.workspace.mkdir(parents=True, exist_ok=True)
        self.memory = Memory(APP_DATA_DIR / "data" / "memory.db")
        self.voice = Voice(self.cfg)
        self.brain = None
        self.listening = False
        self.muted = tk.BooleanVar(value=False)
        self.wake_var = tk.BooleanVar(value=self.cfg.get("wake_word_enabled", True))
        self._ollama_ok = None
        self._build_ui()
        if not self._has_key():
            self.root.after(300, self.open_settings)
        else:
            self.root.after(800, self._apply_wake)
        threading.Thread(target=self._auto_connect_playnite, daemon=True).start()

    # ---------- UI ----------
    def _build_ui(self):
        self.root.title("OPEN JARVIS")
        self.root.geometry("920x700")
        self.root.configure(bg=BG)

        header = tk.Frame(self.root, bg=BG2)
        header.pack(fill="x", side="top")
        label(header, "◉  OPEN JARVIS", bg=BG2, font=("Consolas", 18, "bold")).pack(side="left", padx=18, pady=14)
        self.status_var = tk.StringVar(value="IDLE")
        tk.Label(header, textvariable=self.status_var, bg=BG2, fg=GREEN,
                 font=("Consolas", 10, "bold")).pack(side="right", padx=18)
        self.wake_lbl = tk.Label(header, text="", bg=BG2, fg=AMBER, font=("Consolas", 9, "bold"))
        self.wake_lbl.pack(side="right", padx=6)

        self.chat = scrolledtext.ScrolledText(
            self.root, bg=CARD, fg=TEXT, insertbackground=CYAN, font=("Consolas", 11), wrap="word",
            borderwidth=0, highlightthickness=1, highlightbackground=CYAN, padx=14, pady=12)
        self.chat.pack(fill="both", expand=True, padx=14, pady=(10, 6))
        self.chat.tag_config("user", foreground=CYAN, font=("Consolas", 11, "bold"))
        self.chat.tag_config("jarvis", foreground=TEXT)
        self.chat.tag_config("tool", foreground=AMBER, font=("Consolas", 10))
        self.chat.tag_config("system", foreground=MUTED, font=("Consolas", 10, "italic"))
        self.chat.configure(state="disabled")

        row = tk.Frame(self.root, bg=BG)
        row.pack(fill="x", padx=14, pady=(0, 6))
        self.entry = tk.Entry(row, bg=CARD, fg=TEXT, insertbackground=CYAN, font=("Consolas", 12),
                              borderwidth=0, highlightthickness=1, highlightbackground=CYAN)
        self.entry.pack(side="left", fill="x", expand=True, ipady=10, padx=(0, 8))
        self.entry.bind("<Return>", lambda e: self.send_from_entry())
        self.mic_btn = tk.Button(row, text="🎤  TALK", command=self.toggle_listen, bg=CYAN, fg=BG,
                                 font=("Consolas", 11, "bold"), borderwidth=0, padx=18, pady=8, cursor="hand2")
        self.mic_btn.pack(side="left", padx=(0, 6))
        button(row, "SEND  ➤", self.send_from_entry).pack(side="left")

        bar = tk.Frame(self.root, bg=BG2)
        bar.pack(fill="x", side="bottom")
        for text, var, cmd in (("Mute voice", self.muted, None), ('"Hey Jarvis"', self.wake_var, self._toggle_wake)):
            tk.Checkbutton(bar, text=text, variable=var, command=cmd, bg=BG2, fg=MUTED, selectcolor=BG,
                           activebackground=BG2, font=("Consolas", 9)).pack(side="left", padx=8)
        tk.Button(bar, text="Settings", command=self.open_settings, bg=BG2, fg=CYAN, borderwidth=0,
                  font=("Consolas", 9, "underline"), cursor="hand2").pack(side="right", padx=10)
        self.workspace_lbl = tk.Label(bar, text=f"workspace: {self.workspace}", bg=BG2, fg=MUTED, font=("Consolas", 8))
        self.workspace_lbl.pack(side="right", padx=10)

        self._append("system", "OPEN JARVIS online. Say \"Hey Jarvis\", hold TALK, or type.\n"
                               "Try: 'fix this' (with a file open in VS Code) · 'play Hades' · 'what should I play?'\n"
                               "     'write a python script that prints primes up to 100 and run it'")

    def _append(self, tag: str, text: str):
        self.chat.configure(state="normal")
        prefix = {"user": "\n▸ you  ", "jarvis": "\n◉ jarvis  "}.get(tag)
        if prefix:
            self.chat.insert("end", prefix, tag)
        self.chat.insert("end", text + "\n", tag)
        self.chat.see("end")
        self.chat.configure(state="disabled")

    def _ui(self, fn):
        self.root.after(0, fn)

    # ---------- settings ----------
    def _has_key(self) -> bool:
        """Local mode: ready when Ollama is reachable (checked lazily, cached 30s)."""
        if self._ollama_ok is not None and self._ollama_ok[0]:
            import time
            if time.time() - self._ollama_ok[1] < 30:
                return True
        return self._check_ollama()

    def _check_ollama(self) -> bool:
        import time
        import urllib.request
        host = self.cfg.get("ollama_host", "http://localhost:11434").rstrip("/")
        try:
            with urllib.request.urlopen(f"{host}/api/version", timeout=1.5) as r:
                ok = r.status == 200
        except Exception:
            ok = False
        self._ollama_ok = (ok, time.time())
        return ok

    def open_settings(self):
        win = tk.Toplevel(self.root)
        win.title("Settings")
        win.configure(bg=BG)
        win.geometry("580x760")
        pad = {"padx": 16, "anchor": "w"}

        label(win, "LOCAL AI — OLLAMA").pack(pady=(14, 2), **pad)
        host_var = tk.StringVar(value=self.cfg.get("ollama_host", "http://localhost:11434"))
        tk.Entry(win, textvariable=host_var, bg=CARD, fg=TEXT,
                 font=("Consolas", 11)).pack(padx=16, fill="x")
        label(win, "runs locally — no API key needed (ollama serve)", fg=MUTED, font=("Consolas", 8)).pack(**pad)

        label(win, "MODEL").pack(pady=(10, 2), **pad)
        model_var = tk.StringVar(value=self.cfg.get("model_name", "qwen3.5:4b"))
        tk.Entry(win, textvariable=model_var, bg=CARD, fg=TEXT, font=("Consolas", 11)).pack(padx=16, fill="x")
        label(win, "installed: qwen3.5:4b · gemma3:4b — check with: ollama list", fg=MUTED, font=("Consolas", 8)).pack(**pad)

        label(win, "WORKSPACE DIR").pack(pady=(10, 2), **pad)
        ws_var = tk.StringVar(value=self.cfg.get("workspace_dir", "~/JarvisWorkspace"))
        tk.Entry(win, textvariable=ws_var, bg=CARD, fg=TEXT, font=("Consolas", 11)).pack(padx=16, fill="x")

        label(win, "VOICE").pack(pady=(12, 2), **pad)
        label(win, "Kokoro 'George' (local AI voice) with Windows voice fallback", fg=MUTED, font=("Consolas", 9)).pack(**pad)
        button(win, "▶ Test voice", lambda: self.voice.speak("Good evening. All systems are online.")).pack(padx=16, anchor="w", pady=(2, 0))

        wake_var = tk.BooleanVar(value=self.cfg.get("wake_word_enabled", True))
        check(win, 'Hands-free: listen for the wake word', wake_var).pack(padx=12, anchor="w", pady=(6, 0))
        r3 = tk.Frame(win, bg=BG); r3.pack(fill="x", padx=16)
        label(r3, "Wake word:", fg=MUTED, font=("Consolas", 9)).pack(side="left")
        wword_var = tk.StringVar(value=self.cfg.get("wake_word", "jarvis"))
        tk.Entry(r3, textvariable=wword_var, bg=CARD, fg=TEXT, width=16, font=("Consolas", 10)).pack(side="left", padx=6)

        label(win, "PERMISSIONS").pack(pady=(12, 2), **pad)
        shell_var = tk.BooleanVar(value=self.cfg.get("allow_shell_commands", True))
        pc_var = tk.BooleanVar(value=self.cfg.get("allow_pc_control", True))
        check(win, "Allow shell commands", shell_var).pack(padx=12, anchor="w")
        check(win, "Allow PC control (mouse/keyboard/apps)", pc_var).pack(padx=12, anchor="w")

        label(win, "VS CODE").pack(pady=(12, 2), **pad)
        button(win, "Enable VS Code 'fix this'", lambda: messagebox.showinfo(
            "VS Code", vscode.enable_full_path_titles(), parent=win)).pack(padx=16, anchor="w")

        label(win, "PLAYNITE").pack(pady=(12, 2), **pad)
        pn_status = tk.StringVar(value=self._playnite_status())
        label(win, "", textvariable=pn_status, fg=MUTED, font=("Consolas", 9)).pack(**pad)
        r4 = tk.Frame(win, bg=BG); r4.pack(fill="x", padx=16)

        def pn_run(fn):
            def job():
                msg = fn()
                self._ui(lambda: (pn_status.set(self._playnite_status()), self._append("tool", msg)))
            threading.Thread(target=job, daemon=True).start()
        button(r4, "Connect Playnite", lambda: pn_run(lambda: playnite.install_bridge(self.cfg, RES_DIR))).pack(side="left")
        button(r4, "Install Playnite", lambda: pn_run(playnite.install_playnite)).pack(side="left", padx=6)

        def save_and_close():
            self.cfg.update({
                "ollama_host": host_var.get().strip() or "http://localhost:11434",
                "model_provider": "ollama",
                "model_name": model_var.get().strip() or "qwen3.5:4b",
                "workspace_dir": ws_var.get().strip() or "~/JarvisWorkspace",
                "wake_word_enabled": wake_var.get(),
                "wake_word": wword_var.get().strip().lower() or "jarvis",
                "allow_shell_commands": shell_var.get(),
                "allow_pc_control": pc_var.get(),
            })
            save_config(self.cfg)
            self.workspace = Path(self.cfg["workspace_dir"]).expanduser()
            self.workspace.mkdir(parents=True, exist_ok=True)
            self.workspace_lbl.config(text=f"workspace: {self.workspace}")
            self.brain = None
            self._ollama_ok = None
            self.wake_var.set(self.cfg["wake_word_enabled"])
            self.voice.stop_wake()
            win.destroy()
            self.root.after(600, self._apply_wake)

        button(win, "SAVE", save_and_close, primary=True).pack(pady=16)

    def _playnite_status(self) -> str:
        if not playnite.find_exe(self.cfg):
            return "Playnite: not found"
        if not playnite.bridge_installed(self.cfg):
            return "Playnite: found, not connected"
        lib = playnite.load_library(self.cfg)
        return f"Playnite: connected · {len(lib)} games" if lib is not None else "Playnite: connected · open Playnite once to sync"

    def _auto_connect_playnite(self):
        if sys.platform == "win32" and playnite.find_exe(self.cfg) and not playnite.bridge_installed(self.cfg):
            msg = playnite.install_bridge(self.cfg, RES_DIR)
            self._ui(lambda: self._append("tool", msg))

    # ---------- wake word ----------
    def _apply_wake(self):
        on = self.wake_var.get() and self._has_key()
        if on and not self.voice.wake_running():
            ok = self.voice.start_wake(
                on_command=lambda t: self._ui(lambda: self.send(t)),
                on_wake=lambda: self._ui(lambda: self.status_var.set("LISTENING…")),
            )
            if not ok:
                self._append("system", f"Wake word unavailable: {self.voice.last_error}")
                self.wake_var.set(False)
        elif not on:
            self.voice.stop_wake()
        word = self.cfg.get("wake_word", "jarvis").upper()
        self.wake_lbl.config(text=f"◉ HEY {word}" if self.voice.wake_running() else "")

    def _toggle_wake(self):
        self.cfg["wake_word_enabled"] = self.wake_var.get()
        save_config(self.cfg)
        self._apply_wake()

    # ---------- brain ----------
    def _ensure_brain(self) -> bool:
        if self.brain:
            return True
        if not self._has_key():
            messagebox.showerror("Ollama not running",
                                 "Start Ollama first (it should be in the system tray), then try again.")
            return False
        history = self.memory.get_recent(self.session_id)
        self.brain = Brain(session_id=self.session_id,
                           provider="ollama",
                           model=self.cfg.get("model_name", "qwen3.5:4b"),
                           host=self.cfg.get("ollama_host", "http://localhost:11434"),
                           history=history)
        return True

    def _with_context(self, text: str) -> str:
        if not vscode.TRIGGER.search(text):
            return text
        ctx = vscode.read_active()
        self._ui(lambda: self._append("tool", ctx.split("\n")[0]))
        return f"{text}\n\n{ctx}"

    def send_from_entry(self):
        text = self.entry.get().strip()
        if text:
            self.entry.delete(0, "end")
            self.send(text)

    def send(self, text: str):
        if not self._ensure_brain():
            return
        self._append("user", text)
        self.memory.add_message(self.session_id, "user", text)
        self.status_var.set("THINKING…")
        self.voice.busy.set()
        threading.Thread(target=self._worker, args=(text,), daemon=True).start()

    def _worker(self, text: str):
        prose = ""
        try:
            reply = self.brain.reply(self._with_context(text))
            for _ in range(MAX_TOOL_ROUNDS):
                self.memory.add_message(self.session_id, "assistant", reply)
                results = execute_tool_calls(
                    reply, self.workspace,
                    allow_shell=self.cfg.get("allow_shell_commands", True),
                    allow_pc=self.cfg.get("allow_pc_control", True),
                    cfg=self.cfg, res_dir=RES_DIR)
                prose = strip_tool_blocks(reply)
                self._ui(lambda p=prose, rs=results: self._show(p, rs))
                if not results or not needs_followup(reply):
                    break
                reply = self.brain.reply("TOOL RESULTS (not from the user):\n" + "\n\n".join(results)
                                         + "\n\nNow answer the user briefly using these results.")
        except Exception as e:
            prose = f"Something went wrong: {e}"
            self._ui(lambda: self._append("jarvis", prose))
        finally:
            self.voice.busy.clear()
            self._ui(lambda: self.status_var.set("IDLE"))
        if prose and not self.muted.get():
            self.voice.speak(re.sub(r"[*_`#>]", "", prose))

    def _show(self, prose: str, results: list[str]):
        if prose:
            self._append("jarvis", prose)
        for r in results:
            self._append("tool", r)
        if self.voice.last_error:
            self._append("system", self.voice.last_error)
            self.voice.last_error = ""

    # ---------- push to talk ----------
    def toggle_listen(self):
        if self.listening:
            return
        self.listening = True
        self.voice.busy.set()
        self.mic_btn.config(text="◉ LISTENING", bg=AMBER)
        self.status_var.set("LISTENING…")
        threading.Thread(target=self._listen_worker, daemon=True).start()

    def _listen_worker(self):
        text = self.voice.listen_once()

        def done():
            self.listening = False
            self.voice.busy.clear()
            self.mic_btn.config(text="🎤  TALK", bg=CYAN)
            if text:
                self.send(text)
            else:
                self.status_var.set("IDLE")
                self._append("system", self.voice.last_error or "(no speech detected)")
                self.voice.last_error = ""
        self._ui(done)

    def on_close(self):
        self.voice.shutdown()
        self.root.destroy()


def main():
    root = tk.Tk()
    try:
        prepare_user_data()
    except OSError as error:
        messagebox.showerror(
            "OpenJarvis setup failed",
            f"Could not prepare the user settings folder:\n{error}",
        )
        root.destroy()
        return
    app = JarvisApp(root)
    root.protocol("WM_DELETE_WINDOW", app.on_close)
    root.mainloop()


if __name__ == "__main__":
    main()
