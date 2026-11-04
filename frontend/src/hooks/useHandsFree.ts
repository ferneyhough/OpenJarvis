import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalWhisperRecognition, isEmbeddedWebView } from '../lib/localRecognition';

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
  if (isEmbeddedWebView() && hasMic) {
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
    const wakeWord = /^\s*(?:hey\s+)?jarvis\b[\s,:-]*/i.exec(transcript);
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
        setError('Microphone or speech recognition permission was denied. Open this site’s browser permissions, allow Microphone, then retry.');
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
      recognitionRef.current = null;
      shouldRunRef.current = false;
      setPhase('error');
      setError(permissionMessage(
        startError instanceof DOMException ? startError.name : undefined,
      ));
      return false;
    }
    return true;
  }, [clearRetry]);

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
      setPhase('error');
      setError(permissionMessage(
        startError instanceof DOMException ? startError.name : undefined,
      ));
      return false;
    }

    shouldRunRef.current = true;
    return beginRecognition();
  }, [beginRecognition]);

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
          setError('Microphone access is blocked. Open this site’s browser permissions, allow Microphone, then retry.');
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
  }, [autoResume, beginRecognition]);

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
