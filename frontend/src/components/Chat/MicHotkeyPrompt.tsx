import { Keyboard, X } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { HOTKEY_OPTIONS, hotkeyLabel } from '../../lib/hotkeys';

// One-time prompt asking the user to pick a mic push-to-talk hotkey.
// Shown until settings.micHotkey is set ('Off' counts as set).
export function MicHotkeyPrompt() {
  const micHotkey = useAppStore((s) => s.settings.micHotkey);
  const updateSettings = useAppStore((s) => s.updateSettings);

  if (micHotkey !== '') return null;

  return (
    <div
      className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs"
      style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
      role="dialog"
      aria-label="Set mic hotkey"
    >
      <Keyboard size={14} style={{ color: 'var(--color-accent)' }} />
      <span className="font-medium" style={{ color: 'var(--color-text)' }}>Set your mic hotkey</span>
      <span>— press it anytime to start/stop dictation:</span>
      {HOTKEY_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => updateSettings({ micHotkey: opt.id })}
          className="rounded-md px-2 py-1 font-medium"
          style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
          title={opt.global ? 'Also works system-wide in the desktop app' : undefined}
        >
          {hotkeyLabel(opt.id)}
          {opt.global ? ' ⤢' : ''}
        </button>
      ))}
      <button
        type="button"
        onClick={() => updateSettings({ micHotkey: 'Off' })}
        className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1"
        style={{ color: 'var(--color-text-tertiary)' }}
        title="Don't ask again"
      >
        <X size={12} /> Not now
      </button>
    </div>
  );
}
