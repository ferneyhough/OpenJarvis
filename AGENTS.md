# Project notes

## Offline 3D rendering

A portable Blender 4.5.15 LTS lives at
`C:\Users\Administrator\Tools\blender-4.5.15-windows-x64\blender.exe`
(no install needed). Render headless with:

```
blender.exe -b --python <script.py>
```

## Frontend

- Build: `cd frontend && npm run build` (outputs to `src/openjarvis/server/static`)
- Typecheck: `npx tsc -b`; tests: `npx vitest run`
- Desktop launcher: `.venv/Scripts/python.exe jarvis_desktop.py` (serves :8000)
