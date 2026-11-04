import { useCallback, useEffect } from 'react';
import { useTtsStore } from '../lib/tts';
import { useAppStore } from '../lib/store';

export type { TtsState } from '../lib/tts';

/**
 * Read-aloud controls backed by the shared voice-output store.
 *
 * Every consumer talks to the same utterance, so starting one reply stops the
 * previous one instead of layering on top of it. The health probe runs once per
 * document, no matter how many components mount this hook.
 */
export function useTts() {
  const state = useTtsStore((s) => s.state);
  const speakingId = useTtsStore((s) => s.speakingId);
  const error = useTtsStore((s) => s.error);
  const errorId = useTtsStore((s) => s.errorId);
  const available = useTtsStore((s) => s.available);
  const speakToVoice = useTtsStore((s) => s.speak);
  const voiceId = useAppStore((s) => s.settings.voiceId);
  const stop = useTtsStore((s) => s.stop);
  const ensureHealth = useTtsStore((s) => s.ensureHealth);
  const speak = useCallback(
    (id: string, text: string) => speakToVoice(id, text, voiceId),
    [speakToVoice, voiceId],
  );

  useEffect(() => {
    ensureHealth();
  }, [ensureHealth]);

  return {
    state,
    speakingId,
    error,
    errorId,
    available: available === true,
    speak,
    stop,
    isLoading: state === 'loading',
    isSpeaking: state === 'speaking',
  };
}
