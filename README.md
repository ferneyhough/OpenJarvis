# OPEN JARVIS

A fully-featured desktop Jarvis for Windows (also runs on macOS / Linux).
It **listens**, **talks**, **remembers**, **writes code**, **scaffolds apps**, and
**controls your PC** — powered by **Claude Sonnet 5.5** through the Emergent Universal Key.

```
   ◉ voice in       ◉ chat memory         ◉ code generation
   ◉ voice out      ◉ app scaffolding     ◉ keyboard / mouse / app control
```

---

## 0. Add to your existing VS Code project

1. Back up your `openjarvis` folder first: any files with the same names, like `README.md` or `requirements.txt`, get replaced.
2. Right-click `OpenJarvis.zip` → **Extract All…** → pick your `openjarvis` folder.
   (Git Bash: `unzip -o OpenJarvis.zip -d /c/path/to/openjarvis`)
3. In VS Code: **File → Open Folder → openjarvis**. Install the recommended Python extension when prompted.
4. **Terminal → Run Task…** → `Jarvis: Install (Windows CMD)`, `(Git Bash)` or `(pip)`.
5. Press **Ctrl+Shift+B** (or **F5** to debug) to run Jarvis.

## 1. Install

Pick whichever matches your terminal — all three do the exact same thing (create a
`.venv`, install deps, drop a `config.json`).

### a) Windows CMD / PowerShell (recommended)

Double-click `install.bat`, **or**:

```cmd
install.bat
```

### b) Git Bash / WSL / macOS / Linux

```bash
bash install.sh
```

### c) Plain `pip` (any OS, if you prefer manual control)

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux / Git Bash:
source .venv/bin/activate

pip install --upgrade pip
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
pip install -r requirements.txt
copy config.example.json config.json      # Windows
# cp config.example.json config.json      # macOS / Linux
```

> **PyAudio issue?**
> • Windows: `pip install pipwin && pipwin install pyaudio`
> • macOS: `brew install portaudio && pip install pyaudio`
> • Debian/Ubuntu: `sudo apt install portaudio19-dev && pip install pyaudio`

---

## 2. Add your Emergent LLM Key

Open `config.json` and replace `PASTE_YOUR_EMERGENT_LLM_KEY_HERE` with your key.
Get yours free at **emergent.sh → Profile → Universal Key**.
Or just launch the app once and paste the key into **Settings**.

---

## 3. Run

```cmd
run.bat          REM  Windows
./run.sh         # macOS / Linux / Git Bash
```

The HUD window opens. Type a command, or hit **🎤 TALK** and speak.

### Try these

```
write a python script that prints the first 50 primes and run it
scaffold a react app called helloworld
open notepad and type "jarvis was here"
take a screenshot
read the file hello.py
list the files in my workspace
```

---

## 4. Make a ready-to-run installer for friends

In VS Code: **Terminal → Run Task → Jarvis: Build .exe** (or double-click `build_exe.bat`).

It builds `dist\OpenJarvis\OpenJarvis.exe`, installs Inno Setup if needed, and creates
**`Output\OpenJarvis-Setup.exe`**. Send that one file to anyone with Windows 10/11:
no Python needed, no admin rights needed. On first launch Jarvis asks for *their own*
Emergent LLM key.

---

## 5. Hands-free "Hey Jarvis"

On by default (toggle at the bottom of the window or in Settings).
Say **"Hey Jarvis"**, wait for the beep, then speak. You can also say it in one go:
**"Jarvis, open notepad"**. Wake-word listening uses the free recognizer, so idle
listening costs nothing. Change the wake word in Settings.

## 6. Premium voice

Settings → **Premium voice** uses OpenAI Whisper to understand you and a natural OpenAI
voice (default **onyx**) to reply. It's on by default and uses a little of your Emergent key
balance on every reply. Untick it for the free voice. If premium fails, Jarvis switches to
the free voice automatically. Press **▶ Test** to hear each voice.

## 7. "Fix this" in VS Code

Open any file in VS Code and tell Jarvis **"fix this"**, **"explain this file"** or
**"refactor this function"**. Jarvis reads the file you're looking at, rewrites it, and VS Code
reloads it. **Save first (Ctrl+S).**
This project's `.vscode/settings.json` already turns this on. For other projects, click
Settings → **Enable VS Code 'fix this'** once.

## 8. Playnite games

Jarvis finds Playnite and connects to it automatically. If Playnite isn't installed, say
**"install Playnite"** or use Settings → Install Playnite. **Open or restart Playnite once**
so it shares your library, then try:

```
play Elden Ring
what racing games do I have?
what should I play tonight?
open Playnite in fullscreen
```

The bridge is a small Playnite add-on in `playnite_extension/OpenJarvisBridge`. It saves your
game list to `%APPDATA%\Playnite\ExtensionsData\OpenJarvisBridge\library.json`.
Everything stays on your PC.

---

## Config reference (`config.json`)

| key                    | default                   | notes                                   |
|------------------------|---------------------------|-----------------------------------------|
| `emergent_llm_key`     | *(required)*              | from emergent.sh                        |
| `model_provider`       | `anthropic`               | anthropic / openai / gemini             |
| `model_name`           | `claude-sonnet-5-5`       | any model from the Emergent catalog     |
| `workspace_dir`        | `~/JarvisWorkspace`       | where Jarvis writes/reads files         |
| `allow_shell_commands` | `true`                    | gate the `run_shell` tool               |
| `allow_pc_control`     | `true`                    | gate mouse / keyboard / open-app tools  |
| `wake_word_enabled`    | `true`                    | hands-free "Hey Jarvis"                 |
| `wake_word`            | `jarvis`                  | word that wakes Jarvis                  |
| `premium_voice`        | `true`                    | Whisper + OpenAI voice (uses balance)   |
| `premium_voice_name`   | `onyx`                    | onyx/echo/fable/alloy/ash/coral/nova/sage/shimmer |
| `playnite_path`        | *(auto)*                  | only if Playnite is in a custom folder  |
| `voice_rate`           | `185`                     | free voice speech rate                  |
| `voice_volume`         | `1.0`                     | 0.0–1.0                                 |
| `voice_index`          | `0`                       | SAPI voice index (0=default)            |
| `stt_language`         | `en-US`                   | Google STT language code                |

---

## Safety

Jarvis executes shell commands and controls your mouse/keyboard. Review each
reply's `[SHELL]` / `[TYPED]` / `[HOTKEY]` trace in the chat window. Disable the
dangerous tools in **Settings** when you don't need them.

---

MIT License · built with ❤ for the Emergent community
