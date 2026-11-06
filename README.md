# OPEN JARVIS

A fully-featured desktop Jarvis for Windows (also runs on macOS / Linux).
It **listens**, **talks**, **remembers**, **writes code**, **scaffolds apps**, and
**controls your PC** — powered by a **local Ollama model** (e.g. `qwen3.5:4b`). No API keys, no cloud.

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
pip install -r requirements.txt
copy config.example.json config.json      # Windows
# cp config.example.json config.json      # macOS / Linux
```

> **PyAudio issue?**
> • Windows: `pip install pipwin && pipwin install pyaudio`
> • macOS: `brew install portaudio && pip install pyaudio`
> • Debian/Ubuntu: `sudo apt install portaudio19-dev && pip install pyaudio`

---

## 2. Install Ollama and pull a model

Jarvis runs fully local via [Ollama](https://ollama.com). Install Ollama, then:

```bash
ollama pull qwen3.5:4b    # or gemma3:4b
```

Open `config.json` and set `model_name` (and `ollama_host` if Ollama runs elsewhere).
Or launch the app once and set it in **Settings**.

---

## 3. Run

```cmd
run.bat          REM  Windows
./run.sh         # macOS / Linux / Git Bash
```

The HUD window opens. Type a command, or hit **🎤 TALK** and speak.

### Desktop app (web UI in a native WebView2 window)

```cmd
python jarvis_desktop.py
```

`run.bat` starts this. It launches `jarvis serve` on port 8000 if needed and opens it in a
native window. Chat needs Ollama with `qwen3.5:4b` (`install.bat` installs both).

- **Voice:** one global voice, Kokoro `bm_george`, everywhere. Models download into `models\`.
- **Chat toolbar:** model picker, Ask/Agent/Plan/Edit modes, tool permissions, file/image
  attach, edit/resend/regenerate on messages, and slash commands (`/help`).
- **AI image / video:** the **Image** and **Video** buttons (or `/image`, `/video`) open a free
  hosted generator in your browser by default. To generate locally, turn on Developer Mode in
  Settings and select *Local image/video generation model*; the model (image ~2 GB, video
  ~3 GB) downloads on demand into `models\` and Jarvis announces it by voice. Local image
  takes minutes on CPU and video about 20 min (sd-turbo, AnimateDiff-Lightning).
- **Convert:** the **Convert…** dropdown or `/convert <format>` converts audio/video via the
  bundled ffmpeg (`imageio-ffmpeg`). Output files are in `%USERPROFILE%\.openjarvis\media`.
- Optional manual downloads: `python scripts\download_media_models.py [image|video|all]` and
  `python scripts\download_voice_models.py`.
- **Optional dependencies and sizes:** local generation needs `pip install -r requirements-media.txt`
  (diffusers 28 MB, imageio-ffmpeg 106 MB, others <5 MB) plus models downloaded on demand
  (image ~2.4 GB, video ~3–5 GB). Core voice models in `models\` are ~490 MB (Kokoro ~330 MB,
  Whisper ~150 MB). `install.bat` asks before installing the optional packages.

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

## 4. Build Windows x64 installers

Run `install.bat` first to prepare the legacy app's 64-bit Python environment. Install
Node.js, Rust stable with the `x86_64-pc-windows-msvc` target, Visual Studio C++ build
tools, and NSIS. Then run `build_installers.bat` to build both independent products:

- Legacy Tkinter app: `Output\OpenJarvis-Setup-x64.exe`
- Tauri desktop app: `frontend\src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\`

`build_exe.bat` builds only the legacy app. The installers are per-user and do not
require Python on the destination PC. The legacy app stores its settings and memory
under `%APPDATA%\OpenJarvis`, so uninstalling the app does not remove that user data.
On first launch, the Tauri app offers supported account connections and individually
selected optional program installs before opening the main interface.

---

## 5. Hands-free "Hey Jarvis"

On by default (toggle at the bottom of the window or in Settings).
Say **"Hey Jarvis"**, wait for the beep, then speak. You can also say it in one go:
**"Jarvis, open notepad"**. Wake-word listening uses the free recognizer, so idle
listening costs nothing. Change the wake word in Settings.

## 6. Voice

Speech-to-text uses local **faster-whisper** (`base`, int8 on CPU) with a Google
recognizer fallback. Jarvis speaks with the local **Kokoro** voice `bm_george`,
falling back to the Windows SAPI voice if Kokoro fails. Everything voice-related
runs on your machine — no API keys, no cloud.

## 7. "Fix this" in VS Code

Open any file in VS Code and tell Jarvis **"fix this"**, **"explain this file"** or
**"refactor this function"**. Jarvis reads the file you're looking at, rewrites it, and VS Code
reloads it. **Save first (Ctrl+S).**
This project's `.vscode/settings.json` already turns this on. For other projects, click
Settings → **Enable VS Code 'fix this'** once.

## 8. Games, guides, kids, crypto, social, and media

The Chat page is the main page. Its top row has section pills — **Guides** (opens the Media
guide), **Kids**, **Crypto**, **Games**, **Music**, **Browsers**, **Social**, **Media**,
**Record**, **Remote**, **Stores**, and **AI** — each opening a panel of launchers below.

**Guide (Media → Guide tab):** a Rogers-style EPG grid merges live channels from regional
iptv-org playlists (US, Canada, UK, Ireland, Australia, New Zealand), the Mad Titan playlist,
and the iVue TV Guide scraper, each with windowed XMLTV schedules out to 24h in the channel's
home timezone. The grid is a fixed-height viewport: scroll vertically through channels and
horizontally through the timeline; it auto-centers on the now-line (cyan, JARVIS theme) and
a **Now** button jumps back. Views: **Guide** (main channels), **Kids** (kids channels plus a
Games group), and **Sports** (channels grouped under per-sport separators). Religious,
non-English, and gaming channels are filtered out of the main guide; game-show channels stay.
Channels appear progressively as each playlist/EPG pair finishes loading. Clicking a
programme opens an iVue-style detail popup with a Watch button; clicking the channel plays
it in the built-in HLS player. Channels with no playable stream (e.g. `plugin://` Mad Titan
entries) are marked guide-only. A **Tonight's Shows** section below lists TVMaze schedules
by show with air times.

