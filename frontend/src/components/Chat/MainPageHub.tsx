import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Baby,
  Bitcoin,
  BrainCircuit,
  LineChart,
  Wallet,
  Code2,
  Download,
  Disc,
  ExternalLink,
  Gamepad2,
  Loader2,
  Mic,
  MessageCircle,
  Monitor,
  Phone,
  Play,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings,
  Square,
  ShoppingBag,
  Tv,
  Users,
  Video,
  Music2,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { isTauri, launchApp, fetchGuideDocument, launchGame, mcServer } from '../../lib/api';
import { getPlayniteLibrary, launchPlayniteGame, type PlayniteGame } from '../../lib/playnite';
import { getSteamLibrary, launchSteamGame, type SteamLibrary } from '../../lib/steam';
import { MediaPlayerModal, type MediaPlayerTarget } from '../MediaPlayerModal';
import { parseM3U, parseXMLTV, type GuideProgram, type M3UChannel } from '../../lib/media-guide';
import { useAppStore } from '../../lib/store';
import { useMusicStore } from '../../lib/music';
import { MUSIC_APPS } from '../../lib/music-commands';
import { Links, useEnabledMusicApps } from '../PageDetails';
import { getCloudKeyStatus, fetchNativeApps } from '../../lib/api';
import { openVSCode } from '../../lib/developer';
import { openHubService } from '../../lib/hub-voice';
import {
  gameLaunchers,
  openGameLauncher,
  type GameLauncherId,
} from '../../lib/game-launchers';

type HubSection = 'kids' | 'crypto' | 'games' | 'social' | 'music' | 'browsers' | 'media' | 'record' | 'remote' | 'stores' | 'ai' | 'developer';
type GameSource = 'steam' | 'playnite';

interface HubService {
  id: string;
  name: string;
  url: string;
  color: string;
  description: string;
  icon: typeof Tv;
}

const browserApps: HubService[] = [
  { id: 'browser-chrome', name: 'Google Chrome', url: 'https://www.google.com/chrome/', color: '#4285f4', description: 'Fast, widely supported browser.', icon: Globe },
  { id: 'browser-edge', name: 'Microsoft Edge', url: 'https://www.microsoft.com/edge/', color: '#0f7bd8', description: 'Built-in Windows browser.', icon: Globe },
  { id: 'browser-firefox', name: 'Firefox', url: 'https://www.mozilla.org/firefox/', color: '#ff7139', description: 'Privacy-focused open-source browser.', icon: Globe },
  { id: 'browser-brave', name: 'Brave', url: 'https://brave.com/', color: '#fb542b', description: 'Browser with built-in ad and tracker blocking.', icon: Globe },
  { id: 'browser-opera', name: 'Opera', url: 'https://www.opera.com/', color: '#ff1b2d', description: 'Browser with a built-in sidebar and VPN.', icon: Globe },
  { id: 'browser-vivaldi', name: 'Vivaldi', url: 'https://vivaldi.com/', color: '#ef3939', description: 'Highly customizable browser.', icon: Globe },
  { id: 'browser-tor', name: 'Tor Browser', url: 'https://www.torproject.org/', color: '#7d4698', description: 'Privacy browser that routes traffic through Tor.', icon: Globe },
];

