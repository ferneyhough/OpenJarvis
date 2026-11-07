# Clanker Concept — talking avatar resources (blue steampunk robot)

This folder replaces the old clanker GLB concept. These are the live resources
for the app's talking avatar: the blue steampunk robot from the locked videos.

## What's here
- `assets/avatar_base.png` — base plate (dark mouth cavity behind the jaw)
- `assets/avatar_jaw.png` — the jaw as its own layer, locked-model pixels
- `assets/avatar_eyes_glow.png` — cyan eye-glow layer
- `assets/avatar_full_reference.png` — untouched wide still the layers were cut from
- `assets/avatar_full_reference_closeup.png` — earlier close-up framing (spare)
- `TalkingAvatar.tsx` — React component: polls getTtsLevel() from
  frontend/src/lib/tts.ts; jaw follows the voice, eyes light while speaking
- `talking-avatar.js` / `talking-avatar.css` — framework-free version of the driver
- `index.html` — standalone test page with the layout contract:
  pill banner spot on top, avatar centre, chat box spot below
- `layer_test_closed_vs_open.jpg` — proof still: rest vs mid-speech

## Installed copies (already placed for the app)
- Component: `frontend/src/components/Avatar/TalkingAvatar.tsx`
- Web assets: `frontend/public/avatar/*.png`

Framing: wide shot, pulled back to ~80% (Jef: the close-up was a little too close).
Voice: the app's existing Kokoro/George TTS via the shared TTS store — no new
speech wiring needed.
