import { useTtsStore } from '../../lib/tts';

interface Props {
  phase: string;
  model: string;
  elapsedMs: number;
  hasContent: boolean;
  toolCount: number;
}

/** Live "working" line shown while a reply streams — phase, elapsed time,
 *  which model is thinking, tool count, and whether Jarvis is speaking. */
export function WorkingStatus({ phase, model, elapsedMs, hasContent, toolCount }: Props) {
  const ttsActive = useTtsStore(
    (s) => s.state === 'loading' || s.state === 'speaking',
  );
  const secs = (elapsedMs / 1000).toFixed(1);
  const parts = [phase || 'Working…', `${secs}s`];
  if (model) parts.push(model);
  if (toolCount > 0) parts.push(`${toolCount} tool${toolCount === 1 ? '' : 's'}`);
  if (ttsActive) parts.push('speaking');

  return (
    <div
      className="flex items-center gap-2 py-1"
      style={{ color: 'var(--color-text-tertiary)' }}
    >
      {!hasContent && (
        <div className="flex gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ background: 'var(--color-text-tertiary)', animationDelay: '0ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ background: 'var(--color-text-tertiary)', animationDelay: '150ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ background: 'var(--color-text-tertiary)', animationDelay: '300ms' }}
          />
        </div>
      )}
      <span className="text-xs">{parts.join(' · ')}</span>
    </div>
  );
}
