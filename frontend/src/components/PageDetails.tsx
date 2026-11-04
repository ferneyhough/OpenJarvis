import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { fetchManagedAgents, fetchMediaLibrary, fetchNativeApps, getBase, openAllowedLink, type ManagedAgent } from '../lib/api';
import { MUSIC_APPS } from '../lib/music-commands';
import { listConnectors } from '../lib/connectors-api';
import type { ConnectorInfo } from '../types/connectors';

type Tab = 'fields' | 'library' | 'media' | 'deals' | 'feeds' | 'chats';

const TABS: { id: Tab; label: string }[] = [
  { id: 'fields', label: 'Fields' },
  { id: 'library', label: 'Library' },
  { id: 'media', label: 'Images & videos' },
  { id: 'deals', label: 'Store deals' },
  { id: 'feeds', label: 'Social feeds' },
  { id: 'chats', label: 'Chats' },
];

const PAGES: Record<string, { title: string; keywords: string[] }> = {
  '/': { title: 'Chat', keywords: [] },
  '/dashboard': { title: 'Dashboard', keywords: ['usage', 'stat', 'cost', 'dashboard'] },
  '/data-sources': { title: 'Data Sources', keywords: ['source', 'connector', 'sync', 'data'] },
  '/agents': { title: 'Agents', keywords: ['agent', 'task', 'schedule'] },
  '/logs': { title: 'Logs', keywords: ['log', 'error', 'trace'] },
  '/settings': { title: 'Settings', keywords: ['setting', 'voice', 'model', 'config'] },
  '/get-started': { title: 'Get Started', keywords: ['install', 'setup', 'start', 'help'] },
};

const DEALS = [
  { label: 'Steam specials', url: 'https://store.steampowered.com/specials' },
  { label: 'Epic free games', url: 'https://store.epicgames.com/free-games' },
  { label: 'GOG deals', url: 'https://www.gog.com/en/games?discounted=true' },
  { label: 'Humble Bundle', url: 'https://www.humblebundle.com/store/promo/deals' },
  { label: 'IsThereAnyDeal', url: 'https://isthereanydeal.com/deals/' },
];



const FEEDS = [
  { label: 'Reddit – r/LocalLLaMA', url: 'https://www.reddit.com/r/LocalLLaMA/' },
  { label: 'Reddit – r/StableDiffusion', url: 'https://www.reddit.com/r/StableDiffusion/' },
  { label: 'YouTube – AI', url: 'https://www.youtube.com/results?search_query=ai+news' },
  { label: 'X / Twitter – AI', url: 'https://x.com/search?q=AI&f=live' },
  { label: 'Hacker News', url: 'https://news.ycombinator.com/' },
];

const border = '1px solid var(--color-border)';
const muted = { color: 'var(--color-text-tertiary)' } as const;
const inputStyle = { background: 'var(--color-bg)', border, color: 'var(--color-text)' } as const;

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-text)' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}

interface AppLink {
  label: string;
  url: string;
  embed?: string;
}

const EMBEDS: Record<string, string> = {
  'https://open.spotify.com/': 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M',
  'https://soundcloud.com/': 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fsoundcloud&visual=false',
};

