import { useEffect, useRef, useState } from 'react';
import {
  ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Square, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchServerMusic } from '../lib/api';
import { Links, useEnabledMusicApps } from './PageDetails';
import { MUSIC_APPS } from '../lib/music-commands';
import { useAppStore } from '../lib/store';
import {
  registerEmbedFrame, serverMusicUrl, trackFromAppUrl, useMusicStore, type Track,
} from '../lib/music';

const border = '1px solid var(--color-border)';
const muted = { color: 'var(--color-text-tertiary)' } as const;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function IconBtn({
  label, onClick, active, children,
}: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 cursor-pointer"
      style={{
        background: active ? 'var(--color-accent-subtle)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text)',
      }}
    >
      {children}
    </button>
  );
}

/** Floating music player: transport controls, queue, local files and playlists. */
export function MusicPlayer() {
  const s = useMusicStore();
  const enabledApps = useEnabledMusicApps();
  const developerMode = useAppStore((s) => s.settings.developerModeEnabled);
  const appList = developerMode ? MUSIC_APPS : enabledApps;
  const [panel, setPanel] = useState<'queue' | 'library' | 'apps'>('library');
  const [serverFiles, setServerFiles] = useState<{ root: string; files: string[] } | null>(null);
  const [plName, setPlName] = useState('');
  const [plUrl, setPlUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const cur = s.current();

  useEffect(() => {
    registerEmbedFrame(cur?.embed ? frameRef.current : null);
  });

  useEffect(() => {
    if (s.open && panel === 'library' && !serverFiles) {
      fetchServerMusic().then(setServerFiles).catch(() => setServerFiles({ root: '', files: [] }));
    }
  }, [s.open, panel, serverFiles]);

  if (!s.open) {
    return (
      <button
        type="button"
        onClick={s.openPlayer}
        aria-label="Open music player"
        title="Music"
        className="fixed bottom-4 right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full shadow-lg cursor-pointer"
        style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
      >
        <ListMusic size={16} />
      </button>
    );
  }

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const tracks = s.addLocalFiles(Array.from(list));
    if (tracks.length === 0) {
      toast.error('No audio files found in that selection.');
      return;
    }
    s.playTracks(tracks);
    if (plName.trim()) s.createPlaylist(plName, tracks);
    toast.success(`Added ${tracks.length} track${tracks.length > 1 ? 's' : ''}`);
  };

  const addAppPlaylist = () => {
    const t = trackFromAppUrl(plUrl, plName.trim() || undefined);
    if (!t) {
      toast.error('Paste a YouTube, YouTube Music, Spotify or SoundCloud playlist/track link.');
      return;
    }
    s.createPlaylist(plName.trim() || t.title, [t]);
    s.playTracks([t]);
    setPlUrl('');
    setPlName('');
    toast.success('Playlist added');
  };

  const serverTracks = (): Track[] =>
    (serverFiles?.files ?? []).map((f) => ({
      id: f,
      title: f.replace(/\.[^.]+$/, '').split('/').pop() ?? f,
      url: serverMusicUrl(f),
      provider: 'local',
    }));

  return (
    <div
      role="dialog"
      aria-label="Music player"
      className="fixed bottom-14 right-4 z-40 w-[340px] max-w-[calc(100vw-2rem)] rounded-xl shadow-xl"
      style={{ background: 'var(--color-bg-secondary)', border, color: 'var(--color-text)' }}
    >
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="text-xs font-medium">Music</span>
        <IconBtn label="Close music player" onClick={s.closePlayer}><X size={14} /></IconBtn>
      </div>

      <div className="px-3 pb-2">
        <div className="truncate text-sm" title={cur?.title}>{cur?.title ?? 'Nothing playing'}</div>
        {s.error && <div className="text-[11px]" style={{ color: 'var(--color-error)' }}>{s.error}</div>}

        {cur?.embed ? (
          <>
            <iframe
              ref={frameRef}
              key={cur.id}
              src={cur.embed}
              title={`${cur.title} player`}
              allow="autoplay; encrypted-media; clipboard-write"
              className="mt-2 h-40 w-full rounded"
              style={{ border: 0 }}
            />
            <p className="mt-1 text-[10px]" style={muted}>
              {cur.provider === 'youtube'
                ? 'Controls below drive the YouTube player.'
                : 'This service controls its own playback; use the buttons inside the player.'}
            </p>
          </>
        ) : (
          <div className="mt-2 flex items-center gap-2 text-[10px]" style={muted}>
            <span>{fmt(s.time)}</span>
            <input
              type="range" min={0} max={s.duration || 0} step={1} value={Math.min(s.time, s.duration || 0)}
              onChange={(e) => s.seek(Number(e.target.value))}
              aria-label="Seek"
              className="flex-1 accent-[var(--color-accent)]"
            />
            <span>{fmt(s.duration)}</span>
          </div>
        )}

        <div className="mt-1 flex items-center justify-center gap-1">
          <IconBtn label={`Shuffle ${s.shuffle ? 'on' : 'off'}`} onClick={() => s.setShuffle()} active={s.shuffle}><Shuffle size={15} /></IconBtn>
          <IconBtn label="Previous" onClick={s.previous}><SkipBack size={16} /></IconBtn>
          <IconBtn label={s.playing ? 'Pause' : 'Play'} onClick={s.toggle}>
            {s.playing ? <Pause size={18} /> : <Play size={18} />}
          </IconBtn>
          <IconBtn label="Stop" onClick={s.stop}><Square size={15} /></IconBtn>
          <IconBtn label="Next" onClick={() => s.next()}><SkipForward size={16} /></IconBtn>
          <IconBtn label={`Repeat: ${s.repeat}`} onClick={() => s.setRepeat()} active={s.repeat !== 'off'}>
            {s.repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </IconBtn>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px]" style={muted}>
          Vol
          <input
            type="range" min={0} max={1} step={0.05} value={s.volume}
            onChange={(e) => s.setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="flex-1 accent-[var(--color-accent)]"
          />
        </div>
      </div>

      <div style={{ borderTop: border }} className="px-3 py-2">
        <div className="mb-1 flex gap-1">
          {(['library', 'queue', 'apps'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPanel(p)}
              className="rounded px-2 py-0.5 text-xs cursor-pointer"
              style={{
                background: panel === p ? 'var(--color-accent-subtle)' : 'transparent',
                color: panel === p ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
            >
              {p === 'queue' ? <><ListMusic size={11} className="inline" /> Queue ({s.queue.length})</> : p === 'apps' ? 'Apps' : 'Library'}
            </button>
          ))}
        </div>

        <div className="max-h-44 overflow-y-auto text-xs">
          {panel === 'queue' && (
            <ul className="flex flex-col gap-0.5">
              {s.queue.length === 0 && <li style={muted}>Queue is empty.</li>}
              {s.queue.map((t, i) => (
                <li key={t.id + i}>
                  <button
                    onClick={() => s.playTracks(s.queue, i)}
                    className="w-full truncate rounded px-2 py-0.5 text-left cursor-pointer"
                    style={{ background: i === s.index ? 'var(--color-accent-subtle)' : 'transparent', color: 'var(--color-text)' }}
                  >
                    {t.title}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {panel === 'apps' && (appList.length
            ? <Links items={appList} />
            : <p style={muted}>No music apps activated. Turn on Developer Mode, then Settings → Music to activate apps.</p>)}

          {panel === 'library' && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                <button onClick={() => fileRef.current?.click()} className="rounded px-2 py-1 cursor-pointer" style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}>
                  Add local files
                </button>
                <input
                  ref={fileRef} type="file" hidden multiple accept="audio/*"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                />
                {serverFiles && serverFiles.files.length > 0 && (
                  <button onClick={() => s.playTracks(serverTracks())} className="rounded px-2 py-1 cursor-pointer" style={{ border, color: 'var(--color-text)' }}>
                    Play Music folder ({serverFiles.files.length})
                  </button>
                )}
              </div>
              {serverFiles && serverFiles.files.length === 0 && (
                <p style={muted}>No audio found in {serverFiles.root || 'the Music folder'}. Set OPENJARVIS_MUSIC_DIR to change it.</p>
              )}

              <div className="flex flex-col gap-1">
                <input
                  value={plName} onChange={(e) => setPlName(e.target.value)} placeholder="Playlist name (optional)"
                  aria-label="Playlist name" className="rounded px-2 py-1"
                  style={{ background: 'var(--color-bg)', border, color: 'var(--color-text)' }}
                />
                <div className="flex gap-1">
                  <input
                    value={plUrl} onChange={(e) => setPlUrl(e.target.value)}
                    placeholder="Paste YouTube / Spotify / SoundCloud playlist link"
                    aria-label="App playlist link" className="min-w-0 flex-1 rounded px-2 py-1"
                    style={{ background: 'var(--color-bg)', border, color: 'var(--color-text)' }}
                  />
                  <button onClick={addAppPlaylist} className="shrink-0 rounded px-2 py-1 cursor-pointer" style={{ border, color: 'var(--color-text)' }}>Add</button>
                </div>
              </div>

              <ul className="flex flex-col gap-0.5">
                {s.playlists.length === 0 && <li style={muted}>No saved playlists yet.</li>}
                {s.playlists.map((p) => (
                  <li key={p.id} className="flex items-center gap-1">
                    <button
                      onClick={() => s.playTracks(p.tracks)}
                      className="flex-1 truncate rounded px-2 py-0.5 text-left cursor-pointer"
                      style={{ color: 'var(--color-text)' }}
                    >
                      ▶ {p.name} <span style={muted}>({p.tracks.length})</span>
                    </button>
                    <button onClick={() => s.removePlaylist(p.id)} aria-label={`Delete ${p.name}`} className="px-1 cursor-pointer" style={muted}>×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
