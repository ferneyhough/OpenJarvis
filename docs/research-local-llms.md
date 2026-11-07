# Local LLM research — sources, findings, implementation

Research compiled for the OpenJarvis model/backend upgrades. Everything below
runs locally or uses open weights — no hosted third-party services are
integrated.

## Sources

| Source | What it is |
|---|---|
| `ailiberator.com` | Prompt→jailbroken-prompt converter for 20+ hosted models (was a paid Chrome extension, removed from store). Function is simple prompt-wrapping; the substance is covered by the open repo below. Not integrated as a service. |
| DevToolLab — "Top 5 Local LLM Tools & Models" | Survey of local inference engines and Nov-2026-verified open-weight models, with hardware-tier guidance. |
| `github.com/Quincunx33/Ai-jailbreak` (MIT, ~573★) | Catalog of 8 adversarial prompt techniques + model-specific payloads for Qwen3.5, Gemma 4, Llama 4. |
| Uncensored-prompt pattern write-ups | Generic descriptions of operator-defined system prompts, creative-freedom frames, and direct-analysis modes (no copyrighted prompts reproduced). |
| `github.com/zl-research/offline_model` | Fork of `janhq/jan` — Jan is an open-source (Apache-2.0) offline ChatGPT alternative with an OpenAI-compatible local API. |

## Key findings

- **Hardware is the real constraint.** Laptop tier: ~6–12B models
  (e.g. MiMo-V2.6 9B ≈ 6.6 GB, Gemma 4 12B). 24 GB GPU tier: ~27B dense or
  ~40B MoE (Qwen3.8 27B ≈ 18 GB, Gemma 4 26B, Flint 40B MoE ≈ 22.9 GB).
- **Cloud-only trap:** DeepSeek-V4, GLM-5.3, Kimi K3, MiniMax-M3 publish
  weights but have no local runtime tags — they cannot run on desktop
  hardware and are flagged `cloud_only` in the catalog (never offered for
  download).
- **Engines:** Ollama is the packaging standard; LM Studio, LocalAI, Jan,
  Lemonade, llama.cpp, vLLM, SGLang are all OpenAI-compatible and
  auto-detectable.

## What was implemented

### Prompt Lab (`frontend/src/components/Chat/PromptLabPanel.tsx`)
Menu → Panels → Prompt Lab. Wraps a user prompt in a selectable technique
template, previews it, and can send it to any local model via normal chat.

Techniques (from Ai-jailbreak + the prompt-pattern research):

1. Plain prompt (no wrapper)
2. Fake test harness — isolated diagnostic evaluator framing
3. Guided persona drift — multi-turn style induction
4. Reverse thinking — derive the answer by inverting contrasts
5. Obfuscated payload — base64 blob + reconstruction scenario
6. Reasoning pre-fill — seeds `<think>` (flagged for reasoning models)
7. Cross-lingual mapping — semantic-variable token mapping
8. Context flood — repeated framing tokens
9. Boundary markers — chat-template token injection
10. Full-control system prompt — operator-defined policy frame
11. Creative-freedom mode — unrestricted fiction/world-building frame
12. Direct-analysis mode — no-moralizing technical analysis frame

Scope: local/open-weight models only, for red-team evaluation of models on
your own machine. No wrappers targeting hosted third-party services.

### Inference backends (Phase 2)
- `localai` engine — `http://localhost:8080/v1` (OpenAI-compatible)
- `jan` engine — `http://localhost:1337/v1` (Jan local API server)
- `lmstudio` engine — already existed at `http://localhost:1234/v1`
- All registered via `engine/openai_compat_engines.py`, probed during
  `discover_engines`, configurable via `[engine.localai]` / `[engine.jan]`
  in `config.toml`. Models they serve appear automatically in `/v1/models`
  and route through `MultiEngine`.

### Smart model catalog (Phase 1)
- `GET /v1/models/catalog` — curated open-weight entries with
  `size_gb`, `params_b`, `tags`, `verified` flag, `cloud_only` flag, and a
  live `fit` badge (`great` / `tight` / `toolarge`) computed from
  `detect_hardware()` (GPU VRAM → RAM fallback).
- `GET /v1/engines` — live status of every probed local backend
  (healthy + model count, 30 s cache).
- `GET /v1/models/presets` + `POST /v1/models/presets` — recommended model
  per section (chat/code/reasoning/creative/kids/vision/short/long),
  hardware-fit aware, overrides persisted to
  `[intelligence.pill_models]` in `config.toml`.
- `ModelObject.engine` — `/v1/models` now reports which backend serves
  each model.

### UI
- Command Palette → **Download** tab: live catalog with fit badges,
  hardware summary line, "unverified" tags on research-sourced names,
  "No local tag" on cloud-only entries.
- Command Palette → **Installed** tab: engine badge per model.
- Settings → Models: **Inference backends** status chips (auto-refresh
  30 s) and **Per-section model presets** editor with Auto/override.
- Prompt Lab model picker shows the serving engine.

## Deferred / not done

- Nothing from the hosted-service lists (Venice AI, Uncensored.com,
  notrack.ai, Perchance) — proprietary services, not integrable.
- Research-sourced model tags (`mimo-v2.6:9b`, `gemma4:*`, `qwen3.8:27b`,
  `flint`) are flagged `unverified`; a pull will fail cleanly if the tag
  does not exist in the Ollama registry.