**Movies & Shows tabs:** Rogers-style catalog rows browse movies and series with genre
filters and global dedupe. Title details offer season/episode pickers, quality filters,
**Play best** (speed-tests the top torrent candidates and plays the fastest), direct-stream
playback, and torrent download/progressive streaming via the `/v1/vod` Stremio/Torrentio/
Comet/MediaFusion sources. Downloads land under `~/.openjarvis/torrents`.

**Kids pill:** YouTube Kids, Messenger Kids, PBS Kids, Nick Jr., Google Classroom, plus
Minecraft (bundled PortableMC), Roblox (detects an installed client), and **Host MC Server**
which downloads the official dedicated server + Java runtime and hosts it on port 25565
(friends on your network can join; remote players need port forwarding).

**Crypto pill:** grouped launchers for exchanges (Coinbase, Kraken, Crypto.com, Gemini,
KuCoin, Bitstamp), AI trading bots (Pionex, 3Commas, Cryptohopper, Coinrule, Bitsgap),
market charts (CoinGecko, CoinMarketCap, TradingView, CoinStats), mining (Kryptex, NiceHash,
Salad, Cudo Miner, Honeygain, EarnApp), mining pools (F2Pool, Antpool, ViaBTC, Braiins,
Foundry, Poolin, CTPool), faucets, and wallets (Coinbase Wallet, Exodus, Electrum,
MetaMask, Trust Wallet, Ledger Live, Tangem, NC Wallet). These are browser launch links.

Games includes Steam and
Playnite libraries plus launchers for Xbox, GOG Galaxy, Epic, EA, Ubisoft Connect,
Battle.net, Riot, Rockstar, itch.io, Amazon Games, GeForce NOW, and Amazon Luna. Cloud
gaming services open in their official browser apps. On Windows Desktop, OpenJarvis
tries the installed launcher first and falls back to its official website. Configure which
apps appear in Settings; Developer Mode reveals all hub launchers.

Social services, including TikTok, open in their own browser pages. OpenJarvis does not access
private feeds unless a supported connector is separately linked and authorized.

On OpenJarvis Desktop for Windows, Steam can browse local games and launch installed
titles. For your online library and current-game status, open Settings → Steam and add your
SteamID64 plus a Steam Web API key. The profile must be public; the key is stored in the
operating system credential store and is never sent to the AI model.

Steam context in chat is off by default. When enabled in Settings, each standard chat request
can include your current game and up to 20 of your most-played titles. This game metadata is
sent to the selected model along with your message.

With hands-free voice active, say **"Jarvis, open [app]"** for an enabled hub app, then
**"Return to Jarvis"** to bring OpenJarvis back. Jarvis requests a graceful close only for a
directly launched, trackable game launcher; browser tabs opened by the web app can be closed
by Jarvis. If an external app cannot be safely closed, it is left open and Jarvis reports that.
Say **"Sleep Jarvis"** to return to wake-word mode. Background speech recognition depends on
the browser or desktop webview and may stop while another app is foregrounded.

Personal-source context is separately **off by default** in Settings. After connecting a
supported account in Data Sources, enabling it lets regular chats search connected, indexed
sources and send up to five relevant excerpts with your prompt to the selected model. Those
excerpts may contain sensitive personal information; turn the setting off to keep them out of
regular chat requests. Linking a browser launcher does not grant Jarvis access to its private
data, and providers without an OpenJarvis connector are not searched.

Playnite's exported library includes installation state, playtime, genres, platforms, source,
favorites, hidden state, and completion status. Jarvis finds Playnite automatically. If it
isn't installed, say **"install Playnite"** or use Settings → Install Playnite. **Open or
restart Playnite once** so it shares your library, then try:

```
play Elden Ring
what racing games do I have?
what should I play tonight?
open Playnite in fullscreen
```

The bridge is a small Playnite add-on in `playnite_extension/OpenJarvisBridge`. It saves your
game list to `%APPDATA%\Playnite\ExtensionsData\OpenJarvisBridge\library.json`.
Everything stays on your PC.

