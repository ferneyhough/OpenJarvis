import { create } from 'zustand';
import { getBase } from './api';

export type RepeatMode = 'off' | 'all' | 'one';

export interface Track {
  id: string;
  title: string;
  /** Audio URL for local/server files; omitted for embedded players. */
  url?: string;
  /** iframe URL for app playlists (YouTube, Spotify, SoundCloud). */
  embed?: string;
  provider?: 'youtube' | 'spotify' | 'soundcloud' | 'local';
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

const STORAGE_KEY = 'openjarvis-music';

interface Persisted {
  playlists: Playlist[];
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

function load(): Persisted {
  const fallback: Persisted = { playlists: [], volume: 0.8, shuffle: false, repeat: 'off' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      playlists: (parsed.playlists ?? []).map((p) => ({
        ...p,
        // blob: URLs from a previous session are dead.
        tracks: p.tracks.filter((t) => !t.url?.startsWith('blob:')),
      })),
      volume: typeof parsed.volume === 'number' ? parsed.volume : fallback.volume,
      shuffle: !!parsed.shuffle,
      repeat: parsed.repeat ?? 'off',
    };
  } catch {
    return fallback;
  }
}

function save(s: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Storage may be unavailable; playback still works in memory.
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Turn a pasted app playlist link into an embeddable track, or null if unsupported. */
export function trackFromAppUrl(rawUrl: string, title?: string): Track | null {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'music.youtube.com' || host === 'youtube.com' || host === 'youtu.be') {
    const list = u.searchParams.get('list');
    const video = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v');
    let embed: string | null = null;
    if (list) embed = `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}&enablejsapi=1`;
    else if (video) embed = `https://www.youtube.com/embed/${encodeURIComponent(video)}?enablejsapi=1`;
    if (!embed) return null;
    return { id: uid(), title: title || 'YouTube playlist', embed, provider: 'youtube' };
  }
  if (host === 'open.spotify.com') {
    const m = u.pathname.match(/\/(playlist|album|track|show|episode|artist)\/([A-Za-z0-9]+)/);
    if (!m) return null;
    return {
      id: uid(),
      title: title || `Spotify ${m[1]}`,
      embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
      provider: 'spotify',
    };
  }
  if (host === 'soundcloud.com') {
    return {
      id: uid(),
      title: title || 'SoundCloud',
      embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.toString())}&auto_play=false`,
      provider: 'soundcloud',
    };
  }
  return null;
}

const initial = load();
let audio: HTMLAudioElement | null = null;
let embedFrame: HTMLIFrameElement | null = null;

export function registerEmbedFrame(el: HTMLIFrameElement | null): void {
  embedFrame = el;
}

function ytCommand(func: string): void {
  embedFrame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
}

interface MusicState extends Persisted {
  queue: Track[];
  index: number;
  playing: boolean;
  open: boolean;
  time: number;
  duration: number;
  error: string;
  current: () => Track | null;
  playTracks: (tracks: Track[], start?: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  stop: () => void;
  next: (auto?: boolean) => void;
  previous: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  setShuffle: (on?: boolean) => void;
  setRepeat: (mode?: RepeatMode) => void;
  openPlayer: () => void;
  closePlayer: () => void;
  addLocalFiles: (files: File[]) => Track[];
  addServerTracks: (tracks: Track[]) => void;
  createPlaylist: (name: string, tracks: Track[]) => Playlist;
  addToPlaylist: (playlistId: string, tracks: Track[]) => void;
  removePlaylist: (id: string) => void;
  playPlaylistByName: (name: string) => boolean;
}

function persist(get: () => MusicState): void {
  const s = get();
  save({ playlists: s.playlists, volume: s.volume, shuffle: s.shuffle, repeat: s.repeat });
}

function getAudio(set: (p: Partial<MusicState>) => void, get: () => MusicState): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.volume = get().volume;
  audio.addEventListener('timeupdate', () => set({ time: audio?.currentTime ?? 0 }));
  audio.addEventListener('durationchange', () => set({ duration: Number.isFinite(audio?.duration) ? audio!.duration : 0 }));
  audio.addEventListener('play', () => set({ playing: true }));
  audio.addEventListener('pause', () => set({ playing: false }));
  audio.addEventListener('ended', () => get().next(true));
  audio.addEventListener('error', () => set({ playing: false, error: 'Could not play this file.' }));
  return audio;
}

export const useMusicStore = create<MusicState>((set, get) => {
  const startCurrent = () => {
    const t = get().queue[get().index];
    const a = getAudio(set, get);
    a.pause();
    set({ error: '', time: 0, duration: 0 });
    if (!t) {
      set({ playing: false });
      return;
    }
    if (t.embed) {
      a.removeAttribute('src');
      set({ playing: true });
      return;
    }
    a.src = t.url ?? '';
    a.play().catch((e) => set({ playing: false, error: e instanceof Error ? e.message : 'Playback blocked' }));
  };

  return {
    ...initial,
    queue: [],
    index: 0,
    playing: false,
    open: false,
    time: 0,
    duration: 0,
    error: '',
    current: () => get().queue[get().index] ?? null,

    playTracks: (tracks, start = 0) => {
      if (tracks.length === 0) return;
      const first = get().shuffle && start === 0 ? Math.floor(Math.random() * tracks.length) : start;
      set({ queue: tracks, index: first, open: true });
      startCurrent();
    },
    play: () => {
      const t = get().current();
      if (!t) {
        const all = get().playlists.flatMap((p) => p.tracks);
        if (all.length) get().playTracks(all);
        else set({ open: true });
        return;
      }
      if (t.embed) {
        if (t.provider === 'youtube') ytCommand('playVideo');
        set({ playing: true });
      } else {
        getAudio(set, get).play().catch(() => undefined);
      }
    },
    pause: () => {
      const t = get().current();
      if (t?.embed) {
        if (t.provider === 'youtube') ytCommand('pauseVideo');
        set({ playing: false });
      } else audio?.pause();
    },
    toggle: () => (get().playing ? get().pause() : get().play()),
    stop: () => {
      const t = get().current();
      if (t?.embed) {
        if (t.provider === 'youtube') ytCommand('stopVideo');
      } else if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      set({ playing: false, time: 0 });
    },
    next: (auto = false) => {
      const { queue, index, repeat, shuffle } = get();
      if (queue.length === 0) return;
      const cur = queue[index];
      if (cur?.embed && cur.provider === 'youtube') {
        ytCommand('nextVideo');
        return;
      }
      if (auto && repeat === 'one') {
        startCurrent();
        return;
      }
      let n = index + 1;
      if (shuffle && queue.length > 1) {
        do n = Math.floor(Math.random() * queue.length); while (n === index);
      } else if (n >= queue.length) {
        if (repeat === 'all' || !auto) n = 0;
        else {
          set({ playing: false });
          return;
        }
      }
      set({ index: n });
      startCurrent();
    },
    previous: () => {
      const { queue, index } = get();
      if (queue.length === 0) return;
      const cur = queue[index];
      if (cur?.embed && cur.provider === 'youtube') {
        ytCommand('previousVideo');
        return;
      }
      if (audio && audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
      }
      set({ index: (index - 1 + queue.length) % queue.length });
      startCurrent();
    },
    seek: (t) => {
      if (audio) audio.currentTime = t;
    },
    setVolume: (v) => {
      const vol = Math.max(0, Math.min(1, v));
      if (audio) audio.volume = vol;
      set({ volume: vol });
      persist(get);
    },
    setShuffle: (on) => {
      set({ shuffle: on ?? !get().shuffle });
      persist(get);
    },
    setRepeat: (mode) => {
      const order: RepeatMode[] = ['off', 'all', 'one'];
      set({ repeat: mode ?? order[(order.indexOf(get().repeat) + 1) % 3] });
      persist(get);
    },
    openPlayer: () => set({ open: true }),
    closePlayer: () => {
      get().stop();
      set({ open: false });
    },
    addLocalFiles: (files) => {
      const tracks = files
        .filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac|opus|webm)$/i.test(f.name))
        .map<Track>((f) => ({
          id: uid(),
          title: f.name.replace(/\.[^.]+$/, ''),
          url: URL.createObjectURL(f),
          provider: 'local',
        }));
      return tracks;
    },
    addServerTracks: (tracks) => get().playTracks(tracks),
    createPlaylist: (name, tracks) => {
      const p: Playlist = { id: uid(), name: name.trim() || 'Playlist', tracks };
      set({ playlists: [...get().playlists, p] });
      persist(get);
      return p;
    },
    addToPlaylist: (playlistId, tracks) => {
      set({
        playlists: get().playlists.map((p) => (p.id === playlistId ? { ...p, tracks: [...p.tracks, ...tracks] } : p)),
      });
      persist(get);
    },
    removePlaylist: (id) => {
      set({ playlists: get().playlists.filter((p) => p.id !== id) });
      persist(get);
    },
    playPlaylistByName: (name) => {
      const q = name.toLowerCase();
      const p = get().playlists.find((x) => x.name.toLowerCase() === q)
        ?? get().playlists.find((x) => x.name.toLowerCase().includes(q));
      if (!p || p.tracks.length === 0) return false;
      get().playTracks(p.tracks);
      return true;
    },
  };
});

export function serverMusicUrl(relPath: string): string {
  return `${getBase()}/v1/media/music/file?path=${encodeURIComponent(relPath)}`;
}
