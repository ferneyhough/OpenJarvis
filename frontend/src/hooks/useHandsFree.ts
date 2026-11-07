import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalWhisperRecognition } from '../lib/localRecognition';
import { openMicSettings } from '../lib/api';

type HandsFreePhase = 'unsupported' | 'off' | 'starting' | 'sleeping' | 'awake' | 'error';
type SpeechRecognitionError = 'not-allowed' | 'service-not-allowed' | 'audio-capture' | 'no-speech' | 'network' | string;

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent {
  error: SpeechRecognitionError;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

interface TranscriptAction {
  awake: boolean;
  command?: string;
}

function recognitionConstructor(): SpeechRecognitionWindow['SpeechRecognition'] {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as SpeechRecognitionWindow;
  const hasMic = Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
  // Prefer the local Whisper path everywhere, not just embedded WebViews:
  // the browser's SpeechRecognition API depends on a cloud speech service
  // (fails offline and is flaky in regular tabs), while LocalWhisperRecognition
  // records short utterances and transcribes them via /v1/speech/transcribe.
  if (hasMic) {
    return LocalWhisperRecognition as unknown as SpeechRecognitionWindow['SpeechRecognition'];
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function normalizeCommand(text: string): string {
  return text.toLocaleLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isSleepCommand(text: string): boolean {
  return normalizeCommand(text).replace(/\s/g, '') === 'sleepjarvis';
}

/** Interpret a final browser transcript as wake-word, command, or sleep-word input. */
export function interpretHandsFreeTranscript(text: string, currentlyAwake: boolean): TranscriptAction {
  const transcript = text.trim();
  if (!transcript) return { awake: currentlyAwake };

  if (!currentlyAwake) {
    // Tolerate natural filler before the wake word: "hey you jarvis",
    // "hi there jarvis", "hello jarvis" all wake him.
    const wakeWord = /^\s*(?:(?:hey|hi|hello|yo|hiya|howdy)\s+)?(?:you\s+|there\s+)?jarvis\b[\s,:-]*/i.exec(transcript);
    if (!wakeWord) return { awake: false };

    const command = transcript.slice(wakeWord[0].length).trim();
    if (isSleepCommand(command)) return { awake: false };
    return { awake: true, ...(command ? { command } : {}) };
  }

  if (isSleepCommand(transcript)) return { awake: false };
  return { awake: true, command: transcript };
}

function permissionMessage(name?: string): string {
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone access was blocked. Click "Open microphone settings" below, set Microphone to Allow for this site, then retry.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found. Connect a microphone and try again.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The microphone is busy or unavailable. Close other apps using it and try again.';
  }
  return 'Could not start microphone access. Check this site’s microphone permission and try again.';
}

export function useHandsFree({
  autoResume,
  onCommand,
}: {
  autoResume: boolean;
  onCommand: (text: string) => void;
}) {
  const [phase, setPhase] = useState<HandsFreePhase>(
    () => recognitionConstructor() ? 'off' : 'unsupported',
  );
  const [error, setError] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldRunRef = useRef(false);
  const awakeRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  // Permission failures trigger the OS settings flow once per session — the
  // user shouldn't have to hunt for a button when the fix is one click away.
  const autoOpenedRef = useRef(false);
  const autoOpenPermissions = useCallback(() => {
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    void openMicSettings().catch(() => {
      autoOpenedRef.current = false;
    });
  }, []);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const beginRecognition = useCallback((): boolean => {
    if (!shouldRunRef.current) return false;
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      shouldRunRef.current = false;
      setPhase('unsupported');
      return false;
    }

    const recognition = new Constructor();
    recognition.lang = 'en-CA';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onstart = () => {
      setPhase(awakeRef.current ? 'awake' : 'sleeping');
    };
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result.isFinal) continue;

        const text = result[0]?.transcript.trim();
        if (!text) continue;
        setLastHeard(text);
        const action = interpretHandsFreeTranscript(text, awakeRef.current);
        awakeRef.current = action.awake;
        setPhase(action.awake ? 'awake' : 'sleeping');
        if (action.command) onCommandRef.current(action.command);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldRunRef.current = false;
        setPhase('error');
        setError('Microphone or speech recognition permission was denied. Windows privacy settings for microphone, camera, and screen capture have been opened — set them to Allow, then retry.');
        autoOpenPermissions();
      } else if (event.error === 'audio-capture') {
        shouldRunRef.current = false;
        setPhase('error');
        setError('The browser could not access a microphone. Connect or enable one, then retry.');
      } else if (event.error === 'network') {
        setError('The browser speech service is unavailable. Check your connection; recognition will retry.');
      } else if (event.error !== 'no-speech') {
        setError(`Speech recognition stopped: ${event.error}. Retry hands-free voice.`);
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      if (!shouldRunRef.current) return;
      setPhase(awakeRef.current ? 'awake' : 'sleeping');
      clearRetry();
      retryTimerRef.current = setTimeout(beginRecognition, 500);
    };

    recognitionRef.current = recognition;
    setPhase('starting');
    try {
      recognition.start();
    } catch (startError) {
      const name = startError instanceof DOMException ? startError.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        autoOpenPermissions();
      }
      recognitionRef.current = null;
      shouldRunRef.current = false;
      setPhase('error');
      setError(permissionMessage(name || undefined));
      return false;
    }
    return true;
  }, [clearRetry, autoOpenPermissions]);

  const start = useCallback(async (): Promise<boolean> => {
    if (!recognitionConstructor()) {
      setPhase('unsupported');
      return false;
    }
    if (shouldRunRef.current) return true;

    setError(null);
    setLastHeard('');
    awakeRef.current = false;
    setPhase('starting');
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('error');
      setError('This browser cannot request microphone access. Open OpenJarvis on localhost or a secure HTTPS address and retry.');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (startError) {
      const name = startError instanceof DOMException ? startError.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        autoOpenPermissions();
      }
      setPhase('error');
      setError(permissionMessage(name || undefined));
      return false;
    }

    shouldRunRef.current = true;
    return beginRecognition();
  }, [beginRecognition, autoOpenPermissions]);

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    awakeRef.current = false;
    clearRetry();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
    }
    setError(null);
    setPhase(recognitionConstructor() ? 'off' : 'unsupported');
  }, [clearRetry]);

  useEffect(() => {
    if (!autoResume || !recognitionConstructor() || !navigator.permissions?.query) return;
    let cancelled = false;
    void navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((permission) => {
        if (cancelled) return;
        if (permission.state === 'denied') {
          setPhase('error');
          setError('Microphone access is blocked. Windows privacy settings for microphone, camera, and screen capture have been opened — set them to Allow, then retry.');
          autoOpenPermissions();
          return;
        }
        if (permission.state !== 'granted') return;
        if (shouldRunRef.current) return;
        shouldRunRef.current = true;
        awakeRef.current = false;
        beginRecognition();
      })
      .catch(() => {
        // Some browsers do not expose microphone permission queries.
      });
    return () => {
      cancelled = true;
    };
  }, [autoResume, beginRecognition, autoOpenPermissions]);

  useEffect(() => () => {
    shouldRunRef.current = false;
    clearRetry();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
    }
  }, [clearRetry]);

  return {
    phase,
    error,
    lastHeard,
    supported: phase !== 'unsupported',
    isEnabled: shouldRunRef.current,
    start,
    stop,
  };
}
