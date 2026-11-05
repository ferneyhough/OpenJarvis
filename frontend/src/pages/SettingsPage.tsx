import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Palette,
  Globe,
  Cpu,
  Database,
  Info,
  Check,
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  Trash2,
  Mic,
  Key,
  Search,
  Gamepad2,
  Brain,
  RefreshCw,
  Volume2,
  Square,
  Code2,
  ExternalLink,
  ArrowUpRight,
} from 'lucide-react';
import { useAppStore, type ThemeMode } from '../lib/store';
import { useTts } from '../hooks/useTts';
import {
  checkHealth,
  fetchSpeechHealth,
  fetchTtsHealth,
  getMemoryStats,
  getInferenceSource,
  setInferenceSource,
  getCloudKeyStatus,
  saveCloudKey,
  fetchToolCredentialStatus,
  saveToolCredentials,
  deleteToolCredential,
  isTauri,
  pullModel,
  type InferenceSource,
  type MemoryStats,
} from '../lib/api';
import { getSteamApiKeyStatus, saveSteamApiKey } from '../lib/steam';
import { gameLaunchers } from '../lib/game-launchers';
import { MUSIC_APPS } from '../lib/music-commands';
import { openVSCode } from '../lib/developer';
import { ensureLocalMediaModel } from '../lib/mediaModels';
import {
  COLOR_THEMES,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_TILES,
  getCustomBackground,
  setCustomBackground,
  readImageAsDataUrl,
} from '../lib/themes';

const CLOUD_KEY_STATUS_CHANGED = 'openjarvis-cloud-key-status-changed';

function BackgroundPicker({
  opacity,
  onOpacity,
  onSaved,
}: {
  opacity: number;
  onOpacity: (value: number) => void;
  onSaved: () => void;
}) {
  const [image, setImage] = useState(() => getCustomBackground());
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const choose = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setCustomBackground(dataUrl);
      setImage(dataUrl);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use that image.');
    }
  };

  const buttonStyle = {
    background: 'var(--color-bg-tertiary)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
  };

  return (
    <>
      <SettingRow label="Custom background" description={error || 'Use any image as the app background'}>
        <div className="flex items-center gap-2">
          {image && (
            <span
              style={{ width: 36, height: 24, borderRadius: 4, backgroundImage: `url("${image}")`, backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid var(--color-border)' }}
            />
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
          <button onClick={() => inputRef.current?.click()} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={buttonStyle}>
            {image ? 'Change image' : 'Choose image'}
          </button>
          {image && (
            <button onClick={() => { setCustomBackground(''); setImage(''); onSaved(); }} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={buttonStyle}>
              Remove
            </button>
          )}
        </div>
      </SettingRow>
      {image && (
        <SettingRow label="Panel opacity" description="Lower values show more of the background image">
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => onOpacity(Number(e.target.value))}
            aria-label="Panel opacity"
          />
        </SettingRow>
      )}
    </>
  );
}

function UpdateActionRow({
  label,
  description,
  idleText,
  run,
}: {
  label: string;
  description: string;
  idleText: string;
  run: () => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const onClick = async () => {
    setBusy(true);
    setResult('');
    try {
      setResult(await run());
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SettingRow label={label} description={result || description}>
      <button
        onClick={onClick}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: busy ? 'default' : 'pointer' }}
      >
        <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
        {busy ? 'Updating...' : idleText}
      </button>
    </SettingRow>
  );
}

async function updateInstalledApps(): Promise<string> {
  if (!isTauri()) return 'App updates are available in the desktop app.';
  const { invoke } = await import('@tauri-apps/api/core');
  const updated = await invoke<string[]>('update_optional_programs');
  return updated.length ? `Updated: ${updated.join(', ')}` : 'All apps are up to date.';
}

async function updateLocalModels(): Promise<string> {
  const res = await fetch('http://localhost:11434/api/tags');
  if (!res.ok) throw new Error('Could not reach Ollama.');
  const names: string[] = ((await res.json()).models || []).map((m: { name: string }) => m.name);
  if (names.length === 0) return 'No local models to update.';
  for (const name of names) await pullModel(name);
  return `Refreshed ${names.length} model${names.length === 1 ? '' : 's'}.`;
}

function OllamaModelList() {
  const [models, setModels] = useState<Array<{ name: string; size: number }>>([]);
  useEffect(() => {
    fetch('http://localhost:11434/api/tags')
      .then(r => r.json())
      .then(data => setModels((data.models || []).map((m: any) => ({ name: m.name, size: m.size }))))
      .catch(() => setModels([]));
  }, []);
  if (models.length === 0) return <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No models loaded</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {models.map(m => (
        <span key={m.name} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
          style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
          {m.name} ({(m.size / 1e9).toFixed(1)} GB)
        </span>
      ))}
    </div>
  );
}

function ApiKeyInput({
  keyName,
  placeholder,
  toolName,
}: {
  keyName: string;
  placeholder: string;
  toolName?: string;
}) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [error, setError] = useState('');
  const desktopKeyStorage = isTauri();
  const serverToolStorage = !desktopKeyStorage && !!toolName;
  const canManage = desktopKeyStorage || serverToolStorage;

  const refresh = useCallback(async () => {
    if (!canManage) {
      setHasKey(false);
      return;
    }
    try {
      const status = desktopKeyStorage
        ? await getCloudKeyStatus()
        : await fetchToolCredentialStatus(toolName!);
      setHasKey(!!status[keyName]);
    } catch {
      setHasKey(false);
    }
  }, [canManage, desktopKeyStorage, keyName, toolName]);

  useEffect(() => {
    void refresh();
    window.addEventListener(CLOUD_KEY_STATUS_CHANGED, refresh);
    return () => window.removeEventListener(CLOUD_KEY_STATUS_CHANGED, refresh);
  }, [refresh]);

  const save = async (v: string) => {
    const next = v.trim();
    if (!next) return;
    setError('');
    try {
      if (desktopKeyStorage) {
        await saveCloudKey(keyName, next);
      } else if (toolName) {
        await saveToolCredentials(toolName, { [keyName]: next });
      } else {
        return;
      }
      setValue('');
      setHasKey(true);
      setSaved(true);
      window.dispatchEvent(new Event(CLOUD_KEY_STATUS_CHANGED));
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.message || 'Failed to save API key');
    }
  };

  const remove = async () => {
    setError('');
    try {
      if (desktopKeyStorage) {
        await saveCloudKey(keyName, '');
      } else if (toolName) {
        await deleteToolCredential(toolName, keyName);
      } else {
        return;
      }
      setValue('');
      setHasKey(false);
      setSaved(true);
      window.dispatchEvent(new Event(CLOUD_KEY_STATUS_CHANGED));
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.message || 'Failed to remove API key');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => { if (value.trim()) void save(value); }}
        placeholder={hasKey ? (desktopKeyStorage ? 'Saved in secure storage' : 'Saved by local server') : placeholder}
        disabled={!canManage}
        className="w-48 px-2 py-1 rounded text-xs"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
      {hasKey && (
        <button
          onClick={() => void remove()}
          className="px-2 py-1 rounded text-[10px] cursor-pointer"
          style={{ color: 'var(--color-error)', border: '1px solid var(--color-error)' }}
        >
          Remove
        </button>
      )}
      {saved && <span className="text-[10px]" style={{ color: 'var(--color-success)' }}>Saved</span>}
      {error && <span className="text-[10px]" style={{ color: 'var(--color-error)' }}>{error}</span>}
    </div>
  );
}

