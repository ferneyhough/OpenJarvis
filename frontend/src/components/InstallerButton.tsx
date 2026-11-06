import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadInstaller, resolveInstaller, runInstaller } from '../lib/api';
import { openInAppBrowser } from '../lib/in-app-browser';

/**
 * Small icon button that turns a product/repo link into an installed app:
 * resolves the page to a real installer file, downloads it into
 * ~/.openjarvis/installers, then launches it.
 */
export function InstallerButton({
  url,
  name,
  color = 'var(--color-accent)',
}: {
  url: string;
  name: string;
  color?: string;
}) {
  const [busy, setBusy] = useState(false);

  const install = async () => {
    setBusy(true);
    const toastId = toast.loading(`Finding installer for ${name}…`);
    try {
      const candidates = await resolveInstaller(url);
      if (!candidates.length) {
        toast.info(`${name}: no direct installer found — opening inside Jarvis.`, { id: toastId });
        openInAppBrowser(url, name);
        return;
      }
      const best = candidates[0];
      const extra = candidates.length > 1 ? ` (${candidates.length} builds found, picked ${best.name})` : '';
      toast.loading(`Downloading ${best.name}${extra}…`, { id: toastId });
      const file = await downloadInstaller(best.url, best.name);
      toast.loading(`Launching ${file.name}…`, { id: toastId });
      await runInstaller(file.path);
      toast.success(`${name}: installer launched — complete setup in the window that opened. Saved to ~/.openjarvis/installers`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error), { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void install();
      }}
      disabled={busy}
      title={`Download & install ${name} (saved to ~/.openjarvis/installers)`}
      aria-label={`Install ${name}`}
      className="inline-flex h-9 w-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50"
      style={{ color, background: `${color}14`, border: `1px solid ${color}44` }}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
    </button>
  );
}