const socialApps: HubService[] = [
  { id: 'discord', name: 'Discord', url: 'https://discord.com/app', color: '#5865f2', description: 'Communities, servers, and direct messages.', icon: MessageCircle },
  { id: 'telegram', name: 'Telegram', url: 'https://web.telegram.org/', color: '#229ed9', description: 'Chats and channels.', icon: Send },
  { id: 'whatsapp', name: 'WhatsApp', url: 'https://web.whatsapp.com/', color: '#25d366', description: 'Messages and calls.', icon: Phone },
  { id: 'slack', name: 'Slack', url: 'https://slack.com/signin', color: '#611f69', description: 'Team channels and workspaces.', icon: Users },
  { id: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/', color: '#0866ff', description: 'Friends, groups, and updates.', icon: Users },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/', color: '#d62976', description: 'Photos, reels, and stories.', icon: MessageCircle },
  { id: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com/', color: '#fe2c55', description: 'Short videos, creators, and live streams.', icon: Play },
];

const mediaApps: HubService[] = [
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/', color: '#ff0033', description: 'Video search and viewing.', icon: Play },
  { id: 'twitch', name: 'Twitch', url: 'https://www.twitch.tv/', color: '#9146ff', description: 'Live streams, channels, and VODs.', icon: Play },
  { id: 'plex', name: 'Plex', url: 'https://app.plex.tv/desktop/', color: '#e5a00d', description: 'Your Plex media server and watch library.', icon: Tv },
  { id: 'netflix', name: 'Netflix', url: 'https://www.netflix.com/', color: '#e50914', description: 'Movies and series.', icon: Tv },
  { id: 'prime-video', name: 'Prime Video', url: 'https://www.primevideo.com/', color: '#00a8e1', description: 'Movies and series.', icon: Tv },
  { id: 'crave', name: 'Crave', url: 'https://www.crave.ca/', color: '#ed1c24', description: 'Stream TV series, movies, and originals with a Crave account.', icon: Tv },
  { id: 'crunchyroll', name: 'Crunchyroll', url: 'https://www.crunchyroll.com/', color: '#f47521', description: 'Anime streaming and simulcasts.', icon: Tv },
  { id: 'disney-plus', name: 'Disney+', url: 'https://www.disneyplus.com/', color: '#113ccf', description: 'Movies and series.', icon: Tv },
  { id: 'max', name: 'Max', url: 'https://www.max.com/', color: '#5b2bdb', description: 'Movies and series.', icon: Tv },
  { id: 'hulu', name: 'Hulu', url: 'https://www.hulu.com/', color: '#1ce783', description: 'TV and movies.', icon: Tv },
  { id: 'paramount-plus', name: 'Paramount+', url: 'https://www.paramountplus.com/', color: '#0064ff', description: 'TV and movies.', icon: Tv },
  { id: 'peacock', name: 'Peacock', url: 'https://www.peacocktv.com/', color: '#111827', description: 'TV and movies.', icon: Tv },
  { id: 'vlc', name: 'VLC', url: 'https://www.videolan.org/vlc/', color: '#ff8800', description: 'Local media and authorized TV streams.', icon: Play },
  { id: 'tv-guide', name: 'TV Guide', url: 'https://www.xmltv.org/', color: '#22d3ee', description: 'Combine your own M3U/M3U8 playlist with XMLTV schedule data.', icon: Tv },
];

const storeApps: HubService[] = [
  { id: 'gg-deals', name: 'GG.deals', url: 'https://gg.deals/', color: '#f97316', description: 'Compare game prices and deals.', icon: ShoppingBag },
  { id: 'steam-store', name: 'Steam Store', url: 'https://store.steampowered.com/', color: '#1b2838', description: 'Browse Steam games and offers.', icon: Gamepad2 },
  { id: 'epic-store', name: 'Epic Games Store', url: 'https://store.epicgames.com/', color: '#303030', description: 'Browse Epic games and offers.', icon: ShoppingBag },
  { id: 'gog-store', name: 'GOG', url: 'https://www.gog.com/', color: '#86328a', description: 'Browse DRM-free games and offers.', icon: ShoppingBag },
  { id: 'humble-store', name: 'Humble Bundle', url: 'https://www.humblebundle.com/store', color: '#cc4e00', description: 'Browse bundles and game offers.', icon: ShoppingBag },
  { id: 'itch-store', name: 'itch.io', url: 'https://itch.io/', color: '#fa5c5c', description: 'Discover indie games.', icon: ShoppingBag },
  { id: 'xbox-store', name: 'Xbox Store', url: 'https://www.xbox.com/games/store', color: '#107c10', description: 'Browse Xbox games and offers.', icon: ShoppingBag },
  { id: 'playstation-store', name: 'PlayStation Store', url: 'https://store.playstation.com/', color: '#003791', description: 'Browse PlayStation games and offers.', icon: ShoppingBag },
];

const aiApps = [
  { id: 'openai', name: 'OpenAI', key: 'OPENAI_API_KEY', url: 'https://platform.openai.com/api-keys', color: '#10a37f' },
  { id: 'anthropic', name: 'Anthropic', key: 'ANTHROPIC_API_KEY', url: 'https://console.anthropic.com/settings/keys', color: '#d97757' },
  { id: 'google', name: 'Google AI Studio', key: 'GEMINI_API_KEY', url: 'https://aistudio.google.com/app/apikey', color: '#4285f4' },
  { id: 'openrouter', name: 'OpenRouter', key: 'OPENROUTER_API_KEY', url: 'https://openrouter.ai/keys', color: '#7c3aed' },
  { id: 'atlascloud', name: 'Atlas Cloud', key: 'ATLASCLOUD_API_KEY', url: 'https://cloud.atlascloud.ai/', color: '#0ea5e9' },
];

const aiTools: HubService[] = [
  { id: 'base44', name: 'Base44', url: 'https://base44.com/', color: '#635bff', description: 'AI app-building platform. Sign in with Base44 to use its hosted tools.', icon: BrainCircuit },
  { id: 'microsoft-copilot', name: 'Microsoft Copilot', url: 'https://copilot.microsoft.com/', color: '#4f6bed', description: 'Microsoft Copilot web app. Uses its own Microsoft sign-in and subscription.', icon: BrainCircuit },
];

const streamingDestinations: HubService[] = [
  { id: 'live-twitch', name: 'Twitch Creator Dashboard', url: 'https://dashboard.twitch.tv/', color: '#9146ff', description: 'Manage your channel and start a live stream.', icon: Radio },
  { id: 'live-youtube', name: 'YouTube Live', url: 'https://studio.youtube.com/', color: '#ff0033', description: 'Create and manage YouTube live streams.', icon: Radio },
  { id: 'live-kick', name: 'Kick Creator Dashboard', url: 'https://kick.com/creator/dashboard', color: '#53fc18', description: 'Open Kick creator tools and streaming dashboard.', icon: Radio },
  { id: 'live-tiktok', name: 'TikTok LIVE Center', url: 'https://livecenter.tiktok.com/', color: '#fe2c55', description: 'Open TikTok LIVE tools; account eligibility may apply.', icon: Radio },
  { id: 'live-facebook', name: 'Facebook Live Producer', url: 'https://www.facebook.com/live/producer/', color: '#0866ff', description: 'Set up a Facebook Live broadcast.', icon: Radio },
  { id: 'live-rumble', name: 'Rumble Studio', url: 'https://rumble.com/studio', color: '#85c742', description: 'Open Rumble Studio to configure your own live broadcast.', icon: Radio },
  { id: 'live-steam', name: 'Steam Broadcast', url: 'https://steamcommunity.com/broadcast/upload/', color: '#1b2838', description: 'Open Steam Community broadcast settings for gameplay.', icon: Radio },
];

const streamingTools: HubService[] = [
  { id: 'obs-studio', name: 'OBS Studio', url: 'https://obsproject.com/', color: '#302e32', description: 'Free, open-source recording and live-streaming software.', icon: Video },
  { id: 'prism-live-studio', name: 'PRISM Live Studio', url: 'https://prismlive.com/en_us/', color: '#6c59ff', description: 'Streaming and live-production software; sign in and configure it with the provider.', icon: Video },
  { id: 'streamlabs', name: 'Streamlabs', url: 'https://streamlabs.com/', color: '#80f5d2', description: 'Streaming software and creator tools.', icon: Video },
  { id: 'streamyard', name: 'StreamYard', url: 'https://streamyard.com/', color: '#1768ff', description: 'Browser-based live production; sign in and choose your destinations.', icon: Video },
  { id: 'prism-launcher', name: 'Prism Launcher', url: 'https://prismlauncher.org/', color: '#5d8db8', description: 'Minecraft instance launcher (not the same as PRISM Live Studio).', icon: Gamepad2 },
];

const remoteApps: HubService[] = [
  { id: 'steam-link', name: 'Steam Link', url: 'https://store.steampowered.com/steamlink/about/', color: '#1b2838', description: 'Stream your own Steam games to another supported device.', icon: Gamepad2 },
  { id: 'chrome-remote-desktop', name: 'Chrome Remote Desktop', url: 'https://remotedesktop.google.com/access/', color: '#4285f4', description: 'Access your own computers after installing and configuring Chrome Remote Desktop.', icon: Monitor },
  { id: 'anydesk', name: 'AnyDesk', url: 'https://anydesk.com/en', color: '#ef443b', description: 'Remote desktop software; install it on devices you own or are authorized to access.', icon: Monitor },
  { id: 'teamviewer', name: 'TeamViewer', url: 'https://www.teamviewer.com/en/', color: '#0e8ee7', description: 'Remote access and support; use only with the device owner’s permission.', icon: Monitor },
  { id: 'rustdesk', name: 'RustDesk', url: 'https://rustdesk.com/', color: '#2a85ff', description: 'Open-source remote desktop; configure your own clients or server.', icon: Monitor },
  { id: 'parsec', name: 'Parsec', url: 'https://parsec.app/', color: '#8f4bff', description: 'Low-latency remote desktop and game streaming for devices you control.', icon: Gamepad2 },
];

function appArtwork(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 300"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${color}" stop-opacity=".8"/><stop offset="1" stop-color="#10131a"/></linearGradient><radialGradient id="r"><stop stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="960" height="300" fill="url(#g)"/><circle cx="760" cy="90" r="220" fill="url(#r)"/><path d="M0 245 290 90l185 125 205-150 280 150v85H0z" fill="#080b12" fill-opacity=".26"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

async function openExternal(url: string) {
  await launchApp(url);
}

function ActionButton({
  children,
  active = false,
  onClick,
  title,
}: {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        background: active ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)',
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
      }}
    >
      {children}
    </button>
  );
}

function SteamGames() {
  const navigate = useNavigate();
  const steamId64 = useAppStore((state) => state.settings.steamId64);
  const [library, setLibrary] = useState<SteamLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      setLibrary(await getSteamLibrary(steamId64, forceRefresh));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [steamId64]);

  useEffect(() => {
    void load();
  }, [load]);

  const games = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (library?.games ?? []).filter((game) => !needle || game.name.toLocaleLowerCase().includes(needle));
  }, [library?.games, query]);

  const launch = async (appId: number) => {
    setLaunching(appId);
    try {
      await launchSteamGame(appId);
    } catch (launchError) {
      toast.error(launchError instanceof Error ? launchError.message : String(launchError));
    } finally {
      setLaunching(null);
    }
  };

  return (
    <section className="mt-3 min-w-0" aria-label="Steam library">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {loading
            ? 'Loading your Steam library…'
            : !library?.supported
              ? 'Steam library access is available in the Windows desktop app.'
              : !library.installed
                ? 'Install Steam to browse local games.'
                : `${library.games.length} games · ${library.games.filter((game) => game.installed).length} installed`}
        </p>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          aria-label="Refresh Steam library"
          className="rounded-md p-2 disabled:opacity-50"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Settings size={13} /> Steam settings
        </button>
      </div>
      {library?.nowPlaying && (
        <p className="mt-2 text-xs" role="status" style={{ color: 'var(--color-success)' }}>
          Playing now: {library.nowPlaying.name}
        </p>
      )}
      {library?.apiError && <p className="mt-2 text-xs" role="status" style={{ color: 'var(--color-text-secondary)' }}>{library.apiError}</p>}
      {error && <p className="mt-2 text-xs" role="alert" style={{ color: 'var(--color-error)' }}>{error}</p>}
      {games.length > 8 && (
        <label className="mt-3 flex max-w-sm items-center gap-2 rounded-lg px-3" style={{ border: '1px solid var(--color-border)' }}>
          <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a Steam game"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-text)' }}
          />
        </label>
      )}
      {games.length > 0 ? (
        <ul className="mt-2 max-h-64 divide-y overflow-y-auto pr-1" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {games.map((game) => (
            <li key={game.appId} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--color-text)' }}>
                {game.name}
                <span className="ml-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {game.installed ? 'Installed' : 'Not installed'}
                  {game.playtimeHours > 0 && ` · ${game.playtimeHours.toFixed(1)} h`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void launch(game.appId)}
                disabled={!game.installed || launching !== null}
                title={game.installed ? `Launch ${game.name}` : 'Install this game in Steam to launch it'}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                style={{ color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
              >
                {launching === game.appId ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Launch
              </button>
            </li>
          ))}
        </ul>
      ) : !loading && library?.games.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {library.installed ? 'No local games found. Add your public profile in Steam settings to load online games.' : 'No games to show.'}
        </p>
      ) : !loading && games.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>No games match that search.</p>
      ) : null}
    </section>
  );
}

