import { useEffect, useRef } from 'react';
import { getTtsLevel, useTtsStore } from '../../lib/tts';

interface TalkingAvatarProps {
  className?: string;
  /** Jaw travel at full voice volume, as % of the avatar's height. Keep small: he talks a little. */
  maxDropPct?: number;
}

/**
 * The blue steampunk robot as a live talking head.
 *
 * Three stacked copies of the same locked still do the work: a base plate with
 * a dark mouth cavity, the jaw as its own layer, and a cyan eye-glow layer.
 * The TTS store already meters playback level for visuals (getTtsLevel), so
 * this component only polls that level each frame: jaw follows the voice,
 * eyes brighten while he speaks, everything settles when he stops.
 *
 * Layout contract (matches the locked intro's final frame): this component is
 * only the robot. Keep the pill banner spot above it and the chat box below it
 * in the page layout; he never draws over either.
 */
export function TalkingAvatar({ className, maxDropPct = 2.8 }: TalkingAvatarProps) {
  const jawRef = useRef<HTMLImageElement>(null);
  const glowRef = useRef<HTMLImageElement>(null);
  const state = useTtsStore((s) => s.state);
  const speakingRef = useRef(false);
  speakingRef.current = state === 'speaking';

  useEffect(() => {
    let raf = 0;
    let jaw = 0;
    const loop = () => {
      const target = speakingRef.current ? getTtsLevel() : 0;
      // Fast open, slower close: reads as a jaw, not a bouncing sticker.
      const k = target > jaw ? 0.45 : 0.14;
      jaw += (target - jaw) * k;
      if (jawRef.current) {
        jawRef.current.style.transform = `translateY(${(jaw * maxDropPct).toFixed(3)}%)`;
      }
      if (glowRef.current) {
        glowRef.current.style.opacity = String(Math.min(1, 0.12 + jaw * 0.95));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [maxDropPct]);

  return (
    <div
      className={className}
      style={{ position: 'relative', lineHeight: 0, overflow: 'hidden' }}
      aria-hidden
    >
      <img src="/avatar/avatar_base.png" alt="" style={{ width: '100%', display: 'block' }} />
      <img
        ref={jawRef}
        src="/avatar/avatar_jaw.png"
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', pointerEvents: 'none' }}
      />
      <img
        ref={glowRef}
        src="/avatar/avatar_eyes_glow.png"
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          pointerEvents: 'none',
          opacity: 0.12,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}
