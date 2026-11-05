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
// IPTV tab: M3U playlist + XMLTV guide + embedded player
// ---------------------------------------------------------------------------

const IPTV_SOURCE_KEY = 'openjarvis.iptv.sources';

function loadIptvSources(): { playlist: string; guide: string } {
  try {
    const raw = localStorage.getItem(IPTV_SOURCE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { playlist: '', guide: '' };
}

function IptvTab() {
  const [sources, setSources] = useState(loadIptvSources);
  const [channels, setChannels] = useState<M3UChannel[]>([]);
  const [programs, setPrograms] = useState<Map<string, GuideProgram[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<M3UChannel | null>(null);
  const [englishOnly, setEnglishOnly] = useState(true);
  const [error, setError] = useState('');
  const [guideError, setGuideError] = useState('');
  const [playerError, setPlayerError] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTarget, setLinkTarget] = useState<MediaPlayerTarget | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    localStorage.setItem(IPTV_SOURCE_KEY, JSON.stringify(sources));
  }, [sources]);

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

  const visibleChannels = useMemo(
    () =>
      englishOnly
        ? channels.filter((c) => !c.language || /^(en|eng|english)([-_].*)?$/i.test(c.language))
        : channels,
    [channels, englishOnly],
  );

  const loadChannels = async () => {
    if (!sources.playlist.trim()) {
      setError('Enter an M3U or M3U8 playlist URL first.');
      return;
    }
    setLoading(true);
    setError('');
    setGuideError('');
    destroyPlayer();
    setPlaying(null);
    try {
      const playlistText = await fetchGuideDocument(sources.playlist.trim(), 'playlist');
      const parsed = parseM3U(playlistText);
      if (parsed.length === 0) {
        throw new Error('The playlist contains no supported channels. Check its URL and M3U format.');
      }
      setChannels(parsed);
      setPrograms(new Map());
      if (sources.guide.trim()) {
        try {
          const guideText = await fetchGuideDocument(sources.guide.trim(), 'guide');
          const parsedPrograms = parseXMLTV(guideText);
          if (parsedPrograms.size === 0) {
            setGuideError('The XMLTV file contains no usable programme entries.');
          } else {
            setPrograms(parsedPrograms);
          }
        } catch (guideLoadError) {
          setGuideError(
            guideLoadError instanceof Error ? guideLoadError.message : String(guideLoadError),
          );
        }
      }
    } catch (loadError) {
      setChannels([]);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  };

  const playChannel = (channel: M3UChannel) => {
    const video = videoRef.current;
    if (!video) return;
    setPlayerError('');
    setPlaying(channel);
    destroyPlayer();
    const url = channel.url;
    const isHls = /\.m3u8($|\?)/i.test(url) || url.includes('/playlist.m3u8');
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
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
        Add an M3U/M3U8 playlist and optional XMLTV guide you are authorized to use.
        Channels play in the built-in player below — no external app needed.
      </p>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Playlist URL (M3U/M3U8)
          <input
            value={sources.playlist}
            onChange={(e) => setSources((s) => ({ ...s, playlist: e.target.value }))}
            placeholder="https://…/channels.m3u8"
            className="h-9 w-full rounded-lg bg-transparent px-3 text-sm outline-none"
            style={inputStyle}
          />
        </label>
        <label className="space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          XMLTV guide URL (optional)
          <input
            value={sources.guide}
            onChange={(e) => setSources((s) => ({ ...s, guide: e.target.value }))}
            placeholder="https://…/guide.xml"
            className="h-9 w-full rounded-lg bg-transparent px-3 text-sm outline-none"
            style={inputStyle}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => void loadChannels()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          Load channels
        </button>
        {channels.length > 0 && (
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={englishOnly} onChange={(e) => setEnglishOnly(e.target.checked)} />
            English channels
          </label>
        )}
        {channels.length > 0 && (
          <span className="text-xs ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
            {visibleChannels.length} channels
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
      {guideError && (
        <div className="text-xs" style={{ color: 'var(--color-warning)' }}>
          Playlist loaded, but the TV schedule could not load: {guideError}
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
          <video ref={videoRef} controls autoPlay className="w-full aspect-video bg-black" />
          {playerError && (
            <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-error)' }}>{playerError}</div>
          )}
        </div>
      )}

      {channels.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={panelStyle}>
          <div className="max-h-[28rem] overflow-y-auto divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {visibleChannels.map((channel) => {
              const entries = programs.get(channel.id) ?? [];
              const now = Date.now();
              const current = entries.find((p) => p.start <= now && p.stop > now);
              const next = entries.find((p) => p.start > now);
              const isPlaying = playing?.url === channel.url;
              return (
                <button
                  key={`${channel.id}:${channel.url}`}
                  onClick={() => playChannel(channel)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer hover:opacity-90"
                  style={{ background: isPlaying ? 'var(--color-accent-subtle)' : 'transparent' }}
                >
                  <Play size={14} style={{ color: isPlaying ? 'var(--color-accent)' : 'var(--color-text-tertiary)', flexShrink: 0 }} />
                  <span className="flex-1 min-w-0">
                    <span className="text-sm truncate block" style={{ color: 'var(--color-text)' }}>{channel.name}</span>
                    <span className="text-[11px] truncate block" style={{ color: 'var(--color-text-tertiary)' }}>
                      {channel.group}
                      {current && (
                        <span style={{ color: 'var(--color-accent)' }}> · Now: {current.title}</span>
                      )}
                      {!current && next && <span> · Next: {next.title}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
            {visibleChannels.length === 0 && (
              <div className="px-3 py-6 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                No channels match the English filter.
              </div>
            )}
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
