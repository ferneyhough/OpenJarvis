# TalkingAvatar

Live talking head of the blue steampunk robot (the locked video model), driven
by the app's own TTS level meter.

## Pieces
- `TalkingAvatar.tsx` — the component. Polls `getTtsLevel()` from
  `frontend/src/lib/tts.ts` (already in the app) and the `useTtsStore` state.
- `frontend/public/avatar/avatar_base.png` — base plate, dark mouth cavity
- `frontend/public/avatar/avatar_jaw.png` — jaw layer (locked-model pixels)
- `frontend/public/avatar/avatar_eyes_glow.png` — eye glow layer

## Use
```tsx
import { TalkingAvatar } from './components/Avatar/TalkingAvatar';

// Page layout keeps the locked intro frame's contract:
//   [ pill banner spot — your interface ]
//   [ <TalkingAvatar /> — centre ]
//   [ chat box ]
<TalkingAvatar className="w-[min(720px,92vw)]" />
```
No wiring needed for speech: when any read-aloud or voice reply plays through
the shared TTS store, he talks. Tune with `maxDropPct` (default 2.8).
