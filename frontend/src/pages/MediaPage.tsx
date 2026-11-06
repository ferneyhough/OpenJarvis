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
  Zap,
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
  type TvEpisode,
  type GuideItem,
  type GuideMetaDetail,
  type LocalMediaResponse,
  type LocalMediaGroup,
  type GuideLink,
  fetchGuideDocument,
  fetchGuideEpg,
  fetchIvueGuide,
  fetchVodStreams,
  vodTorrentAdd,
  vodTorrentStatus,
  vodTorrentRemove,
  vodTorrentStreamUrl,
  vodMagnetUri,
  getBase,
  type GuideEpgResponse,
  type VodStream,
  type VodEpisode,
  type VodTorrentStatus,
} from '../lib/api';
import { parseM3U, parseXMLTV, type M3UChannel, type GuideProgram } from '../lib/media-guide';
import { MediaPlayerModal, type MediaPlayerTarget } from '../components/MediaPlayerModal';
import Hls from 'hls.js';

type Tab = 'guide' | 'movies' | 'shows' | 'local' | 'links';

const TABS: Array<{ id: Tab; label: string; icon: typeof Tv }> = [
  { id: 'guide', label: 'Guide', icon: Tv },
  { id: 'movies', label: 'Movies', icon: Film },
  { id: 'shows', label: 'Shows', icon: Clapperboard },
  { id: 'local', label: 'Local', icon: FolderOpen },
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

interface CatalogRow {
  label: string;
  items: GuideItem[];
}

const CATALOG_GENRES: Record<'movie' | 'series', string[]> = {
  movie: ['Action', 'Comedy', 'Drama', 'Horror', 'Thriller', 'Documentary', 'Animation', 'Romance'],
  series: ['Drama', 'Comedy', 'Crime', 'Thriller', 'Documentary', 'Animation', 'Family', 'Mystery'],
};

const CATALOG_ROW_SIZE = 24;

function CatalogTab({ type }: { type: 'movie' | 'series' }) {
  const [items, setItems] = useState<GuideItem[]>([]);
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<GuideMetaDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selSeason, setSelSeason] = useState<number | ''>('');
  const [selEpisode, setSelEpisode] = useState<number | ''>('');
  const [streams, setStreams] = useState<VodStream[] | null>(null);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [streamsError, setStreamsError] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [bestTesting, setBestTesting] = useState(false);
  const [playerTarget, setPlayerTarget] = useState<MediaPlayerTarget | null>(null);
  const [torrentJobs, setTorrentJobs] = useState<
    Record<string, { tid: string; status?: VodTorrentStatus; error?: string }>
  >({});

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const labels = ['', ...CATALOG_GENRES[type]];
      const results = await Promise.allSettled(
        labels.map((genre) => fetchGuideCatalog(type, genre)),
      );
      // Dedupe across the whole guide — a title appears only in the first
      // row that contains it.
      const seen = new Set<string>();
      const built: CatalogRow[] = [];
      results.forEach((res, i) => {
        if (res.status !== 'fulfilled') return;
        const deduped = (res.value.items ?? [])
          .filter((it) => {
            const key = it.imdb_id || `${it.name ?? ''}`;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, CATALOG_ROW_SIZE);
        if (deduped.length > 0) built.push({ label: labels[i] || 'Top', items: deduped });
      });
      if (built.length === 0) setError('Catalog unavailable');
      setRows(built);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Catalog unavailable');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    setItems([]);
    setRows([]);
    setQuery('');
    void loadCatalog();
  }, [loadCatalog]);

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError('');
    setRows([]);
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
    setStreams(null);
    setStreamsError('');
    setSelSeason('');
    setSelEpisode('');
    setTorrentJobs({});
    try {
      const d = await fetchGuideMeta(type, item.imdb_id);
      setDetail(d);
      const seasons = Array.from(
        new Set((d.episodes ?? []).map((e) => e.season).filter((s): s is number => s != null)),
      ).sort((a, b) => a - b);
      if (type === 'series' && seasons.length > 0) setSelSeason(seasons[0]);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const episodes = detail?.episodes ?? [];
  const seasons = useMemo(
    () =>
      Array.from(new Set(episodes.map((e) => e.season).filter((s): s is number => s != null))).sort(
        (a, b) => a - b,
      ),
    [episodes],
  );
  const seasonEpisodes = useMemo(
    () =>
      episodes
        .filter((e) => e.season === selSeason && e.episode != null)
        .sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0)),
    [episodes, selSeason],
  );

  useEffect(() => {
    if (type === 'series' && selSeason !== '') {
      const first = episodes
        .filter((e) => e.season === selSeason && e.episode != null)
        .sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0))[0];
      setSelEpisode(first?.episode ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selSeason]);

  // Poll active torrent jobs for progress.
  useEffect(() => {
    const active = Object.values(torrentJobs).filter((j) => j.tid && !j.status?.finished);
    if (active.length === 0) return;
    const timer = window.setInterval(() => {
      void Promise.all(
        active.map(async (j) => {
          try {
            const status = await vodTorrentStatus(j.tid);
            setTorrentJobs((prev) => ({ ...prev, [j.tid]: { ...prev[j.tid], tid: j.tid, status } }));
          } catch {
            /* keep last status */
          }
        }),
      );
    }, 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(Object.keys(torrentJobs))]);

  const loadSources = async () => {
    if (!detail) return;
    if (type === 'series' && (selSeason === '' || selEpisode === '')) {
      setStreamsError('Pick a season and episode first.');
      return;
    }
    setStreamsLoading(true);
    setStreamsError('');
    setStreams(null);
    try {
      const data = await fetchVodStreams(
        type,
        detail.meta.imdb_id,
        type === 'series' ? Number(selSeason) : undefined,
        type === 'series' ? Number(selEpisode) : undefined,
      );
      setStreams(data.streams);
    } catch (e) {
      setStreamsError(e instanceof Error ? e.message : 'Source lookup failed');
    } finally {
      setStreamsLoading(false);
    }
  };

  const ensureTorrent = async (stream: VodStream): Promise<string> => {
    const key = stream.id;
    const existing = torrentJobs[key];
    if (existing?.tid) return existing.tid;
    if (!stream.infoHash) throw new Error('Stream has no torrent hash');
    const magnet = vodMagnetUri(stream.infoHash, stream.name || stream.title || undefined);
    const added = await vodTorrentAdd(magnet, stream.fileIdx);
    setTorrentJobs((prev) => ({ ...prev, [key]: { tid: added.id } }));
    return added.id;
  };

  const playStream = async (stream: VodStream) => {
    const title = `${detail?.meta.name ?? ''} — ${stream.name || stream.title || stream.quality}`;
    if (stream.url) {
      setPlayerTarget({ src: stream.url, title });
      return;
    }
    if (stream.externalUrl) {
      window.open(stream.externalUrl, '_blank', 'noopener');
      return;
    }
    try {
      const tid = await ensureTorrent(stream);
      setPlayerTarget({ src: vodTorrentStreamUrl(tid), title });
    } catch (e) {
      setStreamsError(e instanceof Error ? e.message : 'Could not start torrent');
    }
  };

  const downloadStream = async (stream: VodStream) => {
    if (stream.url) {
      window.open(stream.url, '_blank', 'noopener');
      return;
    }
    try {
      const tid = await ensureTorrent(stream);
      window.open(vodTorrentStreamUrl(tid, true), '_blank', 'noopener');
    } catch (e) {
      setStreamsError(e instanceof Error ? e.message : 'Could not start torrent');
    }
  };

  const qualities = useMemo(() => {
    if (!streams) return [];
    const order = ['8K', '4K', '1080P', '720P', '480P'];
    const present = new Set(streams.map((s) => s.quality).filter(Boolean));
    const sorted = order.filter((q) => present.has(q));
    for (const q of present) if (!sorted.includes(q)) sorted.push(q);
    return sorted;
  }, [streams]);

  const filteredStreams = useMemo(() => {
    if (!streams) return null;
    if (!qualityFilter) return streams;
    return streams.filter((s) => s.quality === qualityFilter);
  }, [streams, qualityFilter]);

  const fmtRate = (bps: number) => {
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
    if (bps >= 1_000) return `${Math.round(bps / 1_000)} KB/s`;
    return `${Math.round(bps)} B/s`;
  };

  // Speed-test the top torrent candidates and play the fastest.
  const playBest = async () => {
    if (!detail || !filteredStreams) return;
    const title = detail.meta.name;
    const torrents = filteredStreams.filter((s) => s.isTorrent && s.infoHash);
    const directs = filteredStreams.filter((s) => s.url);

    if (torrents.length === 0) {
      const first = directs[0] ?? filteredStreams[0];
      if (first) void playStream(first);
      else setStreamsError('No playable sources in this quality.');
      return;
    }

    setBestTesting(true);
    setStreamsError('');
    // Candidates: highest seeders first, cap at 5 to keep the test quick.
    const candidates = [...torrents]
      .sort((a, b) => (b.seeders ?? 0) - (a.seeders ?? 0))
      .slice(0, 5);

    // Phase 1: add all candidates in parallel (metadata fetch per torrent).
    const added = await Promise.all(
      candidates.map(async (s) => {
        try {
          const tid = await ensureTorrent(s);
          return { stream: s, tid };
        } catch {
          return null;
        }
      }),
    );
    const live = added.filter((x): x is { stream: VodStream; tid: string } => x !== null);

    // Phase 2: sample download rates for ~6s and pick the fastest.
    let winner: { stream: VodStream; tid: string } | null = null;
    if (live.length === 1) {
      winner = live[0];
    } else if (live.length > 1) {
      const sample = async () => {
        const rates = new Map<string, number>();
        await Promise.all(
          live.map(async ({ tid }) => {
            try {
              const st = await vodTorrentStatus(tid);
              rates.set(tid, st.download_rate);
            } catch {
              rates.set(tid, 0);
            }
          }),
        );
        return rates;
      };
      await new Promise((r) => setTimeout(r, 4000));
      const rates1 = await sample();
      await new Promise((r) => setTimeout(r, 2500));
      const rates2 = await sample();
      let bestRate = -1;
      for (const { tid } of live) {
        const rate = Math.max(rates1.get(tid) ?? 0, rates2.get(tid) ?? 0);
        if (rate > bestRate) {
          bestRate = rate;
          winner = live.find((x) => x.tid === tid) ?? null;
        }
      }
      // Remove the losers to free bandwidth.
      await Promise.all(
        live
          .filter((x) => x.tid !== winner?.tid)
          .map((x) => vodTorrentRemove(x.tid).catch(() => {})),
      );
      setTorrentJobs((prev) => {
        const next = { ...prev };
        for (const x of live) {
          if (x.tid !== winner?.tid) {
            for (const [k, v] of Object.entries(next)) {
              if (v.tid === x.tid) delete next[k];
            }
          }
        }
        return next;
      });
    }

    setBestTesting(false);
    if (winner) {
      const w = winner.stream;
      setPlayerTarget({
        src: vodTorrentStreamUrl(winner.tid),
        title: `${title} — ${w.name || w.title || w.quality} (best source)`,
      });
    } else if (directs[0]) {
      void playStream(directs[0]);
    } else {
      setStreamsError('Could not start any torrent source.');
    }
  };

  const renderCard = (item: GuideItem, compact = false) => (
    <button
      key={`${item.imdb_id}-${item.name}`}
      onClick={() => void openDetail(item)}
      className={`text-left rounded-xl overflow-hidden transition-transform hover:scale-[1.03] cursor-pointer shrink-0 ${compact ? 'w-32' : 'w-40'}`}
      style={panelStyle}
    >
      {item.poster ? (
        <img src={item.poster} alt={item.name ?? ''} className="w-full aspect-[2/3] object-cover" loading="lazy" />
      ) : (
        <div className="w-full aspect-[2/3] flex items-center justify-center text-xs px-2 text-center" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
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
  );

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
          Guide
        </button>
      </div>

      {error && <ErrorNote message={error} />}
      {loading && (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--color-accent)' }} /></div>
      )}

      {/* Search results — flat grid */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map((item) => renderCard(item))}
        </div>
      )}

      {/* Guide rows — Rogers-style shelves */}
      {!loading && rows.length > 0 && (
        <div className="flex flex-col gap-5">
          {rows.map((row) => (
            <div key={row.label}>
              <div
                className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1"
                style={{ color: 'var(--color-text-secondary)', borderLeft: '3px solid var(--color-accent)', paddingLeft: 8 }}
              >
                {row.label}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                {row.items.map((item) => renderCard(item, true))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && rows.length === 0 && !error && (
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
            className="rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 flex gap-4"
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

              {/* Episode picker for series */}
              {type === 'series' && seasons.length > 0 && (
                <div className="flex items-center gap-2 mt-4">
                  <select
                    value={selSeason}
                    onChange={(e) => setSelSeason(Number(e.target.value))}
                    className="h-8 rounded-lg px-2 text-xs"
                    style={inputStyle}
                  >
                    {seasons.map((s) => (
                      <option key={s} value={s}>Season {s}</option>
                    ))}
                  </select>
                  <select
                    value={selEpisode}
                    onChange={(e) => setSelEpisode(Number(e.target.value))}
                    className="h-8 flex-1 rounded-lg px-2 text-xs"
                    style={inputStyle}
                  >
                    {seasonEpisodes.map((ep) => (
                      <option key={ep.episode} value={ep.episode ?? 0}>
                        E{ep.episode} — {ep.title || 'Episode'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sources */}
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void loadSources()}
                    disabled={streamsLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
                    style={{ background: 'var(--color-accent)', color: '#fff' }}
                  >
                    {streamsLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    {type === 'series' ? 'Find episode sources' : 'Find sources'}
                  </button>
                  {filteredStreams && filteredStreams.length > 0 && (
                    <button
                      onClick={() => void playBest()}
                      disabled={bestTesting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
                      style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                    >
                      {bestTesting ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                      {bestTesting ? 'Speed-testing…' : 'Play best'}
                    </button>
                  )}
                  <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    Torrentio · Comet · MediaFusion
                  </span>
                </div>
                {filteredStreams && qualities.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <button
                      onClick={() => setQualityFilter('')}
                      className="px-2 py-0.5 rounded text-[10px] cursor-pointer"
                      style={{
                        background: qualityFilter === '' ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)',
                        color: qualityFilter === '' ? 'var(--color-text)' : 'var(--color-text-tertiary)',
                        border: `1px solid ${qualityFilter === '' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      }}
                    >
                      All
                    </button>
                    {qualities.map((q) => (
                      <button
                        key={q}
                        onClick={() => setQualityFilter(qualityFilter === q ? '' : q)}
                        className="px-2 py-0.5 rounded text-[10px] cursor-pointer"
                        style={{
                          background: qualityFilter === q ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)',
                          color: qualityFilter === q ? 'var(--color-text)' : 'var(--color-text-tertiary)',
                          border: `1px solid ${qualityFilter === q ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {streamsError && (
                  <p className="text-xs mt-2" style={{ color: 'var(--color-error, #f87171)' }}>{streamsError}</p>
                )}
                {streams && (
                  <div className="mt-2 space-y-1.5">
                    {filteredStreams!.length === 0 && (
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                        {streams.length === 0 ? 'No streams found for this title.' : 'No streams in this quality.'}
                      </p>
                    )}
                    {(filteredStreams ?? []).map((s) => {
                      const job = torrentJobs[s.id];
                      const progress = job?.status?.progress;
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {s.quality && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-text)' }}>
                                  {s.quality}
                                </span>
                              )}
                              <span className="text-xs font-medium truncate" style={{ color: 'var(--color-text)' }}>
                                {s.name || s.title || s.addon}
                              </span>
                            </div>
                            <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                              {s.addon}
                              {s.size ? ` · ${s.size}` : ''}
                              {s.seeders != null ? ` · ${s.seeders} seeds` : ''}
                              {s.isTorrent ? ' · torrent' : ' · direct'}
                              {s.externalUrl ? ' · external' : ''}
                            </div>
                            {job?.status && !job.status.finished && (
                              <div className="mt-1">
                                <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                                  <span>{job.status.state} · {job.status.peers} peers</span>
                                  <span>{fmtRate(job.status.download_rate)} · {Math.round((progress ?? 0) * 100)}%</span>
                                </div>
                                <div className="mt-0.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
                                  <div className="h-full" style={{ width: `${Math.round((progress ?? 0) * 100)}%`, background: 'var(--color-accent)' }} />
                                </div>
                              </div>
                            )}
                            {job?.status?.finished && (
                              <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-success, #4ade80)' }}>Downloaded — saved to ~/.openjarvis/torrents</div>
                            )}
                          </div>
                          <button
                            onClick={() => void playStream(s)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer shrink-0"
                            style={{ background: 'var(--color-accent)', color: '#fff' }}
                          >
                            Play
                          </button>
                          <button
                            onClick={() => void downloadStream(s)}
                            className="px-2.5 py-1 rounded-md text-[11px] cursor-pointer shrink-0"
                            style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                          >
                            Download
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <MediaPlayerModal target={playerTarget} onClose={() => setPlayerTarget(null)} />
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
// IPTV tab: merged regional playlists + windowed XMLTV EPG
// ---------------------------------------------------------------------------

interface RegionPreset {
  key: string;
  label: string;
  playlist: string;
  epg: string;
  tz: string;
  ivue?: boolean;
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
  {
    key: 'MT',
    label: 'Mad Titan',
    playlist: 'https://magnetic.website/jet/playlists/titan.m3u8',
    epg: 'https://magnetic.website/jet/epg/merged_epg.xml.gz',
    tz: 'America/New_York',
  },
  {
    key: 'IV',
    label: 'iVue Guide',
    playlist: '',
    epg: '',
    tz: '',
    ivue: true,
  },
];

interface GuideChannel extends M3UChannel {
  region: string;
  regionLabel: string;
  tz: string;
  schedule: GuideProgram[];
  playable: boolean;
}

const IPTV_STATE_KEY = 'openjarvis.iptv.merged';

// Religious channels are excluded from the guide entirely.
const RELIGIOUS_RE = new RegExp(
  '\\b(' +
    [
      // Islam / Muslim
      'islam', 'islamic', 'muslim', 'muslims', 'quran', 'koran', 'masjid', 'mosque',
      'azan', 'athan', 'salah', 'salat', 'eid', 'halal', 'haram', 'fatwa', 'imam',
      'mullah', 'ulema', 'allahu', 'muhammad', 'jihad', 'sharia', 'deen', 'dawah',
      'ramadan', 'iftar', 'suhoor', 'suhur', 'hajj', 'umrah', 'jumuah', 'taraweeh',
      'sujud', 'wudu', 'hijab', 'niqab', 'iqra', 'alkauthar', 'awakening', 'hayat',
      'huda', 'noor', 'safa', 'assiratv', 'peace tv', 'voice of islam', 'radio islam',
      'islam 21', 'alkarim', 'alkoos', 'hijrah', 'qibla', 'mihrab', 'maghrib', 'fajr',
      'dhuhr', 'asr', 'ishaa', 'isha', 'sehar', 'salaam', 'assalamu', 'islamic relief',
      'muslim aid', 'human appeal',
      // Muslim / Arabic-leaning news
      'al jazeera', 'aljazeera', 'al arabiya', 'alarabiya', 'arab news', 'press tv',
      'tasnim', 'al mayadeen', 'almayadeen', 'sky news arabia', 'trt arabic',
      'alhurra', 'alkhaleej', 'al anadolu', 'anadolu ajansi',
      // Christianity / church / prayer / donation
      'gospel', 'christian', 'christ', 'jesus', 'bible', 'scripture', 'church',
      'worship', 'praise', 'hymn', 'hymns', 'sermon', 'pastor', 'ministry',
      'ministries', 'faith', 'catholic', 'orthodox', 'adventist', 'mormon',
      'jehovah', 'torah', 'synagogue', 'jewish', 'revival', 'anoint', 'hallelujah',
      'sabbath', 'eucharist', 'baptist', 'methodist', 'presbyterian', 'lutheran',
      'anglican', 'pentecostal', 'charismatic', 'messianic', 'daystar', 'god tv',
      'pray', 'adoration', 'rosary', 'novena', 'litany', 'sacred', 'divine',
      'chapel', 'cathedral', 'parish', 'diocese', 'abbey', 'monastery', 'convent',
      'chaplain', 'reverend', 'rev.', 'padre', 'priest', 'cleric', 'deacon',
      'vicar', 'bishop', 'cardinal', 'pope', 'vatican', 'lourdes', 'fatima',
      'guadalupe', 'donat', 'tithe', 'offering', 'benevolence', 'savior',
      'saviour', 'messiah', 'redemption', 'salvation', 'born again', 'glory tv',
      // Other religions / spirituality
      'hindu', 'sikh', 'buddhist', 'jain', 'kirtan', 'bhajan', 'mandir',
      'gurdwara', 'temple', 'guru granth', 'bhagavad', 'upanishad', 'vedas',
      'dalai lama', 'dharma', 'nirvana', 'bahai', 'meditation', 'yoga',
    ].join('|') +
    ')\\b',
  'i',
);

type ChannelMeta = Pick<M3UChannel, 'id' | 'name' | 'group' | 'language'>;

function isReligiousChannel(channel: ChannelMeta): boolean {
  return RELIGIOUS_RE.test(`${channel.name} ${channel.group} ${channel.id}`);
}

// Gaming/esports channels are excluded from the guide entirely.
const GAMES_RE =
  /\b(gaming|esports?|e-?sports?|game\s*network|twitch|steam|xbox|playstation|nintendo|roblox|minecraft|riot|league\s*of\s*legends|dota|esl|gaming tv|videogame)\b/i;

function isGameChannel(channel: ChannelMeta): boolean {
  return GAMES_RE.test(`${channel.name} ${channel.group} ${channel.id}`);
}

// Non-Latin scripts indicate a non-English-spoken channel even when the
// playlist omits tvg-language.
const NON_ENGLISH_SCRIPT_RE =
  /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;

function isEnglishChannel(channel: ChannelMeta): boolean {
  if (channel.language && !/^(en|eng|english)([-_].*)?$/i.test(channel.language))
    return false;
  if (NON_ENGLISH_SCRIPT_RE.test(channel.name) || NON_ENGLISH_SCRIPT_RE.test(channel.group))
    return false;
  return true;
}

// Kids channels (cartoons, anime, preschool) get their own guide section.
const KIDS_RE =
  /\b(kids?|nick\s*(jr|elodeon|music|at\s*night)?|nicktoons|disney\s*(jr|junior|xd|channel)|boomerang|cartoon|anime|baby\s*(tv|first)|toddler|pbs|cbeebies|treehouse|jeemovies|sprout|kidscity|kidtastic|cartoonito|babyfirst|zombie\s*chum|garfield|peppa|bluey|paw patrol)\b/i;

// Sports channels get their own section, grouped by sport.
const SPORTS_RE =
  /\b(sports?|nfl|nba|mlb|nhl|mls|ncaa|soccer|football|futbol|tennis|golf|pga|ufc|mma|boxing|wwe|wrestling|nascar|indycar|f1|formula|motogp|racing|cricket|rugby|espn|fs1|fs2|big ten|sec network|dazn|bein sports|sky sports|tsn|sportsnet|eurosport|golf channel|tennis channel|nba tv|nfl network|mlb network|nhl network|mls soccer)\b/i;

const SPORT_ORDER = [
  'American Football',
  'Basketball',
  'Baseball',
  'Hockey',
  'Soccer',
  'Tennis',
  'Golf',
  'Combat & Wrestling',
  'Racing & Motorsports',
  'Cricket & Rugby',
  'Sports Network',
  'Other Sports',
];

function sportOf(channel: GuideChannel): string {
  const s = `${channel.name} ${channel.group}`.toLowerCase();
  if (/\b(nfl|super bowl|football)\b/.test(s) && !/soccer|futbol|premier/.test(s)) return 'American Football';
  if (/\b(nba|basketball|march madness|ncaa)\b/.test(s)) return 'Basketball';
  if (/\b(mlb|baseball)\b/.test(s)) return 'Baseball';
  if (/\b(nhl|hockey|stanley cup)\b/.test(s)) return 'Hockey';
  if (/\b(soccer|mls|futbol|premier league|champions league|bundesliga|serie a|laliga|la liga|uefa|fifa|epl)\b/.test(s)) return 'Soccer';
  if (/\b(tennis|wimbledon|us open|australian open|french open)\b/.test(s)) return 'Tennis';
  if (/\bgolf|pga\b/.test(s)) return 'Golf';
  if (/\b(ufc|mma|boxing|wwe|wrestling|wrestlemania|bellator|pfl)\b/.test(s)) return 'Combat & Wrestling';
  if (/\b(nascar|indycar|formula|f1|motogp|racing|speedway|drag)\b/.test(s)) return 'Racing & Motorsports';
  if (/\b(cricket|rugby|six nations)\b/.test(s)) return 'Cricket & Rugby';
  if (/\bsports?\b|espn|fs1|fs2|dazn|bein|sky sports|tsn|sportsnet|eurosport|big ten|sec network|nba tv|nfl network|mlb network|nhl network|mls/.test(s)) return 'Sports Network';
  return 'Other Sports';
}

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
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [guideErrors, setGuideErrors] = useState<string[]>([]);
  const [playerError, setPlayerError] = useState('');
  const [playNotice, setPlayNotice] = useState('');
  const [guideView, setGuideView] = useState<'main' | 'kids' | 'sports'>('main');
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
        if (isReligiousChannel(channel) || !isEnglishChannel(channel)) continue;
        const dedupeKey = channel.id || `${channel.name}|${channel.url}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        merged.push({
          ...channel,
          region: regionKey,
          regionLabel,
          tz,
          schedule: lookup ? lookup(channel) : [],
          playable: /^(https?|rtsp|rtmp|udp):\/\//i.test(channel.url),
        });
      }
    };

    const streamRegions = regions.filter((r) => !r.ivue);
    const ivueRegions = regions.filter((r) => r.ivue);

    await Promise.all(
      streamRegions.map(async (region) => {
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

    if (ivueRegions.length > 0) {
      try {
        const data = await fetchIvueGuide();
        for (const region of ivueRegions) {
          for (const channel of data.channels) {
            if (isReligiousChannel(channel) || !isEnglishChannel(channel)) continue;
            const dedupeKey = channel.id || `${channel.name}|${channel.url}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            merged.push({
              ...channel,
              userAgent: '',
              referrer: '',
              region: region.key,
              regionLabel: channel.regionLabel || region.label,
              tz: channel.tz || region.tz,
              schedule: channel.schedule ?? [],
              playable: false,
            });
          }
        }
      } catch (ivueError) {
        errors.push(
          `iVue Guide: ${ivueError instanceof Error ? ivueError.message : String(ivueError)}`,
        );
      }
    }

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
    const matchesQuery = (c: GuideChannel) =>
      !q || c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q);
    const filtered = channels.filter((c) => {
      if (c.language && !/^(en|eng|english)([-_].*)?$/i.test(c.language))
        return false;
      if (regionFilter !== 'ALL' && c.region !== regionFilter) return false;
      if (!matchesQuery(c)) return false;
      const kids = KIDS_RE.test(`${c.name} ${c.group}`);
      const game = isGameChannel(c);
      const sports = SPORTS_RE.test(`${c.name} ${c.group}`);
      if (guideView === 'kids') return kids || game;
      if (guideView === 'sports') return sports;
      return !kids && !game; // main guide excludes kids and game channels
    });
    if (guideView === 'sports') {
      filtered.sort(
        (a, b) =>
          SPORT_ORDER.indexOf(sportOf(a)) - SPORT_ORDER.indexOf(sportOf(b)) ||
          a.name.localeCompare(b.name),
      );
      return filtered;
    }
    if (guideView === 'kids') {
      // Kids channels first, then a Games group at the bottom.
      const groupOf = (c: GuideChannel) =>
        !KIDS_RE.test(`${c.name} ${c.group}`) && isGameChannel(c) ? 1 : 0;
      return filtered.sort(
        (a, b) =>
          groupOf(a) - groupOf(b) ||
          (regionOrder.get(a.region) ?? 99) - (regionOrder.get(b.region) ?? 99) ||
          a.name.localeCompare(b.name),
      );
    }
    return filtered.sort(
      (a, b) =>
        (regionOrder.get(a.region) ?? 99) - (regionOrder.get(b.region) ?? 99) ||
        a.name.localeCompare(b.name),
    );
  }, [channels, regionFilter, query, regionOrder, guideView]);

  // Sports and Kids views insert a separator row whenever the group changes.
  const gridRows = useMemo(() => {
    const groupOf = (c: GuideChannel): string => {
      if (guideView === 'sports') return sportOf(c);
      if (guideView === 'kids') {
        return KIDS_RE.test(`${c.name} ${c.group}`) ? 'Kids' : 'Games';
      }
      return '';
    };
    if (guideView === 'main') {
      return visibleChannels.map((channel, idx) => ({ kind: 'channel' as const, channel, idx }));
    }
    const rows: (
      | { kind: 'channel'; channel: GuideChannel; idx: number }
      | { kind: 'header'; label: string; count: number }
    )[] = [];
    const counts = new Map<string, number>();
    for (const c of visibleChannels) {
      const s = groupOf(c);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    let lastGroup = '';
    visibleChannels.forEach((channel, idx) => {
      const group = groupOf(channel);
      if (group !== lastGroup) {
        rows.push({ kind: 'header', label: group, count: counts.get(group) ?? 0 });
        lastGroup = group;
      }
      rows.push({ kind: 'channel', channel, idx });
    });
    return rows;
  }, [visibleChannels, guideView]);

  const channelKey = (channel: GuideChannel) => `${channel.region}:${channel.id || channel.url}`;

  // EPG grid: 24h window starting one hour before now, in the viewer's local time.
  const GRID_HOURS = 24;
  const PX_PER_HOUR = 120;
  const GRID_LEFT_W = 220;
  const NOW_COLOR = '#22d3ee'; // JARVIS cyan — matches the boot screen theme
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
    setPlayNotice('');
    if (!channel.playable) {
      setPlayNotice(`${channel.name} is guide-only — Mad Titan/plugin channels have no stream OpenJarvis can play.`);
      return;
    }
    setPlayerError('');
    setPlaying(channel);
    destroyPlayer();
  };

  // Attach the stream once the <video> element exists (it mounts with `playing`).
  useEffect(() => {
    const video = videoRef.current;
    const channel = playing;
    if (!video || !channel || !channel.playable) return;
    setPlayerError('');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

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
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          {(['main', 'kids', 'sports'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setGuideView(view)}
              className="px-3 py-1.5 text-xs cursor-pointer capitalize"
              style={{
                background: guideView === view ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                color: guideView === view ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {view === 'main' ? 'Guide' : view === 'kids' ? 'Kids' : 'Sports'}
            </button>
          ))}
        </div>
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
      {playNotice && (
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{playNotice}</div>
      )}
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
                  <div>Channel</div>
                  <div className="text-[9px] font-medium normal-case tracking-normal" style={{ color: NOW_COLOR }}>
                    {new Date(nowTick).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    {' · '}
                    {new Date(nowTick).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
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
                      <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: 'var(--color-text)' }}>
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

              {/* Channel rows (with sport separators in Sports view) */}
              {gridRows.map((row) => {
                if (row.kind === 'header') {
                  return (
                    <div
                      key={`sport-${row.label}`}
                      className="flex"
                      style={{ background: 'var(--color-bg-tertiary)', borderTop: '1px solid var(--color-border)' }}
                    >
                      <div
                        className="sticky left-0 z-10 shrink-0 px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                        style={{
                          width: GRID_LEFT_W,
                          background: 'var(--color-bg-tertiary)',
                          borderRight: '1px solid var(--color-border)',
                          color: 'var(--color-accent)',
                        }}
                      >
                        {row.label}
                      </div>
                      <div className="relative shrink-0" style={{ width: gridWidth, height: 26 }}>
                        <span className="absolute left-2 top-1 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                          {row.count} channel{row.count === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  );
                }
                const { channel, idx: rowIndex } = row;
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
                        <img src={channel.logo} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" style={{ background: '#000' }} loading="lazy" />
                      ) : (
                        <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-bg-tertiary)' }}>
                          <Tv size={15} style={{ color: 'var(--color-text-tertiary)' }} />
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="text-[13px] font-semibold truncate block" style={{ color: 'var(--color-text)' }}>{channel.name}</span>
                        <span className="text-[10px] truncate block" style={{ color: current ? NOW_COLOR : 'var(--color-text-tertiary)', fontWeight: current ? 600 : 400 }}>
                          {current ? `● ${current.title}` : channel.regionLabel}
                        </span>
                      </span>
                      <Play size={11} style={{ color: isPlaying ? 'var(--color-accent)' : 'var(--color-text-tertiary)', flexShrink: 0 }} />
                    </button>
                    <div className="relative shrink-0" style={{ width: gridWidth, height: 54 }}>
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
                            className="absolute top-1 bottom-1 rounded-md px-2 text-left overflow-hidden cursor-pointer transition-opacity hover:opacity-80"
                            style={{
                              left,
                              width,
                              background: isCurrent
                                ? NOW_COLOR
                                : program.stop <= nowTick
                                  ? 'var(--color-bg-tertiary)'
                                  : pIndex % 2
                                    ? 'var(--color-bg-secondary)'
                                    : 'var(--color-bg-tertiary)',
                              border: isCurrent ? 'none' : '1px solid var(--color-border)',
                              opacity: program.stop <= nowTick ? 0.45 : 1,
                            }}
                            title={`${channel.name} — ${program.title || '—'}\n${new Date(program.start).toLocaleString()} – ${new Date(program.stop).toLocaleString()}`}
                          >
                            <span
                              className="block text-[11px] font-medium truncate leading-tight"
                              style={{ color: isCurrent ? '#062a33' : 'var(--color-text)' }}
                            >
                              {program.title || '—'}
                            </span>
                            <span
                              className="block text-[9px] truncate leading-tight"
                              style={{ color: isCurrent ? 'rgba(6,42,51,0.75)' : 'var(--color-text-tertiary)' }}
                            >
                              {fmtHour(program.start)}–{fmtHour(program.stop)}
                              {isCurrent ? '  ● LIVE' : ''}
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
                  style={{ left: GRID_LEFT_W + nowX - 1, width: 3, background: NOW_COLOR, boxShadow: `0 0 8px ${NOW_COLOR}` }}
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
  const [tab, setTab] = useState<Tab>('guide');

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
          {tab === 'guide' && (
            <div className="flex flex-col gap-6">
              <IptvTab />
              <div>
                <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                  Tonight's Shows
                </h2>
                <TvGuideTab />
              </div>
            </div>
          )}
          {tab === 'movies' && <CatalogTab type="movie" />}
          {tab === 'shows' && <CatalogTab type="series" />}
          {tab === 'local' && <LocalTab />}
          {tab === 'links' && <LinksTab />}
        </div>
      </div>
    </div>
  );
}
