# Project notes

## Offline 3D rendering

A portable Blender 4.5.15 LTS lives outside the repo (not OneDrive-synced) at
`C:\Users\Administrator\JarvisArchive\blender-4.5.15-windows-x64\blender.exe`
(no install needed). Render headless with:

```
blender.exe -b --python <script.py>
```

## Media guide

- IPTV tab merges regional playlists (iptv-org US/CA/UK/IE/AU/NZ + Mad Titan
  `titan.m3u8`) with windowed XMLTV EPG via `/v1/guide/epg`.
- `/v1/guide/ivue` scrapes iVue TV Guide sources (~2 min cold; cache it).
- VOD: `/v1/vod/*` Stremio addons + libtorrent progressive playback.
- EPG docs are parsed once into `_epg_doc_cache` (6h TTL). No fetch on boot —
  `POST /v1/guide/prefetch` warms 1h→6h→12h→24h windows manually.
- Games (incl. Minecraft server) live on the chat-page Kids pill, not Media.
- Installers: `/v1/installer/resolve|download|run` turns a product/GitHub page
  link into a downloaded installer under `~/.openjarvis/installers` (wired to
  hub tiles via `InstallerButton`).
- XCrawl (web scraping API for agents): sign up at dash.xcrawl.com for an API
  key, then add the hosted MCP server in `~/.openjarvis/config.toml`:
  `servers = '[{"name":"xcrawl","url":"https://mcp.xcrawl.com/mcp","token":"YOUR_KEY"}]'`
  under `[tools.mcp]`. Or run `npx -y xcrawl-mcp` with `XCRAWL_API_KEY` set.

## Frontend

- Build: `cd frontend && npm run build` (outputs to `src/openjarvis/server/static`)
- Typecheck: `npx tsc -b`; tests: `npx vitest run`
- Desktop launcher: `.venv/Scripts/python.exe jarvis_desktop.py` (serves :8000)