function AppRow({ item, installed }: { item: AppLink; installed: boolean }) {
  const [open, setOpen] = useState(false);
  const embed = item.embed ?? EMBEDS[item.url];
  const launch = () => {
    openAllowedLink(item.url).catch(() => {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    });
  };
  return (
    <li className="rounded" style={{ border }}>
      <div className="flex items-center gap-2 px-2 py-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label}`}
          className="flex flex-1 items-center gap-1.5 text-left cursor-pointer"
          style={{ color: 'var(--color-text)' }}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {item.label}
          {installed && <span className="ml-1 text-[10px]" style={{ color: 'var(--color-accent)' }}>app installed</span>}
        </button>
        <button
          type="button"
          onClick={launch}
          className="shrink-0 rounded px-2 py-0.5 cursor-pointer"
          style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
        >
          {installed ? 'Open app' : 'Launch'}
        </button>
      </div>
      {open && (
        <div className="px-2 pb-2">
          {embed ? (
            <iframe
              src={embed}
              title={`${item.label} player`}
              loading="lazy"
              allow="autoplay; encrypted-media; clipboard-write"
              className="h-40 w-full rounded"
              style={{ border: 0 }}
            />
          ) : (
            <p style={muted}>
              {item.label} can&apos;t be embedded here. Use Launch to open it in your browser.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function useEnabledMusicApps() {
  const enabled = useAppStore((s) => s.settings.hubEnabledApps);
  return MUSIC_APPS.filter((a) => enabled.includes(`music-${a.id}`));
}

export function Links({ items }: { items: AppLink[] }) {
  const [native, setNative] = useState<Record<string, boolean>>({});
  useEffect(() => {
    fetchNativeApps().then(setNative).catch(() => {});
  }, []);
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((i) => (
        <AppRow key={i.url} item={i} installed={!!native[new URL(i.url).hostname]} />
      ))}
    </ul>
  );
}

function Row({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full truncate rounded px-2 py-1 text-left"
      style={{
        background: active ? 'var(--color-accent-subtle)' : 'transparent',
        color: 'var(--color-text)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>{label}{children}</label>;
}

/** Developer-mode panel below every page: page-specific fields, libraries, media, deals, feeds, chats. */
export function PageDetails() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('fields');
  const [media, setMedia] = useState<Awaited<ReturnType<typeof fetchMediaLibrary>>>([]);
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [agents, setAgents] = useState<ManagedAgent[]>([]);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const developerMode = useAppStore((s) => s.settings.developerModeEnabled);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const models = useAppStore((s) => s.models);
  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);
  const conversations = useAppStore((s) => s.conversations);
  const activeId = useAppStore((s) => s.activeId);
  const selectConversation = useAppStore((s) => s.selectConversation);

  const page = PAGES[pathname] ?? { title: 'Page', keywords: [] };

  useEffect(() => {
    if (!developerMode || !open) return;
    if (tab === 'media') fetchMediaLibrary().then(setMedia).catch(() => setMedia([]));
    if (tab === 'library' && pathname === '/data-sources') listConnectors().then(setConnectors).catch(() => setConnectors([]));
    if (tab === 'library' && pathname === '/agents') fetchManagedAgents().then(setAgents).catch(() => setAgents([]));
  }, [developerMode, open, tab, pathname]);

  if (!developerMode) return null;

  const related = page.keywords.length
    ? conversations.filter((c) => {
        const hay = `${c.title} ${c.messages.slice(0, 3).map((m) => m.content).join(' ')}`.toLowerCase();
        return page.keywords.some((k) => hay.includes(k));
      })
    : conversations;
  const chats = (related.length ? related : conversations).slice(0, 20);

  return (
    <div
      className="shrink-0 relative z-[3]"
      style={{ borderTop: border, background: 'var(--color-bg-secondary)' }}
      data-testid="page-details"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-xs cursor-pointer"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        {page.title} details
      </button>
      {open && (
        <div className="px-4 pb-3">
          <div className="mb-2 flex flex-wrap gap-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className="rounded-md px-2.5 py-1 text-xs cursor-pointer"
                style={{
                  background: tab === t.id ? 'var(--color-accent-subtle)' : 'transparent',
                  color: tab === t.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="max-h-48 overflow-y-auto text-xs">
            {tab === 'fields' && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {pathname === '/' && (
                  <>
                    <Field label="Mode">
                      <select
                        value={settings.chatMode}
                        onChange={(e) => updateSettings({ chatMode: e.target.value as typeof settings.chatMode })}
                        className="rounded px-2 py-1"
                        style={inputStyle}
                      >
                        {['ask', 'agent', 'plan', 'edit'].map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </Field>
                    <Field label="Temperature">
                      <input
                        type="number" min={0} max={2} step={0.1} value={settings.temperature}
                        onChange={(e) => updateSettings({ temperature: Number(e.target.value) })}
                        className="w-16 rounded px-2 py-1" style={inputStyle}
                      />
                    </Field>
                    <Field label="Max tokens">
                      <input
                        type="number" min={64} step={64} value={settings.maxTokens}
                        onChange={(e) => updateSettings({ maxTokens: Number(e.target.value) })}
                        className="w-20 rounded px-2 py-1" style={inputStyle}
                      />
                    </Field>
                    <Toggle label="Allow files" checked={settings.allowFiles} onChange={(v) => updateSettings({ allowFiles: v })} />
                    <Toggle label="Allow web" checked={settings.allowWeb} onChange={(v) => updateSettings({ allowWeb: v })} />
                    <Toggle label="Allow shell" checked={settings.allowShell} onChange={(v) => updateSettings({ allowShell: v })} />
                  </>
                )}
                {(pathname === '/settings' || pathname === '/get-started') && (
                  <>
                    <Toggle label="Voice autoplay" checked={settings.voiceAutoplay} onChange={(v) => updateSettings({ voiceAutoplay: v })} />
                    <Toggle label="Hands-free" checked={settings.handsFreeEnabled} onChange={(v) => updateSettings({ handsFreeEnabled: v })} />
                    <Toggle label="Local image model" checked={settings.localImageModel} onChange={(v) => updateSettings({ localImageModel: v })} />
                    <Toggle label="Local video model" checked={settings.localVideoModel} onChange={(v) => updateSettings({ localVideoModel: v })} />
                  </>
                )}
                {pathname === '/data-sources' && (
                  <Toggle label="Personal sources in chat" checked={settings.personalSourcesEnabled} onChange={(v) => updateSettings({ personalSourcesEnabled: v })} />
                )}
                {(pathname === '/dashboard' || pathname === '/logs' || pathname === '/agents') && (
                  <span style={muted}>This page has no extra settings of its own.</span>
                )}
                {pathname !== '/settings' && (
                  <button onClick={() => navigate('/settings')} className="underline cursor-pointer" style={{ color: 'var(--color-accent)' }}>
                    All settings
                  </button>
                )}
              </div>
            )}
            {tab === 'library' && (
              <ul className="flex flex-col gap-1">
                {pathname === '/data-sources' && connectors.map((c) => (
                  <li key={c.connector_id}>
                    <Row>{c.display_name} <span style={muted}>· {c.connected ? 'connected' : 'not connected'}</span></Row>
                  </li>
                ))}
                {pathname === '/agents' && agents.map((a) => (
                  <li key={a.id}><Row>{a.name} <span style={muted}>· {a.agent_type} · {a.status}</span></Row></li>
                ))}
                {models.length === 0 && <li style={muted}>No models loaded.</li>}
                {models.map((m) => (
                  <li key={m.id}>
                    <Row active={m.id === selectedModel} onClick={() => setSelectedModel(m.id)}>
                      {m.id} <span style={muted}>· {m.owned_by}</span>{m.id === selectedModel ? ' ✓' : ''}
                    </Row>
                  </li>
                ))}
              </ul>
            )}
            {tab === 'media' && (
              media.length === 0 ? (
                <p style={muted}>Nothing generated or converted yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {media.map((m) => (
                    <a key={m.name} href={`${getBase()}${m.url}`} target="_blank" rel="noreferrer noopener" title={m.name}>
                      {m.kind === 'image' ? (
                        <img src={`${getBase()}${m.url}`} alt={m.name} className="h-16 w-16 rounded object-cover" />
                      ) : (
                        <span className="flex h-16 w-24 items-center justify-center rounded px-1 text-center" style={{ border, color: 'var(--color-text)' }}>
                          {m.kind === 'video' ? '🎬' : '🎵'} {m.name.slice(0, 14)}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              )
            )}
            {tab === 'deals' && <Links items={DEALS} />}
            {tab === 'feeds' && <Links items={FEEDS} />}
            {tab === 'chats' && (
              <ul className="flex flex-col gap-1">
                {chats.length === 0 && <li style={muted}>No chats yet.</li>}
                {chats.map((c) => (
                  <li key={c.id}>
                    <Row active={c.id === activeId} onClick={() => { selectConversation(c.id); navigate('/'); }}>
                      {c.title || 'Untitled'}
                    </Row>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