function PlayniteGames() {
  const [games, setGames] = useState<PlayniteGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [installedOnly, setInstalledOnly] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [launching, setLaunching] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setGames(await getPlayniteLibrary());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredGames = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return games.filter((game) => {
      if (!showHidden && game.hidden) return false;
      if (installedOnly && !game.installed) return false;
      const searchable = [
        game.name,
        game.source,
        ...(game.genres ?? []),
        ...(game.platforms ?? []),
      ].join(' ').toLocaleLowerCase();
      return words.every((word) => searchable.includes(word));
    });
  }, [games, installedOnly, query, showHidden]);

  const launch = async (game: PlayniteGame) => {
    setLaunching(game.id);
    try {
      await launchPlayniteGame(game.id);
    } catch (launchError) {
      toast.error(launchError instanceof Error ? launchError.message : String(launchError));
    } finally {
      setLaunching('');
    }
  };

  return (
    <section className="mt-3 min-w-0" aria-label="Playnite library">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {loading ? 'Loading your Playnite library…' : `${filteredGames.length} of ${games.length} games`}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh Playnite library"
          className="rounded-md p-2 disabled:opacity-50"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        </button>
      </div>
      {games.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex max-w-sm flex-1 items-center gap-2 rounded-lg px-3" style={{ border: '1px solid var(--color-border)' }}>
            <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, genre, platform"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text)' }}
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={installedOnly} onChange={(event) => setInstalledOnly(event.target.checked)} />
            Installed
          </label>
          <label className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />
            Include hidden
          </label>
        </div>
      )}
      {error && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" role="alert" style={{ color: 'var(--color-error)' }}>
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="underline underline-offset-2">Try again</button>
        </div>
      )}
      {filteredGames.length > 0 ? (
        <ul className="mt-2 max-h-64 divide-y overflow-y-auto pr-1" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {filteredGames.map((game) => {
            const lastPlayedDate = game.last_played ? new Date(game.last_played) : null;
            const lastPlayed = lastPlayedDate && !Number.isNaN(lastPlayedDate.getTime())
              ? `Last played ${lastPlayedDate.toLocaleDateString()}`
              : '';
            const playtime = game.playtime > 0
              ? `${Math.floor(game.playtime / 3600)} h ${Math.floor((game.playtime % 3600) / 60)} min`
              : '';
            const details = [
              game.installed ? 'Installed' : 'Not installed',
              game.source,
              playtime,
              game.play_count > 0 ? `${game.play_count} launches` : '',
              game.completion,
              ...(game.genres ?? []),
              ...(game.platforms ?? []),
              lastPlayed,
            ].filter(Boolean);
            return (
              <li key={game.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
                <div className="min-w-[12rem] flex-1">
                  <p className="truncate text-sm" style={{ color: 'var(--color-text)' }}>
                    {game.name}
                    {game.favorite && <span className="ml-2 text-xs" style={{ color: 'var(--color-accent)' }}>Favorite</span>}
                    {game.hidden && <span className="ml-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Hidden</span>}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    {details.join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void launch(game)}
                  disabled={launching !== ''}
                  aria-label={`Open ${game.name} in Playnite`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs disabled:opacity-50"
                  style={{ color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
                >
                  {launching === game.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Playnite
                </button>
              </li>
            );
          })}
        </ul>
      ) : !loading && !error ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {games.length === 0
            ? 'No Playnite export found. Open or restart Playnite with the OpenJarvis Bridge enabled, then refresh.'
            : 'No games match these filters.'}
        </p>
      ) : null}
    </section>
  );
}

function GamesPanel() {
  const navigate = useNavigate();
  const enabledApps = useAppStore((state) => state.settings.hubEnabledApps);
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  const [source, setSource] = useState<GameSource | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>('steam');
  const [opening, setOpening] = useState<string | null>(null);
  const availableLaunchers = gameLaunchers.filter(
    (launcher) => developerModeEnabled || enabledApps.includes(launcher.settingsId),
  );
  const selectedLauncher = availableLaunchers.find((launcher) => launcher.id === selectedId)
    ?? availableLaunchers[0];
  const visibleSource = availableLaunchers.some((launcher) => launcher.id === source) ? source : null;

  const openApp = async (appId: GameLauncherId) => {
    setOpening(appId);
    try {
      const location = await openGameLauncher(appId);
      if (location === 'web') toast.info(`${gameLaunchers.find((launcher) => launcher.id === appId)?.name} desktop app not found; opened its website.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="px-4 pb-4">
      {selectedLauncher && (
        <div
          className="mb-3 flex min-h-24 flex-col justify-end rounded-lg bg-cover bg-center px-4 py-3"
          style={{
            backgroundImage: `${appArtwork(selectedLauncher.color)}, linear-gradient(115deg, ${selectedLauncher.color}88, var(--color-bg-secondary))`,
            border: '1px solid var(--color-border)',
          }}
          aria-live="polite"
        >
          <span className="text-lg font-semibold text-white">{selectedLauncher.name}</span>
          <span className="text-xs text-white/85">{selectedLauncher.description}</span>
          {selectedLauncher.id === 'steam' || selectedLauncher.id === 'playnite' ? (
            <button
              type="button"
              onClick={() => void openApp(selectedLauncher.id)}
              disabled={opening !== null}
              className="mt-2 inline-flex min-h-8 w-fit items-center gap-1.5 rounded-md px-2.5 text-xs disabled:opacity-50"
              style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              {opening === selectedLauncher.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpRight size={13} />}
              Open {selectedLauncher.name}
            </button>
          ) : null}
        </div>
      )}
      {availableLaunchers.length === 0 && (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Enable game launchers in Settings → Games to list them here.
          <button type="button" onClick={() => navigate('/settings')} className="ml-1 underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Open Settings</button>
        </p>
      )}
      {availableLaunchers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Game launchers">
          {availableLaunchers.map((launcher) => (
            <button
              key={launcher.id}
              type="button"
              onMouseEnter={() => setSelectedId(launcher.id)}
              onFocus={() => setSelectedId(launcher.id)}
              onClick={() => {
                setSelectedId(launcher.id);
                if (launcher.id === 'steam' || launcher.id === 'playnite') {
                  setSource(launcher.id);
                } else {
                  setSource(null);
                  void openApp(launcher.id);
                }
              }}
              aria-pressed={selectedLauncher?.id === launcher.id}
              disabled={opening !== null && opening !== launcher.id}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
              style={{
                color: selectedLauncher?.id === launcher.id ? launcher.color : 'var(--color-text-secondary)',
                background: selectedLauncher?.id === launcher.id ? `${launcher.color}18` : 'var(--color-bg-secondary)',
                border: `1px solid ${selectedLauncher?.id === launcher.id ? launcher.color : 'var(--color-border)'}`,
              }}
            >
              {opening === launcher.id ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
              {launcher.name}
              {launcher.id !== 'steam' && launcher.id !== 'playnite' && <ExternalLink size={11} />}
            </button>
          ))}
        </div>
      )}
      {visibleSource === 'steam' && <SteamGames />}
      {visibleSource === 'playnite' && <PlayniteGames />}
    </div>
  );
}

const kidsApps: HubService[] = [
  { id: 'youtube-kids', name: 'YouTube Kids', url: 'https://www.youtube.com/kids', color: '#ff0033', description: 'Kid-friendly videos picked for younger viewers.', icon: Play },
  { id: 'messenger-kids', name: 'Messenger Kids', url: 'https://www.messenger.com/', color: '#a033ff', description: 'Video calls and messages for kids — needs a parent\'s Facebook account.', icon: MessageCircle },
  { id: 'pbskids', name: 'PBS Kids', url: 'https://pbskids.org/', color: '#0074bc', description: 'Free educational games and videos for kids.', icon: Tv },
  { id: 'nickjr', name: 'Nick Jr.', url: 'https://www.nickjr.com/', color: '#ff6f00', description: 'Games and videos for preschoolers.', icon: Tv },
  { id: 'google-classroom', name: 'Google Classroom', url: 'https://classroom.google.com/', color: '#0f9d58', description: 'School assignments and classes — sign in with the school Google account.', icon: Tv },
];

function KidsPanel() {
  const navigate = useNavigate();
  const [launching, setLaunching] = useState<string | null>(null);
  const [serverBusy, setServerBusy] = useState(false);

  const hostMinecraftServer = async () => {
    setServerBusy(true);
    try {
      const status = await mcServer('status');
      if (status.running) {
        toast.info('Minecraft server is already running.');
        return;
      }
      toast.message('Setting up Minecraft server (first run downloads ~60 MB)…');
      await mcServer('start');
      toast.success('Minecraft server started — friends can join on port 25565.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setServerBusy(false);
    }
  };

  const launchBundledGame = async (kind: 'portablemc' | 'roblox') => {
    setLaunching(kind);
    try {
      await launchGame({ kind });
      toast.success(kind === 'portablemc' ? 'Starting Minecraft…' : 'Starting Roblox…');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLaunching(null);
    }
  };

  return (
    <div className="space-y-3 px-4 pb-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Kids apps">
        {kidsApps.map((app) => {
          const Icon = app.icon;
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => void openExternal(app.url)}
              title={app.description}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors"
              style={{
                color: app.color,
                background: `${app.color}18`,
                border: `1px solid ${app.color}55`,
              }}
            >
              <Icon size={14} />
              {app.name}
              <ExternalLink size={11} />
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Kids games">
        <button
          type="button"
          onClick={() => void launchBundledGame('portablemc')}
          disabled={launching !== null}
          title="Launches the bundled PortableMC — installs and starts the latest Minecraft release"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-50"
          style={{ color: '#62a944', background: '#62a94418', border: '1px solid #62a94455' }}
        >
          {launching === 'portablemc' ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
          Minecraft
        </button>
        <button
          type="button"
          onClick={() => void launchBundledGame('roblox')}
          disabled={launching !== null}
          title="Launches the newest installed Roblox player"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-50"
          style={{ color: '#e2231a', background: '#e2231a18', border: '1px solid #e2231a55' }}
        >
          {launching === 'roblox' ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
          Roblox
        </button>
        <button
          type="button"
          onClick={() => void hostMinecraftServer()}
          disabled={serverBusy || launching !== null}
          title="Downloads the official dedicated server + Java runtime once, then hosts it for friends to join"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-50"
          style={{ color: '#4ade80', background: '#4ade8018', border: '1px solid #4ade8055' }}
        >
          {serverBusy ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
          Host MC Server
        </button>
        <button
          type="button"
          onClick={() => navigate('/media')}
          title="Cartoon, anime and kids channels have their own guide section"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm"
          style={{ color: 'var(--color-accent)', background: 'var(--color-accent-subtle)', border: '1px solid var(--color-border)' }}
        >
          <Baby size={14} /> Kids TV guide
        </button>
      </div>
      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        Messenger Kids runs inside the Messenger mobile/desktop apps and needs a parent&apos;s Facebook
        account — the tile opens Messenger. Cartoons, anime and kids channels live in Media → IPTV → Kids.
      </p>
    </div>
  );
}

interface CryptoGroup {
  label: string;
  apps: HubService[];
}

const cryptoGroups: CryptoGroup[] = [
  {
    label: 'Exchanges — buy, sell & trade',
    apps: [
      { id: 'coinbase', name: 'Coinbase', url: 'https://www.coinbase.com/', color: '#0052ff', description: 'Major US exchange — buy, sell, stake and earn crypto.', icon: Bitcoin },
      { id: 'kraken', name: 'Kraken', url: 'https://www.kraken.com/', color: '#5741d9', description: 'Exchange with low fees, futures and staking.', icon: Bitcoin },
      { id: 'crypto-com', name: 'Crypto.com', url: 'https://crypto.com/', color: '#002b4c', description: 'Exchange plus DeFi wallet and card.', icon: Bitcoin },
      { id: 'gemini', name: 'Gemini', url: 'https://www.gemini.com/', color: '#00dcfa', description: 'Regulated US exchange with insurance on digital assets.', icon: Bitcoin },
      { id: 'kucoin', name: 'KuCoin', url: 'https://www.kucoin.com/', color: '#24ae8f', description: 'Exchange with the widest altcoin selection.', icon: Bitcoin },
      { id: 'bitstamp', name: 'Bitstamp', url: 'https://www.bitstamp.net/', color: '#1a1a1a', description: 'One of the oldest exchanges — simple buy/sell.', icon: Bitcoin },
    ],
  },
  {
    label: 'AI trading bots',
    apps: [
      { id: 'pionex', name: 'Pionex', url: 'https://www.pionex.com/', color: '#1a7f5a', description: 'Exchange with built-in free AI trading bots.', icon: BrainCircuit },
      { id: '3commas', name: '3Commas', url: 'https://3commas.io/', color: '#2f80ed', description: 'Automated crypto trading bots and DCA.', icon: BrainCircuit },
      { id: 'cryptohopper', name: 'Cryptohopper', url: 'https://www.cryptohopper.com/', color: '#4f8ff7', description: 'AI-powered strategy bots for 100+ exchanges.', icon: BrainCircuit },
      { id: 'coinrule', name: 'Coinrule', url: 'https://coinrule.com/', color: '#7c5cff', description: 'No-code rule builder — "if this then that" trading.', icon: BrainCircuit },
      { id: 'bitsgap', name: 'Bitsgap', url: 'https://bitsgap.com/', color: '#00d4a6', description: 'Trading bots, signals and portfolio tools.', icon: BrainCircuit },
    ],
  },
  {
    label: 'Market graphs & data',
    apps: [
      { id: 'coingecko', name: 'CoinGecko', url: 'https://www.coingecko.com/', color: '#16a085', description: 'Prices, charts and market data for every crypto.', icon: LineChart },
      { id: 'coinmarketcap', name: 'CoinMarketCap', url: 'https://coinmarketcap.com/', color: '#3861fb', description: 'Market cap rankings and charts.', icon: LineChart },
      { id: 'tradingview', name: 'TradingView', url: 'https://www.tradingview.com/', color: '#2962ff', description: 'Professional charts and technical analysis.', icon: LineChart },
      { id: 'coinstats', name: 'CoinStats', url: 'https://coinstats.app/', color: '#f7931a', description: 'Portfolio tracker with live charts.', icon: LineChart },
    ],
  },
  {
    label: 'Mining & earn',
    apps: [
      { id: 'kryptex', name: 'Kryptex', url: 'https://www.kryptex.com/en/', color: '#f97316', description: 'Cloud mining, mining contracts and the Kryptex Miner app.', icon: Bitcoin },
      { id: 'nicehash', name: 'NiceHash', url: 'https://www.nicehash.com/', color: '#3b82f6', description: 'Hashpower marketplace — sell or buy mining power.', icon: Bitcoin },
      { id: 'salad', name: 'Salad', url: 'https://salad.com/', color: '#22c55e', description: 'Share idle GPU/CPU power and earn crypto payouts.', icon: Bitcoin },
      { id: 'cudo-miner', name: 'Cudo Miner', url: 'https://cudominer.com/', color: '#a855f7', description: 'Free miner app — auto-switches to the most profitable coin.', icon: Bitcoin },
      { id: 'honeygain', name: 'Honeygain', url: 'https://www.honeygain.com/', color: '#facc15', description: 'Earn from unused bandwidth (pays in BTC/JumpToken).', icon: Bitcoin },
      { id: 'earnapp', name: 'EarnApp', url: 'https://earnapp.com/', color: '#38bdf8', description: 'Bandwidth-sharing earnings paid in BTC or gift cards.', icon: Bitcoin },
    ],
  },
  {
    label: 'Mining pools',
    apps: [
      { id: 'f2pool', name: 'F2Pool', url: 'https://www.f2pool.com/', color: '#f97316', description: 'Largest BTC mining pool — PPS+ payouts.', icon: Bitcoin },
      { id: 'antpool', name: 'Antpool', url: 'https://www.antpool.com/', color: '#3b82f6', description: 'Major pool for BTC and many altcoins.', icon: Bitcoin },
      { id: 'viabtc', name: 'ViaBTC', url: 'https://viabtc.com/', color: '#22c55e', description: 'Pool plus cloud mining and exchange.', icon: Bitcoin },
      { id: 'braiins', name: 'Braiins Pool', url: 'https://braiins.com/pool', color: '#a855f7', description: 'Bitcoin-only pool with FPPS+ payouts.', icon: Bitcoin },
      { id: 'foundry', name: 'Foundry USA', url: 'https://foundrydigital.com/', color: '#64748b', description: 'US-based pool — reputable, institutional grade.', icon: Bitcoin },
      { id: 'poolin', name: 'Poolin', url: 'https://www.poolin.com/', color: '#ef4444', description: 'Large multi-coin pool with low fees.', icon: Bitcoin },
    ],
  },
  {
    label: 'Faucets — small crypto rewards',
    apps: [
      { id: 'earnbitmoon', name: 'Earnbitmoon', url: 'https://earnbitmoon.club/', color: '#f59e0b', description: 'Faucet claims plus offerwalls and PTC tasks.', icon: Bitcoin },
      { id: 'fire-faucet', name: 'Fire Faucet', url: 'https://firefaucet.win/', color: '#ef4444', description: 'Faucet with games, staking and a rewards marketplace.', icon: Bitcoin },
      { id: 'freebitcoin', name: 'FreeBitcoin', url: 'https://freebitcoin.com/', color: '#f7931a', description: 'Long-running BTC faucet — roll every 30 min for a chance at 0.0001+ BTC.', icon: Bitcoin },
      { id: 'cointiply', name: 'Cointiply', url: 'https://cointiply.com/', color: '#22c55e', description: 'Faucet plus offerwalls, surveys and PTC earning.', icon: Bitcoin },
      { id: 'faucetpay', name: 'FaucetPay', url: 'https://faucetpay.io/', color: '#3b82f6', description: 'Faucet list, wallet and micro-earning ecosystem.', icon: Bitcoin },
      { id: 'adbtc', name: 'AdBTC.top', url: 'https://adbtc.top/', color: '#a855f7', description: 'Watch ads and complete tasks for BTC rewards.', icon: Bitcoin },
    ],
  },
  {
    label: 'Wallets',
    apps: [
      { id: 'coinbase-wallet', name: 'Coinbase Wallet', url: 'https://www.coinbase.com/wallet', color: '#0052ff', description: 'Self-custody wallet — separate from the exchange account.', icon: Wallet },
      { id: 'exodus', name: 'Exodus', url: 'https://www.exodus.com/', color: '#6c5ce7', description: 'Desktop/mobile wallet with built-in exchange.', icon: Wallet },
      { id: 'electrum', name: 'Electrum', url: 'https://electrum.org/', color: '#519be5', description: 'Lightweight Bitcoin wallet — open source.', icon: Wallet },
      { id: 'metamask', name: 'MetaMask', url: 'https://metamask.io/', color: '#f6851b', description: 'The standard Web3/Ethereum wallet.', icon: Wallet },
      { id: 'trust-wallet', name: 'Trust Wallet', url: 'https://trustwallet.com/', color: '#3375bb', description: 'Mobile wallet supporting 10M+ assets.', icon: Wallet },
      { id: 'ledger-live', name: 'Ledger Live', url: 'https://www.ledger.com/', color: '#000000', description: 'Hardware wallet companion app.', icon: Wallet },
      { id: 'tangem', name: 'Tangem', url: 'https://tangem.com/', color: '#1a1a1a', description: 'Smartcard hardware wallet — no seed phrase.', icon: Wallet },
      { id: 'nc-wallet', name: 'NC Wallet', url: 'https://app.nc-wallet.com/', color: '#7c3aed', description: 'Multi-chain self-custody wallet.', icon: Wallet },
    ],
  },
];

function CryptoPanel() {
  return (
    <div className="space-y-4 px-4 pb-4">
      {cryptoGroups.map((group) => (
        <div key={group.label}>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
            {group.label}
          </h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label={group.label}>
            {group.apps.map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => void openExternal(app.url)}
                  title={app.description}
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors"
                  style={{
                    color: app.color,
                    background: `${app.color}18`,
                    border: `1px solid ${app.color}55`,
                  }}
                >
                  <Icon size={14} />
                  {app.name}
                  <ExternalLink size={11} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        These open in your browser — exchanges require account signup and KYC. Not financial advice.
      </p>
    </div>
  );
}

function ConnectedServicesPanel({ apps, category }: { apps: HubService[]; category: 'social' | 'stores' | 'media' | 'record' | 'remote' | 'ai' | 'browsers' }) {
  const navigate = useNavigate();
  const enabledApps = useAppStore((state) => state.settings.hubEnabledApps);
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  const visibleApps = category === 'ai'
    ? apps
    : apps.filter((app) => developerModeEnabled || enabledApps.includes(app.id));
  const [selectedId, setSelectedId] = useState<string | null>(visibleApps[0]?.id ?? null);
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const urlKey = visibleApps.map((app) => app.url).join('|');
  useEffect(() => {
    if (!urlKey) return;
    fetchNativeApps(urlKey.split('|')).then(setInstalled).catch(() => {});
  }, [urlKey]);
  const [opening, setOpening] = useState('');
  const selectedApp = visibleApps.find((app) => app.id === selectedId) ?? visibleApps[0];

  const openLink = async (app: HubService) => {
    setSelectedId(app.id);
    setOpening(app.id);
    try {
      await openExternal(app.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setOpening('');
    }
  };

  return (
    <div className="space-y-3 px-4 pb-4">
      {visibleApps.length === 0 ? (
        <p className="py-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Set up apps in Settings → {category === 'social' ? 'Social' : category === 'stores' ? 'Stores' : category === 'media' ? 'Media' : category === 'record' ? 'Record and live stream' : category === 'remote' ? 'Remote access and play' : category === 'browsers' ? 'Browsers' : 'API Keys'} to show them here.
          <button type="button" onClick={() => navigate('/settings')} className="ml-1 underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Open Settings</button>
        </p>
      ) : (
        <>
          {selectedApp && (
            <div
              className="flex min-h-24 flex-col justify-end rounded-lg bg-cover bg-center px-4 py-3"
              style={{
                backgroundImage: `${appArtwork(selectedApp.color)}, linear-gradient(115deg, ${selectedApp.color}88, var(--color-bg-secondary))`,
                border: '1px solid var(--color-border)',
              }}
              aria-live="polite"
            >
              <span className="text-lg font-semibold text-white">{selectedApp.name}</span>
              <span className="text-xs text-white/85">{selectedApp.description}</span>
              <span className="mt-0.5 text-[11px] text-white/75">
                {installed[selectedApp.url]
                  ? 'Desktop app found — opens the app.'
                  : 'Desktop app not found — opens the website.'}
              </span>
              {category === 'social' && (
                <span className="mt-1 text-[11px] text-white/75">
                  Feed previews are not available in OpenJarvis yet. Open the service to see its feed; OpenJarvis does not access private content.
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Available ${category} apps`}>
            {visibleApps.map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  type="button"
                  onMouseEnter={() => setSelectedId(app.id)}
                  onFocus={() => setSelectedId(app.id)}
                  onClick={() => void openLink(app)}
                  aria-pressed={selectedApp?.id === app.id}
                  title={installed[app.url] ? `Open ${app.name} app` : `Open ${app.name} website`}
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    color: selectedApp?.id === app.id ? app.color : 'var(--color-text-secondary)',
                    background: selectedApp?.id === app.id ? `${app.color}18` : 'var(--color-bg-secondary)',
                    border: `1px solid ${selectedApp?.id === app.id ? app.color : 'var(--color-border)'}`,
                  }}
                >
                  {opening === app.id ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
                  {app.name}
                  <ExternalLink size={11} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SocialPanel() {
  return <ConnectedServicesPanel apps={socialApps} category="social" />;
}

function BrowsersPanel() {
  return <ConnectedServicesPanel apps={browserApps} category="browsers" />;
}

function StoresPanel() {
  return <ConnectedServicesPanel apps={storeApps} category="stores" />;
}

function MediaPanel() {
  const navigate = useNavigate();
  const enabledApps = useAppStore((state) => state.settings.hubEnabledApps);
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  const showGuide = developerModeEnabled || enabledApps.includes('tv-guide');
  const [sources, setSources] = useState({ playlist: '', guide: '' });
  const [youtubeQuery, setYoutubeQuery] = useState('');
  const [channels, setChannels] = useState<M3UChannel[]>([]);
  const [programs, setPrograms] = useState<Map<string, GuideProgram[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [playerTarget, setPlayerTarget] = useState<MediaPlayerTarget | null>(null);
  const [englishOnly, setEnglishOnly] = useState(true);
  const [error, setError] = useState('');
  const [guideError, setGuideError] = useState('');

  const visibleChannels = useMemo(
    () => englishOnly
      ? channels.filter((channel) => !channel.language || /^(en|eng|english)([-_].*)?$/i.test(channel.language))
      : channels,
    [channels, englishOnly],
  );

  const loadGuide = async () => {
    if (!sources.playlist.trim()) {
      setError('Enter an M3U or M3U8 playlist URL first.');
      return;
    }
    setLoading(true);
    setError('');
    setGuideError('');
    try {
      const playlistText = await fetchGuideDocument(sources.playlist.trim(), 'playlist');
      const parsedChannels = parseM3U(playlistText);
      if (parsedChannels.length === 0) {
        throw new Error('The playlist contains no supported channels. Check its URL and M3U format.');
      }
      setChannels(parsedChannels);
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
          setGuideError(guideLoadError instanceof Error ? guideLoadError.message : String(guideLoadError));
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
    setError('');
    setPlayerTarget({ src: channel.url, title: channel.name });
  };

  const searchYoutube = async (event: FormEvent) => {
    event.preventDefault();
    const query = youtubeQuery.trim();
    if (!query) return;
    try {
      await openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    } catch (openError) {
      toast.error(openError instanceof Error ? openError.message : String(openError));
    }
  };

  return (
    <div className="space-y-4 px-4 pb-4">
      {(developerModeEnabled || enabledApps.includes('youtube')) && (
        <form onSubmit={(event) => void searchYoutube(event)} className="flex flex-wrap items-center gap-2">
          <Play size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <label className="sr-only" htmlFor="youtube-search">Search YouTube</label>
          <input
            id="youtube-search"
            value={youtubeQuery}
            onChange={(event) => setYoutubeQuery(event.target.value)}
            placeholder="Search YouTube"
            className="h-9 min-w-[12rem] flex-1 rounded-lg bg-transparent px-3 text-sm outline-none"
            style={{ color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
          />
          <button type="submit" className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
            <ArrowUpRight size={14} /> Open YouTube
          </button>
        </form>
      )}
      <ConnectedServicesPanel apps={mediaApps.filter((app) => app.id !== 'tv-guide')} category="media" />
      {showGuide ? <div className="space-y-3">
        <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>TV guide</h3>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Add an M3U/M3U8 playlist and optional XMLTV guide you are authorized to use. Streaming apps remain in their own services; only playlist channels and guide data can be combined here.
        </p>
        <div className="grid gap-2 xl:grid-cols-2">
          <label className="space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Playlist URL
            <input
              value={sources.playlist}
              onChange={(event) => setSources((current) => ({ ...current, playlist: event.target.value }))}
              placeholder="https://…/channels.m3u8"
              className="h-9 w-full rounded-lg bg-transparent px-3 text-sm outline-none"
              style={{ color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            />
          </label>
          <label className="space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            XMLTV guide URL (optional)
            <input
              value={sources.guide}
              onChange={(event) => setSources((current) => ({ ...current, guide: event.target.value }))}
              placeholder="https://…/guide.xml"
              className="h-9 w-full rounded-lg bg-transparent px-3 text-sm outline-none"
              style={{ color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void loadGuide()}
            disabled={loading}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-50"
            style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Load guide
          </button>
          <label className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={englishOnly} onChange={(event) => setEnglishOnly(event.target.checked)} />
            English channels
          </label>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Playlist and guide documents load through the local server — no CORS issues.</span>
        </div>
      </div> : (
        <p className="px-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Enable TV Guide in Settings → Media to load your own playlist and schedule.
          <button type="button" onClick={() => navigate('/settings')} className="ml-1 underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Open Settings</button>
        </p>
      )}
      {showGuide && error && <p role="alert" className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>}
      {showGuide && guideError && <p role="status" className="text-xs" style={{ color: 'var(--color-error)' }}>Playlist loaded, but the TV schedule could not load: {guideError}</p>}
      {showGuide && channels.length > 0 && (
        <div className="min-w-0">
          <p className="mb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {visibleChannels.length} channels{englishOnly ? ' · English metadata filter on' : ''}
          </p>
          <ul className="max-h-64 divide-y overflow-y-auto pr-1" style={{ borderColor: 'var(--color-border-subtle)' }}>
            {visibleChannels.map((channel) => {
              const entries = programs.get(channel.id) ?? [];
              const now = Date.now();
              const current = entries.find((program) => program.start <= now && program.stop > now);
              const next = entries.find((program) => program.start > now);
              return (
                <li key={`${channel.id}:${channel.url}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="min-w-[12rem] flex-1 truncate text-sm" style={{ color: 'var(--color-text)' }}>
                    {channel.name}
                    {current && <span className="ml-2 text-xs" style={{ color: 'var(--color-accent)' }}>Now: {current.title}</span>}
                    {!current && next && <span className="ml-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Next: {next.title}</span>}
                  </span>
                  {channel.group && <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{channel.group}</span>}
                  <button
                    type="button"
                    onClick={() => playChannel(channel)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                    style={{ color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
                  >
                    <Play size={12} />
                    Play
                  </button>
                </li>
              );
            })}
          </ul>
          {visibleChannels.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No channels match the English filter.</p>}
        </div>
      )}
      <MediaPlayerModal target={playerTarget} onClose={() => setPlayerTarget(null)} />
    </div>
  );
}

function LocalRecorder() {
  const settings = useAppStore((state) => state.settings);
  const [recording, setRecording] = useState(false);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true);
  const [includeMicrophone, setIncludeMicrophone] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recordingUrl, setRecordingUrl] = useState('');
  const [recordingName, setRecordingName] = useState('');
  const displayStreamRef = useRef<MediaStream | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const releaseCapture = useCallback(() => {
    for (const stream of [
      displayStreamRef.current,
      microphoneStreamRef.current,
      recorderStreamRef.current,
    ]) {
      stream?.getTracks().forEach((track) => track.stop());
    }
    if (previewRef.current) previewRef.current.srcObject = null;
    displayStreamRef.current = null;
    microphoneStreamRef.current = null;
    recorderStreamRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    releaseCapture();
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  }, [recordingUrl, releaseCapture]);

  const startRecording = async () => {
    setError('');
    setNotice('');
    setElapsedSeconds(0);
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser does not support local screen recording. Use an up-to-date browser or a dedicated recorder such as OBS Studio.');
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: includeSystemAudio,
      });
      displayStreamRef.current = displayStream;
      if (previewRef.current) {
        previewRef.current.srcObject = displayStream;
        void previewRef.current.play().catch(() => undefined);
      }

      const microphoneStream = includeMicrophone
        ? await navigator.mediaDevices.getUserMedia({ audio: true })
        : null;
      microphoneStreamRef.current = microphoneStream;

      const outputTracks = [...displayStream.getVideoTracks()];
      const audioInputs = [displayStream, ...(microphoneStream ? [microphoneStream] : [])]
        .filter((stream) => stream.getAudioTracks().length > 0);
      if (audioInputs.length > 0) {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        await audioContext.resume();
        const mix = audioContext.createMediaStreamDestination();
        for (const stream of audioInputs) {
          audioContext.createMediaStreamSource(
            new MediaStream(stream.getAudioTracks()),
          ).connect(mix);
        }
        outputTracks.push(...mix.stream.getAudioTracks());
      }
      const recorderStream = new MediaStream(outputTracks);
      recorderStreamRef.current = recorderStream;
      const mimeType = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(
        recorderStream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError('Recording stopped because the browser reported a media error.');
        releaseCapture();
        setRecording(false);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });
        if (blob.size > 0) {
          const previousUrl = recordingUrl;
          if (previousUrl) URL.revokeObjectURL(previousUrl);
          const url = URL.createObjectURL(blob);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          setRecordingName(`OpenJarvis-recording-${timestamp}.webm`);
          setRecordingUrl(url);
          const hasSystemAudio = displayStream.getAudioTracks().length > 0;
          if (includeSystemAudio && !hasSystemAudio) {
            setNotice('The selected screen or window did not provide system audio; the video was recorded without it.');
          } else {
            setNotice('Recording saved locally in memory. Download it to keep a copy.');
          }
        } else {
          setError('No video data was captured. Choose a screen or window and try again.');
        }
        chunksRef.current = [];
        releaseCapture();
        setRecording(false);
      };
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorder.state === 'recording') recorder.stop();
      }, { once: true });
      recorder.start(1000);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((current) => current + 1);
      }, 1000);
      setRecording(true);
      if (includeSystemAudio && displayStream.getAudioTracks().length === 0) {
        setNotice('The chosen source may not provide system audio. Recording will continue with any available microphone audio.');
      }
    } catch (captureError) {
      releaseCapture();
      const message = captureError instanceof Error ? captureError.message : String(captureError);
      setError(message.toLowerCase().includes('permission')
        ? 'Screen or microphone permission was denied. Allow capture in the browser prompt and try again.'
        : `Could not start recording: ${message}`);
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
  };

  const destinations = streamingDestinations.filter((app) =>
    settings.developerModeEnabled || settings.hubEnabledApps.includes(app.id),
  );
  const tools = streamingTools.filter((app) =>
    settings.developerModeEnabled || settings.hubEnabledApps.includes(app.id),
  );

  return (
    <div className="space-y-4 px-4 pb-4">
      <section className="space-y-3" aria-label="Local screen recording">
        <div>
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Record your screen or gameplay</h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Captures locally in your browser; no OpenJarvis backend, AI account, or internet connection is used. Recording is not uploaded or added to a remote library.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={includeSystemAudio} disabled={recording} onChange={(event) => setIncludeSystemAudio(event.target.checked)} />
            System audio (if supported)
          </label>
          <label className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={includeMicrophone} disabled={recording} onChange={(event) => setIncludeMicrophone(event.target.checked)} />
            Microphone
          </label>
          {!recording ? (
            <button type="button" onClick={() => void startRecording()} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
              <Disc size={15} /> Choose screen and record
            </button>
          ) : (
            <button type="button" onClick={stopRecording} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm" style={{ background: 'var(--color-error)', color: 'white' }}>
              <Square size={13} /> Stop · {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
            </button>
          )}
        </div>
        {recording && (
          <video ref={previewRef} autoPlay muted playsInline className="max-h-56 w-full rounded-lg bg-black object-contain" aria-label="Recording preview" />
        )}
        {error && <p role="alert" className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
        {notice && <p role="status" className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{notice}</p>}
        {recordingUrl && !recording && (
          <a href={recordingUrl} download={recordingName} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm underline underline-offset-2" style={{ color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}>
            <Download size={14} /> Download {recordingName}
          </a>
        )}
      </section>
      <section className="space-y-2" aria-label="Livestream destinations">
        <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Livestream platforms</h3>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Open the provider's own creator dashboard to sign in and stream. Jarvis does not record or download other people's streams.
        </p>
        {destinations.length > 0
          ? <ConnectedServicesPanel apps={destinations} category="record" />
          : <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Enable destinations in Settings → Record and live stream.</p>}
      </section>
      <section className="space-y-2" aria-label="Streaming and game tools">
        <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Streaming and game tools</h3>
        {tools.length > 0
          ? <ConnectedServicesPanel apps={tools} category="record" />
          : <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Enable tools in Settings → Record and live stream.</p>}
      </section>
      <p className="inline-flex items-start gap-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        <Mic size={13} className="mt-0.5 shrink-0" />
        System audio capture depends on browser and operating-system support. Use OBS or PRISM Live Studio for advanced scenes, encoding, and multistream setup.
      </p>
    </div>
  );
}

function RemotePanel() {
  const enabledApps = useAppStore((state) => state.settings.hubEnabledApps);
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  const apps = remoteApps.filter((app) =>
    developerModeEnabled || enabledApps.includes(app.id),
  );

  return (
    <div className="space-y-3 px-4 pb-4">
      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        OpenJarvis Desktop tries the installed app first when it supports direct launch, then opens the official page if the app is unavailable. These links do not connect devices for you; configure each service and only access devices you own or have permission to use.
      </p>
      {apps.length > 0
        ? <ConnectedServicesPanel apps={apps} category="remote" />
        : <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Enable services in Settings → Remote access and play.</p>}
    </div>
  );
}

function AIPlatformPanel() {
  const navigate = useNavigate();
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  const enabledApps = useAppStore((state) => state.settings.hubEnabledApps);
  const serverInfo = useAppStore((state) => state.serverInfo);
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getCloudKeyStatus()
      .then((status) => {
        if (active) setKeyStatus(status);
      })
      .catch((statusError: unknown) => {
        if (active) setError(statusError instanceof Error ? statusError.message : String(statusError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const apps: HubService[] = aiApps
    .filter((app) => developerModeEnabled || keyStatus[app.key])
    .map((app) => ({
      id: app.id,
      name: app.name,
      url: app.url,
      color: app.color,
      description: keyStatus[app.key] ? 'API key configured in OpenJarvis secure settings.' : 'Add an API key in Settings to use this provider.',
      icon: BrainCircuit,
    }));
  const localModelConfigured = Boolean(serverInfo?.model);

  return (
    <div className="space-y-3 px-4 pb-4">
      {localModelConfigured && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
          Local AI · {serverInfo?.engine} · {serverInfo?.model}
        </div>
      )}
      {loading && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Checking configured AI providers…</p>}
      {error && <p role="alert" className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
      {!loading && apps.length === 0 && !localModelConfigured && (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          No AI platform is connected yet. Configure a provider in Settings → API Keys.
          <button type="button" onClick={() => navigate('/settings')} className="ml-1 underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Open Settings</button>
        </p>
      )}
      {(apps.length > 0 || localModelConfigured) && (
        <section aria-label="Cloud AI services">
          <h3 className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>Cloud AI services</h3>
          {apps.length > 0
            ? <ConnectedServicesPanel apps={apps} category="ai" />
            : <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No cloud provider API keys are configured. Local inference remains available.</p>}
        </section>
      )}
      <section aria-label="AI tools">
        <h3 className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>AI tools</h3>
        {aiTools.filter((app) => developerModeEnabled || enabledApps.includes(app.id)).length > 0 ? (
          <ConnectedServicesPanel
            apps={aiTools.filter((app) => developerModeEnabled || enabledApps.includes(app.id))}
            category="ai"
          />
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Enable Base44 or Microsoft Copilot in Settings → AI and cloud tools to show them here.
            <button type="button" onClick={() => navigate('/settings')} className="ml-1 underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Open Settings</button>
          </p>
        )}
      </section>
      {developerModeEnabled && (
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Showing supported providers; a provider is usable only after its API key or local endpoint is configured.
        </p>
      )}
    </div>
  );
}

function DeveloperPanel() {
  const navigate = useNavigate();
  const settings = useAppStore((state) => state.settings);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  const openEditor = async () => {
    setOpening(true);
    setError('');
    try {
      await openVSCode(settings.vscodeExecutablePath, settings.developerWorkspacePath);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="space-y-3 px-4 pb-4">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Open the configured project in your existing VS Code install. Coding requests can continue in the regular Chat; available tools depend on your configured model and backend.
      </p>
      <button
        type="button"
        onClick={() => void openEditor()}
        disabled={opening}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-50"
        style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
      >
        {opening ? <Loader2 size={14} className="animate-spin" /> : <Code2 size={14} />}
        {opening ? 'Opening VS Code…' : 'Open VS Code'}
      </button>
      <button type="button" onClick={() => navigate('/settings')} className="ml-3 text-xs underline underline-offset-2" style={{ color: 'var(--color-text-secondary)' }}>
        Developer settings
      </button>
      {error && <p role="alert" className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
    </div>
  );
}

function MusicPanel() {
  const openPlayer = useMusicStore((s) => s.openPlayer);
  const playlists = useMusicStore((s) => s.playlists);
  const playTracks = useMusicStore((s) => s.playTracks);
  const addLocalFiles = useMusicStore((s) => s.addLocalFiles);
  const fileRef = useRef<HTMLInputElement>(null);
  const enabledApps = useEnabledMusicApps();
  const developerMode = useAppStore((s) => s.settings.developerModeEnabled);
  const apps = developerMode ? MUSIC_APPS : enabledApps;
  const onFiles = (list: FileList | null) => {
    const tracks = addLocalFiles(Array.from(list ?? []));
    if (tracks.length === 0) {
      toast.error('No audio files found in that selection.');
      return;
    }
    playTracks(tracks);
    openPlayer();
  };
  return (
    <div className="space-y-3 px-4 pb-4">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Play local files and playlists in the Jarvis player, or open a music app. Say &ldquo;Jarvis open Spotify&rdquo;, &ldquo;pause&rdquo;, &ldquo;next&rdquo; or &ldquo;Jarvis return&rdquo;.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openPlayer}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm"
          style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
        >
          <Music2 size={14} /> Open music player
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm"
          style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
        >
          Add local media
        </button>
        <button
          type="button"
          onClick={openPlayer}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm"
          style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
        >
          Add playlist
        </button>
        <input
          ref={fileRef} type="file" hidden multiple accept="audio/*"
          onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
        />
      </div>
      {playlists.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {playlists.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { playTracks(p.tracks); openPlayer(); }}
              className="rounded-lg px-2.5 py-1"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              ▶ {p.name} ({p.tracks.length})
            </button>
          ))}
        </div>
      )}
      <div className="text-xs">
        {apps.length
          ? <Links items={apps} />
          : <p style={{ color: 'var(--color-text-tertiary)' }}>No music apps activated yet. Turn on Developer Mode, then activate apps in Settings → Music. Activated apps stay here afterwards.</p>}
      </div>
    </div>
  );
}

export function MainPageHub() {
  const navigate = useNavigate();
  const [section, setSection] = useState<HubSection | null>(null);
  const [visitedSections, setVisitedSections] = useState<Set<HubSection>>(() => new Set());
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  useEffect(() => {
    if (!developerModeEnabled && section === 'developer') setSection(null);
  }, [developerModeEnabled, section]);
  const selectSection = (next: HubSection) => {
    setSection((current) => current === next ? null : next);
    setVisitedSections((current) => new Set(current).add(next));
  };

  return (
    <section className="shrink-0 border-b px-4 pt-2" style={{ borderColor: 'var(--color-border)' }} aria-label="Games, social, media, remote access, stores, and AI">
      <nav className="flex flex-wrap items-center gap-2 pb-2" aria-label="Main page sections">
        <ActionButton active={false} onClick={() => navigate('/media')} title="Open TV, movie and show guides">
          <Tv size={15} /> Guides
        </ActionButton>
        <ActionButton active={section === 'kids'} onClick={() => selectSection('kids')}>
          <Baby size={15} /> Kids
        </ActionButton>
        <ActionButton active={section === 'crypto'} onClick={() => selectSection('crypto')}>
          <Bitcoin size={15} /> Crypto
        </ActionButton>
        <ActionButton active={section === 'music'} onClick={() => selectSection('music')}>
          <Music2 size={15} /> Music
        </ActionButton>
        <ActionButton active={section === 'browsers'} onClick={() => selectSection('browsers')}>
          <Globe size={15} /> Browsers
        </ActionButton>
        <ActionButton active={section === 'games'} onClick={() => selectSection('games')}>
          <Gamepad2 size={15} /> Games
        </ActionButton>
        <ActionButton active={section === 'social'} onClick={() => selectSection('social')}>
          <ArrowUpRight size={15} /> Social
        </ActionButton>
        <ActionButton active={section === 'media'} onClick={() => selectSection('media')}>
          <Tv size={15} /> Media
        </ActionButton>
        <ActionButton active={section === 'record'} onClick={() => selectSection('record')}>
          <Disc size={15} /> Record
        </ActionButton>
        <ActionButton active={section === 'remote'} onClick={() => selectSection('remote')}>
          <Monitor size={15} /> Remote
        </ActionButton>
        <ActionButton active={section === 'stores'} onClick={() => selectSection('stores')}>
          <ShoppingBag size={15} /> Stores
        </ActionButton>
        <ActionButton active={section === 'ai'} onClick={() => selectSection('ai')}>
          <BrainCircuit size={15} /> AI
        </ActionButton>
        {developerModeEnabled && (
          <ActionButton active={section === 'developer'} onClick={() => selectSection('developer')}>
            <Code2 size={15} /> Developer
          </ActionButton>
        )}
      </nav>
      <div className={`max-h-[42vh] overflow-y-auto pb-2 ${section ? '' : 'hidden'}`}>
        {visitedSections.has('kids') && <div hidden={section !== 'kids'}><KidsPanel /></div>}
        {visitedSections.has('crypto') && <div hidden={section !== 'crypto'}><CryptoPanel /></div>}
        {visitedSections.has('browsers') && <div hidden={section !== 'browsers'}><BrowsersPanel /></div>}
        {visitedSections.has('games') && <div hidden={section !== 'games'}><GamesPanel /></div>}
        {visitedSections.has('social') && <div hidden={section !== 'social'}><SocialPanel /></div>}
        {visitedSections.has('music') && <div hidden={section !== 'music'}><MusicPanel /></div>}
        {visitedSections.has('media') && <div hidden={section !== 'media'}><MediaPanel /></div>}
        {visitedSections.has('record') && <div hidden={section !== 'record'}><LocalRecorder /></div>}
        {visitedSections.has('remote') && <div hidden={section !== 'remote'}><RemotePanel /></div>}
        {visitedSections.has('stores') && <div hidden={section !== 'stores'}><StoresPanel /></div>}
        {visitedSections.has('ai') && <div hidden={section !== 'ai'}><AIPlatformPanel /></div>}
        {developerModeEnabled && visitedSections.has('developer') && <div hidden={section !== 'developer'}><DeveloperPanel /></div>}
      </div>
    </section>
  );
}
