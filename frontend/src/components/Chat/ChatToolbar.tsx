import { Paperclip, X, Shield, Image as ImageIcon, Film } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../lib/store';

export interface Attachment {
  id: string;
  name: string;
  kind: 'image' | 'text';
  /** data URL for images, file text for text files */
  data: string;
}

export const CHAT_MODES = [
  { id: 'ask', label: 'Ask', hint: 'Answer questions directly' },
  { id: 'agent', label: 'Agent', hint: 'Work through tasks step by step, acting autonomously' },
  { id: 'plan', label: 'Plan', hint: 'Produce a plan before doing anything' },
  { id: 'edit', label: 'Edit', hint: 'Return precise edits to the supplied text/code' },
] as const;

export const MODE_PROMPTS: Record<string, string> = {
  ask: '',
  agent:
    'You are in Agent mode. Break the request into steps, carry them out, and report what you did and the result.',
  plan:
    'You are in Plan mode. Do not execute anything. Reply with a clear, numbered plan with risks and open questions.',
  edit:
    'You are in Edit mode. Reply only with the revised text or code (and a one-line summary of changes). Preserve everything not asked to change.',
};

export const MODE_STATUS: Record<string, string> = {
  ask: 'replies directly to your question.',
  agent: 'works through your request step by step and reports what it did.',
  plan: 'replies with a numbered plan only, nothing is carried out.',
  edit: 'replies only with the revised text or code you supplied.',
};

export const MODE_PLACEHOLDERS: Record<string, string> = {
  ask: 'Ask anything...',
  agent: 'Describe a task for Jarvis to carry out...',
  plan: 'Describe what to plan...',
  edit: 'Paste text or code and say what to change...',
};

const pill = (active: boolean): React.CSSProperties => ({
  background: active ? 'var(--color-accent-subtle)' : 'transparent',
  border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
  color: active ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
});

export function ChatToolbar({
  attachments,
  onAttach,
  onRemove,
  onCommand,
  onConvert,
  disabled,
}: {
  attachments: Attachment[];
  onAttach: () => void;
  onRemove: (id: string) => void;
  onCommand: (cmd: string) => void;
  onConvert: (format: string) => void;
  disabled?: boolean;
}) {
  const models = useAppStore((s) => s.models);
  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [permsOpen, setPermsOpen] = useState(false);

  const perms = [
    { key: 'allowFiles', label: 'Read attached files' },
    { key: 'allowWeb', label: 'Web access' },
    { key: 'allowShell', label: 'Run shell commands' },
    { key: 'personalSourcesEnabled', label: 'Personal sources' },
    { key: 'steamContextEnabled', label: 'Steam library' },
  ] as const;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span style={{ color: 'var(--color-text-tertiary)' }}>Model</span>
        <select
          aria-label="Model"
          title={`${models.length} model${models.length === 1 ? '' : 's'} available`}
          value={selectedModel}
          disabled={disabled}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="rounded-full px-2.5 py-1 cursor-pointer"
          style={{ ...pill(false), background: 'var(--color-bg-secondary)', maxWidth: 200 }}
        >
          {!selectedModel && <option value="">Pick model…</option>}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
        </select>
        <div role="group" aria-label="Mode" className="flex items-center gap-1">
          {CHAT_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.hint}
              aria-pressed={settings.chatMode === m.id}
              onClick={() => updateSettings({ chatMode: m.id })}
              className="rounded-full px-2.5 py-1 cursor-pointer"
              style={pill(settings.chatMode === m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPermsOpen((v) => !v)}
            aria-expanded={permsOpen}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 cursor-pointer"
            style={pill(permsOpen)}
            title="Tool permissions"
          >
            <Shield size={12} /> Permissions
          </button>
          {permsOpen && (
            <div
              className="absolute bottom-full left-0 mb-1 z-20 rounded-xl p-2 flex flex-col gap-1 min-w-[190px]"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {perms.map((p) => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings[p.key])}
                    onChange={(e) => updateSettings({ [p.key]: e.target.checked })}
                  />
                  <span style={{ color: 'var(--color-text-secondary)' }}>{p.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onCommand('/image')}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 cursor-pointer disabled:opacity-50"
          style={pill(false)}
          title="Generate an AI image from a prompt"
        >
          <ImageIcon size={12} /> Image
        </button>
        <button
          type="button"
          onClick={() => onCommand('/video')}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 cursor-pointer disabled:opacity-50"
          style={pill(false)}
          title="Generate an AI video from a prompt (slow on CPU)"
        >
          <Film size={12} /> Video
        </button>
        <select
          aria-label="Convert audio or video"
          value=""
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value) onConvert(e.target.value);
          }}
          className="rounded-full px-2.5 py-1 cursor-pointer"
          style={{ ...pill(false), background: 'var(--color-bg-secondary)' }}
          title="Convert an audio or video file"
        >
          <option value="">Convert…</option>
          <optgroup label="Audio">
            {['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].map((f) => (
              <option key={f} value={f}>to {f}</option>
            ))}
          </optgroup>
          <optgroup label="Video">
            {['mp4', 'webm', 'mkv', 'avi', 'mov', 'gif'].map((f) => (
              <option key={f} value={f}>to {f}</option>
            ))}
          </optgroup>
        </select>
        <button
          type="button"
          onClick={onAttach}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 cursor-pointer disabled:opacity-50"
          style={pill(false)}
          title="Attach files or images"
        >
          <Paperclip size={12} /> Attach
        </button>
      </div>
      <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        {CHAT_MODES.find((m) => m.id === settings.chatMode)?.label} mode: {MODE_STATUS[settings.chatMode]}
      </div>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs"
              style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
            >
              {a.kind === 'image' && (
                <img src={a.data} alt="" className="h-5 w-5 rounded object-cover" />
              )}
              {a.name}
              <button type="button" onClick={() => onRemove(a.id)} aria-label={`Remove ${a.name}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
