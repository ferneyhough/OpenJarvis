import { create } from 'zustand';
import { synthesizeSpeech, fetchTtsHealth } from './api';
import { toSpeakableText } from './message-text';

export type TtsState = 'idle' | 'loading' | 'speaking';

/**
 * Voice output is a single shared resource: one utterance at a time, for the
 * whole app. The state lives in one store rather than per component, because a
 * per-component hook would give every message its own audio element -- two
 * replies would then talk over each other, and autoplay would make that the
 * normal case rather than the exception.
 */
interface TtsStore {
  state: TtsState;
  /** id of the message currently loading or speaking, if any. */
  speakingId: string | null;
  error: string | null;
  /** Message whose read-aloud attempt failed, if any. */
  errorId: string | null;
  /** null until the health probe has answered. */
  available: boolean | null;
  /** Active TTS backend, used to avoid sending backend-specific voice IDs elsewhere. */
  backend: string | null;
  /** Last message spoken by autoplay, so a re-render never repeats it. */
  autoSpokenId: string | null;
  speak: (id: string, text: string, voiceId?: string) => Promise<void>;
  stop: () => void;
  ensureHealth: () => Promise<void>;
  markAutoSpoken: (id: string) => void;
}

// Playback handles are not render state -- keeping them out of the store avoids
// re-rendering every subscriber when an audio element is swapped.
let audio: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let controller: AbortController | null = null;
let token = 0;
let healthProbe: Promise<void> | null = null;

// Speech-level metering for visuals: routes the audio element through an
// AnalyserNode and exposes a smoothed 0..1 amplitude via getTtsLevel().
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let analyserSource: MediaElementAudioSourceNode | null = null;
let levelData: Uint8Array<ArrayBuffer> | null = null;
let smoothedLevel = 0;
let levelRaf = 0;

// Pre-synthesized clip cache for canned phrases (acknowledgments). Kokoro
// takes ~3s per sentence on CPU, so short repeated phrases are rendered once
// up front and replayed instantly instead of paying synthesis latency on
// every send. Keyed by voice + text; entries are shared Promises so
// concurrent consumers reuse one synthesis.
const speechCache = new Map<string, Promise<Blob>>();

function speechCacheKey(text: string, voiceId?: string): string {
  return `${voiceId ?? ''}${text}`;
}

/**
 * Synthesize `text` ahead of time so a later speak/streamSpeaker call for the
 * same voice+text replays the cached audio immediately. Safe to call
 * repeatedly; failures evict the entry so a later call can retry.
 */
export function prefetchSpeech(text: string, voiceId?: string): void {
  const trimmed = toSpeakableText(text);
  if (!trimmed) return;
  const key = speechCacheKey(trimmed, voiceId);
  if (speechCache.has(key)) return;
  const p = synthesizeSpeech(trimmed, { voiceId });
  p.catch(() => speechCache.delete(key));
  speechCache.set(key, p);
}

function synthForPlayback(
  text: string,
  voiceId: string | undefined,
  signal: AbortSignal,
): Promise<Blob> {
  const key = speechCacheKey(text, voiceId);
  const hit = speechCache.get(key);
  if (hit) return hit;
  const p = synthesizeSpeech(text, { voiceId, signal });
  p.catch(() => undefined);
  return p;
}

function teardownLevelMeter(): void {
  if (levelRaf) cancelAnimationFrame(levelRaf);
  levelRaf = 0;
  if (analyserSource) {
    try { analyserSource.disconnect(); } catch { /* already gone */ }
    analyserSource = null;
  }
  analyser = null;
  levelData = null;
  smoothedLevel = 0;
  if (audioCtx) {
    void audioCtx.close().catch(() => undefined);
    audioCtx = null;
  }
}

