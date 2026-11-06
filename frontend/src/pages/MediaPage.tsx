import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tv,
  Film,
  Clapperboard,
  FolderOpen,
  Link2,
  Search,
  Star,
  ExternalLink,
  Trash2,
  Plus,
  Copy,
  Loader2,
  AlertCircle,
  Play,
  Music,
  Gamepad2,
} from 'lucide-react';
import {
  fetchTvGuide,
  fetchGuideCatalog,
  searchGuide,
  fetchGuideMeta,
  fetchLocalMedia,
  fetchGuideLinks,
  addGuideLink,
  deleteGuideLink,
  fetchGamesLibrary,
  launchGame,
  addCustomGame,
  deleteCustomGame,
  type GamesLibrary,
  type SteamGame,
  type CustomGame,
  type TvEpisode,
  type GuideItem,
  type GuideMetaDetail,
  type LocalMediaResponse,
  type LocalMediaGroup,
  type GuideLink,
  fetchGuideDocument,
  fetchGuideEpg,
  type GuideEpgResponse,
} from '../lib/api';
import { parseM3U, parseXMLTV, type M3UChannel, type GuideProgram } from '../lib/media-guide';
import { MediaPlayerModal, type MediaPlayerTarget } from '../components/MediaPlayerModal';
import Hls from 'hls.js';

type Tab = 'tv' | 'iptv' | 'movies' | 'shows' | 'local' | 'games' | 'links';

const TABS: Array<{ id: Tab; label: string; icon: typeof Tv }> = [
  { id: 'tv', label: 'TV Guide', icon: Tv },
  { id: 'iptv', label: 'IPTV', icon: Tv },
  { id: 'movies', label: 'Movies', icon: Film },
  { id: 'shows', label: 'Shows', icon: Clapperboard },
  { id: 'local', label: 'Local', icon: FolderOpen },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'links', label: 'Links', icon: Link2 },
];

const COUNTRIES = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'IN', 'BR', 'MX', 'JP'];

const panelStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
};
const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
};

function ErrorNote({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
      style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-error)', border: '1px solid var(--color-border)' }}
    >
      <AlertCircle size={14} /> {message}
    </div>
  );
}

