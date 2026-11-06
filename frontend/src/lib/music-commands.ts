export type MusicAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'shuffle'; on?: boolean }
  | { type: 'repeat'; mode?: 'off' | 'all' | 'one' }
  | { type: 'volume'; delta?: number; level?: number }
  | { type: 'open-player' }
  | { type: 'close-player' }
  | { type: 'playlist'; name: string }
  | { type: 'open-app'; app: string };

export interface MusicApp {
  id: string;
  label: string;
  url: string;
  aliases: string[];
}

export const MUSIC_APPS: MusicApp[] = [
  { id: 'youtube-music', label: 'YouTube Music', url: 'https://music.youtube.com/', aliases: ['youtube music', 'you tube music'] },
  { id: 'spotify', label: 'Spotify', url: 'https://open.spotify.com/', aliases: ['spotify'] },
  { id: 'apple-music', label: 'Apple Music', url: 'https://music.apple.com/', aliases: ['apple music'] },
  { id: 'amazon-music', label: 'Amazon Music', url: 'https://music.amazon.com/', aliases: ['amazon music'] },
  { id: 'tidal', label: 'Tidal', url: 'https://listen.tidal.com/', aliases: ['tidal'] },
  { id: 'soundcloud', label: 'SoundCloud', url: 'https://soundcloud.com/', aliases: ['soundcloud', 'sound cloud'] },
  { id: 'audible', label: 'Audible', url: 'https://www.audible.com/', aliases: ['audible'] },
  { id: 'deezer', label: 'Deezer', url: 'https://www.deezer.com/', aliases: ['deezer'] },
  { id: 'pandora', label: 'Pandora', url: 'https://www.pandora.com/', aliases: ['pandora'] },
  { id: 'bandcamp', label: 'Bandcamp', url: 'https://bandcamp.com/', aliases: ['bandcamp', 'band camp'] },
  { id: 'qobuz', label: 'Qobuz', url: 'https://play.qobuz.com/', aliases: ['qobuz'] },
  { id: 'mixcloud', label: 'Mixcloud', url: 'https://www.mixcloud.com/', aliases: ['mixcloud', 'mix cloud'] },
  { id: 'iheart', label: 'iHeartRadio', url: 'https://www.iheart.com/', aliases: ['iheart', 'i heart', 'iheart radio', 'i heart radio'] },
];

function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/^(?:hey |ok |okay )?jarvis\s+/, '')
    .replace(/^please\s+/, '')
    .replace(/\s+please$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const THING = '(?:the )?(?:music|song|track|playlist|player|audio)?';

/** Parse spoken music commands. Returns null when the text is not a music command. */
export function parseMusicVoiceCommand(text: string): MusicAction | null {
  const t = normalize(text);
  if (!t) return null;

  if (/^(?:pause|hold)(?: (?:the )?(?:music|song|track|playback|player|audio))?$/.test(t)) return { type: 'pause' };
  if (/^(?:stop|end)(?: (?:the )?(?:music|song|track|playback|player|audio))$/.test(t) || t === 'stop music') return { type: 'stop' };
  if (/^(?:resume|unpause|continue)(?: (?:the )?(?:music|song|track|playback|player|audio))?$/.test(t)) return { type: 'play' };
  if (/^play(?: (?:the )?(?:music|song|track|playback|audio))?$/.test(t)) return { type: 'play' };
  if (new RegExp(`^(?:next|skip)(?: ${THING})?$`).test(t) || /^skip (?:this )?(?:song|track)$/.test(t)) return { type: 'next' };
  if (new RegExp(`^(?:previous|last|go back)(?: ${THING})?$`).test(t) || t === 'back' || t === 'play previous') return { type: 'previous' };

  const shuffle = t.match(/^(?:turn )?shuffle(?: (on|off))?(?: (?:the )?(?:music|playlist|songs))?$/)
    ?? t.match(/^(?:turn )?(?:shuffle) (on|off)$/);
  if (shuffle) return { type: 'shuffle', on: shuffle[1] === undefined ? undefined : shuffle[1] === 'on' };
  if (/^(?:stop|disable) shuffl(?:e|ing)$/.test(t)) return { type: 'shuffle', on: false };

  const repeat = t.match(/^(?:turn )?repeat(?: (off|all|one|song|track|list|playlist|this song|this track|on))?$/);
  if (repeat) {
    const m = repeat[1];
    if (!m) return { type: 'repeat' };
    if (m === 'off') return { type: 'repeat', mode: 'off' };
    if (m === 'on' || m === 'all' || m === 'list' || m === 'playlist') return { type: 'repeat', mode: 'all' };
    return { type: 'repeat', mode: 'one' };
  }
  if (/^(?:stop|disable) repeat(?:ing)?$/.test(t)) return { type: 'repeat', mode: 'off' };

  if (/^(?:turn )?(?:the )?(?:music |volume )?(?:up|louder)$/.test(t) || /^volume up$/.test(t) || /^turn it up$/.test(t)) return { type: 'volume', delta: 0.1 };
  if (/^(?:turn )?(?:the )?(?:music |volume )?(?:down|quieter|lower)$/.test(t) || /^volume down$/.test(t) || /^turn it down$/.test(t)) return { type: 'volume', delta: -0.1 };
  if (t === 'mute' || t === 'mute music') return { type: 'volume', level: 0 };
  const vol = t.match(/^(?:set )?(?:the )?volume (?:to )?(\d{1,3})(?: percent)?$/);
  if (vol) return { type: 'volume', level: Math.min(100, Number(vol[1])) / 100 };

  if (/^(?:open|show|launch|start) (?:the )?(?:music|music player|media player|player)$/.test(t)) return { type: 'open-player' };
  if (/^(?:close|hide|dismiss) (?:the )?(?:music|music player|media player|player)$/.test(t)) return { type: 'close-player' };

  const playlist = t.match(/^play (?:the )?(?:playlist )?(.+?)(?: playlist)?$/);
  if (playlist && /\bplaylist\b/.test(t)) return { type: 'playlist', name: playlist[1].trim() };

  const open = t.match(/^(?:open|launch|start) (.+)$/);
  if (open) {
    const target = open[1].replace(/^the /, '');
    const app = MUSIC_APPS.find((a) => a.aliases.includes(target));
    if (app) return { type: 'open-app', app: app.id };
  }
  return null;
}

/** “Jarvis return” / “return” also brings the user back to Jarvis. */
export function isShortReturnCommand(text: string): boolean {
  const t = normalize(text);
  return t === 'return' || t === 'come back';
}
