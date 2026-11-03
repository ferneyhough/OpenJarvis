"""Tool executor: file I/O, shell commands, app scaffolding, PC control.
Jarvis issues tool calls as JSON-fenced blocks in its reply, and we parse+execute them.
"""
import os
import re
import json
import subprocess
import shlex
from pathlib import Path
from typing import Callable, Dict, Any


# ---------- individual tools ----------

def _resolve(workspace: Path, rel: str) -> Path:
    p = Path(rel).expanduser()
    if not p.is_absolute():
        p = workspace / p
    return p


def tool_write_file(workspace: Path, path: str, content: str) -> str:
    full = _resolve(workspace, path)
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(content, encoding="utf-8")
    return f"[WROTE] {full} ({len(content)} chars)"


def tool_read_file(workspace: Path, path: str) -> str:
    full = _resolve(workspace, path)
    if not full.exists():
        return f"[ERROR] {full} not found"
    text = full.read_text(encoding="utf-8", errors="replace")
    return f"[READ] {full}\n----\n{text[:4000]}"


def tool_append_file(workspace: Path, path: str, content: str) -> str:
    full = _resolve(workspace, path)
    full.parent.mkdir(parents=True, exist_ok=True)
    with open(full, "a", encoding="utf-8") as f:
        f.write(content)
    return f"[APPENDED] {full} (+{len(content)} chars)"


def tool_list_dir(workspace: Path, path: str = ".") -> str:
    full = _resolve(workspace, path)
    if not full.exists():
        return f"[ERROR] {full} not found"
    entries = []
    for p in sorted(full.iterdir()):
        tag = "DIR " if p.is_dir() else "FILE"
        entries.append(f"  {tag}  {p.name}")
    return f"[LIST] {full}\n" + "\n".join(entries[:200])


def tool_run_shell(workspace: Path, command: str, allow_shell: bool = True) -> str:
    if not allow_shell:
        return "[DENIED] Shell commands are disabled in config."
    try:
        proc = subprocess.run(
            command,
            shell=True,
            cwd=str(workspace),
            capture_output=True,
            text=True,
            timeout=120,
        )
        out = (proc.stdout or "")[-3000:]
        err = (proc.stderr or "")[-1500:]
        return f"[SHELL exit={proc.returncode}]\nSTDOUT:\n{out}\nSTDERR:\n{err}"
    except subprocess.TimeoutExpired:
        return "[SHELL] Command timed out after 120s"
    except Exception as e:
        return f"[SHELL ERROR] {e}"


def tool_open_app(name: str) -> str:
    """Launch a Windows (or cross-platform) application by name."""
    try:
        if os.name == "nt":
            os.startfile(name)  # type: ignore[attr-defined]
        elif os.uname().sysname == "Darwin":
            subprocess.Popen(["open", "-a", name])
        else:
            subprocess.Popen(shlex.split(name))
        return f"[OPEN] launched {name}"
    except Exception as e:
        return f"[OPEN ERROR] {e}"


def tool_type_text(text: str) -> str:
    try:
        import pyautogui
        pyautogui.typewrite(text, interval=0.01)
        return f"[TYPED] {len(text)} chars"
    except Exception as e:
        return f"[TYPE ERROR] {e}"


def tool_hotkey(keys: str) -> str:
    try:
        import pyautogui
        pyautogui.hotkey(*[k.strip() for k in keys.split("+")])
        return f"[HOTKEY] {keys}"
    except Exception as e:
        return f"[HOTKEY ERROR] {e}"


def tool_screenshot(workspace: Path) -> str:
    try:
        import pyautogui
        out = workspace / "screenshots"
        out.mkdir(exist_ok=True)
        from datetime import datetime
        fp = out / f"shot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        pyautogui.screenshot(str(fp))
        return f"[SHOT] {fp}"
    except Exception as e:
        return f"[SHOT ERROR] {e}"


def tool_scaffold(workspace: Path, template: str, name: str) -> str:
    """Scaffold common project types."""
    target = workspace / name
    if target.exists():
        return f"[ERROR] {target} already exists"
    target.mkdir(parents=True)

    if template == "python":
        (target / "main.py").write_text('def main():\n    print("Hello from " + __name__)\n\nif __name__ == "__main__":\n    main()\n')
        (target / "requirements.txt").write_text("")
        (target / "README.md").write_text(f"# {name}\n\nPython project scaffolded by Jarvis.\n")
    elif template == "node":
        (target / "package.json").write_text(json.dumps({"name": name, "version": "0.1.0", "scripts": {"start": "node index.js"}}, indent=2))
        (target / "index.js").write_text('console.log("Hello from ' + name + '");\n')
        (target / "README.md").write_text(f"# {name}\n\nNode project scaffolded by Jarvis.\n")
    elif template == "react":
        (target / "README.md").write_text(f"# {name}\n\nRun: npx create-react-app .\n")
        (target / "setup.bat").write_text("npx create-react-app .\n")
    elif template == "html":
        (target / "index.html").write_text(
            f"<!doctype html><html><head><meta charset='utf-8'><title>{name}</title></head>"
            f"<body><h1>{name}</h1><script src='app.js'></script></body></html>"
        )
        (target / "app.js").write_text('console.log("ready");\n')
        (target / "style.css").write_text("body{font-family:sans-serif;padding:2rem}\n")
    else:
        return f"[ERROR] unknown template '{template}'. Use python|node|react|html"

    return f"[SCAFFOLD] created {template} project at {target}"


