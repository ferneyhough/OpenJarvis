import { transcribeAudio } from './api';

/**
 * Speech recognition that records short utterances in the page and sends them to
 * the local Whisper backend (/v1/speech/transcribe). Embedded WebViews (WebView2)
 * have no browser speech service, so this mirrors the SpeechRecognition surface
 * the hands-free hook expects.
 */

const SPEECH_RMS = 0.02;
const SILENCE_MS = 900;
const MIN_SPEECH_MS = 400;
const IDLE_RESTART_MS = 10000;
const MAX_UTTERANCE_MS = 25000;
const TICK_MS = 60;

interface ResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

export class LocalWhisperRecognition {
  lang = 'en-US';
  continuous = true;
  interimResults = false;
  onstart: (() => void) | null = null;
  onresult:
    | ((event: { resultIndex: number; results: ArrayLike<ResultLike> }) => void)
    | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private cycleStart = 0;
  private speechMs = 0;
  private lastVoice = 0;
  private lastTickAt = 0;
  /** When true, audio is captured but never transcribed — used while Jarvis
   *  is speaking so his own TTS can't loop back as a command. */
  private muted = false;

  start(): void {
    this.running = true;
    void this.open();
  }

  stop(): void {
    this.running = false;
    this.teardown();
  }

  /** Drop all audio captured while muted — nothing is transcribed or sent. */
  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    if (muted) {
      const recorder = this.recorder;
      this.recorder = null;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }
      this.chunks = [];
    } else {
      this.lastTickAt = 0;
      if (this.running && this.stream && !this.recorder) this.beginCycle();
    }
  }

  private async open(): Promise<void> {
    try {
      // AEC keeps Jarvis's own TTS output out of the microphone so his
      // voice isn't transcribed back as a command. `ideal` keeps these
      // best-effort — mandatory constraints can hard-fail getUserMedia on
      // devices/browsers that don't support them exactly.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
        },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      this.fail(name === 'NotFoundError' ? 'audio-capture' : 'not-allowed');
      return;
    }
    if (!this.running) {
      this.teardown();
      return;
    }
    this.context = new AudioContext();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.context.createMediaStreamSource(this.stream).connect(this.analyser);
    this.beginCycle();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.onstart?.();
  }

  private beginCycle(): void {
    if (!this.stream || this.muted) return;
    this.chunks = [];
    this.speechMs = 0;
    this.lastVoice = 0;
    this.lastTickAt = 0;
    this.cycleStart = Date.now();
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start();
  }

  private level(): number {
    if (!this.analyser) return 0;
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (const sample of data) sum += sample * sample;
    return Math.sqrt(sum / data.length);
  }

  private tick(): void {
    if (!this.running) return;
    const now = Date.now();
    if (this.muted) {
      this.lastTickAt = now;
      return;
    }
    // Accumulate real elapsed time, not TICK_MS: backgrounded pages get
    // their timers throttled (1s+, sometimes once a minute), and a fixed
    // step would make speech/silence detection drift minutes out of true.
    const dt = this.lastTickAt === 0 ? TICK_MS : Math.min(now - this.lastTickAt, 1000);
    this.lastTickAt = now;
    if (this.level() > SPEECH_RMS) {
      this.speechMs += dt;
      this.lastVoice = now;
    }

    const heard = this.speechMs >= MIN_SPEECH_MS;
    const finished = heard && now - this.lastVoice > SILENCE_MS;
    const tooLong = now - this.cycleStart > MAX_UTTERANCE_MS;
    const idle = !heard && now - this.cycleStart > IDLE_RESTART_MS;
    if (!finished && !tooLong && !idle) return;
    this.endCycle(heard);
  }

  private endCycle(send: boolean): void {
    const recorder = this.recorder;
    this.recorder = null;
    if (!recorder) return;
    recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
      if (send) void this.transcribe(blob);
    };
    if (recorder.state !== 'inactive') recorder.stop();
    if (this.running) this.beginCycle();
  }

  private async transcribe(blob: Blob): Promise<void> {
    try {
      const result = await transcribeAudio(blob, 'speech.webm');
      const text = (result.text ?? '').trim();
      // A transcription that lands after muting began is still his own
      // voice leaking through — drop it.
      if (text && this.running && !this.muted) {
        this.onresult?.({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: text } }],
        });
      }
    } catch {
      if (this.running) this.onerror?.({ error: 'network' });
    }
  }

  private fail(error: string): void {
    this.running = false;
    this.teardown();
    this.onerror?.({ error });
    this.onend?.();
  }

  private teardown(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.recorder = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.analyser = null;
  }
}

/** True inside an embedded WebView2 control, which has no browser speech service. */
export function isEmbeddedWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { chrome?: { webview?: unknown } }).chrome?.webview);
}
