export type PermissionMode = 'allow' | 'manual' | 'sandbox';

export const PERMISSION_MODES: readonly { id: PermissionMode; label: string; hint: string }[] = [
  { id: 'allow', label: 'Allow', hint: 'Use the permissions you ticked below' },
  { id: 'manual', label: 'Manual', hint: 'Ask before each message that uses a ticked permission' },
  { id: 'sandbox', label: 'Sandbox', hint: 'No shell, web or personal data; only attached files' },
];

export interface Capabilities {
  allowShell: boolean;
  allowWeb: boolean;
  personalSourcesEnabled: boolean;
  steamContextEnabled: boolean;
}

const LABELS: Record<keyof Capabilities, string> = {
  allowShell: 'run shell commands',
  allowWeb: 'access the web',
  personalSourcesEnabled: 'read your personal sources',
  steamContextEnabled: 'read your Steam library',
};

const NONE: Capabilities = {
  allowShell: false,
  allowWeb: false,
  personalSourcesEnabled: false,
  steamContextEnabled: false,
};

/** Capabilities a single message may use, given the mode and the ticked permissions. */
export function resolvePermissions(
  mode: PermissionMode,
  ticked: Capabilities,
  ask: (message: string) => boolean,
): Capabilities {
  if (mode === 'sandbox') return NONE;
  if (mode !== 'manual') return ticked;
  const wanted = (Object.keys(LABELS) as (keyof Capabilities)[]).filter((k) => ticked[k]);
  if (wanted.length === 0) return ticked;
  const ok = ask(
    `Allow Jarvis to ${wanted.map((k) => LABELS[k]).join(', ')} for this message?\n\nCancel sends it in sandbox (none of these).`,
  );
  return ok ? ticked : NONE;
}