function CloudProviderStatus({ label, keyName }: { label: string; keyName: string }) {
  const [hasKey, setHasKey] = useState(false);
  const desktopKeyStorage = isTauri();

  const refresh = useCallback(async () => {
    if (!desktopKeyStorage) {
      setHasKey(false);
      return;
    }
    try {
      const status = await getCloudKeyStatus();
      setHasKey(!!status[keyName]);
    } catch {
      setHasKey(false);
    }
  }, [desktopKeyStorage, keyName]);

  useEffect(() => {
    void refresh();
    window.addEventListener(CLOUD_KEY_STATUS_CHANGED, refresh);
    return () => window.removeEventListener(CLOUD_KEY_STATUS_CHANGED, refresh);
  }, [refresh]);

  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
        background: hasKey ? 'var(--color-success)' : 'var(--color-text-tertiary)',
      }} />
      {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const anchor = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const [open, setOpen] = useState(() => window.location?.hash === `#${anchor}`);
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === `#${anchor}`) setOpen(true);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [anchor]);
  return (
    <div
      id={anchor}
      className="rounded-xl"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {title}
        </h3>
        <span
          aria-hidden
          style={{
            color: 'var(--color-text-tertiary)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 150ms',
          }}
        >
          ›
        </span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div className="min-w-0">
        <div className="text-sm" style={{ color: 'var(--color-text)' }}>{label}</div>
        {description && (
          <div className="text-xs mt-0.5 break-words" style={{ color: 'var(--color-text-tertiary)' }}>{description}</div>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SteamSettings() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [message, setMessage] = useState('');
  const desktop = isTauri();

  const refreshKeyStatus = useCallback(async () => {
    if (!desktop) return;
    try {
      setHasApiKey(await getSteamApiKeyStatus());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, [desktop]);

  useEffect(() => {
    void refreshKeyStatus();
  }, [refreshKeyStatus]);

  const saveKey = async (value: string) => {
    setKeyBusy(true);
    setMessage('');
    try {
      await saveSteamApiKey(value);
      setApiKey('');
      setHasApiKey(Boolean(value.trim()));
      setMessage(value.trim() ? 'API key saved securely.' : 'API key removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setKeyBusy(false);
    }
  };

  return (
    <Section title="Steam">
      <SettingRow
        label="SteamID64"
        description="A public 17-digit Steam profile ID. Your profile and game details must be public."
      >
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={17}
          pattern="[0-9]{17}"
          aria-label="SteamID64"
          placeholder="76561198000000000"
          value={settings.steamId64}
          onChange={(event) => updateSettings({ steamId64: event.target.value.replace(/\D/g, '').slice(0, 17) })}
          className="w-56 max-w-full rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
      </SettingRow>
      <SettingRow
        label="Steam Web API key"
        description={desktop
          ? 'Stored in your operating system credential store; never sent to your AI model.'
          : 'Save API keys from OpenJarvis Desktop, where they are stored securely.'}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            type="password"
            autoComplete="new-password"
            aria-label="Steam Web API key"
            placeholder={hasApiKey ? 'Key saved securely' : 'Enter Steam Web API key'}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            disabled={!desktop || keyBusy}
            className="w-56 max-w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          {apiKey.trim() && (
            <button
              type="button"
              onClick={() => void saveKey(apiKey)}
              disabled={!desktop || keyBusy}
              className="rounded-lg px-3 py-2 text-xs font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
            >
              Save key
            </button>
          )}
          {hasApiKey && (
            <button
              type="button"
              onClick={() => void saveKey('')}
              disabled={keyBusy}
              className="rounded-lg px-3 py-2 text-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: 'var(--color-error)', border: '1px solid var(--color-border)' }}
            >
              Remove
            </button>
          )}
        </div>
      </SettingRow>
      <SettingRow
        label="Use Steam context in chat"
        description={desktop
          ? 'When enabled, sends your current game and up to 20 most-played games with each standard chat request.'
          : 'Steam context is available in OpenJarvis Desktop on Windows.'}
      >
        <input
          type="checkbox"
          aria-label="Use Steam context in chat"
          checked={settings.steamContextEnabled}
          onChange={(event) => updateSettings({ steamContextEnabled: event.target.checked })}
          disabled={!desktop}
          className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
        />
      </SettingRow>
      <div className="flex items-center justify-between gap-3 pt-2">
        <a
          href="https://steamcommunity.com/dev/apikey"
          target="_blank"
          rel="noreferrer"
          className="text-xs underline underline-offset-2"
          style={{ color: 'var(--color-accent)' }}
        >
          Get a Steam Web API key
        </a>
        {message && (
          <span role="status" className="text-xs" style={{ color: message.includes('saved') || message.includes('removed') ? 'var(--color-success)' : 'var(--color-error)' }}>
            {message}
          </span>
        )}
      </div>
      {!desktop && (
        <p className="mt-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Local game discovery and launching require OpenJarvis Desktop on Windows.
        </p>
      )}
    </Section>
  );
}

const hubIntegrationGroups = [
  {
    title: 'Games',
    apps: gameLaunchers.map((launcher) => ({
      id: launcher.settingsId,
      name: launcher.name,
      url: launcher.url,
      auth: launcher.id === 'steam'
        ? 'Enable to show Steam in Games. Local library and installed game launching require the desktop app and Steam client.'
        : launcher.id === 'playnite'
          ? 'Enable to show Playnite in Games. Open Playnite once with the OpenJarvis Bridge installed to export your library.'
          : `Enable to show ${launcher.name} in Games. OpenJarvis opens its installed desktop app when available, otherwise its official website.`,
    })),
  },
  {
    title: 'Social',
    apps: [
      { id: 'discord', name: 'Discord', url: 'https://discord.com/app', auth: 'Sign in to Discord in your browser. OpenJarvis does not read private messages.' },
      { id: 'telegram', name: 'Telegram', url: 'https://web.telegram.org/', auth: 'Sign in to Telegram in your browser.' },
      { id: 'whatsapp', name: 'WhatsApp', url: 'https://web.whatsapp.com/', auth: 'Link your device in WhatsApp Web. Messages are not read by OpenJarvis.' },
      { id: 'slack', name: 'Slack', url: 'https://slack.com/signin', auth: 'Sign in to your Slack workspace.' },
      { id: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/', auth: 'Sign in to Facebook in your browser.' },
      { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/', auth: 'Sign in to Instagram in your browser.' },
      { id: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com/', auth: 'Sign in to TikTok in your browser. Live streaming eligibility is set by TikTok.' },
    ],
  },
  {
    title: 'Media and streaming',
    apps: [
      { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/', auth: 'Sign in on YouTube if you want your subscriptions and watch history there.' },
      { id: 'twitch', name: 'Twitch', url: 'https://www.twitch.tv/', auth: 'Sign in to Twitch in the browser; OpenJarvis does not access private chat or download streams.' },
      { id: 'plex', name: 'Plex', url: 'https://app.plex.tv/desktop/', auth: 'Sign in to Plex in its web app. OpenJarvis does not connect to your Plex server or import its catalog.' },
      { id: 'netflix', name: 'Netflix', url: 'https://www.netflix.com/', auth: 'Sign in to Netflix in your browser.' },
      { id: 'prime-video', name: 'Prime Video', url: 'https://www.primevideo.com/', auth: 'Sign in to Prime Video in your browser.' },
      { id: 'crave', name: 'Crave', url: 'https://www.crave.ca/', auth: 'Sign in to Crave in your browser.' },
      { id: 'crunchyroll', name: 'Crunchyroll', url: 'https://www.crunchyroll.com/', auth: 'Sign in to Crunchyroll in your browser.' },
      { id: 'disney-plus', name: 'Disney+', url: 'https://www.disneyplus.com/', auth: 'Sign in to Disney+ in your browser.' },
      { id: 'max', name: 'Max', url: 'https://www.max.com/', auth: 'Sign in to Max in your browser.' },
      { id: 'hulu', name: 'Hulu', url: 'https://www.hulu.com/', auth: 'Sign in to Hulu in your browser.' },
      { id: 'paramount-plus', name: 'Paramount+', url: 'https://www.paramountplus.com/', auth: 'Sign in to Paramount+ in your browser.' },
      { id: 'peacock', name: 'Peacock', url: 'https://www.peacocktv.com/', auth: 'Sign in to Peacock in your browser.' },
      { id: 'vlc', name: 'VLC', url: 'https://www.videolan.org/vlc/', auth: 'Install VLC locally to play user-provided TV streams.' },
      { id: 'tv-guide', name: 'Playlist TV guide', url: 'https://www.xmltv.org/', auth: 'Add an M3U/M3U8 playlist and optional XMLTV URL in the Media tab.' },
    ],
  },
  {
    title: 'AI and cloud tools',
    apps: [
      { id: 'base44', name: 'Base44', url: 'https://base44.com/', auth: 'Open Base44 and sign in there. This is a website launcher, not a model provider connected to OpenJarvis chat.' },
      { id: 'microsoft-copilot', name: 'Microsoft Copilot', url: 'https://copilot.microsoft.com/', auth: 'Open Copilot and sign in with Microsoft. This does not connect Copilot to OpenJarvis chat.' },
    ],
  },
  {
    title: 'Record and live stream',
    apps: [
      { id: 'live-twitch', name: 'Twitch Creator Dashboard', url: 'https://dashboard.twitch.tv/', auth: 'Open your own Twitch creator dashboard to configure a stream.' },
      { id: 'live-youtube', name: 'YouTube Live', url: 'https://studio.youtube.com/', auth: 'Open YouTube Studio to set up a live stream on your own channel.' },
      { id: 'live-kick', name: 'Kick Creator Dashboard', url: 'https://kick.com/creator/dashboard', auth: 'Open Kick creator tools; sign in and configure streaming with Kick.' },
      { id: 'live-tiktok', name: 'TikTok LIVE Center', url: 'https://livecenter.tiktok.com/', auth: 'Open TikTok LIVE tools; account eligibility may apply.' },
      { id: 'live-facebook', name: 'Facebook Live Producer', url: 'https://www.facebook.com/live/producer/', auth: 'Open Facebook Live Producer for your own broadcasts.' },
      { id: 'live-rumble', name: 'Rumble Studio', url: 'https://rumble.com/studio', auth: 'Open Rumble Studio to configure your own live broadcast.' },
      { id: 'live-steam', name: 'Steam Broadcast', url: 'https://steamcommunity.com/broadcast/upload/', auth: 'Open Steam Community broadcast settings for gameplay.' },
      { id: 'obs-studio', name: 'OBS Studio', url: 'https://obsproject.com/', auth: 'Open the official OBS site to install or learn about the desktop streaming and recording app.' },
      { id: 'prism-live-studio', name: 'PRISM Live Studio', url: 'https://prismlive.com/en_us/', auth: 'Open the official PRISM Live Studio site for the streaming and live-production app.' },
      { id: 'streamlabs', name: 'Streamlabs', url: 'https://streamlabs.com/', auth: 'Open the official Streamlabs site for streaming software and creator tools.' },
      { id: 'streamyard', name: 'StreamYard', url: 'https://streamyard.com/', auth: 'Open StreamYard to configure your browser-based live production.' },
      { id: 'prism-launcher', name: 'Prism Launcher', url: 'https://prismlauncher.org/', auth: 'Minecraft instance launcher; it is separate from PRISM Live Studio.' },
    ],
  },
  {
    title: 'Remote access and play',
    apps: [
      { id: 'steam-link', name: 'Steam Link', url: 'https://store.steampowered.com/steamlink/about/', auth: 'Install Steam Link on your supported device and configure it with your own Steam account and PC.' },
      { id: 'chrome-remote-desktop', name: 'Chrome Remote Desktop', url: 'https://remotedesktop.google.com/access/', auth: 'Set up Chrome Remote Desktop on computers you own or are authorized to access.' },
      { id: 'anydesk', name: 'AnyDesk', url: 'https://anydesk.com/en', auth: 'Install and configure AnyDesk on devices you own or have permission to access.' },
      { id: 'teamviewer', name: 'TeamViewer', url: 'https://www.teamviewer.com/en/', auth: 'Use TeamViewer only with the device owner’s permission.' },
      { id: 'rustdesk', name: 'RustDesk', url: 'https://rustdesk.com/', auth: 'Install and configure RustDesk on devices you own or are authorized to access.' },
      { id: 'parsec', name: 'Parsec', url: 'https://parsec.app/', auth: 'Install and configure Parsec on devices you own or have permission to access.' },
    ],
  },
  {
    title: 'Music',
    apps: MUSIC_APPS.map((app) => ({
      id: `music-${app.id}`,
      name: app.label,
      url: app.url,
      auth: `Activate to show ${app.label} in the Music section and its player. Once activated it stays visible. OpenJarvis opens the desktop app when installed, otherwise the website; sign in there.`,
    })),
  },
  {
    title: 'Browsers',
    apps: [
      { id: 'browser-chrome', name: 'Google Chrome', url: 'https://www.google.com/chrome/', auth: 'Activate to show Chrome in Browsers. Opens the installed browser, otherwise its download site.' },
      { id: 'browser-edge', name: 'Microsoft Edge', url: 'https://www.microsoft.com/edge/', auth: 'Activate to show Edge in Browsers. Opens the installed browser, otherwise its site.' },
      { id: 'browser-firefox', name: 'Firefox', url: 'https://www.mozilla.org/firefox/', auth: 'Activate to show Firefox in Browsers. Opens the installed browser, otherwise its download site.' },
      { id: 'browser-brave', name: 'Brave', url: 'https://brave.com/', auth: 'Activate to show Brave in Browsers. Opens the installed browser, otherwise its download site.' },
      { id: 'browser-opera', name: 'Opera', url: 'https://www.opera.com/', auth: 'Activate to show Opera in Browsers. Opens the installed browser, otherwise its download site.' },
      { id: 'browser-vivaldi', name: 'Vivaldi', url: 'https://vivaldi.com/', auth: 'Activate to show Vivaldi in Browsers. Opens the installed browser, otherwise its download site.' },
      { id: 'browser-tor', name: 'Tor Browser', url: 'https://www.torproject.org/', auth: 'Activate to show Tor Browser in Browsers. Opens it from your Desktop install, otherwise its download site.' },
    ],
  },
  {
    title: 'Stores',
    apps: [
      { id: 'gg-deals', name: 'GG.deals', url: 'https://gg.deals/', auth: 'Open deal pages in your browser; sign in there if you use a GG.deals account.' },
      { id: 'steam-store', name: 'Steam Store', url: 'https://store.steampowered.com/', auth: 'Uses your Steam sign-in; game library setup is in Steam settings above.' },
      { id: 'epic-store', name: 'Epic Games Store', url: 'https://store.epicgames.com/', auth: 'Sign in to Epic Games in your browser.' },
      { id: 'gog-store', name: 'GOG', url: 'https://www.gog.com/', auth: 'Sign in to GOG in your browser.' },
      { id: 'humble-store', name: 'Humble Bundle', url: 'https://www.humblebundle.com/store', auth: 'Sign in to Humble Bundle in your browser.' },
      { id: 'itch-store', name: 'itch.io', url: 'https://itch.io/', auth: 'Sign in to itch.io in your browser.' },
      { id: 'xbox-store', name: 'Xbox Store', url: 'https://www.xbox.com/games/store', auth: 'Sign in to Xbox in your browser.' },
      { id: 'playstation-store', name: 'PlayStation Store', url: 'https://store.playstation.com/', auth: 'Sign in to PlayStation in your browser.' },
    ],
  },
];

export function AppIntegrationsSettings() {
  const enabledApps = useAppStore((state) => state.settings.hubEnabledApps);
  const developerMode = useAppStore((state) => state.settings.developerModeEnabled);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const toggleApp = (id: string, enabled: boolean) => {
    const next = new Set(enabledApps);
    if (enabled) next.add(id);
    else next.delete(id);
    updateSettings({ hubEnabledApps: [...next] });
  };

  return (
    <>
      {hubIntegrationGroups.filter((group) => group.title !== 'Music' || developerMode).map((group) => (
        <Section key={group.title} title={group.title}>
          <p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            These are launch links and visibility controls, not account connections. Sign in with each provider separately; OpenJarvis cannot verify browser sign-in. Private feeds and unsupported provider APIs are not connected.
          </p>
          {group.apps.map((app) => (
            <SettingRow key={app.id} label={app.name} description={app.auth}>
              <div className="flex items-center gap-3">
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
                  style={{ color: 'var(--color-accent)' }}
                >
                  {group.title === 'AI and cloud tools' ? 'Open setup' : 'Sign in / open'} <ExternalLink size={12} />
                </a>
                <label className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <input
                    type="checkbox"
                    aria-label={`Show ${app.name} in hub`}
                    checked={enabledApps.includes(app.id)}
                    onChange={(event) => toggleApp(app.id, event.target.checked)}
                    className="accent-[var(--color-accent)]"
                  />
                  Show in hub
                </label>
              </div>
            </SettingRow>
          ))}
        </Section>
      ))}
    </>
  );
}

function PersonalSourcesSettings() {
  const enabled = useAppStore((state) => state.settings.personalSourcesEnabled);
  const updateSettings = useAppStore((state) => state.updateSettings);
  return (
    <Section title="Personal information sources">
      <p className="mb-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        Connect supported accounts in Data Sources. OpenJarvis searches only connected, indexed data and sends a few relevant excerpts to your selected model when this is enabled. Account linking does not grant access to apps without a supported connector.
      </p>
      <SettingRow
        label="Use connected sources in regular chats"
        description="Turn off to keep personal source excerpts out of standard chat prompts. Deep Research remains separately controlled."
      >
        <input
          type="checkbox"
          aria-label="Use connected sources in regular chats"
          checked={enabled}
          onChange={(event) => {
            updateSettings({ personalSourcesEnabled: event.target.checked });
          }}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
      </SettingRow>
      <SettingRow label="Manage connected accounts" description="Connect or disconnect supported sources and manage their indexed data.">
        <a
          href="/data-sources"
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs underline underline-offset-2"
          style={{ color: 'var(--color-accent)' }}
        >
          Open Data Sources <ArrowUpRight size={12} />
        </a>
      </SettingRow>
    </Section>
  );
}

function DeveloperSettings() {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  const launchEditor = async () => {
    setOpening(true);
    setError('');
    try {
      await openVSCode(settings.vscodeExecutablePath, settings.developerWorkspacePath);
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : String(launchError));
    } finally {
      setOpening(false);
    }
  };

  return (
    <Section title="Developer tools">
      <>
          <SettingRow label="VS Code executable" description="Optional. Set this to Code.exe for a portable or non-standard install.">
            <input
              value={settings.vscodeExecutablePath}
              onChange={(event) => {
                updateSettings({ vscodeExecutablePath: event.target.value });
              }}
              placeholder="Auto-detect VS Code"
              aria-label="VS Code executable path"
              className="w-64 max-w-full rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </SettingRow>
          <SettingRow label="Workspace folder" description="Optional folder to open in VS Code.">
            <input
              value={settings.developerWorkspacePath}
              onChange={(event) => {
                updateSettings({ developerWorkspacePath: event.target.value });
              }}
              placeholder="C:\\Projects\\MyProject"
              aria-label="Developer workspace folder"
              className="w-64 max-w-full rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </SettingRow>
          <SettingRow label="Open editor" description="Uses an existing VS Code install; no editor is downloaded or embedded.">
            <button
              type="button"
              onClick={() => void launchEditor()}
              disabled={opening}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs disabled:opacity-50"
              style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
            >
              <Code2 size={14} /> {opening ? 'Opening…' : 'Open VS Code'}
            </button>
          </SettingRow>
          {error && <p role="alert" className="pt-2 text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
          {(['image', 'video'] as const).map((kind) => {
            const key = kind === 'image' ? 'localImageModel' : 'localVideoModel';
            return (
              <SettingRow
                key={kind}
                label={`Local ${kind} generation model`}
                description={
                  kind === 'image'
                    ? 'Stable Diffusion Turbo (~2 GB). Off = the Image button opens a free website instead; nothing is downloaded. Turning this on downloads it and announces it by voice.'
                    : 'SD 1.5 + AnimateDiff-Lightning (~3 GB, very slow on CPU). Off = the Video button opens a free website instead; nothing is downloaded. Turning this on downloads it and announces it by voice.'
                }
              >
                <input
                  type="checkbox"
                  aria-label={`Local ${kind} generation model`}
                  checked={settings[key]}
                  onChange={(event) => {
                    const on = event.target.checked;
                    updateSettings({ [key]: on });
                    if (on) {
                      ensureLocalMediaModel(kind).then((ok) => {
                        if (!ok) updateSettings({ [key]: false });
                      }).catch((e) => {
                        updateSettings({ [key]: false });
                        setError(e instanceof Error ? e.message : String(e));
                      });
                    }
                  }}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
              </SettingRow>
            );
          })}
      </>
    </Section>
  );
}

type MemoryStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; stats: MemoryStats }
  | { kind: 'error'; message: string };

export function MemoryStatusRow({
  status,
  onRetry,
}: {
  status: MemoryStatus;
  onRetry: () => void;
}) {
  const stats = status.kind === 'ready' ? status.stats : null;
  const description = status.kind === 'error'
    ? status.message
    : status.kind === 'loading'
      ? 'Checking memory backend...'
      : stats?.backend === 'none'
        ? 'Memory is not configured'
        : `${stats?.backend} backend — ${stats?.entries} entries`;
  const label = status.kind === 'loading'
    ? 'Checking...'
    : stats?.backend === 'none'
      ? 'Not configured'
      : stats
        ? `${stats.entries} entries`
        : 'Unavailable';

  return (
    <SettingRow label="Memory status" description={description}>
      <div className="flex items-center gap-2">
        <Brain size={14} style={{ color: stats && stats.backend !== 'none' ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }} />
        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </span>
        {status.kind === 'error' && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs underline cursor-pointer whitespace-nowrap"
            style={{ color: 'var(--color-accent)' }}
          >
            Retry
          </button>
        )}
      </div>
    </SettingRow>
  );
}

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const conversations = useAppStore((s) => s.conversations);
  const serverInfo = useAppStore((s) => s.serverInfo);
  const tts = useTts();
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [speechBackendAvailable, setSpeechBackendAvailable] = useState<boolean | null>(null);
  const [ttsBackend, setTtsBackend] = useState<{ available: boolean; backend?: string; voice_id?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus>({ kind: 'loading' });
  const memoryRequestId = useRef(0);
  const [memoryEnabled, setMemoryEnabled] = useState(() => {
    try { return localStorage.getItem('openjarvis-memory-enabled') !== 'false'; } catch { return true; }
  });
  const [memoryBackend, setMemoryBackend] = useState(() => {
    try { return localStorage.getItem('openjarvis-memory-backend') || 'sqlite'; } catch { return 'sqlite'; }
  });
  const [memoryTopK, setMemoryTopK] = useState(() => {
    try { return parseInt(localStorage.getItem('openjarvis-memory-top-k') || '5'); } catch { return 5; }
  });
  const [memoryMinScore, setMemoryMinScore] = useState(() => {
    try { return parseFloat(localStorage.getItem('openjarvis-memory-min-score') || '0.1'); } catch { return 0.1; }
  });
  const [memoryMaxTokens, setMemoryMaxTokens] = useState(() => {
    try { return parseInt(localStorage.getItem('openjarvis-memory-max-tokens') || '2048'); } catch { return 2048; }
  });

  const [srcKind, setSrcKind] = useState<InferenceSource['kind']>('ollama');
  const [customHost, setCustomHost] = useState('http://localhost:1234/v1');
  const [customModel, setCustomModel] = useState('');
  const [customEngine, setCustomEngine] = useState('lmstudio');
  const [customKey, setCustomKey] = useState('');
  const [srcMsg, setSrcMsg] = useState('');

  useEffect(() => {
    getInferenceSource().then((s) => {
      setSrcKind(s.kind);
      if (s.host) setCustomHost(s.host);
      if (s.model) setCustomModel(s.model);
      if (s.engine) setCustomEngine(s.engine);
    }).catch(() => {});
  }, []);

  const saveSource = useCallback(async () => {
    try {
      if (srcKind === 'custom') {
        await setInferenceSource({ kind: 'custom', host: customHost, model: customModel, engine: customEngine, apiKey: customKey || undefined });
      } else {
        await setInferenceSource({ kind: 'ollama' });
      }
      setSrcMsg('Saved — restart the app to apply.');
    } catch (e: any) {
      setSrcMsg(e?.message ?? 'Failed to save.');
    }
  }, [srcKind, customHost, customModel, customEngine, customKey]);

  const refreshMemoryStatus = useCallback(async () => {
    const requestId = ++memoryRequestId.current;
    setMemoryStatus({ kind: 'loading' });
    try {
      const stats = await getMemoryStats();
      if (requestId === memoryRequestId.current) {
        setMemoryStatus({ kind: 'ready', stats });
      }
    } catch (error) {
      if (requestId === memoryRequestId.current) {
        setMemoryStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, []);

  useEffect(() => {
    void refreshMemoryStatus();
    const onFocus = () => { void refreshMemoryStatus(); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      ++memoryRequestId.current;
    };
  }, [refreshMemoryStatus, settings.apiUrl]);

  useEffect(() => {
    checkHealth().then(setHealthy);
    fetchSpeechHealth()
      .then((h) => setSpeechBackendAvailable(h.available))
      .catch(() => setSpeechBackendAvailable(false));
    fetchTtsHealth()
      .then((h) => setTtsBackend(h))
      .catch(() => setTtsBackend({ available: false }));
  }, []);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleExport = () => {
    const data = localStorage.getItem('openjarvis-conversations') || '{}';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openjarvis-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.version === 1) {
            localStorage.setItem('openjarvis-conversations', JSON.stringify(data));
            useAppStore.getState().loadConversations();
            showSaved();
          }
        } catch {}
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const [confirmClear, setConfirmClear] = useState(false);
  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    localStorage.removeItem('openjarvis-conversations');
    useAppStore.getState().loadConversations();
    setConfirmClear(false);
    showSaved();
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              Settings
            </h1>
            {saved && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{
                background: 'var(--color-accent-subtle)',
                color: 'var(--color-success)',
              }}>
                <Check size={12} /> Saved
              </span>
            )}
          </div>
          <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--color-text-secondary)' }}>
            App preferences — appearance, model defaults, keyboard shortcuts, and data management.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          {/* Appearance */}
          <Section title="Appearance">
            <SettingRow label="Theme" description="Choose how OpenJarvis looks">
              <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
                {themeOptions.map((opt) => {
                  const isActive = settings.theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { updateSettings({ theme: opt.value, colorTheme: DEFAULT_THEME_ID }); showSaved(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
                      style={{
                        background: isActive ? 'var(--color-surface)' : 'transparent',
                        color: isActive ? 'var(--color-text)' : 'var(--color-text-tertiary)',
                        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                      }}
                    >
                      <opt.icon size={14} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </SettingRow>
            <SettingRow label="Color theme" description={`${COLOR_THEMES.length} themes plus defaults. Picking Light, Dark or System above overrides a theme`}>
              <span />
            </SettingRow>
            <div className="grid grid-cols-3 gap-2 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              {[
                ...DEFAULT_THEME_TILES.map((d) => ({ id: d.id, name: d.name, bg: d.bg, accent: d.accent, text: d.text, mode: d.mode })),
                ...COLOR_THEMES.map((t) => ({ id: t.id, name: t.name, bg: t.bg, accent: t.accent, text: t.text, mode: t.mode as ThemeMode })),
              ].map((t) => {
                const isDefaultTile = t.id.startsWith('default');
                const active = isDefaultTile
                  ? (settings.colorTheme || DEFAULT_THEME_ID) === DEFAULT_THEME_ID && settings.theme === t.mode
                  : settings.colorTheme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      updateSettings({ colorTheme: isDefaultTile ? DEFAULT_THEME_ID : t.id, theme: t.mode });
                      showSaved();
                    }}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left cursor-pointer"
                    style={{
                      background: t.bg,
                      color: t.text,
                      border: active ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.accent, flexShrink: 0 }} />
                    <span className="truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>
            <BackgroundPicker
              opacity={settings.backgroundOpacity}
              onOpacity={(v) => updateSettings({ backgroundOpacity: v })}
              onSaved={showSaved}
            />
            <SettingRow label="Font size">
              <select
                value={settings.fontSize}
                onChange={(e) => { updateSettings({ fontSize: e.target.value as any }); showSaved(); }}
                className="text-sm px-3 py-1.5 rounded-lg outline-none cursor-pointer"
                style={{
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <option value="small">Small</option>
                <option value="default">Default</option>
                <option value="large">Large</option>
              </select>
            </SettingRow>
          </Section>

          {/* Connection */}
          <Section title="Connection">
            <SettingRow label="Server status" description={serverInfo ? `${serverInfo.engine} / ${serverInfo.model}` : 'Not connected'}>
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: healthy === true ? 'var(--color-success)' : healthy === false ? 'var(--color-error)' : 'var(--color-text-tertiary)' }}
                />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {healthy === true ? 'Connected' : healthy === false ? 'Disconnected' : 'Checking...'}
                </span>
              </div>
            </SettingRow>
            <SettingRow label="API URL" description="Set if backend runs on a different port or host">
              <input
                type="text"
                value={settings.apiUrl}
                onChange={(e) => { updateSettings({ apiUrl: e.target.value }); showSaved(); }}
                placeholder="http://localhost:8000"
                className="text-sm px-3 py-1.5 rounded-lg outline-none w-56"
                style={{
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              />
            </SettingRow>
            <SettingRow label="API key" description="Required only if the server was started with an API key">
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => { updateSettings({ apiKey: e.target.value }); showSaved(); }}
                placeholder="OPENJARVIS_API_KEY"
                autoComplete="off"
                className="text-sm px-3 py-1.5 rounded-lg outline-none w-56"
                style={{
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              />
            </SettingRow>
          </Section>

          {/* Inference source */}
          <Section title="Inference source">
            <SettingRow label="Source" description="Where the app runs models. Applies after restart.">
              <select
                value={srcKind}
                onChange={(e) => { setSrcKind(e.target.value as InferenceSource['kind']); setSrcMsg(''); }}
                className="text-sm px-3 py-1.5 rounded-lg outline-none w-56"
                style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
              >
                <option value="ollama">Bundled Ollama (default)</option>
                <option value="custom">Custom OpenAI-compatible server</option>
              </select>
            </SettingRow>
            {srcKind === 'custom' && (
              <>
                <SettingRow label="Server URL" description="e.g. LM Studio: http://localhost:1234/v1">
                  <input type="text" value={customHost} onChange={(e) => { setCustomHost(e.target.value); setSrcMsg(''); }} placeholder="http://localhost:1234/v1"
                    className="text-sm px-3 py-1.5 rounded-lg outline-none w-56"
                    style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
                </SettingRow>
                <SettingRow label="Model" description="Model id served by your endpoint">
                  <input type="text" value={customModel} onChange={(e) => { setCustomModel(e.target.value); setSrcMsg(''); }} placeholder="qwen2.5-7b-instruct"
                    className="text-sm px-3 py-1.5 rounded-lg outline-none w-56"
                    style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
                </SettingRow>
                <SettingRow label="Server type" description="OpenAI-compatible engine">
                  <select value={customEngine} onChange={(e) => { setCustomEngine(e.target.value); setSrcMsg(''); }}
                    className="text-sm px-3 py-1.5 rounded-lg outline-none w-56"
                    style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                    <option value="lmstudio">LM Studio</option>
                    <option value="vllm">vLLM</option>
                    <option value="sglang">SGLang</option>
                    <option value="llamacpp">llama.cpp</option>
                    <option value="mlx">MLX</option>
                  </select>
                </SettingRow>
                <SettingRow label="API key (optional)" description="Only if your server requires one">
                  <input type="password" value={customKey} onChange={(e) => { setCustomKey(e.target.value); setSrcMsg(''); }} placeholder="leave blank if none"
                    className="text-sm px-3 py-1.5 rounded-lg outline-none w-56"
                    style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
                </SettingRow>
              </>
            )}
            <SettingRow label="" description={srcMsg}>
              <button onClick={saveSource}
                className="text-sm px-3 py-1.5 rounded-lg outline-none cursor-pointer"
                style={{ background: 'var(--color-accent, var(--color-bg-tertiary))', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
                Save inference source
              </button>
            </SettingRow>
          </Section>

          {/* Models */}
          <Section title="Models">
            <SettingRow label="Local models (Ollama)" description="Models available for local inference">
              <OllamaModelList />
            </SettingRow>
            <div className="text-xs mt-2 px-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Run <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: 'var(--color-bg-tertiary)' }}>ollama pull &lt;model-name&gt;</code> in your terminal to add more models
            </div>
            <SettingRow label="Cloud providers" description="Green dot means API key is configured">
              <div className="flex flex-wrap gap-3">
                <CloudProviderStatus label="OpenAI" keyName="OPENAI_API_KEY" />
                <CloudProviderStatus label="Anthropic" keyName="ANTHROPIC_API_KEY" />
                <CloudProviderStatus label="Google" keyName="GEMINI_API_KEY" />
                <CloudProviderStatus label="OpenRouter" keyName="OPENROUTER_API_KEY" />
                <CloudProviderStatus label="Atlas Cloud" keyName="ATLASCLOUD_API_KEY" />
              </div>
            </SettingRow>
          </Section>

          {/* API Keys */}
          <Section title="API Keys">
            <SettingRow label="OpenAI" description="GPT models · setup and API-key management">
              <div className="flex flex-wrap items-center gap-3">
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Get API key</a>
                <ApiKeyInput keyName="OPENAI_API_KEY" placeholder="sk-..." />
              </div>
            </SettingRow>
            <SettingRow label="Anthropic" description="Claude models · setup and API-key management">
              <div className="flex flex-wrap items-center gap-3">
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Get API key</a>
                <ApiKeyInput keyName="ANTHROPIC_API_KEY" placeholder="sk-ant-..." />
              </div>
            </SettingRow>
            <SettingRow label="Google AI Studio" description="Gemini models · setup and API-key management">
              <div className="flex flex-wrap items-center gap-3">
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Get API key</a>
                <ApiKeyInput keyName="GEMINI_API_KEY" placeholder="AI..." />
              </div>
            </SettingRow>
            <SettingRow label="OpenRouter" description="Multi-provider routing · setup and API-key management">
              <div className="flex flex-wrap items-center gap-3">
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Get API key</a>
                <ApiKeyInput keyName="OPENROUTER_API_KEY" placeholder="sk-or-..." />
              </div>
            </SettingRow>
            <SettingRow label="Atlas Cloud" description="Models routed through Atlas Cloud · setup and API-key management">
              <div className="flex flex-wrap items-center gap-3">
                <a href="https://cloud.atlascloud.ai/" target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Open platform</a>
                <ApiKeyInput keyName="ATLASCLOUD_API_KEY" placeholder="Atlas Cloud API key" />
              </div>
            </SettingRow>
            <SettingRow label="Local and custom providers" description="Ollama plus OpenAI-compatible servers such as LM Studio, vLLM, SGLang, llama.cpp, and MLX">
              <a href="#inference-source" className="text-xs underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Configure inference source</a>
            </SettingRow>
          </Section>

          <SteamSettings />
          <AppIntegrationsSettings />
          <PersonalSourcesSettings />
          <DeveloperSettings />

          {/* Tools */}
          <Section title="Tools">
            <SettingRow label="Web Search" description="Tavily key for web search tool">
              <ApiKeyInput keyName="TAVILY_API_KEY" placeholder="tvly-..." toolName="web_search" />
            </SettingRow>
          </Section>

          {/* Memory */}
          <Section title="Memory">
            <MemoryStatusRow status={memoryStatus} onRetry={() => { void refreshMemoryStatus(); }} />
            <SettingRow label="Use memory context" description="Automatically inject relevant memories into conversations">
              <button
                onClick={() => {
                  const next = !memoryEnabled;
                  setMemoryEnabled(next);
                  try { localStorage.setItem('openjarvis-memory-enabled', String(next)); } catch {}
                  showSaved();
                }}
                className="relative w-11 h-6 rounded-full transition-colors cursor-pointer"
                style={{
                  background: memoryEnabled ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform bg-white"
                  style={{
                    transform: memoryEnabled ? 'translateX(20px)' : 'translateX(0)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </button>
            </SettingRow>
            <SettingRow label="Memory backend" description="Which retrieval engine to use">
              <select
                value={memoryBackend}
                onChange={(e) => {
                  setMemoryBackend(e.target.value);
                  try { localStorage.setItem('openjarvis-memory-backend', e.target.value); } catch {}
                  showSaved();
                }}
                className="text-sm px-3 py-1.5 rounded-lg outline-none cursor-pointer"
                style={{
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <option value="sqlite">sqlite</option>
                <option value="faiss">faiss</option>
                <option value="bm25">bm25</option>
                <option value="colbert">colbert</option>
                <option value="hybrid">hybrid</option>
              </select>
            </SettingRow>
            <SettingRow label="Results to inject" description={`${memoryTopK}`}>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={memoryTopK}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setMemoryTopK(v);
                  try { localStorage.setItem('openjarvis-memory-top-k', String(v)); } catch {}
                  showSaved();
                }}
                className="w-32 cursor-pointer accent-[var(--color-accent)]"
              />
            </SettingRow>
            <SettingRow label="Min relevance score" description={`${memoryMinScore}`}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={memoryMinScore}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setMemoryMinScore(v);
                  try { localStorage.setItem('openjarvis-memory-min-score', String(v)); } catch {}
                  showSaved();
                }}
                className="w-32 cursor-pointer accent-[var(--color-accent)]"
              />
            </SettingRow>
            <SettingRow label="Max context tokens" description={`${memoryMaxTokens}`}>
              <input
                type="range"
                min="256"
                max="8192"
                step="256"
                value={memoryMaxTokens}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setMemoryMaxTokens(v);
                  try { localStorage.setItem('openjarvis-memory-max-tokens', String(v)); } catch {}
                  showSaved();
                }}
                className="w-32 cursor-pointer accent-[var(--color-accent)]"
              />
            </SettingRow>
          </Section>

          {/* Model defaults */}
          <Section title="Model Defaults">
            <SettingRow label="Temperature" description={`${settings.temperature}`}>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => { updateSettings({ temperature: parseFloat(e.target.value) }); showSaved(); }}
                className="w-32 cursor-pointer accent-[var(--color-accent)]"
              />
            </SettingRow>
            <SettingRow label="Max tokens" description={`${settings.maxTokens}`}>
              <input
                type="range"
                min="256"
                max="32768"
                step="256"
                value={settings.maxTokens}
                onChange={(e) => { updateSettings({ maxTokens: parseInt(e.target.value) }); showSaved(); }}
                className="w-32 cursor-pointer accent-[var(--color-accent)]"
              />
            </SettingRow>
          </Section>

          {/* Speech */}
          <Section title="Speech">
            <SettingRow
              label="Hands-free voice"
              description="In Chat, start the microphone once, say “Jarvis” to speak, then say “Sleep Jarvis” to return to wake-word mode."
            >
              <span className="text-xs whitespace-nowrap" style={{ color: settings.handsFreeEnabled ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
                {settings.handsFreeEnabled ? 'On for next Chat visit' : 'Off'}
              </span>
            </SettingRow>
            <div className="mb-2 px-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
              Hands-free voice uses your browser’s speech-recognition service, which may process audio online. Browser microphone permission is requested when you start it in Chat; if blocked, allow Microphone in the site controls beside the address bar and retry.
            </div>
            <SettingRow label="Speech-to-Text" description="Enable microphone input for voice dictation">
              <button
                onClick={() => { updateSettings({ speechEnabled: !settings.speechEnabled }); showSaved(); }}
                className="relative w-11 h-6 rounded-full transition-colors cursor-pointer"
                style={{
                  background: settings.speechEnabled ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform bg-white"
                  style={{
                    transform: settings.speechEnabled ? 'translateX(20px)' : 'translateX(0)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </button>
            </SettingRow>
            <SettingRow label="Text-to-Speech" description="Show a read-aloud button on assistant replies">
              <button
                onClick={() => { updateSettings({ voiceOutputEnabled: !settings.voiceOutputEnabled }); showSaved(); }}
                className="relative w-11 h-6 rounded-full transition-colors cursor-pointer"
                style={{
                  background: settings.voiceOutputEnabled ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform bg-white"
                  style={{
                    transform: settings.voiceOutputEnabled ? 'translateX(20px)' : 'translateX(0)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </button>
            </SettingRow>
            <SettingRow label="Speak replies automatically" description="Read every assistant reply aloud as soon as it finishes">
              <button
                onClick={() => { updateSettings({ voiceAutoplay: !settings.voiceAutoplay }); showSaved(); }}
                disabled={!settings.voiceOutputEnabled}
                className="relative w-11 h-6 rounded-full transition-colors cursor-pointer"
                style={{
                  background: settings.voiceAutoplay && settings.voiceOutputEnabled ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                  opacity: settings.voiceOutputEnabled ? 1 : 0.4,
                  cursor: settings.voiceOutputEnabled ? 'pointer' : 'default',
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform bg-white"
                  style={{
                    transform: settings.voiceAutoplay && settings.voiceOutputEnabled ? 'translateX(20px)' : 'translateX(0)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </button>
            </SettingRow>
            <SettingRow label="Voice" description="Select an English Kokoro voice, including American and British accents">
              <select
                value={settings.voiceId}
                onChange={(e) => { updateSettings({ voiceId: e.target.value }); showSaved(); }}
                className="text-sm px-3 py-1.5 rounded-lg outline-none cursor-pointer"
                style={{
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <optgroup label="American English — feminine">
                  <option value="af_heart">Heart — American</option>
                  <option value="af_bella">Bella — American</option>
                  <option value="af_nicole">Nicole — American</option>
                  <option value="af_sarah">Sarah — American</option>
                  <option value="af_sky">Sky — American</option>
                </optgroup>
                <optgroup label="American English — masculine">
                  <option value="am_adam">Adam — American</option>
                  <option value="am_michael">Michael — American</option>
                </optgroup>
                <optgroup label="British English — feminine">
                  <option value="bf_emma">Emma — British</option>
                  <option value="bf_isabella">Isabella — British</option>
                </optgroup>
                <optgroup label="British English — masculine">
                  <option value="bm_george">George — British</option>
                  <option value="bm_lewis">Lewis — British</option>
                </optgroup>
              </select>
            </SettingRow>
            <SettingRow label="Voice backend" description="Backend and currently configured voice">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: ttsBackend?.available ? 'var(--color-success)' : 'var(--color-text-tertiary)',
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {ttsBackend === null ? 'Checking...'
                    : ttsBackend.available ? `${ttsBackend.backend}${ttsBackend.voice_id ? ` / ${ttsBackend.voice_id}` : ''}`
                    : 'Not configured'}
                </span>
              </div>
            </SettingRow>
            <SettingRow label="Test voice" description="Play a short sample using the selected voice">
              <button
                type="button"
                onClick={() => {
                    if (tts.speakingId === 'speech-test' && tts.state !== 'idle') {
                      tts.stop();
                    } else {
                      void tts.speak('speech-test', 'Good evening. It is a pleasure to speak with you.');
                    }
                }}
                disabled={!tts.available}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                }}
                aria-busy={tts.speakingId === 'speech-test' && tts.state === 'loading'}
              >
                {tts.speakingId === 'speech-test' && tts.state !== 'idle'
                    ? <><Square size={12} /> Stop test</>
                    : <><Volume2 size={12} /> Test voice</>}
              </button>
            </SettingRow>
            {tts.errorId === 'speech-test' && tts.error && (
              <div role="alert" className="text-xs px-1" style={{ color: 'var(--color-error)' }}>
                Voice test failed: {tts.error}
              </div>
            )}
            <SettingRow label="Backend status" description="Requires Whisper, Deepgram, or another speech backend">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: speechBackendAvailable === true ? 'var(--color-success)'
                      : speechBackendAvailable === false ? 'var(--color-text-tertiary)'
                      : 'var(--color-text-tertiary)',
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {speechBackendAvailable === null ? 'Checking...'
                    : speechBackendAvailable ? 'Available'
                    : 'Not configured'}
                </span>
              </div>
            </SettingRow>
            {!speechBackendAvailable && speechBackendAvailable !== null && (
              <div className="text-xs mt-2 px-1" style={{ color: 'var(--color-text-tertiary)' }}>
                Set up a speech backend to use voice input.
                See the <a href="https://open-jarvis.github.io/OpenJarvis/user-guide/tools/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>documentation</a> for details.
              </div>
            )}
            {ttsBackend?.available === false && (
              <div className="text-xs mt-2 px-1" style={{ color: 'var(--color-text-tertiary)' }}>
                Set up a text-to-speech backend to hear spoken replies.
              </div>
            )}
          </Section>

          {/* Data */}
          <Section title="Data">
            <SettingRow label="Conversations" description={`${conversations.length} stored locally`}>
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
                >
                  <Download size={12} /> Export
                </button>
                <button
                  onClick={handleImport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
                >
                  <Upload size={12} /> Import
                </button>
              </div>
            </SettingRow>
            <SettingRow label="Clear all data" description="Permanently delete all conversations">
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                style={{
                  color: confirmClear ? 'white' : 'var(--color-error)',
                  background: confirmClear ? 'var(--color-error)' : 'transparent',
                  border: '1px solid var(--color-error)',
                }}
                onMouseEnter={(e) => { if (!confirmClear) e.currentTarget.style.background = 'rgba(220,38,38,0.1)'; }}
                onMouseLeave={(e) => { if (!confirmClear) e.currentTarget.style.background = 'transparent'; }}
              >
                <Trash2 size={12} /> {confirmClear ? 'Click again to confirm' : 'Clear'}
              </button>
            </SettingRow>
          </Section>

          {/* Updates */}
          <Section title="Updates">
            <UpdateActionRow
              label="Update apps"
              description="Upgrade installed optional programs (Steam, Discord, OBS, and others) via winget"
              idleText="Update apps"
              run={updateInstalledApps}
            />
            <UpdateActionRow
              label="Update models"
              description="Re-pull your local Ollama models to get the latest versions"
              idleText="Update models"
              run={updateLocalModels}
            />
          </Section>
          <Section title="About">
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="mb-2">
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>OpenJarvis</span> — Programming abstractions for on-device AI.
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Part of Intelligence Per Watt, a research initiative at Stanford SAIL.
              </p>
              <div className="flex gap-3 mt-3 text-xs">
                <a
                  href="https://openjarvis.stanford.edu/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent)' }}
                >
                  Project site
                </a>
                <a
                  href="https://open-jarvis.github.io/OpenJarvis/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent)' }}
                >
                  Documentation
                </a>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
