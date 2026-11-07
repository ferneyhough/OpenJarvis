# Project notes

## Offline 3D rendering

A portable Blender 4.5.15 LTS lives outside OneDrive at
`C:\Users\Administrator\Tools\blender-4.5.15-windows-x64\blender.exe`
(no install needed; a backup copy is inside `JarvisArchive.7z` — see below).
Render headless with:

```
blender.exe -b --python <script.py>
```

The Iron Giant GLB is at `frontend/public/models/iron-giant/iron_giant.glb`
(CC-BY-4.0, bolshooylenny — attribution required). Head-only renders delete
all faces below ~51% of model height (neck cut) via bmesh.

## Archived files

`C:\Users\Administrator\JarvisArchive.7z` holds old projects, downloads,
build cache, the iObit Toolbox reference, and portable Blender — outside
OneDrive so nothing cloud-syncs. Double-click
`C:\Users\Administrator\Restore-JarvisArchive.bat` to extract and copy each
folder back to its original location (`Downloads`, `C:\BuildCache`,
`C:\iobit_toolbox`, `%USERPROFILE%\OpenJarvis`, `%USERPROFILE%\whisper-jarvis`,
`%USERPROFILE%\Tools`). Requires 7-Zip.

## Media guide

- IPTV guide uses only iptv-org regional playlists (US/CA/GB/IE/AU/NZ + custom
  M3U) merged with windowed XMLTV EPG via `/v1/guide/epg`. Mad Titan and iVue
  were removed from the active UI path (their streams/data weren't useful);
  `/v1/guide/ivue` remains as a backend route with stale-while-revalidate +
  disk cache at `~/.openjarvis/epg_cache/ivue_guide.json` if it's ever needed.
- VOD: `/v1/vod/*` Stremio addons + libtorrent progressive playback.
- EPG docs are parsed once into `_epg_doc_cache` (6h TTL) and persisted to
  `~/.openjarvis/epg_cache/*.json` so restarts stay fast. A background thread
  prefetches all `EPG_SOURCES` in parallel at boot (1h→24h windows, once/day;
  `POST /v1/guide/prefetch` forces a re-warm).
- Games (incl. Minecraft server) live on the chat-page Kids pill, not Media.
- Installers: `/v1/installer/resolve|download|run` turns a product/GitHub page
  link into a downloaded installer under `~/.openjarvis/installers` (wired to
  hub tiles via `InstallerButton`).
- XCrawl (web scraping API for agents): sign up at dash.xcrawl.com for an API
  key, then add the hosted MCP server in `~/.openjarvis/config.toml`:
  `servers = '[{"name":"xcrawl","url":"https://mcp.xcrawl.com/mcp","token":"YOUR_KEY"}]'`
  under `[tools.mcp]`. Or run `npx -y xcrawl-mcp` with `XCRAWL_API_KEY` set.

## Voice & latency

- TTS: Kokoro (`bm_george`, speed 1.1) via `POST /v1/speech/synthesize`;
  health at `/v1/speech/tts/health`. `frontend/src/lib/tts.ts` has a shared
  playback slot, sentence-chunked streaming speech (`createStreamSpeaker`),
  and a `speechCache` — canned ack phrases are pre-synthesized on app load
  via `prefetchSpeech` so they replay instantly.
- Chat fast path: the frontend resolves a chat-agent mode (`ask`/`agent`/…)
  and sends it as `agent_mode` on `/v1/chat/completions`. `"ask"` bypasses
  the orchestrator's tool loop entirely (single-pass direct stream) — keep
  this for plain Q&A; task modes still go through the agent.
- Ollama payloads send `keep_alive: "30m"` and the server lifespan warms the
  default chat model + TTS pipeline in a background thread at boot, so
  first-message cold loads (~30s model, ~7s voice) don't hit users.
- Default model is `qwen3:1.7b` (fast on CPU); `qwen3.5:4b`/`gemma3:4b` also
  installed. `offline_mode = true` in `~/.openjarvis/config.toml`.
- Mic/camera/screen consent: `POST /v1/speech/open-mic-settings` writes
  Windows ConsentStore registry `Allow` entries for the running exe and
  opens the Settings pages; hands-free auto-calls it once on permission
  denial.

## Frontend

- Build: `cd frontend && npm run build` (outputs to `src/openjarvis/server/static`)
- Typecheck: `npx tsc -b`; tests: `npx vitest run`
- Desktop launcher: `.venv/Scripts/python.exe jarvis_desktop.py` (serves :8000)