function meterLoop(): void {
  if (!analyser || !levelData) return;
  analyser.getByteTimeDomainData(levelData);
  let sum = 0;
  for (let i = 0; i < levelData.length; i++) {
    const v = (levelData[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / levelData.length);
  smoothedLevel = Math.max(rms * 3.2, smoothedLevel * 0.82);
  levelRaf = requestAnimationFrame(meterLoop);
}

function attachLevelMeter(el: HTMLAudioElement): void {
  try {
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyserSource = audioCtx.createMediaElementSource(el);
    analyserSource.connect(analyser);
    analyser.connect(audioCtx.destination);
    levelData = new Uint8Array(analyser.fftSize);
    void audioCtx.resume().catch(() => undefined);
    levelRaf = requestAnimationFrame(meterLoop);
  } catch {
    teardownLevelMeter();
  }
}

/** Current smoothed speech amplitude, 0..1. Poll from an animation loop. */
export function getTtsLevel(): number {
  return Math.min(1, smoothedLevel);
}

/** Only a stream ending in the active conversation may trigger autoplay. */
export function shouldAutoplayFinishedReply(
  previousStreamingConversationId: string | null,
  activeId: string | null,
  streamIsActive: boolean,
  lastMessage: { id: string; role: string } | undefined,
  autoSpokenId: string | null,
): boolean {
  return previousStreamingConversationId !== null
    && previousStreamingConversationId === activeId
    && !streamIsActive
    && lastMessage !== undefined
    && lastMessage.role === 'assistant'
    && lastMessage.id !== autoSpokenId;
}

/**
 * Split speakable text into sentence-sized chunks (<= ~400 chars). Kokoro
 * synthesizes on CPU, so feeding it the whole reply means the first sound only
 * plays after the entire message is rendered; chunking lets playback start
 * after the first sentence while later chunks synthesize in the background.
 */
function splitForSpeech(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["'”)\]]*\s*|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let cur = '';
  for (const raw of sentences) {
    const piece = raw.trim();
    if (!piece) continue;
    if (cur && (cur + ' ' + piece).length > 400) {
      chunks.push(cur);
      cur = piece;
    } else {
      cur = cur ? `${cur} ${piece}` : piece;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.length > 0 ? chunks : [text];
}

function teardown(): void {
  if (audio) {
    // Detach first: clearing src re-runs the media load algorithm, which fails
    // on an empty source and dispatches an `error` event. With the handler
    // still attached that surfaces as a bogus "Playback failed" after every
    // successful utterance.
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = '';
    audio = null;
    teardownLevelMeter();
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  if (controller) {
    controller.abort();
    controller = null;
  }
}

export const useTtsStore = create<TtsStore>((set, get) => ({
  state: 'idle',
  speakingId: null,
  error: null,
  errorId: null,
  available: null,
  backend: null,
  autoSpokenId: null,

  ensureHealth: () => {
    if (healthProbe) return healthProbe;
    healthProbe = fetchTtsHealth()
      .then((health) => {
        set({ available: health.available, backend: health.backend ?? null });
        if (!health.available) healthProbe = null;
      })
      .catch(() => {
        set({ available: false });
        healthProbe = null;
      });
    return healthProbe;
  },

  markAutoSpoken: (id: string) => set({ autoSpokenId: id }),

  speak: async (id: string, text: string, voiceId?: string) => {
    const trimmed = toSpeakableText(text);
    if (!trimmed) return;

    // Bump before teardown so a synthesis still in flight is both aborted and
    // fenced off by the token, even if the abort loses the race.
    token += 1;
    const mine = token;
    teardown();
    set({ state: 'loading', speakingId: id, error: null, errorId: null });

    const ac = new AbortController();
    controller = ac;

    const selectedVoice = get().backend === 'kokoro' ? voiceId : undefined;
    const chunks = splitForSpeech(trimmed);

    // speak() resolves once the first chunk is actually playing; the rest of
    // the utterance continues in the background so callers are not held for
    // the full length of the reply.
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    const run = async () => {
      try {
        // Prefetch the next sentence's audio while the current one plays, so
        // there is no synthesis gap between chunks.
        let pending: Promise<Blob> | null = synthForPlayback(chunks[0], selectedVoice, ac.signal);
        pending.catch(() => undefined);

        for (let i = 0; i < chunks.length; i += 1) {
          const blob = await pending!;
          pending = null;
          if (mine !== token || ac.signal.aborted) return;

          const url = URL.createObjectURL(blob);
          objectUrl = url;
          const el = new Audio(url);
          audio = el;
          teardownLevelMeter();
          attachLevelMeter(el);

          if (i + 1 < chunks.length) {
            pending = synthForPlayback(chunks[i + 1], selectedVoice, ac.signal);
            pending.catch(() => undefined);
          }

          let failed = false;
          const ended = new Promise<void>((resolve) => {
            el.onended = () => {
              el.onended = null;
              el.onerror = null;
              resolve();
            };
            el.onerror = () => {
              failed = true;
              el.onended = null;
              el.onerror = null;
              resolve();
            };
            // pause()/abort does not fire `ended`; without this the loop would
            // wait forever on a superseded utterance.
            ac.signal.addEventListener('abort', () => resolve(), { once: true });
          });
          const played = el
            .play()
            .then(() => {
              if (mine === token) set({ state: 'speaking', speakingId: id });
            })
            .catch(() => {
              failed = true;
            });
          if (i === 0) {
            await played;
            markStarted();
          }
          await ended;
          if (i === 0) await played;

          // teardown() may already have revoked this URL when the utterance
          // was superseded; only revoke the one we still own.
          if (objectUrl === url) {
            URL.revokeObjectURL(url);
            objectUrl = null;
          }
          if (mine !== token || ac.signal.aborted) return;
          if (failed) {
            teardown();
            set({ state: 'idle', speakingId: null, error: 'Playback failed', errorId: id });
            return;
          }
        }

        teardown();
        set({ state: 'idle', speakingId: null });
      } catch (err) {
        if (mine !== token) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        teardown();
        set({
          state: 'idle',
          speakingId: null,
          error: err instanceof Error ? err.message : 'Speech synthesis failed',
          errorId: id,
        });
      } finally {
        // Unblock speak() even when the utterance never reached playback.
        markStarted();
      }
    };

    void run();
    await started;
  },

  stop: () => {
    token += 1;
    teardown();
    set({ state: 'idle', speakingId: null, error: null, errorId: null });
  },
}));

/**
 * Sentence-boundary extraction for streaming speech. Only punctuation-
 * terminated sentences are emitted mid-stream; the unterminated tail stays
 * buffered until more text arrives or flush() is called.
 */
function extractSpeakUnits(buffer: string): { units: string[]; rest: string } {
  const re = /[^.!?…]+[.!?…]+["'”’)\]]*(?=\s|$)/g;
  const units: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buffer))) {
    units.push(buffer.slice(m.index, re.lastIndex).trim());
    last = re.lastIndex;
  }
  return { units, rest: buffer.slice(last) };
}

export interface StreamSpeaker {
  /** Feed a streamed text delta; completed sentences are queued for speech. */
  push: (delta: string) => void;
  /** Speak whatever remains buffered; call when the stream ends. */
  flush: () => void;
  /** Stop immediately (abort, superseded reply). */
  cancel: () => void;
  /** Speak a short phrase immediately, ahead of queued reply sentences. */
  sayNow: (text: string) => void;
}

/**
 * Progressive read-aloud for a streaming reply: instead of waiting for the
 * full message and synthesizing it whole, each finished sentence is queued
 * and played as soon as its audio is ready, with the next sentence
 * prefetched during playback. Shares the module playback slot with speak(),
 * so a manual read-aloud or a newer reply supersedes it cleanly.
 */
export function createStreamSpeaker(id: string, voiceId?: string): StreamSpeaker {
  token += 1;
  const mine = token;
  teardown();
  const ac = new AbortController();
  controller = ac;
  useTtsStore.setState({
    state: 'loading',
    speakingId: id,
    error: null,
    errorId: null,
  });

  const selectedVoice = useTtsStore.getState().backend === 'kokoro' ? voiceId : undefined;
  let buffer = '';
  let carry = '';
  const queue: string[] = [];
  let done = false;
  let pumpStarted = false;
  let waiters: (() => void) | null = null;
  const kick = () => {
    waiters?.();
    waiters = null;
  };

  // Short sentences are merged into the next one so Kokoro doesn't get a
  // stream of one-word blips; anything >= ~60 chars speaks immediately.
  const enqueue = (unit: string) => {
    const s = toSpeakableText(unit);
    if (!s) return;
    carry = carry ? `${carry} ${s}` : s;
    if (carry.length >= 60) {
      queue.push(carry);
      carry = '';
    }
  };

  const absorb = (final: boolean) => {
    const { units, rest } = extractSpeakUnits(buffer);
    buffer = rest;
    for (const u of units) enqueue(u);
    if (final) {
      if (buffer.trim()) enqueue(buffer);
      buffer = '';
      if (carry) {
        queue.push(carry);
        carry = '';
      }
    }
  };

  const synth = (text: string) => synthForPlayback(text, selectedVoice, ac.signal);

  const pump = async () => {
    if (pumpStarted) return;
    pumpStarted = true;
    try {
      let nextUnit: string | null = null;
      let nextPromise: Promise<Blob> | null = null;
      const ensureNext = () => {
        if (!nextPromise && queue.length > 0) {
          nextUnit = queue.shift()!;
          nextPromise = synth(nextUnit);
        }
      };
      ensureNext();

      while (mine === token && !ac.signal.aborted) {
        if (!nextPromise) {
          if (done) break;
          await new Promise<void>((resolve) => {
            waiters = resolve;
          });
          ensureNext();
          continue;
        }
        nextUnit = null;
        const blob = await nextPromise;
        nextPromise = null;
        if (mine !== token || ac.signal.aborted) return;
        // Prefetch the following sentence while this one plays.
        ensureNext();

        const url = URL.createObjectURL(blob);
        objectUrl = url;
        const el = new Audio(url);
        audio = el;
        teardownLevelMeter();
        attachLevelMeter(el);

        let failed = false;
        const ended = new Promise<void>((resolve) => {
          el.onended = () => {
            el.onended = null;
            el.onerror = null;
            resolve();
          };
          el.onerror = () => {
            failed = true;
            el.onended = null;
            el.onerror = null;
            resolve();
          };
          ac.signal.addEventListener('abort', () => resolve(), { once: true });
        });
        const played = el
          .play()
          .then(() => {
            if (mine === token) {
              useTtsStore.setState({ state: 'speaking', speakingId: id });
            }
          })
          .catch(() => {
            failed = true;
          });
        await played;
        await ended;

        if (objectUrl === url) {
          URL.revokeObjectURL(url);
          objectUrl = null;
        }
        if (mine !== token || ac.signal.aborted) return;
        if (failed) {
          teardown();
          useTtsStore.setState({
            state: 'idle',
            speakingId: null,
            error: 'Playback failed',
            errorId: id,
          });
          return;
        }
      }

      if (mine === token) {
        teardown();
        useTtsStore.setState({ state: 'idle', speakingId: null });
      }
    } catch (err) {
      if (mine !== token) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      teardown();
      useTtsStore.setState({
        state: 'idle',
        speakingId: null,
        error: err instanceof Error ? err.message : 'Speech synthesis failed',
        errorId: id,
      });
    }
  };

  return {
    push: (delta: string) => {
      if (mine !== token || ac.signal.aborted || !delta) return;
      buffer += delta;
      absorb(false);
      kick();
      void pump();
    },
    flush: () => {
      if (mine !== token || ac.signal.aborted) return;
      absorb(true);
      done = true;
      kick();
      void pump();
    },
    cancel: () => {
      if (mine !== token) return;
      token += 1;
      teardown();
      useTtsStore.setState({ state: 'idle', speakingId: null });
    },
    sayNow: (text: string) => {
      if (mine !== token || ac.signal.aborted) return;
      const s = toSpeakableText(text);
      if (!s) return;
      queue.unshift(s);
      kick();
      void pump();
    },
  };
}

/** Test seam: reset module-level playback handles between cases. */
export function __resetTtsForTests(): void {
  teardown();
  token = 0;
  healthProbe = null;
  useTtsStore.setState({
    state: 'idle',
    speakingId: null,
    error: null,
    errorId: null,
    available: null,
    backend: null,
    autoSpokenId: null,
  });
}
