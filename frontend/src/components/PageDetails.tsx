import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '../lib/store';

type Tab = 'fields' | 'library' | 'chats';

const TABS: { id: Tab; label: string }[] = [
  { id: 'fields', label: 'Fields' },
  { id: 'library', label: 'Library' },
  { id: 'chats', label: 'Chats' },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Chat',
  '/dashboard': 'Dashboard',
  '/data-sources': 'Data Sources',
  '/agents': 'Agents',
  '/logs': 'Logs',
  '/settings': 'Settings',
  '/get-started': 'Get Started',
};

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

/** Collapsible panel below every page: quick fields, library and related chats. */
export function PageDetails() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('fields');
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const models = useAppStore((s) => s.models);
  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);
  const conversations = useAppStore((s) => s.conversations);
  const activeId = useAppStore((s) => s.activeId);
  const selectConversation = useAppStore((s) => s.selectConversation);

  const title = PAGE_TITLES[pathname] ?? 'Page';
  const isChat = pathname === '/';
  const chats = conversations.slice(0, 20);
  const border = '1px solid var(--color-border)';

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
        {title} details — fields, library, chats
      </button>
      {open && (
        <div className="px-4 pb-3">
          <div className="mb-2 flex gap-1" role="tablist">
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
                <label className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  Mode
                  <select
                    value={settings.chatMode}
                    onChange={(e) => updateSettings({ chatMode: e.target.value as typeof settings.chatMode })}
                    className="rounded px-2 py-1"
                    style={{ background: 'var(--color-bg)', border, color: 'var(--color-text)' }}
                  >
                    {['ask', 'agent', 'plan', 'edit'].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  Temperature
                  <input
                    type="number" min={0} max={2} step={0.1}
                    value={settings.temperature}
                    onChange={(e) => updateSettings({ temperature: Number(e.target.value) })}
                    className="w-16 rounded px-2 py-1"
                    style={{ background: 'var(--color-bg)', border, color: 'var(--color-text)' }}
                  />
                </label>
                <Toggle label="Allow files" checked={settings.allowFiles} onChange={(v) => updateSettings({ allowFiles: v })} />
                <Toggle label="Allow web" checked={settings.allowWeb} onChange={(v) => updateSettings({ allowWeb: v })} />
                <Toggle label="Allow shell" checked={settings.allowShell} onChange={(v) => updateSettings({ allowShell: v })} />
                <Toggle label="Personal sources" checked={settings.personalSourcesEnabled} onChange={(v) => updateSettings({ personalSourcesEnabled: v })} />
                <Toggle label="Voice autoplay" checked={settings.voiceAutoplay} onChange={(v) => updateSettings({ voiceAutoplay: v })} />
                {!isChat && (
                  <button
                    onClick={() => navigate('/settings')}
                    className="underline cursor-pointer"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    All settings
                  </button>
                )}
              </div>
            )}
            {tab === 'library' && (
              <ul className="flex flex-col gap-1">
                {models.length === 0 && <li style={{ color: 'var(--color-text-tertiary)' }}>No models loaded.</li>}
                {models.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => setSelectedModel(m.id)}
                      className="w-full rounded px-2 py-1 text-left cursor-pointer"
                      style={{
                        background: m.id === selectedModel ? 'var(--color-accent-subtle)' : 'transparent',
                        color: 'var(--color-text)',
                      }}
                    >
                      {m.id} <span style={{ color: 'var(--color-text-tertiary)' }}>· {m.owned_by}</span>
                      {m.id === selectedModel ? ' ✓' : ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {tab === 'chats' && (
              <ul className="flex flex-col gap-1">
                {chats.length === 0 && <li style={{ color: 'var(--color-text-tertiary)' }}>No chats yet.</li>}
                {chats.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => { selectConversation(c.id); navigate('/'); }}
                      className="w-full truncate rounded px-2 py-1 text-left cursor-pointer"
                      style={{
                        background: c.id === activeId ? 'var(--color-accent-subtle)' : 'transparent',
                        color: 'var(--color-text)',
                      }}
                    >
                      {c.title || 'Untitled'}
                    </button>
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
