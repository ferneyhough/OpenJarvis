import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Tv,
  X,
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
  Gamepad2,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
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
  fetchGuideDeadList,
  fetchGuideDocument,
  getWindowFullscreen,
  setWindowFullscreen,
  fetchGuideEpg,
  fetchGuideProbe,
  fetchGuideProgramInfo,
  fetchIvueGuide,
  fetchVodStreams,
  vodTorrentAdd,
  vodTorrentStatus,
  vodTorrentRemove,
  vodTorrentStreamUrl,
  vodMagnetUri,
  getBase,
  type GuideEpgResponse,
  type GuideProgramInfo,
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
// JARVIS cyan — matches the boot screen theme; shared by all guide views.
const NOW_COLOR = '#22d3ee';
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

      <div className="flex flex-col gap-3">
        {groups.map(([showName, eps]) => {
          const first = eps[0];
          return (
            <div key={showName} className="flex gap-3 rounded-xl p-3" style={panelStyle}>
              {first.show.image ? (
                <img src={first.show.image} alt={showName} className="w-16 h-24 object-cover rounded-lg shrink-0" style={{ background: 'var(--color-bg-tertiary)' }} />
              ) : (
                <span className="w-16 h-24 rounded-lg flex items-center justify-center shrink-0 text-[10px] text-center px-1" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                  {showName}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{showName}</span>
                  <Rating value={first.show.rating} />
                  {first.network && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-text)' }}>
                      {first.network}
                    </span>
                  )}
                </div>
                {first.show.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {first.show.genres.slice(0, 4).map((g) => (
                      <span key={g} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                        {g}
                      </span>
                    ))}
                  </div>
                )}
                {first.show.url && (
                  <a href={first.show.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 mt-1 text-[10px]" style={{ color: 'var(--color-accent)' }}>
                    TVMaze <ExternalLink size={9} />
                  </a>
                )}
                <div className="flex flex-col gap-1.5 mt-2">
                  {eps.map((ep) => (
                    <div
                      key={ep.id ?? `${ep.name}-${ep.airtime}`}
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5"
                      style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
                    >
                      {ep.airtime && (
                        <span
                          className="shrink-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--color-bg-tertiary)', color: NOW_COLOR }}
                          title={ep.airdate ? `Airs ${ep.airdate} (${country} local time)` : undefined}
                        >
                          {ep.airtime}
                        </span>
                      )}
                      <span className="text-xs min-w-0" style={{ color: 'var(--color-text)' }}>
                        <span className="font-medium">S{ep.season ?? '?'}E{ep.number ?? '?'} — {ep.name}</span>
                        {ep.runtime ? <span style={{ color: 'var(--color-text-tertiary)' }}> ({ep.runtime}m)</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
                {first.summary && (
                  <p className="text-xs mt-2 leading-relaxed line-clamp-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {first.summary.replace(/<[^>]+>/g, '')}
                  </p>
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
  const [vodNotice, setVodNotice] = useState('');
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

  const runSearch = useCallback(async (override?: string) => {
    const term = (override ?? query).trim();
    if (term.length < 2) return;
    setLoading(true);
    setError('');
    setRows([]);
    try {
      const data = await searchGuide(term, type);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [query, type]);

  // Voice commands: "Jarvis watch/find/play <title>".
  useEffect(() => {
    const onSearch = (e: Event) => {
      const d = (e as CustomEvent<{ kind?: string; query?: string }>).detail;
      if (!d?.query) return;
      const want = type === 'movie' ? 'movie' : 'series';
      if (d.kind && d.kind !== want) return;
      setQuery(d.query);
      void runSearch(d.query);
    };
    window.addEventListener('jarvis:catalog-search', onSearch);
    return () => window.removeEventListener('jarvis:catalog-search', onSearch);
  }, [runSearch, type]);

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
      // Only play a torrent once the file is fully on disk — never stream
      // while it's still downloading. Otherwise just download it.
      const st = await vodTorrentStatus(tid);
      if (st.finished) {
        setPlayerTarget({ src: vodTorrentStreamUrl(tid), title });
      } else {
        setVodNotice(
          `${title}: downloading (${Math.round((st.progress ?? 0) * 100)}%) — it'll be playable from Media → Local when done.`,
        );
      }
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
      // Only play if the file is already fully downloaded; otherwise keep the
      // fastest torrent downloading and point the user at Media → Local.
      try {
        const st = await vodTorrentStatus(winner.tid);
        if (st.finished) {
          setPlayerTarget({
            src: vodTorrentStreamUrl(winner.tid),
            title: `${title} — ${w.name || w.title || w.quality} (best source)`,
          });
        } else {
          setVodNotice(
            `${title}: fastest source is downloading (${Math.round((st.progress ?? 0) * 100)}%) — it'll be playable from Media → Local when done.`,
          );
        }
      } catch {
        setPlayerTarget({
          src: vodTorrentStreamUrl(winner.tid),
          title: `${title} — ${w.name || w.title || w.quality} (best source)`,
        });
      }
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
                {vodNotice && (
                  <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>{vodNotice}</p>
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
                              <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-success, #4ade80)' }}>Downloaded — saved to ~/.openjarvis/downloads</div>
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

// Anything that can't load within ~a minute is treated as dead and dropped.
const FETCH_DEADLINE_MS = 60_000;

function withDeadline<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${FETCH_DEADLINE_MS / 1000}s`)),
        FETCH_DEADLINE_MS,
      ),
    ),
  ]);
}

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

// Timezone helpers for the channel list — programmes are epoch ms, but each
// channel's schedule is labelled in *its* region's timezone (e.g. a US East
// channel shows EDT times even when the viewer is elsewhere).
const tzFormatCache = new Map<string, Intl.DateTimeFormat>();

function tzFormatter(tz: string | undefined, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tz ?? ''}|${JSON.stringify(opts)}`;
  let fmt = tzFormatCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz || undefined });
    tzFormatCache.set(key, fmt);
  }
  return fmt;
}

function tzAbbrev(tz: string | undefined, ts: number): string {
  if (!tz) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(ts);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

function fmtChannelTime(tz: string | undefined, ts: number): string {
  try {
    return tzFormatter(tz, { hour: 'numeric', minute: '2-digit', hour12: false }).format(ts);
  } catch {
    return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
  }
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
  const [detail, setDetail] = useState<{ channel: GuideChannel; program: GuideProgram } | null>(null);
  const [programInfo, setProgramInfo] = useState<GuideProgramInfo | null>(null);
  const [programInfoLoading, setProgramInfoLoading] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [guideErrors, setGuideErrors] = useState<string[]>([]);
  const [playerError, setPlayerError] = useState('');
  const [playNotice, setPlayNotice] = useState('');
  const [guideView, setGuideView] = useState<'main' | 'kids' | 'sports' | 'movies' | 'shows'>('main');
  const [guideLayout, setGuideLayout] = useState<'list' | 'grid'>('list');
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [guideDays, setGuideDays] = useState<1 | 2 | 3>(1);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTarget, setLinkTarget] = useState<MediaPlayerTarget | null>(null);
  const [guideCursor, setGuideCursor] = useState<{ row: number; time: number } | null>(null);
  const [loadProgress, setLoadProgress] = useState<{
    done: number;
    total: number;
    label: string;
    elapsed: number;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const scrolledToNow = useRef(false);
  const rowRefs = useRef<Map<number, HTMLElement>>(new Map());
  const dragRef = useRef<{ x: number; y: number; sl: number; st: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  // Fetch rich program info (EPG description or TVMaze summary) when the
  // detail popup opens. Cancelled-safe via a request token.
  useEffect(() => {
    if (!detail) {
      setProgramInfo(null);
      setProgramInfoLoading(false);
      return;
    }
    const title = detail.program.title?.trim();
    if (!title) {
      setProgramInfo(null);
      setProgramInfoLoading(false);
      return;
    }
    let cancelled = false;
    setProgramInfo(null);
    setProgramInfoLoading(true);
    fetchGuideProgramInfo(title)
      .then((info) => {
        if (!cancelled) setProgramInfo(info);
      })
      .catch(() => {
        if (!cancelled) setProgramInfo(null);
      })
      .finally(() => {
        if (!cancelled) setProgramInfoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detail]);

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

  // Track fullscreen state — native Tauri window fullscreen on desktop,
  // DOM Fullscreen API in the browser.
  useEffect(() => {
    let cancelled = false;
    void getWindowFullscreen().then((fs) => {
      if (!cancelled) setIsFullscreen(fs);
    });
    const onFs = () => {
      void getWindowFullscreen().then((fs) => {
        if (!cancelled) setIsFullscreen(fs);
      });
    };
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('resize', onFs);
    return () => {
      cancelled = true;
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('resize', onFs);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    void getWindowFullscreen().then((fs) => setWindowFullscreen(!fs));
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
    // Streams that failed the reachability audit are purged from the grid.
    const deadUrls = new Set(await fetchGuideDeadList());
    // Publish channels progressively — the grid fills in per region instead of
    // waiting for the slowest playlist+EPG pair (keeps first paint under ~10s).
    const publish = () => {
      setChannels([...merged]);
      setLoaded(true);
    };

    const attach = (
      parsed: M3UChannel[],
      regionKey: string,
      regionLabel: string,
      tz: string,
      lookup: ((channel: M3UChannel) => GuideProgram[]) | null,
    ) => {
      for (const channel of parsed) {
        if (isReligiousChannel(channel) || !isEnglishChannel(channel)) continue;
        if (deadUrls.has(channel.url)) continue;
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

    // Per-source progress: each playlist fetch and each EPG fetch counts as a
    // task so the UI can show "3/12 sources · 14s · ~45s left".
    const taskLabels: string[] = [];
    for (const r of streamRegions) {
      taskLabels.push(`${r.label} playlist`, `${r.label} schedule`);
    }
    if (ivueRegions.length > 0) taskLabels.push('iVue guide');
    if (customUrl) {
      taskLabels.push('Custom playlist');
      if (customGuide.trim()) taskLabels.push('Custom guide');
    }
    const totalTasks = Math.max(1, taskLabels.length);
    const progressStart = Date.now();
    let tasksDone = 0;
    const tickProgress = (label: string) => {
      tasksDone += 1;
      setLoadProgress({
        done: tasksDone,
        total: totalTasks,
        label,
        elapsed: Date.now() - progressStart,
      });
    };
    setLoadProgress({ done: 0, total: totalTasks, label: 'Starting…', elapsed: 0 });

    await Promise.all(
      streamRegions.map(async (region) => {
        try {
          // Channels appear as soon as the playlist lands; schedules fill in
          // when that region's EPG finishes parsing.
          const playlistText = await withDeadline(
            fetchGuideDocument(region.playlist, 'playlist'),
            `${region.label} playlist`,
          );
          tickProgress(`${region.label} playlist`);
          const parsed = parseM3U(playlistText);
          attach(parsed, region.key, region.label, region.tz, null);
          publish();
          const epg = await withDeadline(
            fetchGuideEpg(region.epg, guideDays * 24).catch(() => null),
            `${region.label} schedule`,
          ).catch(() => null);
          tickProgress(`${region.label} schedule`);
          if (epg) {
            const lookup = epgLookup(epg);
            for (const entry of merged) {
              if (entry.region === region.key) entry.schedule = lookup(entry);
            }
            publish();
          } else {
            errors.push(`${region.label}: playlist loaded, TV schedule unavailable`);
          }
        } catch (regionError) {
          tickProgress(`${region.label} (failed)`);
          errors.push(
            `${region.label}: ${regionError instanceof Error ? regionError.message : String(regionError)}`,
          );
        }
      }),
    );

    if (ivueRegions.length > 0) {
      try {
        const data = await withDeadline(fetchIvueGuide(), 'iVue guide');
        tickProgress('iVue guide');
        if (data.stale) {
          errors.push('iVue guide: showing cached schedule — refreshing in background');
        }
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
        publish();
      } catch (ivueError) {
        tickProgress('iVue guide (failed)');
        errors.push(
          `iVue Guide: ${ivueError instanceof Error ? ivueError.message : String(ivueError)}`,
        );
      }
    }

    if (customUrl) {
      try {
        const playlistText = await withDeadline(
          fetchGuideDocument(customUrl, 'playlist'),
          'Custom playlist',
        );
        tickProgress('Custom playlist');
        const parsed = parseM3U(playlistText);
        let lookup: ((channel: M3UChannel) => GuideProgram[]) | null = null;
        const guideUrl = customGuide.trim();
        if (guideUrl) {
          try {
            const guideText = await withDeadline(
              fetchGuideDocument(guideUrl, 'guide'),
              'Custom guide',
            );
            tickProgress('Custom guide');
            const programs = parseXMLTV(guideText);
            if (programs.size > 0) {
              lookup = (channel) => programs.get(channel.id) ?? [];
            } else {
              errors.push('Custom guide: XMLTV file contains no usable programme entries');
            }
          } catch (guideError) {
            tickProgress('Custom guide (failed)');
            errors.push(
              `Custom guide: ${guideError instanceof Error ? guideError.message : String(guideError)}`,
            );
          }
        }
        const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        attach(parsed, 'CUSTOM', 'Custom', localTz, lookup);
        publish();
      } catch (customError) {
        tickProgress('Custom playlist (failed)');
        errors.push(
          `Custom playlist: ${customError instanceof Error ? customError.message : String(customError)}`,
        );
      }
    }

    setGuideErrors(errors);
    setLoading(false);
    setLoadProgress(null);
  }, [enabledRegions, customPlaylist, customGuide, destroyPlayer, guideDays]);

  useEffect(() => {
    if (!loaded && !loading) void loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changing the guide horizon refetches schedules for the new window.
  const guideDaysRef = useRef(guideDays);
  useEffect(() => {
    if (guideDaysRef.current === guideDays) return;
    guideDaysRef.current = guideDays;
    scrolledToNow.current = false;
    if (loaded) void loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideDays]);

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
  const GRID_HOURS = guideDays * 24;
  const PX_PER_HOUR = guideDays > 1 ? 80 : 120;
  const GRID_LEFT_W = 240;
  const gridStart = useMemo(() => {
    const d = new Date(nowTick);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() - 1);
    return d.getTime();
  }, [nowTick]);
  const gridEnd = gridStart + GRID_HOURS * 3_600_000;
  const gridWidth = GRID_HOURS * PX_PER_HOUR;
  const nowX = ((nowTick - gridStart) / 3_600_000) * PX_PER_HOUR;

  // Centre the grid on the "now" line once channels first render.
  useEffect(() => {
    if (scrolledToNow.current || channels.length === 0) return;
    const el = gridScrollRef.current;
    if (!el) return;
    scrolledToNow.current = true;
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, GRID_LEFT_W + nowX - 280);
    });
  }, [channels.length, nowX]);

  const scrollToNow = () => {
    gridScrollRef.current?.scrollTo({
      left: Math.max(0, GRID_LEFT_W + nowX - 280),
      behavior: 'smooth',
    });
  };
  const hourTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let h = 0; h <= GRID_HOURS; h += 1) ticks.push(gridStart + h * 3_600_000);
    return ticks;
  }, [gridStart]);
  const fmtHour = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
  const fmtDay = (ts: number) =>
    new Date(ts).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

  const [probing, setProbing] = useState<string | null>(null);

  const playChannel = (channel: GuideChannel) => {
    setPlayNotice('');
    if (!channel.playable) {
      setPlayNotice(`${channel.name} is guide-only — Mad Titan/plugin channels have no stream OpenJarvis can play.`);
      return;
    }
    if (probing === channel.url) return;
    setProbing(channel.url);
    setPlayNotice(`Checking ${channel.name}…`);
    // Fetch-on-demand: probe the stream first so dead feeds report instantly
    // instead of opening a black player.
    void fetchGuideProbe(channel.url, channel.userAgent, channel.referrer)
      .then((probe) => {
        setPlayNotice('');
        if (probe.ok) {
          setPlayerError('');
          setPlaying(channel);
          destroyPlayer();
        } else {
          const geo = probe.status === 403 || probe.status === 451;
          setPlayNotice(
            geo
              ? `${channel.name}: blocked (HTTP ${probe.status}) — likely geo-restricted to another region.`
              : `${channel.name}: stream unreachable (HTTP ${probe.status || 'timeout'}) — try another channel.`,
          );
        }
      })
      .catch(() => {
        setPlayNotice('');
        setPlayerError('');
        setPlaying(channel);
        destroyPlayer();
      })
      .finally(() => setProbing(null));
  };

  // ---- D-pad / keyboard spatial navigation ---------------------------------
  // Cursor = { row: index into channelRows, time: ms timestamp }. Arrows and
  // gamepad D-pad move it; Enter/A plays the channel; I/X opens program info.

  const channelRows = useMemo(
    () =>
      gridRows.filter(
        (r): r is Extract<(typeof gridRows)[number], { kind: 'channel' }> =>
          r.kind === 'channel',
      ),
    [gridRows],
  );

  const cursorRef = useRef(guideCursor);
  useEffect(() => {
    cursorRef.current = guideCursor;
  }, [guideCursor]);

  const playChannelRef = useRef(playChannel);
  useEffect(() => {
    playChannelRef.current = playChannel;
  });

  // Seed the cursor on the first channel at "now" once the grid appears.
  useEffect(() => {
    if (guideCursor === null && channelRows.length > 0) {
      setGuideCursor({ row: 0, time: Date.now() });
    }
  }, [guideCursor, channelRows.length]);

  const moveGuideCursor = useCallback(
    (dRow: number, dMinutes: number) => {
      if (channelRows.length === 0) return;
      const cur = cursorRef.current ?? { row: 0, time: Date.now() };
      const row = Math.min(Math.max(0, cur.row + dRow), channelRows.length - 1);
      const time = Math.min(Math.max(cur.time + dMinutes * 60_000, gridStart), gridEnd);
      const next = { row, time };
      cursorRef.current = next;
      setGuideCursor(next);
      requestAnimationFrame(() => {
        rowRefs.current.get(row)?.scrollIntoView({ block: 'nearest' });
        const el = gridScrollRef.current;
        if (!el) return;
        const x = GRID_LEFT_W + ((time - gridStart) / 3_600_000) * PX_PER_HOUR;
        if (x < el.scrollLeft + GRID_LEFT_W + 60 || x > el.scrollLeft + el.clientWidth - 120) {
          el.scrollLeft = Math.max(0, x - 260);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channelRows.length, gridStart, gridEnd, guideDays],
  );

  const guideCursorChannel = useCallback(() => {
    const cur = cursorRef.current;
    if (!cur) return null;
    return channelRows[cur.row]?.channel ?? null;
  }, [channelRows]);

  const openCursorProgram = useCallback(() => {
    const cur = cursorRef.current;
    const ch = guideCursorChannel();
    if (!cur || !ch) return;
    const program = ch.schedule.find((p) => p.start <= cur.time && p.stop > cur.time);
    if (program) {
      setDetail({ channel: ch, program });
    } else {
      setPlayNotice(`${ch.name}: no schedule data at the cursor — move ◄ ► to browse.`);
    }
  }, [guideCursorChannel]);

  // Keyboard: arrows move, Enter plays, I opens program info, Esc closes info.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return;
      if (detail) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setDetail(null);
        }
        return;
      }
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveGuideCursor(-1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveGuideCursor(1, 0);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          moveGuideCursor(0, -30);
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveGuideCursor(0, 30);
          break;
        case 'Enter': {
          const ch = guideCursorChannel();
          if (ch) {
            e.preventDefault();
            playChannelRef.current(ch);
          }
          break;
        }
        case 'i':
        case 'I': {
          e.preventDefault();
          openCursorProgram();
          break;
        }
        case 'f':
        case 'F': {
          e.preventDefault();
          toggleFullscreen();
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveGuideCursor, guideCursorChannel, openCursorProgram, detail, channelRows, toggleFullscreen]);

  // Gamepad: standard mapping — D-pad/stick moves, A plays, X info, B closes.
  // Held directions auto-repeat so you can "pull" through the grid.
  useEffect(() => {
    let raf = 0;
    const prev = { up: false, down: false, left: false, right: false, a: false, x: false, b: false };
    const held = { dir: '' as '' | 'up' | 'down' | 'left' | 'right', next: 0 };
    const fire = (dir: 'up' | 'down' | 'left' | 'right') => {
      if (dir === 'up') moveGuideCursor(-1, 0);
      else if (dir === 'down') moveGuideCursor(1, 0);
      else if (dir === 'left') moveGuideCursor(0, -30);
      else moveGuideCursor(0, 30);
    };
    const poll = () => {
      const pads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() : [];
      const gp = pads ? Array.from(pads).find((p) => p && p.connected) : undefined;
      if (gp) {
        const b = (i: number) => !!gp.buttons[i]?.pressed;
        const ax = gp.axes[0] ?? 0;
        const ay = gp.axes[1] ?? 0;
        const dirs = {
          up: b(12) || ay < -0.6,
          down: b(13) || ay > 0.6,
          left: b(14) || ax < -0.6,
          right: b(15) || ax > 0.6,
        } as const;
        const now = performance.now();
        (Object.keys(dirs) as (keyof typeof dirs)[]).forEach((dir) => {
          const pressed = dirs[dir];
          const was = prev[dir];
          if (pressed && (!was || (held.dir === dir && now >= held.next))) {
            fire(dir);
            held.dir = dir;
            held.next = now + (was ? 160 : 380);
          } else if (!pressed && held.dir === dir) {
            held.dir = '';
          }
          prev[dir] = pressed;
        });
        const a = b(0);
        const x = b(2);
        const bb = b(1);
        if (a && !prev.a) {
          const ch = guideCursorChannel();
          if (ch) playChannelRef.current(ch);
        }
        if (x && !prev.x) openCursorProgram();
        if (bb && !prev.b && detail) setDetail(null);
        prev.a = a;
        prev.x = x;
        prev.b = bb;
      } else {
        (Object.keys(prev) as (keyof typeof prev)[]).forEach((k) => {
          prev[k] = false;
        });
        held.dir = '';
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveGuideCursor, guideCursorChannel, openCursorProgram, detail, channelRows]);

  // Escape closes the program detail popup.
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setDetail(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail]);

  // Map channel key → cursor row index for highlight rendering.
  const cursorRowByKey = useMemo(() => {
    const m = new Map<string, number>();
    channelRows.forEach((r, i) => m.set(channelKey(r.channel), i));
    return m;
  }, [channelRows]);

  // Voice commands: "Jarvis play channel <name>" / "tune to <name>".
  const pendingVoiceChannel = useRef<string | null>(null);
  useEffect(() => {
    const findMatch = (name: string) => {
      const n = name.toLowerCase();
      return channels.find((c) => c.name.toLowerCase().includes(n))
        ?? channels.find((c) => n.includes(c.name.toLowerCase()));
    };
    const onPlay = (e: Event) => {
      const name = (e as CustomEvent<{ name?: string }>).detail?.name?.trim();
      if (!name) return;
      setQuery(name);
      const match = findMatch(name);
      if (match) {
        pendingVoiceChannel.current = null;
        playChannel(match);
      } else {
        pendingVoiceChannel.current = name;
        setPlayNotice(`Looking for "${name}" — loading channels…`);
        if (!loaded) void loadChannels();
      }
    };
    window.addEventListener('jarvis:guide-play', onPlay);
    return () => window.removeEventListener('jarvis:guide-play', onPlay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, loaded]);

  // Once channels finish loading, play the pending voice-requested channel.
  useEffect(() => {
    const pending = pendingVoiceChannel.current;
    if (!pending || channels.length === 0) return;
    const n = pending.toLowerCase();
    const match = channels.find((c) => c.name.toLowerCase().includes(n))
      ?? channels.find((c) => n.includes(c.name.toLowerCase()));
    if (match) {
      pendingVoiceChannel.current = null;
      setPlayNotice('');
      playChannel(match);
    } else if (loaded) {
      pendingVoiceChannel.current = null;
      setPlayNotice(`No channel matching "${pending}" found — check the spelling or region.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, loaded]);

  // Attach the stream once the <video> element exists (it mounts with `playing`).
  useEffect(() => {
    const video = videoRef.current;
    const channel = playing;
    if (!video || !channel || !channel.playable) return;
    setPlayerError('');
    // Streams play through the local proxy so playlist-required headers are
    // applied server-side and header-restricted feeds actually work.
    const streamParams = new URLSearchParams({ url: channel.url });
    if (channel.userAgent) streamParams.set('ua', channel.userAgent);
    if (channel.referrer) streamParams.set('ref', channel.referrer);
    const url = `${getBase()}/v1/guide/stream?${streamParams}`;
    const isHls = /\.m3u8($|\?)/i.test(channel.url) || channel.url.includes('/playlist.m3u8');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const stopPlayback = () => {
    destroyPlayer();
    setPlaying(null);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {/* Single control row — everything else lives in the bottom dock */}
      <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-0.5">
        <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: '1px solid var(--color-border)' }}>
          {(['main', 'kids', 'sports', 'movies', 'shows'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setGuideView(view)}
              className="px-3 py-1.5 text-xs cursor-pointer capitalize"
              style={{
                background: guideView === view ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                color: guideView === view ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {view === 'main' ? 'Guide' : view === 'kids' ? 'Kids' : view === 'sports' ? 'Sports' : view === 'movies' ? 'Movies' : 'TV Shows'}
            </button>
          ))}
        </div>

        {/* Layout: iVue-style channel list (default) or EPG timeline grid —
            hidden on the Movies / TV Shows catalog views */}
        {guideView !== 'shows' && guideView !== 'movies' && (
        <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: '1px solid var(--color-border)' }}>
          {(['list', 'grid'] as const).map((layout) => (
            <button
              key={layout}
              onClick={() => setGuideLayout(layout)}
              className="px-3 py-1.5 text-xs cursor-pointer capitalize"
              style={{
                background: guideLayout === layout ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                color: guideLayout === layout ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {layout === 'list' ? 'Channels' : 'Timeline'}
            </button>
          ))}
        </div>
        )}

        {/* Sources dropdown — custom playlist + XMLTV guide */}
        <details className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <summary
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer list-none select-none"
            style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            title="Custom playlist / guide URLs"
          >
            <SlidersHorizontal size={12} /> Sources
          </summary>
          <div
            className="absolute left-0 top-full mt-1 z-30 w-80 rounded-xl p-3 flex flex-col gap-2"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
          >
            <label className="space-y-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
              Custom playlist URL (M3U/M3U8)
              <input
                value={customPlaylist}
                onChange={(e) => setCustomPlaylist(e.target.value)}
                placeholder="https://…/channels.m3u8"
                className="h-8 w-full rounded-lg bg-transparent px-2.5 text-xs outline-none"
                style={inputStyle}
              />
            </label>
            <label className="space-y-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
              Custom XMLTV guide URL
              <input
                value={customGuide}
                onChange={(e) => setCustomGuide(e.target.value)}
                placeholder="https://…/guide.xml"
                className="h-8 w-full rounded-lg bg-transparent px-2.5 text-xs outline-none"
                style={inputStyle}
              />
            </label>
            <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Applied on next channel load. Leave empty to use regional sources only.
            </p>
          </div>
        </details>

        <button
          onClick={scrollToNow}
          className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0"
          style={{ background: 'var(--color-bg-secondary)', color: NOW_COLOR, border: `1px solid ${NOW_COLOR}55` }}
          title="Jump the timeline back to the current time"
        >
          ● Now
        </button>
        <select
          value={guideDays}
          onChange={(e) => setGuideDays(Number(e.target.value) as 1 | 2 | 3)}
          className="h-8 rounded-lg px-2 text-xs shrink-0 cursor-pointer"
          style={inputStyle}
          title="How many days of schedule to fetch and display"
        >
          <option value={1}>1 day</option>
          <option value={2}>2 days</option>
          <option value={3}>3 days</option>
        </select>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="h-8 rounded-lg px-2 text-xs shrink-0 cursor-pointer"
          style={inputStyle}
          title="Filter grid to one region"
        >
          <option value="ALL">All regions</option>
          {REGION_PRESETS.filter((r) => enabledRegions.has(r.key)).map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
          {customPlaylist.trim() && <option value="CUSTOM">Custom</option>}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter channels…"
          className="h-8 w-36 rounded-lg bg-transparent px-3 text-xs outline-none shrink-0"
          style={inputStyle}
        />
        <button
          onClick={() => void loadChannels()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
          title={loaded ? 'Reload all guide sources' : 'Load guide channels'}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          {loaded ? 'Reload' : 'Load'}
        </button>
        <button
          onClick={toggleFullscreen}
          className="px-2.5 py-1.5 rounded-lg text-xs cursor-pointer shrink-0"
          style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          title={isFullscreen ? 'Exit fullscreen (Esc or F)' : 'Fullscreen guide (F)'}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        {channels.length > 0 && (
          <span className="text-xs ml-auto shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
            {visibleChannels.length} of {channels.length} channels
          </span>
        )}
      </div>

      {error && <ErrorNote message={error} />}
      {playNotice && (
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{playNotice}</div>
      )}
      {guideErrors.map((message) => (
        <div key={message} className="text-xs" style={{ color: 'var(--color-warning)' }}>
          {message}
        </div>
      ))}
      {loading && loadProgress && (() => {
        const pct = Math.min(100, Math.round((loadProgress.done / loadProgress.total) * 100));
        const elapsedS = Math.floor(loadProgress.elapsed / 1000);
        const etaS =
          loadProgress.done > 0
            ? Math.max(0, Math.round((loadProgress.elapsed / loadProgress.done) * (loadProgress.total - loadProgress.done) / 1000))
            : null;
        return (
          <div className="rounded-xl px-4 py-3" style={panelStyle}>
            <div className="flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              <Loader2 size={13} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                Loading guide sources…
              </span>
              <span className="ml-auto font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                {loadProgress.done}/{loadProgress.total} · {elapsedS}s
                {etaS !== null ? ` · ~${etaS}s left` : ''}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: 'var(--color-accent)' }}
              />
            </div>
            <div className="text-[11px] mt-1.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>
              {loadProgress.label} — channels already loaded stay visible while the rest finish.
            </div>
          </div>
        );
      })()}

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

      {/* TV Shows view — tonight's episodes as guide cards */}
      {guideView === 'shows' && (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl p-3" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
          <TvGuideTab />
        </div>
      )}

      {/* Movies view — the VOD movie catalog inside the guide */}
      {guideView === 'movies' && (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl p-3" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
          <CatalogTab type="movie" />
        </div>
      )}

      {/* iVue-style channel list — logo, timezone, now/next, synopses */}
      {channels.length > 0 && guideLayout === 'list' && guideView !== 'shows' && guideView !== 'movies' && (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl p-1.5 flex flex-col gap-1.5" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
          {gridRows.map((row) => {
            if (row.kind === 'header') {
              return (
                <div
                  key={`list-header-${row.label}`}
                  className="flex items-center gap-2 px-2 pt-3 pb-1"
                  style={{ borderTop: '1px solid var(--color-border)' }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-accent)' }}>
                    {row.label}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {row.count} channel{row.count === 1 ? '' : 's'}
                  </span>
                </div>
              );
            }
            const { channel } = row;
            const chKey = channelKey(channel);
            const isPlaying = playing?.url === channel.url;
            const current = channel.schedule.find((p) => p.start <= nowTick && p.stop > nowTick);
            const upcoming = channel.schedule
              .filter((p) => p.start > nowTick)
              .sort((a, b) => a.start - b.start)
              .slice(0, 3);
            const expanded = expandedChannels.has(chKey);
            const tz = channel.tz || undefined;
            const tzLabel = tzAbbrev(tz, nowTick);
            const progPct = current
              ? Math.min(100, Math.max(0, ((nowTick - current.start) / (current.stop - current.start)) * 100))
              : 0;
            return (
              <div
                key={chKey}
                className="rounded-xl px-2.5 py-2"
                style={{
                  background: isPlaying ? 'var(--color-accent-subtle)' : 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {/* Channel header — logo, name, timezone, play */}
                <div className="flex items-center gap-2">
                  {channel.logo ? (
                    <img src={channel.logo} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" style={{ background: '#000' }} loading="lazy" />
                  ) : (
                    <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: 'var(--color-bg-tertiary)' }}>
                      <Tv size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text)' }}>{channel.name}</span>
                      {tzLabel && (
                        <span
                          className="text-[9px] font-bold px-1 py-px rounded shrink-0"
                          style={{ background: 'var(--color-bg-tertiary)', color: NOW_COLOR }}
                          title={`Channel timezone: ${channel.tz}`}
                        >
                          {tzLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                      {channel.regionLabel}{channel.group && channel.group !== channel.regionLabel ? ` · ${channel.group}` : ''}
                    </div>
                  </div>
                  {channel.playable && (
                    <button
                      onClick={() => playChannel(channel)}
                      className="p-1.5 rounded-lg cursor-pointer shrink-0"
                      style={{ color: isPlaying ? 'var(--color-accent)' : 'var(--color-text-tertiary)', border: '1px solid var(--color-border)' }}
                      title={`Play ${channel.name}`}
                    >
                      <Play size={12} />
                    </button>
                  )}
                  {channel.schedule.length > 0 && (
                    <button
                      onClick={() =>
                        setExpandedChannels((prev) => {
                          const next = new Set(prev);
                          if (next.has(chKey)) next.delete(chKey);
                          else next.add(chKey);
                          return next;
                        })
                      }
                      className="p-1.5 rounded-lg cursor-pointer shrink-0"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      title={expanded ? 'Hide schedule' : 'Show full schedule'}
                    >
                      {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  )}
                </div>

                {/* Now playing — title, channel-tz times, progress */}
                <div className="mt-2">
                  {current ? (
                    <button
                      onClick={() => setDetail({ channel, program: current })}
                      className="w-full text-left rounded-lg px-2.5 py-2 cursor-pointer"
                      style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest shrink-0" style={{ color: NOW_COLOR }}>Now</span>
                        <span className="text-[12px] font-medium truncate flex-1" style={{ color: 'var(--color-text)' }}>
                          {current.title || '—'}
                        </span>
                        <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                          {fmtChannelTime(tz, current.start)}–{fmtChannelTime(tz, current.stop)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
                        <div className="h-full rounded-full" style={{ width: `${progPct}%`, background: NOW_COLOR }} />
                      </div>
                      {current.desc && (
                        <p className="text-[10px] mt-1.5 line-clamp-2 leading-snug" style={{ color: 'var(--color-text-tertiary)' }}>
                          {current.desc}
                        </p>
                      )}
                    </button>
                  ) : (
                    <div className="px-2.5 py-2 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      {channel.schedule.length > 0 ? 'Nothing on right now in this window.' : 'No schedule data.'}
                    </div>
                  )}
                </div>

                {/* Up next — clickable programme chips */}
                {upcoming.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {upcoming.map((p) => (
                      <button
                        key={`${p.start}-${p.title}`}
                        onClick={() => setDetail({ channel, program: p })}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] cursor-pointer max-w-full"
                        style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                        title={p.desc || p.title}
                      >
                        <span className="font-mono shrink-0" style={{ color: NOW_COLOR }}>
                          {fmtChannelTime(tz, p.start)}
                        </span>
                        <span className="truncate">{p.title || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Expanded full schedule */}
                {expanded && channel.schedule.length > 0 && (
                  <div className="mt-2 pt-2 flex flex-col gap-1" style={{ borderTop: '1px solid var(--color-border)' }}>
                    {channel.schedule
                      .filter((p) => p.stop > gridStart && p.start < gridEnd)
                      .map((p) => {
                        const isCurrent = p.start <= nowTick && p.stop > nowTick;
                        return (
                          <button
                            key={`${p.start}-${p.stop}-${p.title}`}
                            onClick={() => setDetail({ channel, program: p })}
                            className="flex items-start gap-2 px-2 py-1.5 rounded-lg text-left cursor-pointer"
                            style={{ background: isCurrent ? 'var(--color-accent-subtle)' : 'transparent' }}
                          >
                            <span className="text-[10px] font-mono w-24 shrink-0 pt-px" style={{ color: isCurrent ? NOW_COLOR : 'var(--color-text-tertiary)' }}>
                              {fmtChannelTime(tz, p.start)}–{fmtChannelTime(tz, p.stop)}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-[11px] font-medium truncate" style={{ color: 'var(--color-text)' }}>
                                {p.title || '—'}{isCurrent ? '  ●' : ''}
                              </span>
                              {p.desc && (
                                <span className="block text-[10px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                                  {p.desc}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
          {visibleChannels.length === 0 && (
            <div className="px-3 py-6 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              {loading ? 'Loading…' : 'No channels match the current filters.'}
            </div>
          )}
        </div>
      )}

      {channels.length > 0 && guideLayout === 'grid' && guideView !== 'shows' && guideView !== 'movies' && (
        <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden" style={panelStyle}>
          <div
            ref={gridScrollRef}
            className="overflow-auto flex-1 min-h-0"
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => {
              if (e.pointerType !== 'mouse' || e.button !== 0) return;
              const el = e.currentTarget;
              dragRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, moved: false };
              el.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (!d) return;
              const dx = e.clientX - d.x;
              const dy = e.clientY - d.y;
              if (!d.moved && Math.hypot(dx, dy) > 6) {
                d.moved = true;
                suppressClickRef.current = true;
                e.currentTarget.style.cursor = 'grabbing';
              }
              if (d.moved) {
                e.currentTarget.scrollLeft = d.sl - dx;
                e.currentTarget.scrollTop = d.st - dy;
              }
            }}
            onPointerUp={(e) => {
              dragRef.current = null;
              e.currentTarget.style.cursor = 'grab';
              // Keep suppression alive through the click that follows pointerup.
              setTimeout(() => {
                suppressClickRef.current = false;
              }, 0);
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
            onClickCapture={(e) => {
              if (suppressClickRef.current) {
                e.preventDefault();
                e.stopPropagation();
                suppressClickRef.current = false;
              }
            }}
          >
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
                const chKey = channelKey(channel);
                const cursorIdx = cursorRowByKey.get(chKey);
                const isCursorRow =
                  guideCursor !== null && cursorIdx !== undefined && cursorIdx === guideCursor.row;
                return (
                  <div
                    key={chKey}
                    ref={(el) => {
                      if (el && cursorIdx !== undefined) rowRefs.current.set(cursorIdx, el);
                    }}
                    className="flex"
                    style={{
                      borderTop: '1px solid var(--color-border)',
                      background: isPlaying ? 'var(--color-accent-subtle)' : rowIndex % 2 ? 'var(--color-bg-secondary)' : 'transparent',
                      outline: isCursorRow ? '1.5px solid var(--color-accent)' : '1.5px solid transparent',
                      outlineOffset: '-1.5px',
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
                      <span
                        className="w-6 text-center text-[11px] font-mono shrink-0"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        {rowIndex + 1}
                      </span>
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
                        const isCursorCell =
                          isCursorRow &&
                          guideCursor !== null &&
                          program.start <= guideCursor.time &&
                          program.stop > guideCursor.time;
                        return (
                          <button
                            key={`${program.start}-${pIndex}`}
                            onClick={() => setDetail({ channel, program })}
                            onDoubleClick={() => {
                              setDetail(null);
                              playChannel(channel);
                            }}
                            className="absolute top-1 bottom-1 rounded-md px-2 text-left overflow-hidden cursor-pointer transition-opacity hover:opacity-80"
                            style={{
                              left,
                              width,
                              boxShadow: isCursorCell ? '0 0 0 2px var(--color-accent)' : undefined,
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
                            title={`${channel.name} — ${program.title || '—'}\n${new Date(program.start).toLocaleString()} – ${new Date(program.stop).toLocaleString()}\nClick = program info · Double-click = play · drag to pan`}
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

              {/* D-pad cursor time line */}
              {guideCursor !== null && (() => {
                const cursorX =
                  GRID_LEFT_W + ((guideCursor.time - gridStart) / 3_600_000) * PX_PER_HOUR;
                if (cursorX < GRID_LEFT_W || cursorX > GRID_LEFT_W + gridWidth) return null;
                return (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-[9]"
                    style={{ left: cursorX - 1, width: 2, background: 'var(--color-accent)', opacity: 0.55 }}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Bottom dock — region picks, custom sources, link player, shortcuts */}
      <div className="shrink-0 rounded-xl px-3 py-2.5 flex flex-col gap-2" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest mr-1" style={{ color: 'var(--color-text-tertiary)' }}>Regions</span>
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
                  background: active ? 'var(--color-accent-subtle)' : 'var(--color-bg-tertiary)',
                  color: active ? 'var(--color-text)' : 'var(--color-text-tertiary)',
                  border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}
              >
                {region.label}
              </button>
            );
          })}
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
            placeholder="Play any video link — YouTube, MP4, WebM or M3U8 stream"
            className="h-8 flex-1 min-w-[14rem] rounded-lg bg-transparent px-3 text-xs outline-none"
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
            style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
          >
            <Play size={12} />
            Play in Jarvis
          </button>
        </div>
        <p className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
          <Gamepad2 size={10} />
          <span>Click a show = info · Double-click = play · drag to pan · ↑↓ channels · ←→ ±30 min · Enter play · Esc close</span>
          <span className="ml-auto">Links play in-app; DRM sites can't embed.</span>
        </p>
      </div>

      {/* Program detail popup — iVue-style: click a programme for info + play */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setDetail(null)}
        >
          <div
            className="rounded-2xl w-full max-w-md p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {programInfo?.image && (
              <img
                src={programInfo.image}
                alt=""
                className="w-full h-28 object-cover rounded-xl mb-3"
                style={{ background: 'var(--color-bg-tertiary)' }}
              />
            )}
            <div className="flex items-start gap-3">
              {detail.channel.logo ? (
                <img src={detail.channel.logo} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" style={{ background: '#000' }} />
              ) : (
                <span className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-bg-tertiary)' }}>
                  <Tv size={20} style={{ color: 'var(--color-text-tertiary)' }} />
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{detail.channel.name}</div>
                <div className="text-[11px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                  {detail.channel.regionLabel} · {detail.channel.group}
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="text-xs cursor-pointer px-2 py-1 rounded" style={{ color: 'var(--color-text-tertiary)' }}>✕</button>
            </div>
            <div className="mt-4 rounded-xl p-3" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: NOW_COLOR }}>Now / Next</div>
              <div className="text-sm font-medium mt-1" style={{ color: 'var(--color-text)' }}>
                {detail.program.title || '—'}
                {programInfo?.sub_title ? (
                  <span className="font-normal" style={{ color: 'var(--color-text-secondary)' }}> — {programInfo.sub_title}</span>
                ) : null}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                {new Date(detail.program.start).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                {' – '}
                {new Date(detail.program.stop).toLocaleString([], { hour: 'numeric', minute: '2-digit' })}
                {` · ${Math.max(1, Math.round((detail.program.stop - detail.program.start) / 60000))} min`}
              </div>
            </div>

            {/* Synopsis — straight from the EPG/iVue scrape when present */}
            {detail.program.desc && (
              <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {detail.program.desc}
              </p>
            )}

            {/* Rich program info: EPG description or TVMaze summary */}
            <div className="mt-3">
              {programInfoLoading ? (
                <div className="text-[11px] py-2" style={{ color: 'var(--color-text-tertiary)' }}>Loading program info…</div>
              ) : programInfo && (programInfo.description || programInfo.genres.length > 0 || programInfo.category) ? (
                <div className="rounded-xl p-3" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  {programInfo.description && (
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      {programInfo.description}
                    </p>
                  )}
                  {(programInfo.category || programInfo.genres.length > 0 || programInfo.rating != null || programInfo.premiered || programInfo.network) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {programInfo.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>{programInfo.category}</span>
                      )}
                      {programInfo.genres.map((g) => (
                        <span key={g} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>{g}</span>
                      ))}
                      {programInfo.rating != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,193,7,0.15)', color: '#ffc107' }}>★ {programInfo.rating.toFixed(1)}</span>
                      )}
                      {programInfo.premiered && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>{programInfo.premiered}</span>
                      )}
                      {programInfo.network && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>{programInfo.network}</span>
                      )}
                    </div>
                  )}
                </div>
              ) : !programInfoLoading && !detail.program.desc ? (
                <div className="text-[11px] py-1" style={{ color: 'var(--color-text-tertiary)' }}>No description available for this program.</div>
              ) : null}
            </div>

            {/* Up next on this channel */}
            {(() => {
              const next = detail.channel.schedule
                .filter((p) => p.start >= detail.program.stop)
                .sort((a, b) => a.start - b.start)[0];
              if (!next) return null;
              return (
                <div className="mt-3 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  <span className="font-semibold uppercase tracking-widest text-[9px]" style={{ color: NOW_COLOR }}>Up next · </span>
                  {new Date(next.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} — {next.title || '—'}
                </div>
              );
            })()}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { playChannel(detail.channel); setDetail(null); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
                style={{ background: NOW_COLOR, color: '#062a33' }}
              >
                <Play size={14} /> {detail.channel.playable ? 'Watch live' : 'Guide only'}
              </button>
            </div>
            {!detail.channel.playable && (
              <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                This channel has schedule data but no stream OpenJarvis can play.
              </p>
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
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('guide');

  // Voice commands: "Jarvis open the guide / movies / shows / local / links".
  useEffect(() => {
    const onTab = (e: Event) => {
      const next = (e as CustomEvent<{ tab?: Tab }>).detail?.tab;
      if (next) setTab(next);
    };
    window.addEventListener('jarvis:media-tab', onTab);
    return () => window.removeEventListener('jarvis:media-tab', onTab);
  }, []);

  const isGuide = tab === 'guide';
  return (
    <div className={isGuide ? 'flex-1 flex flex-col overflow-hidden' : 'flex-1 flex flex-col overflow-hidden px-6 py-10'}>
      <div className={isGuide ? 'flex-1 flex flex-col min-h-0 w-full' : 'max-w-6xl mx-auto w-full flex flex-col flex-1 overflow-hidden'}>
        <header className="mb-5 shrink-0 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Media</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              TV guide, movie &amp; show catalog, local media library, and your own links.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            title="Close — back to chat"
            aria-label="Close media"
            className="p-2 rounded-lg cursor-pointer shrink-0"
            style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
          >
            <X size={16} />
          </button>
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

        {isGuide ? (
          <div className="flex-1 flex flex-col min-h-0">
            <IptvTab />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 pb-4">
            {tab === 'movies' && <CatalogTab type="movie" />}
            {tab === 'shows' && <CatalogTab type="series" />}
            {tab === 'local' && <LocalTab />}
            {tab === 'links' && <LinksTab />}
          </div>
        )}
      </div>
    </div>
  );
}
