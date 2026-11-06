import { toast } from 'sonner';
import {
  resolveInstaller,
  downloadInstaller,
  runInstaller,
} from './api';
import { openInAppBrowser } from './in-app-browser';

/**
 * Smart hub-tile open: try to resolve + download + launch a real installer
 * first; when no installer exists (web apps, stores, dashboards), open the
 * page inside Jarvis' in-app browser instead of the system browser.
 */
export async function openHubApp(url: string, name: string): Promise<void> {
  const toastId = toast.loading(`Checking ${name} for an installer…`);
  try {
    const candidates = await resolveInstaller(url);
    if (candidates.length > 0) {
      const best = candidates[0];
      const extra = candidates.length > 1 ? ` (${candidates.length} builds, picked ${best.name})` : '';
      toast.loading(`Downloading ${best.name}${extra}…`, { id: toastId });
      const file = await downloadInstaller(best.url, best.name);
      toast.loading(`Launching ${file.name}…`, { id: toastId });
      await runInstaller(file.path);
      toast.success(`${name}: installer launched — saved to ~/.openjarvis/installers`, { id: toastId, duration: 6000 });
      // Post-install follow-ups: some apps pair with a companion resource.
      if (/poweriso\.com/i.test(url)) {
        setTimeout(() => {
          openInAppBrowser('https://github.com/benevides/PowerISO-KEYS', 'PowerISO Keys');
        }, 1500);
      }
      return;
    }
  } catch {
    // Resolution/download failed — fall through to in-app browsing.
  }
  toast.dismiss(toastId);
  openInAppBrowser(url, name);
}