The Guide tab merges regional M3U playlists with their XMLTV schedules server-side
(`GET /v1/guide/epg`, `GET /v1/guide/ivue`). Streams play in the built-in HLS player with
the playlist's required User-Agent/Referer headers; many free streams are dead,
geo-blocked, or flaky — try another channel if one fails. Only add playlists and streams
you are authorized to access. Guide data is cached on disk and prefetches daily; the
server warms each region's EPG once a day in 1h→6h→12h→24h passes.

The Record tab captures your own screen or gameplay locally using browser screen-share
permission and lets you download the resulting WebM. It does not need the OpenJarvis backend
or an AI provider, and recordings are not uploaded. Microphone and shared system audio are
optional; system audio capture depends on browser, operating system, and the selected share
source. For live streaming, the tab links to Twitch, YouTube, Kick, TikTok, Facebook, Rumble,
and Steam broadcast pages, plus OBS Studio, PRISM Live Studio, Streamlabs, StreamYard, and
Prism Launcher. Prism Launcher is a Minecraft launcher, not PRISM Live Studio. These are
links, not embedded stream controls.
Enable each link in Settings → Record and live stream. Local recording works offline after the
app is installed, but AI chat still requires a backend and a locally installed model to work
without internet.

The Remote tab includes Steam Link, Chrome Remote Desktop, AnyDesk, TeamViewer, RustDesk,
and Parsec. OpenJarvis Desktop first tries the installed application for services with a
registered app link and falls back to the official site if unavailable; the browser version
opens the official site. These are launch links, not remote-control connections. Configure
the service on both devices and only access devices you own or are authorized to use. Enable
each entry in Settings → Remote access and play.

The main-page hub also includes Stores and AI sections. Configure hub launchers in Settings;
only enabled apps appear unless Developer Mode is on. Social services open in your browser,
but private feeds and account authentication are not integrated. Media streaming services and
stores are launch links rather than unified provider catalogs; guide channels come from the
built-in regional playlists plus any custom M3U/M3U8 playlist and optional XMLTV schedule
you add in the Guide tab. The AI section lists cloud providers with configured API keys and authorized local models.
Base44 and Microsoft Copilot can also be enabled as website launchers in Settings;
they use their own sign-in and are not connected as OpenJarvis chat model providers.

Developer Mode reveals additional hub entries and the Developer tab. It can open an existing
VS Code installation with an optional workspace folder; it does not download or embed VS Code
or grant Chat additional tools.

Speech settings include Kokoro's curated American and British English voices. Cloud TTS
backends use their configured voices and credentials.

### Chat agents, permissions and attachments

The toolbar select picks an agent and a model together. Agents are Auto (routes each message by
keyword), Ask, Pro (step by step), Autopilot (works autonomously), Plan, Edit, Explore, Review,
Research and Debug. Enabled toolbar pills are highlighted. Permissions has Allow, Manual (asks
before each send) and Sandbox modes plus "Allow all"; shell and web limits are prompt-level
guidance, not hard blocks. Attach files or a whole folder and browse them in the explorer below
the chat box (large, binary and `node_modules`-style content is skipped).

### Paths and disk space

All scripts (`run.bat`, `install.bat`, `build_*.bat`) start in their own folder and use `.venv`;
`tests/deployment/test_windows_scripts.py` enforces this. `install.bat` also builds the web UI.
Rust build output is large: set `CARGO_TARGET_DIR` to a folder outside OneDrive and run
`cargo clean` when you need the space back. NTFS compression (`compact /c /s /i /q <folder>`)
works well on `tools` and `node_modules` but not on model files.

---

## Config reference (`config.json`)

| key                    | default                   | notes                                   |
|------------------------|---------------------------|-----------------------------------------|
| `ollama_host`          | `http://localhost:11434`  | Ollama server URL                       |
| `model_provider`       | `ollama`                  | local engine                            |
| `model_name`           | `qwen3.5:4b`              | any `ollama list` model                 |
| `workspace_dir`        | `~/JarvisWorkspace`       | where Jarvis writes/reads files         |
| `allow_shell_commands` | `true`                    | gate the `run_shell` tool               |
| `allow_pc_control`     | `true`                    | gate mouse / keyboard / open-app tools  |
| `wake_word_enabled`    | `true`                    | hands-free "Hey Jarvis"                 |
| `wake_word`            | `jarvis`                  | word that wakes Jarvis                  |
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

## Archived files (optional restore)

Old projects, downloads, build cache, the iObit Toolbox reference, and portable
Blender are compressed into `C:\Users\Administrator\JarvisArchive.7z` (outside
OneDrive — not cloud-synced). To restore everything to its original locations,
double-click `C:\Users\Administrator\Restore-JarvisArchive.bat` (needs 7-Zip,
installed). It self-elevates, extracts to `%TEMP%`, and copies each folder back
to `Downloads`, `C:\BuildCache`, `C:\iobit_toolbox`, `%USERPROFILE%\OpenJarvis`,
`%USERPROFILE%\whisper-jarvis`, and `%USERPROFILE%\Tools` (Blender).

---

MIT License · built with ❤ for the Emergent community
