import { describe, expect, it } from 'vitest';
import { interpretHandsFreeTranscript } from './useHandsFree';

describe('hands-free voice commands', () => {
  it('only wakes when Jarvis is spoken at the start', () => {
    expect(interpretHandsFreeTranscript('Jarvis', false)).toEqual({ awake: true });
    expect(interpretHandsFreeTranscript('Hey Jarvis, what is the weather?', false)).toEqual({
      awake: true,
      command: 'what is the weather?',
    });
    expect(interpretHandsFreeTranscript('I saw Jarvis yesterday', false)).toEqual({ awake: false });
  });

  it('returns to wake-word mode only for the exact sleep Jarvis phrase', () => {
    for (const phrase of ['sleep Jarvis', 'SleepJarvis', 'sleep Jarvis.']) {
      expect(interpretHandsFreeTranscript(phrase, true)).toEqual({ awake: false });
    }
    expect(interpretHandsFreeTranscript('Jarvis sleep Jarvis', false)).toEqual({ awake: false });
  });

  it('treats every other phrase as ordinary speech while awake', () => {
    for (const phrase of ['stop', 'sleep', 'go to sleep', 'stop listening', 'please sleep Jarvis']) {
      expect(interpretHandsFreeTranscript(phrase, true)).toEqual({
        awake: true,
        command: phrase,
      });
    }
  });

  it('keeps listening for requests while awake', () => {
    expect(interpretHandsFreeTranscript('Tell me the weather in St Thomas', true)).toEqual({
      awake: true,
      command: 'Tell me the weather in St Thomas',
    });
  });

  it('does not wake when a sleep word is spoken before the wake word', () => {
    expect(interpretHandsFreeTranscript('stop listening', false)).toEqual({ awake: false });
  });
});