# ---------- dispatcher ----------

TOOL_SPEC = """
AVAILABLE TOOLS — call them by emitting a fenced block exactly like this (JSON only, no prose inside):

```tool
{"name":"write_file","args":{"path":"hello.py","content":"print('hi')"}}
```

Tools:
- write_file(path, content)          -> create/overwrite a file (relative paths go under workspace)
- append_file(path, content)         -> append to a file
- read_file(path)                    -> read a file's contents
- list_dir(path)                     -> list a directory
- run_shell(command)                 -> run a shell/cmd command (max 120s)
- open_app(name)                     -> launch an app (e.g. "notepad", "chrome")
- type_text(text)                    -> type keystrokes into the focused window
- hotkey(keys)                       -> press a hotkey like "ctrl+c" or "win+r"
- screenshot()                       -> take a screenshot into workspace/screenshots
- scaffold(template, name)           -> create a project: template in {python,node,react,html}
- vscode_active_file()               -> read the file currently open in VS Code (full path + content)
- playnite_search(query, installed_only) -> list/search the user's game library (query may be a name, genre, platform or store; "" = all)
- playnite_play(name)                -> launch a game through Playnite (fuzzy name match)
- playnite_recommend(genre)          -> suggest installed, barely-played games (genre optional)
- playnite_open(mode)                -> open Playnite: mode "desktop" or "fullscreen"
- playnite_connect()                 -> install the Jarvis bridge into Playnite
- playnite_install()                 -> install Playnite itself with winget

Rules:
0. EVERY tool call must be wrapped exactly: a line "```tool", the JSON on one line, then a line "```".
1. You may emit multiple ```tool blocks in one reply; they run in order.
2. After tool blocks, continue speaking naturally to the user.
3. Keep tool JSON strict: double quotes only, no comments, no trailing commas.
4. For code generation, prefer write_file. For running the result, use run_shell.
"""

TOOL_PATTERN = re.compile(r'(?:```(?:tool|json)?[ \t]*\n?)?(\{\s*"name"\s*:.*?\})\s*```', re.DOTALL)
FOLLOWUP_TOOLS = {"read_file", "list_dir", "run_shell", "vscode_active_file", "playnite_search", "playnite_recommend"}


def needs_followup(reply: str) -> bool:
    """True if the reply used a tool whose output Jarvis must see to answer."""
    for m in TOOL_PATTERN.finditer(reply):
        try:
            if json.loads(m.group(1)).get("name") in FOLLOWUP_TOOLS:
                return True
        except Exception:
            continue
    return False


def _extra_tool(name: str, args: dict, cfg: dict, res_dir: Path) -> str | None:
    import playnite
    import vscode
    if name == "vscode_active_file":
        return vscode.read_active()
    if name == "playnite_search":
        return playnite.search(cfg, args.get("query", ""), bool(args.get("installed_only", False)))
    if name == "playnite_play":
        return playnite.play(cfg, args["name"])
    if name == "playnite_recommend":
        return playnite.recommend(cfg, args.get("genre", ""))
    if name == "playnite_open":
        return playnite.open_app(cfg, args.get("mode", "desktop"))
    if name == "playnite_connect":
        return playnite.install_bridge(cfg, res_dir)
    if name == "playnite_install":
        return playnite.install_playnite()
    return None


def execute_tool_calls(reply: str, workspace: Path, allow_shell: bool, allow_pc: bool,
                       cfg: dict | None = None, res_dir: Path | None = None) -> list[str]:
    """Scan a model reply for ```tool blocks and execute them. Returns results."""
    results: list[str] = []
    for m in TOOL_PATTERN.finditer(reply):
        raw = m.group(1).strip()
        try:
            spec = json.loads(raw)
        except Exception as e:
            results.append(f"[TOOL PARSE ERROR] {e} in: {raw[:200]}")
            continue
        name = spec.get("name")
        args = spec.get("args", {}) or {}
        try:
            if name == "write_file":
                r = tool_write_file(workspace, args["path"], args.get("content", ""))
            elif name == "append_file":
                r = tool_append_file(workspace, args["path"], args.get("content", ""))
            elif name == "read_file":
                r = tool_read_file(workspace, args["path"])
            elif name == "list_dir":
                r = tool_list_dir(workspace, args.get("path", "."))
            elif name == "run_shell":
                r = tool_run_shell(workspace, args["command"], allow_shell)
            elif name == "open_app":
                r = tool_open_app(args["name"]) if allow_pc else "[DENIED] PC control disabled"
            elif name == "type_text":
                r = tool_type_text(args["text"]) if allow_pc else "[DENIED] PC control disabled"
            elif name == "hotkey":
                r = tool_hotkey(args["keys"]) if allow_pc else "[DENIED] PC control disabled"
            elif name == "screenshot":
                r = tool_screenshot(workspace) if allow_pc else "[DENIED] PC control disabled"
            elif name == "scaffold":
                r = tool_scaffold(workspace, args["template"], args["name"])
            else:
                r = _extra_tool(name, args, cfg or {}, res_dir or Path(__file__).parent) or f"[UNKNOWN TOOL] {name}"
        except KeyError as e:
            r = f"[TOOL ARG ERROR] missing {e} for {name}"
        except Exception as e:
            r = f"[TOOL ERROR] {name}: {e}"
        results.append(r)
    return results


def strip_tool_blocks(reply: str) -> str:
    """Remove ```tool blocks from reply so TTS only speaks prose."""
    return TOOL_PATTERN.sub("", reply).strip()
