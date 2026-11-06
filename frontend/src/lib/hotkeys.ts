// Mic push-to-talk hotkey parsing/matching.

export interface HotkeySpec {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export const HOTKEY_OPTIONS: { id: string; label: string; global?: boolean }[] = [
  { id: 'F9', label: 'F9', global: true },
  { id: 'Ctrl+Space', label: 'Ctrl + Space' },
  { id: 'Ctrl+Shift+M', label: 'Ctrl + Shift + M' },
  { id: 'Alt+Space', label: 'Alt + Space' },
];

export function parseHotkey(id: string): HotkeySpec | null {
  const parts = id.split('+').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1).map((p) => p.toLowerCase());
  if (!key) return null;
  return {
    key,
    ctrl: mods.includes('ctrl') || mods.includes('control'),
    shift: mods.includes('shift'),
    alt: mods.includes('alt'),
    meta: mods.includes('meta') || mods.includes('cmd') || mods.includes('win'),
  };
}

export function hotkeyLabel(id: string): string {
  const spec = parseHotkey(id);
  if (!spec) return id;
  const mods = [
    spec.ctrl && 'Ctrl',
    spec.alt && 'Alt',
    spec.shift && 'Shift',
    spec.meta && 'Win',
  ].filter(Boolean);
  return [...mods, spec.key].join(' + ');
}

export function matchesHotkey(e: KeyboardEvent, id: string): boolean {
  const spec = parseHotkey(id);
  if (!spec) return false;
  if (e.key.toLowerCase() !== spec.key.toLowerCase()) return false;
  // Function keys report e.key as 'F9' etc.; modifiers must match exactly so
  // plain F9 doesn't fire when Ctrl is held (and vice versa).
  return (
    e.ctrlKey === spec.ctrl &&
    e.shiftKey === spec.shift &&
    e.altKey === spec.alt &&
    e.metaKey === spec.meta
  );
}
