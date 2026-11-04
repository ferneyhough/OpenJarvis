import { describe, expect, it } from 'vitest';
import { isShortReturnCommand, parseMusicVoiceCommand } from './music-commands';

describe('parseMusicVoiceCommand', () => {
  it.each([
    ['pause', { type: 'pause' }],
    ['Jarvis, pause the music', { type: 'pause' }],
    ['play', { type: 'play' }],
    ['resume music', { type: 'play' }],
    ['stop music', { type: 'stop' }],
    ['next song', { type: 'next' }],
    ['skip', { type: 'next' }],
    ['previous track', { type: 'previous' }],
    ['shuffle', { type: 'shuffle', on: undefined }],
    ['shuffle off', { type: 'shuffle', on: false }],
    ['repeat', { type: 'repeat' }],
    ['repeat song', { type: 'repeat', mode: 'one' }],
    ['repeat playlist', { type: 'repeat', mode: 'all' }],
    ['stop repeating', { type: 'repeat', mode: 'off' }],
    ['volume up', { type: 'volume', delta: 0.1 }],
    ['set volume to 40', { type: 'volume', level: 0.4 }],
    ['open music player', { type: 'open-player' }],
    ['close the music player', { type: 'close-player' }],
    ['play playlist workout', { type: 'playlist', name: 'workout' }],
    ['open tidal', { type: 'open-app', app: 'tidal' }],
    ['jarvis open youtube music', { type: 'open-app', app: 'youtube-music' }],
  ])('%s', (text, expected) => {
    expect(parseMusicVoiceCommand(text)).toEqual(expected);
  });

  it('ignores normal chat', () => {
    expect(parseMusicVoiceCommand('what is the weather today')).toBeNull();
    expect(parseMusicVoiceCommand('open steam')).toBeNull();
  });

  it('recognises short return', () => {
    expect(isShortReturnCommand('Jarvis return')).toBe(true);
    expect(isShortReturnCommand('return to my chat')).toBe(false);
  });
});
