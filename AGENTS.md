# Project notes

## Offline 3D rendering

A portable Blender 4.5.15 LTS lives at
`C:\Users\Administrator\Tools\blender-4.5.15-windows-x64\blender.exe`
(no install needed). Render headless with:

```
blender.exe -b --python <script.py>
```

## Media guide

- IPTV tab merges regional playlists (iptv-org US/CA/UK/IE/AU/NZ + Mad Titan
  `titan.m3u8`) with windowed XMLTV EPG via `/v1/guide/epg`.
- `/v1/guide/ivue` scrapes iVue TV Guide sources (~2 min cold; cache it).
- VOD: `/v1/vod/*` Stremio addons + libtorrent progressive playback.
- EPG docs are parsed once into `_epg_doc_cache` (6h TTL); `prefetch_epg_sources()`
  warms 1h→6h→12h→24h windows once daily on server start.
- Games (incl. Minecraft server) live on the chat-page Kids pill, not Media.

## Frontend

- Build: `cd frontend && npm run build` (outputs to `src/openjarvis/server/static`)
- Typecheck: `npx tsc -b`; tests: `npx vitest run`
- Desktop launcher: `.venv/Scripts/python.exe jarvis_desktop.py` (serves :8000)