function Rating({ value }: { value: number | string | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-warning)' }}>
      <Star size={11} fill="currentColor" /> {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// TV Guide tab
// ---------------------------------------------------------------------------

function TvGuideTab() {
  const [country, setCountry] = useState('US');
  const [date, setDate] = useState('');
  const [episodes, setEpisodes] = useState<TvEpisode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTvGuide(country, date || undefined);
      setEpisodes(data.episodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load TV guide');
    } finally {
      setLoading(false);
    }
  }, [country, date]);

  useEffect(() => {
    void load();
  }, [load]);

  // Group consecutive episodes by show, preserving air-time order.
  const groups = useMemo(() => {
    const map = new Map<string, TvEpisode[]>();
    for (const ep of episodes) {
      const key = ep.show.name ?? 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ep);
    }
    return Array.from(map.entries());
  }, [episodes]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm" style={inputStyle}>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg px-2 py-1.5 text-sm"
          style={inputStyle}
        />
        {date && (
          <button onClick={() => setDate('')} className="text-xs underline cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }}>
            today
          </button>
        )}
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} Refresh
        </button>
        <span className="text-xs ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
          {episodes.length} episodes{date ? ` on ${date}` : ' today'} · {country}
        </span>
      </div>

      {error && <ErrorNote message={error} />}
      {loading && episodes.length === 0 && (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--color-accent)' }} /></div>
      )}
      {!loading && !error && episodes.length === 0 && (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          No episodes listed for this date/country.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {groups.map(([showName, eps]) => {
          const first = eps[0];
          return (
            <div key={showName} className="flex gap-3 rounded-xl p-3" style={panelStyle}>
              {first.show.image && (
                <img src={first.show.image} alt={showName} className="w-16 h-24 object-cover rounded-lg shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{showName}</span>
                  <Rating value={first.show.rating} />
                  {first.network && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                      {first.network}
                    </span>
                  )}
                </div>
                <div className="text-[11px] mt-0.5 mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                  {first.show.genres.join(' · ')}
                  {first.show.url && (
                    <a href={first.show.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5" style={{ color: 'var(--color-accent)' }}>
                      TVMaze <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {eps.map((ep) => (
                    <div key={ep.id ?? `${ep.name}-${ep.airtime}`} className="flex items-start gap-2 text-xs">
                      <span className="shrink-0 font-mono w-12" style={{ color: 'var(--color-accent)' }}>
                        {ep.airtime ?? '—'}
                      </span>
                      <span style={{ color: 'var(--color-text)' }}>
                        S{ep.season ?? '?'}E{ep.number ?? '?'} — {ep.name}
                        {ep.runtime ? <span style={{ color: 'var(--color-text-tertiary)' }}> ({ep.runtime}m)</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
                {first.summary && (
                  <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{first.summary}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catalog / search tab (movies & shows share this)
// ---------------------------------------------------------------------------

function CatalogTab({ type }: { type: 'movie' | 'series' }) {
  const [items, setItems] = useState<GuideItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<GuideMetaDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchGuideCatalog(type);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Catalog unavailable');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    setItems([]);
    setQuery('');
    void loadCatalog();
  }, [loadCatalog]);

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError('');
    try {
      const data = await searchGuide(query.trim(), type);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (item: GuideItem) => {
    if (!item.imdb_id) return;
    setDetailLoading(true);
    try {
      const d = await fetchGuideMeta(type, item.imdb_id);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 rounded-lg px-3 py-1.5" style={inputStyle}>
          <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
            placeholder={`Search ${type === 'movie' ? 'movies' : 'shows'}…`}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--color-text)' }}
          />
        </div>
        <button onClick={() => void runSearch()} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: 'var(--color-accent)', color: '#fff' }}>
          Search
        </button>
        <button onClick={() => void loadCatalog()} className="px-3 py-1.5 rounded-lg text-xs cursor-pointer" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
          Top
        </button>
      </div>

      {error && <ErrorNote message={error} />}
      {loading && (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--color-accent)' }} /></div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map((item) => (
            <button
              key={`${item.imdb_id}-${item.name}`}
              onClick={() => void openDetail(item)}
              className="text-left rounded-xl overflow-hidden transition-transform hover:scale-[1.02] cursor-pointer"
              style={panelStyle}
            >
              {item.poster ? (
                <img src={item.poster} alt={item.name ?? ''} className="w-full aspect-[2/3] object-cover" loading="lazy" />
              ) : (
                <div className="w-full aspect-[2/3] flex items-center justify-center text-xs" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                  {item.name}
                </div>
              )}
              <div className="p-2">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>{item.name}</div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{item.year}</span>
                  <Rating value={item.rating} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          {query ? 'No results.' : 'Loading catalog…'}
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setDetail(null)}
        >
          <div
            className="rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5 flex gap-4"
            style={panelStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {detail.meta.poster && (
              <img src={detail.meta.poster} alt="" className="w-32 shrink-0 rounded-lg object-cover self-start" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>{detail.meta.name}</h3>
                <button onClick={() => setDetail(null)} className="text-xs cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }}>✕</button>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                <span>{detail.meta.year}</span>
                <Rating value={detail.meta.rating} />
                {detail.meta.genres.slice(0, 3).map((g) => (
                  <span key={g} className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-tertiary)' }}>{g}</span>
                ))}
              </div>
              <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{detail.meta.description}</p>
              <div className="flex items-center gap-2 mt-4">
                <a href={detail.imdb_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                  IMDb <ExternalLink size={11} />
                </a>
                {detail.trailers.slice(0, 1).map((t) =>
                  t.url ? (
                    <a key={t.url} href={t.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                      <Play size={11} /> {t.name || 'Trailer'}
                    </a>
                  ) : null,
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <Loader2 className="animate-spin" size={28} style={{ color: 'var(--color-accent)' }} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local media tab
// ---------------------------------------------------------------------------

function LocalTab() {
  const [data, setData] = useState<LocalMediaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [playerTarget, setPlayerTarget] = useState<MediaPlayerTarget | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await fetchLocalMedia());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to scan local media');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--color-accent)' }} /></div>;
  }
  if (error) return <ErrorNote message={error} />;
  if (!data || data.groups.length === 0) {
    return (
      <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
        No local media found. Scanned: {data?.roots.join(', ') || 'default folders'}.
        <br />
        <span className="text-xs">Drop shows/movies into a folder under ~/Videos or ~/.openjarvis/media, or set OPENJARVIS_MEDIA_DIRS.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        Scanned {data.roots.length} folder{data.roots.length === 1 ? '' : 's'} · {data.groups.reduce((n, g) => n + g.count, 0)} files
      </p>
      {data.groups.map((group) => {
        const key = `${group.root}/${group.folder}`;
        const open = openGroups.has(key);
        return (
          <div key={key} className="rounded-xl overflow-hidden" style={panelStyle}>
            <button
              onClick={() => toggle(key)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left cursor-pointer"
              style={{ background: 'var(--color-bg-secondary)' }}
            >
              {group.items.some((i) => i.kind === 'video') ? <Film size={15} style={{ color: 'var(--color-accent)' }} /> : <Music size={15} style={{ color: 'var(--color-accent)' }} />}
              <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--color-text)' }}>{group.name}</span>
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                {group.count} file{group.count === 1 ? '' : 's'} {open ? '▾' : '▸'}
              </span>
            </button>
            {open && (
              <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {group.items.map((f) => (
                  <div key={f.path} className="flex items-center gap-3 px-3 py-2 text-xs">
                    {f.kind === 'video' ? <Play size={12} style={{ color: 'var(--color-text-tertiary)' }} /> : <Music size={12} style={{ color: 'var(--color-text-tertiary)' }} />}
                    <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--color-text)' }} title={f.path}>
                      {f.season !== null && f.episode !== null ? `S${f.season}E${f.episode} — ` : ''}
                      {f.name}
                    </span>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>{f.size_str}</span>
                    {f.kind === 'video' && (
                      <button
                        onClick={() => setPlayerTarget({ src: f.path, title: f.name })}
                        title="Play in Jarvis"
                        className="p-1 rounded cursor-pointer"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        <Play size={12} />
                      </button>
                    )}
                    <button onClick={() => void copyPath(f.path)} title="Copy path" className="p-1 rounded cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }}>
                      <Copy size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <MediaPlayerModal target={playerTarget} onClose={() => setPlayerTarget(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Links tab
// ---------------------------------------------------------------------------

function LinksTab() {
  const [links, setLinks] = useState<GuideLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', category: '', note: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchGuideLinks();
      setLinks(data.links);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load links');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!form.title.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      await addGuideLink(form);
      setForm({ title: '', url: '', category: '', note: '' });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add link');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteGuideLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const categories = useMemo(() => {
    const set = new Set(links.map((l) => l.category).filter(Boolean));
    return Array.from(set).sort();
  }, [links]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          <Plus size={12} /> Add link
        </button>
        <span className="text-xs ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
          {links.length} saved — your own bookmarks, stored locally
        </span>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 flex flex-col gap-2" style={panelStyle}>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <div className="flex gap-2">
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category (e.g. Movies, Live TV)" className="flex-1 rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note (optional)" className="flex-1 rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-xs cursor-pointer" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
              Cancel
            </button>
            <button onClick={() => void submit()} disabled={saving || !form.title.trim() || !form.url.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50" style={{ background: 'var(--color-accent)', color: '#fff' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {error && <ErrorNote message={error} />}
      {loading && <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--color-accent)' }} /></div>}

      {!loading && links.length === 0 && !showForm && (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          No links yet — add your own streaming/guide bookmarks above.
        </div>
      )}

      {categories.map((cat) => {
        const items = links.filter((l) => l.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>{cat}</div>
            <div className="grid gap-2">
              {items.map((link) => (
                <div key={link.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={panelStyle}>
                  <Link2 size={14} style={{ color: 'var(--color-accent)' }} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a href={link.url} target="_blank" rel="noreferrer" className="text-sm font-medium truncate block hover:underline" style={{ color: 'var(--color-text)' }}>
                      {link.title}
                    </a>
                    {link.note && <div className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>{link.note}</div>}
                  </div>
                  <button onClick={() => void remove(link.id)} title="Delete" className="p-1.5 rounded cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {links.some((l) => !l.category) && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>Other</div>
          <div className="grid gap-2">
            {links.filter((l) => !l.category).map((link) => (
              <div key={link.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={panelStyle}>
                <Link2 size={14} style={{ color: 'var(--color-accent)' }} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <a href={link.url} target="_blank" rel="noreferrer" className="text-sm font-medium truncate block hover:underline" style={{ color: 'var(--color-text)' }}>
                    {link.title}
                  </a>
                  {link.note && <div className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>{link.note}</div>}
                </div>
                <button onClick={() => void remove(link.id)} title="Delete" className="p-1.5 rounded cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Games tab (Steam library + custom games + Playnite interop)
// ---------------------------------------------------------------------------

function GamesTab() {
  const [data, setData] = useState<GamesLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', exe: '', args: '', cover_url: '' });
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchGamesLibrary());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const play = async (key: string, body: Parameters<typeof launchGame>[0]) => {
    setLaunching(key);
    try {
      await launchGame(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Launch failed');
    } finally {
      setLaunching(null);
    }
  };

  const submitCustom = async () => {
    if (!form.title.trim() || !form.exe.trim()) return;
    setSaving(true);
    try {
      await addCustomGame(form);
      setForm({ title: '', exe: '', args: '', cover_url: '' });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add game');
    } finally {
      setSaving(false);
    }
  };

  const removeCustom = async (id: string) => {
    try {
      await deleteCustomGame(id);
      setData((prev) => prev && { ...prev, custom: prev.custom.filter((g) => g.id !== id) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--color-accent)' }} /></div>;
  }
  if (error && !data) return <ErrorNote message={error} />;
  if (!data) return null;

  const { steam, custom, playnite } = data;
  const total = steam.length + custom.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Source status */}
      <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        <span className="px-2 py-1 rounded-lg" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
          Steam: {steam.length} game{steam.length === 1 ? '' : 's'}
        </span>
        <span className="px-2 py-1 rounded-lg" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
          Custom: {custom.length}
        </span>
        <span className="px-2 py-1 rounded-lg" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
          Playnite: {playnite.installed ? 'detected' : 'not detected'}
        </span>
        {playnite.installed && playnite.exe === null && playnite.scheme_registered && (
          <button
            onClick={() => void play('playnite', { kind: 'playnite' })}
            disabled={launching === 'playnite'}
            className="px-2 py-1 rounded-lg font-medium cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            {launching === 'playnite' ? 'Opening…' : 'Open Playnite'}
          </button>
        )}
        <button
          onClick={() => setShowForm((s) => !s)}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg font-medium cursor-pointer"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          <Plus size={11} /> Add game
        </button>
      </div>

      {error && <ErrorNote message={error} />}

      {showForm && (
        <div className="rounded-xl p-4 flex flex-col gap-2" style={panelStyle}>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Game title" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <input value={form.exe} onChange={(e) => setForm({ ...form, exe: e.target.value })} placeholder="Path to .exe" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <div className="flex gap-2">
            <input value={form.args} onChange={(e) => setForm({ ...form, args: e.target.value })} placeholder="Launch args (optional)" className="flex-1 rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            <input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="Cover URL (optional)" className="flex-1 rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-xs cursor-pointer" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
              Cancel
            </button>
            <button onClick={() => void submitCustom()} disabled={saving || !form.title.trim() || !form.exe.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50" style={{ background: 'var(--color-accent)', color: '#fff' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {!playnite.installed && (
        <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
          <Gamepad2 size={12} className="inline mr-1.5 -mt-0.5" style={{ color: 'var(--color-accent)' }} />
          Playnite not detected. Install Playnite Portable to unify emulated and non-Steam libraries —
          Jarvis will detect it automatically. Games you add manually appear below.
        </div>
      )}

      {total === 0 && !showForm && (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          No games found. Add a custom game above, or install games through Steam/Playnite.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {steam.map((game: SteamGame) => (
          <GameCard
            key={game.id}
            title={game.title}
            cover={game.cover}
            badge="Steam"
            installed={game.installed}
            launching={launching === game.id}
            onPlay={() => void play(game.id, { kind: 'steam', appid: game.appid })}
          />
        ))}
        {custom.map((game: CustomGame) => (
          <GameCard
            key={game.id}
            title={game.title}
            cover={game.cover}
            badge="Custom"
            launching={launching === game.id}
            onPlay={() => void play(game.id, { kind: 'custom', id: game.id })}
            onDelete={() => void removeCustom(game.id)}
          />
        ))}
      </div>
    </div>
  );
}

function GameCard({
  title,
  cover,
  badge,
  installed = true,
  launching,
  onPlay,
  onDelete,
}: {
  title: string;
  cover?: string;
  badge: string;
  installed?: boolean;
  launching: boolean;
  onPlay: () => void;
  onDelete?: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden relative group" style={panelStyle}>
      {cover && !imgFailed ? (
        <img src={cover} alt={title} className="w-full aspect-[2/3] object-cover" loading="lazy" onError={() => setImgFailed(true)} />
      ) : (
        <div className="w-full aspect-[2/3] flex items-center justify-center" style={{ background: 'var(--color-bg-tertiary)' }}>
          <Gamepad2 size={28} style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
      )}
      {!installed && (
        <span className="absolute top-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--color-warning)' }}>
          not installed
        </span>
      )}
      <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--color-text)' }}>
        {badge}
      </span>
      <div className="p-2">
        <div className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>{title}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <button
            onClick={onPlay}
            disabled={launching}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            {launching ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />} Play
          </button>
          {onDelete && (
            <button onClick={onDelete} className="p-1 rounded cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }} title="Remove">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IPTV tab: merged regional playlists + windowed XMLTV EPG
// ---------------------------------------------------------------------------

interface RegionPreset {
  key: string;
  label: string;
  playlist: string;
  epg: string;
  tz: string;
}

const REGION_PRESETS: RegionPreset[] = [
  {
    key: 'US',
    label: 'United States',
    playlist: 'https://iptv-org.github.io/iptv/countries/us.m3u',
    epg: 'https://epgshare01.online/epgshare01/epg_ripper_US2.xml.gz',
    tz: 'America/New_York',
  },
  {
    key: 'CA',
    label: 'Canada',
    playlist: 'https://iptv-org.github.io/iptv/countries/ca.m3u',
    epg: 'https://epgshare01.online/epgshare01/epg_ripper_CA2.xml.gz',
    tz: 'America/Toronto',
  },
  {
    key: 'GB',
    label: 'Britain',
    playlist: 'https://iptv-org.github.io/iptv/countries/uk.m3u',
    epg: 'https://epgshare01.online/epgshare01/epg_ripper_UK1.xml.gz',
    tz: 'Europe/London',
  },
  {
    key: 'IE',
    label: 'Ireland',
    playlist: 'https://iptv-org.github.io/iptv/countries/ie.m3u',
    epg: 'https://epgshare01.online/epgshare01/epg_ripper_IE1.xml.gz',
    tz: 'Europe/Dublin',
  },
  {
    key: 'AU',
    label: 'Australia',
    playlist: 'https://iptv-org.github.io/iptv/countries/au.m3u',
    epg: 'https://epgshare01.online/epgshare01/epg_ripper_AU1.xml.gz',
    tz: 'Australia/Sydney',
  },
  {
    key: 'NZ',
    label: 'New Zealand',
    playlist: 'https://iptv-org.github.io/iptv/countries/nz.m3u',
    epg: 'https://epgshare01.online/epgshare01/epg_ripper_NZ1.xml.gz',
    tz: 'Pacific/Auckland',
  },
];

interface GuideChannel extends M3UChannel {
  region: string;
  regionLabel: string;
  tz: string;
  schedule: GuideProgram[];
}

const IPTV_STATE_KEY = 'openjarvis.iptv.merged';

function loadIptvState(): { regions: string[]; playlist: string; guide: string } {
  try {
    const raw = localStorage.getItem(IPTV_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.regions)) {
        return {
          regions: parsed.regions,
          playlist: typeof parsed.playlist === 'string' ? parsed.playlist : '',
          guide: typeof parsed.guide === 'string' ? parsed.guide : '',
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { regions: REGION_PRESETS.map((r) => r.key), playlist: '', guide: '' };
}

function normalizeGuideName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(720|1080|480|576|2160|540|4k|uhd|fhd|hd|sd)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}

function epgLookup(epg: GuideEpgResponse): (channel: M3UChannel) => GuideProgram[] {
  const nameToId = new Map<string, string>();
  for (const [id, name] of Object.entries(epg.channels)) {
    for (const key of [normalizeGuideName(name), normalizeGuideName(id)]) {
      if (key && !nameToId.has(key)) nameToId.set(key, id);
    }
  }
  return (channel) => {
    for (const candidate of [channel.id, channel.name]) {
      const direct = epg.programmes[candidate];
      if (direct && direct.length > 0) return direct;
    }
    for (const candidate of [channel.name, channel.id]) {
      const epgId = nameToId.get(normalizeGuideName(candidate));
      if (epgId) {
        const entries = epg.programmes[epgId];
        if (entries && entries.length > 0) return entries;
      }
    }
    return [];
  };
}

function IptvTab() {
  const [initialState] = useState(loadIptvState);
  const [enabledRegions, setEnabledRegions] = useState<Set<string>>(
    () => new Set(initialState.regions),
  );
  const [customPlaylist, setCustomPlaylist] = useState(initialState.playlist);
  const [customGuide, setCustomGuide] = useState(initialState.guide);
  const [channels, setChannels] = useState<GuideChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState<GuideChannel | null>(null);
  const [englishOnly, setEnglishOnly] = useState(true);
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [guideErrors, setGuideErrors] = useState<string[]>([]);
  const [playerError, setPlayerError] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTarget, setLinkTarget] = useState<MediaPlayerTarget | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    localStorage.setItem(
      IPTV_STATE_KEY,
      JSON.stringify({
        regions: Array.from(enabledRegions),
        playlist: customPlaylist,
        guide: customGuide,
      }),
    );
  }, [enabledRegions, customPlaylist, customGuide]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const destroyPlayer = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
  }, []);

  useEffect(() => destroyPlayer, [destroyPlayer]);

  const loadChannels = useCallback(async () => {
    const regions = REGION_PRESETS.filter((r) => enabledRegions.has(r.key));
    const customUrl = customPlaylist.trim();
    if (regions.length === 0 && !customUrl) {
      setError('Enable at least one region or enter a custom playlist URL.');
      return;
    }
    setLoading(true);
    setError('');
    setGuideErrors([]);
    destroyPlayer();
    setPlaying(null);
    const errors: string[] = [];
    const merged: GuideChannel[] = [];
    const seen = new Set<string>();

    const attach = (
      parsed: M3UChannel[],
      regionKey: string,
      regionLabel: string,
      tz: string,
      lookup: ((channel: M3UChannel) => GuideProgram[]) | null,
    ) => {
      for (const channel of parsed) {
        const dedupeKey = channel.id || `${channel.name}|${channel.url}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        merged.push({
          ...channel,
          region: regionKey,
          regionLabel,
          tz,
          schedule: lookup ? lookup(channel) : [],
        });
      }
    };

    await Promise.all(
      regions.map(async (region) => {
        try {
          const [playlistText, epg] = await Promise.all([
            fetchGuideDocument(region.playlist, 'playlist'),
            fetchGuideEpg(region.epg, 24).catch(() => null),
          ]);
          const parsed = parseM3U(playlistText);
          const lookup = epg ? epgLookup(epg) : null;
          attach(parsed, region.key, region.label, region.tz, lookup);
          if (!epg) {
            errors.push(`${region.label}: playlist loaded, TV schedule unavailable`);
          }
        } catch (regionError) {
          errors.push(
            `${region.label}: ${regionError instanceof Error ? regionError.message : String(regionError)}`,
          );
        }
      }),
    );

    if (customUrl) {
      try {
        const playlistText = await fetchGuideDocument(customUrl, 'playlist');
        const parsed = parseM3U(playlistText);
        let lookup: ((channel: M3UChannel) => GuideProgram[]) | null = null;
        const guideUrl = customGuide.trim();
        if (guideUrl) {
          try {
            const guideText = await fetchGuideDocument(guideUrl, 'guide');
            const programs = parseXMLTV(guideText);
            if (programs.size > 0) {
              lookup = (channel) => programs.get(channel.id) ?? [];
            } else {
              errors.push('Custom guide: XMLTV file contains no usable programme entries');
            }
          } catch (guideError) {
            errors.push(
              `Custom guide: ${guideError instanceof Error ? guideError.message : String(guideError)}`,
            );
          }
        }
        const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        attach(parsed, 'CUSTOM', 'Custom', localTz, lookup);
      } catch (customError) {
        errors.push(
          `Custom playlist: ${customError instanceof Error ? customError.message : String(customError)}`,
        );
      }
    }

    setGuideErrors(errors);
    setChannels(merged);
    setLoaded(true);
    setLoading(false);
  }, [enabledRegions, customPlaylist, customGuide, destroyPlayer]);

  useEffect(() => {
    if (!loaded && !loading) void loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regionOrder = useMemo(() => {
    const order = new Map(REGION_PRESETS.map((r, i) => [r.key, i]));
    order.set('CUSTOM', REGION_PRESETS.length);
    return order;
  }, []);

  const visibleChannels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels
      .filter((c) => {
        if (englishOnly && c.language && !/^(en|eng|english)([-_].*)?$/i.test(c.language))
          return false;
        if (regionFilter !== 'ALL' && c.region !== regionFilter) return false;
        if (q && !c.name.toLowerCase().includes(q) && !c.group.toLowerCase().includes(q))
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          (regionOrder.get(a.region) ?? 99) - (regionOrder.get(b.region) ?? 99) ||
          a.name.localeCompare(b.name),
      );
  }, [channels, englishOnly, regionFilter, query, regionOrder]);

  const channelKey = (channel: GuideChannel) => `${channel.region}:${channel.id || channel.url}`;

  // EPG grid: 24h window starting one hour before now, in the viewer's local time.
  const GRID_HOURS = 24;
  const PX_PER_HOUR = 90;
  const GRID_LEFT_W = 190;
  const gridStart = useMemo(() => {
    const d = new Date(nowTick);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() - 1);
    return d.getTime();
  }, [nowTick]);
  const gridEnd = gridStart + GRID_HOURS * 3_600_000;
  const gridWidth = GRID_HOURS * PX_PER_HOUR;
  const nowX = ((nowTick - gridStart) / 3_600_000) * PX_PER_HOUR;
  const hourTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let h = 0; h <= GRID_HOURS; h += 1) ticks.push(gridStart + h * 3_600_000);
    return ticks;
  }, [gridStart]);
  const fmtHour = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
  const fmtDay = (ts: number) =>
    new Date(ts).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

  const playChannel = (channel: GuideChannel) => {
    const video = videoRef.current;
    if (!video) return;
    setPlayerError('');
    setPlaying(channel);
    destroyPlayer();
    const url = channel.url;
    const isHls = /\.m3u8($|\?)/i.test(url) || url.includes('/playlist.m3u8');
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        xhrSetup: (xhr) => {
          if (channel.userAgent) xhr.setRequestHeader('User-Agent', channel.userAgent);
          if (channel.referrer) xhr.setRequestHeader('Referer', channel.referrer);
        },
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setPlayerError(`Stream error: ${data.type} (${data.details})`);
          hls.destroy();
          hlsRef.current = null;
        }
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      void video.play().catch(() => {
        /* autoplay may be blocked; user can press play */
      });
    } else {
      video.src = url;
      void video.play().catch(() => {
        /* autoplay may be blocked */
      });
    }
  };

  const stopPlayback = () => {
    destroyPlayer();
    setPlaying(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Live channels merged from regional playlists with TV schedules for the next 24 hours.
        Times are shown in each channel's home timezone. Channels play in the built-in player.
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {REGION_PRESETS.map((region) => {
          const active = enabledRegions.has(region.key);
          return (
            <button
              key={region.key}
              onClick={() =>
                setEnabledRegions((prev) => {
                  const next = new Set(prev);
                  if (next.has(region.key)) next.delete(region.key);
                  else next.add(region.key);
                  return next;
                })
              }
              className="px-2.5 py-1 rounded-lg text-xs cursor-pointer"
              style={{
                background: active ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)',
                color: active ? 'var(--color-text)' : 'var(--color-text-tertiary)',
                border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
              }}
            >
              {region.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Custom playlist URL (M3U/M3U8, optional)
          <input
            value={customPlaylist}
            onChange={(e) => setCustomPlaylist(e.target.value)}
            placeholder="https://…/channels.m3u8"
            className="h-9 w-full rounded-lg bg-transparent px-3 text-sm outline-none"
            style={inputStyle}
          />
        </label>
        <label className="space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Custom XMLTV guide URL (optional)
          <input
            value={customGuide}
            onChange={(e) => setCustomGuide(e.target.value)}
            placeholder="https://…/guide.xml"
            className="h-9 w-full rounded-lg bg-transparent px-3 text-sm outline-none"
            style={inputStyle}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void loadChannels()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          {loaded ? 'Reload channels' : 'Load channels'}
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter channels…"
          className="h-8 w-44 rounded-lg bg-transparent px-3 text-xs outline-none"
          style={inputStyle}
        />
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="h-8 rounded-lg px-2 text-xs"
          style={inputStyle}
        >
          <option value="ALL">All regions</option>
          {REGION_PRESETS.filter((r) => enabledRegions.has(r.key)).map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
          {customPlaylist.trim() && <option value="CUSTOM">Custom</option>}
        </select>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <input type="checkbox" checked={englishOnly} onChange={(e) => setEnglishOnly(e.target.checked)} />
          English channels
        </label>
        {channels.length > 0 && (
          <span className="text-xs ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
            {visibleChannels.length} of {channels.length} channels
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && linkUrl.trim()) {
              setLinkTarget({ src: linkUrl.trim() });
              setLinkUrl('');
            }
          }}
          placeholder="Play any video link here — YouTube, MP4, WebM or M3U8 stream"
          className="h-9 flex-1 min-w-[16rem] rounded-lg bg-transparent px-3 text-sm outline-none"
          style={inputStyle}
        />
        <button
          onClick={() => {
            if (linkUrl.trim()) {
              setLinkTarget({ src: linkUrl.trim() });
              setLinkUrl('');
            }
          }}
          disabled={!linkUrl.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
        >
          <Play size={12} />
          Play in Jarvis
        </button>
      </div>
      <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        Video links open in the built-in player instead of leaving the app. YouTube embeds; MP4/WebM/M3U8 streams play directly. Sites with DRM (Netflix, Twitch, etc.) cannot be embedded and will show a fallback message.
      </p>

      {error && <ErrorNote message={error} />}
      {guideErrors.map((message) => (
        <div key={message} className="text-xs" style={{ color: 'var(--color-warning)' }}>
          {message}
        </div>
      ))}
      {loading && (
        <div className="flex items-center gap-2 text-xs py-2" style={{ color: 'var(--color-text-tertiary)' }}>
          <Loader2 size={12} className="animate-spin" /> Loading regional playlists and TV schedules…
        </div>
      )}

      {playing && (
        <div className="rounded-xl overflow-hidden" style={panelStyle}>
          <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--color-bg-secondary)' }}>
            <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
              {playing.name}
              {playing.group ? <span style={{ color: 'var(--color-text-tertiary)' }}> · {playing.group}</span> : null}
            </span>
            <button onClick={stopPlayback} className="text-xs cursor-pointer px-2 py-1 rounded" style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
              Stop
            </button>
          </div>
          <video
            ref={videoRef}
            controls
            autoPlay
            className="w-full aspect-video bg-black"
            onError={() => setPlayerError('Playback failed — this stream may be offline, geo-blocked, or DRM-protected.')}
          />
          {playerError && (
            <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-error)' }}>{playerError}</div>
          )}
        </div>
      )}

      {channels.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={panelStyle}>
          <div className="overflow-auto max-h-[36rem]">
            <div style={{ width: GRID_LEFT_W + gridWidth, position: 'relative' }}>
              {/* Time header */}
              <div className="flex sticky top-0 z-20" style={{ background: 'var(--color-surface)' }}>
                <div
                  className="sticky left-0 z-10 shrink-0 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    width: GRID_LEFT_W,
                    background: 'var(--color-surface)',
                    borderRight: '1px solid var(--color-border)',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  Channel
                </div>
                <div className="relative shrink-0" style={{ width: gridWidth, height: 30 }}>
                  {hourTicks.map((tick) => (
                    <div
                      key={tick}
                      className="absolute top-0 bottom-0 flex flex-col justify-center border-l pl-1"
                      style={{
                        left: ((tick - gridStart) / 3_600_000) * PX_PER_HOUR,
                        borderColor: 'var(--color-border)',
                      }}
                    >
                      <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                        {fmtHour(tick)}
                      </span>
                      {new Date(tick).getHours() === 0 && (
                        <span className="text-[9px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>
                          {fmtDay(tick)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Channel rows */}
              {visibleChannels.map((channel, rowIndex) => {
                const entries = channel.schedule.filter(
                  (p) => p.stop > gridStart && p.start < gridEnd,
                );
                const isPlaying = playing?.url === channel.url;
                const current = channel.schedule.find((p) => p.start <= nowTick && p.stop > nowTick);
                return (
                  <div
                    key={channelKey(channel)}
                    className="flex"
                    style={{
                      borderTop: '1px solid var(--color-border)',
                      background: isPlaying ? 'var(--color-accent-subtle)' : rowIndex % 2 ? 'var(--color-bg-secondary)' : 'transparent',
                    }}
                  >
                    <button
                      onClick={() => playChannel(channel)}
                      className="sticky left-0 z-10 shrink-0 flex items-center gap-2 px-2 py-1.5 text-left cursor-pointer hover:opacity-90"
                      style={{
                        width: GRID_LEFT_W,
                        background: isPlaying ? 'var(--color-accent-subtle)' : rowIndex % 2 ? 'var(--color-bg-secondary)' : 'var(--color-surface)',
                        borderRight: '1px solid var(--color-border)',
                      }}
                      title={`Play ${channel.name}`}
                    >
                      {channel.logo ? (
                        <img src={channel.logo} alt="" className="w-7 h-7 rounded object-cover shrink-0" loading="lazy" />
                      ) : (
                        <span className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ background: 'var(--color-bg-tertiary)' }}>
                          <Tv size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="text-xs truncate block" style={{ color: 'var(--color-text)' }}>{channel.name}</span>
                        <span className="text-[9px] truncate block" style={{ color: 'var(--color-text-tertiary)' }}>
                          {channel.regionLabel}
                          {current ? ` · ${current.title}` : ''}
                        </span>
                      </span>
                      <Play size={11} style={{ color: isPlaying ? 'var(--color-accent)' : 'var(--color-text-tertiary)', flexShrink: 0 }} />
                    </button>
                    <div className="relative shrink-0" style={{ width: gridWidth, height: 46 }}>
                      {entries.map((program, pIndex) => {
                        const left = Math.max(0, ((program.start - gridStart) / 3_600_000) * PX_PER_HOUR);
                        const right = Math.min(
                          gridWidth,
                          ((program.stop - gridStart) / 3_600_000) * PX_PER_HOUR,
                        );
                        const width = Math.max(4, right - left);
                        const isCurrent = program.start <= nowTick && program.stop > nowTick;
                        return (
                          <button
                            key={`${program.start}-${pIndex}`}
                            onClick={() => playChannel(channel)}
                            className="absolute top-1 bottom-1 rounded px-1.5 text-left overflow-hidden cursor-pointer"
                            style={{
                              left,
                              width,
                              background: isCurrent
                                ? 'var(--color-accent)'
                                : pIndex % 2
                                  ? 'var(--color-bg-tertiary)'
                                  : 'var(--color-bg-secondary)',
                              border: '1px solid var(--color-border)',
                            }}
                            title={`${channel.name} — ${program.title || '—'}\n${new Date(program.start).toLocaleString()} – ${new Date(program.stop).toLocaleString()}`}
                          >
                            <span
                              className="block text-[10px] truncate leading-tight"
                              style={{ color: isCurrent ? '#fff' : 'var(--color-text)' }}
                            >
                              {program.title || '—'}
                            </span>
                            <span
                              className="block text-[9px] truncate leading-tight"
                              style={{ color: isCurrent ? 'rgba(255,255,255,0.75)' : 'var(--color-text-tertiary)' }}
                            >
                              {fmtHour(program.start)}–{fmtHour(program.stop)}
                            </span>
                          </button>
                        );
                      })}
                      {entries.length === 0 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                          no schedule data
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {visibleChannels.length === 0 && (
                <div className="px-3 py-6 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  {loading ? 'Loading…' : 'No channels match the current filters.'}
                </div>
              )}

              {/* Now indicator line */}
              {nowX >= 0 && nowX <= gridWidth && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-10"
                  style={{ left: GRID_LEFT_W + nowX, width: 2, background: 'var(--color-error)' }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <MediaPlayerModal target={linkTarget} onClose={() => setLinkTarget(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function MediaPage() {
  const [tab, setTab] = useState<Tab>('tv');

  return (
    <div className="flex-1 flex flex-col overflow-hidden px-6 py-10">
      <div className="max-w-6xl mx-auto w-full flex flex-col flex-1 overflow-hidden">
        <header className="mb-5 shrink-0">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Media</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            TV guide, movie &amp; show catalog, local media library, and your own links.
          </p>
        </header>

        <div className="flex gap-1 mb-4 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm transition-colors cursor-pointer"
              style={{
                color: tab === id ? 'var(--color-text)' : 'var(--color-text-tertiary)',
                borderBottom: tab === id ? '2px solid var(--color-accent)' : '2px solid transparent',
                fontWeight: tab === id ? 600 : 400,
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 pb-4">
          {tab === 'tv' && <TvGuideTab />}
          {tab === 'iptv' && <IptvTab />}
          {tab === 'movies' && <CatalogTab type="movie" />}
          {tab === 'shows' && <CatalogTab type="series" />}
          {tab === 'local' && <LocalTab />}
          {tab === 'games' && <GamesTab />}
          {tab === 'links' && <LinksTab />}
        </div>
      </div>
    </div>
  );
}
