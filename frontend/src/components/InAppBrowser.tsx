import { useRef, useState } from 'react';
import { AppWindow, ExternalLink, Globe, Loader2, RotateCw, X } from 'lucide-react';
import { useInAppBrowser, closeInAppBrowser } from '../lib/in-app-browser';
import { isTauri, launchApp, openBrowserWindow } from '../lib/api';

/**
 * In-Jarvis browser overlay. Hub tiles open pages here instead of the
 * system browser so sign-in flows and browsing stay inside OpenJarvis.
 * Some sites refuse iframe embedding (X-Frame-Options) — those get an
 * "open externally" fallback button.
 */
export function InAppBrowser() {
  const { url, title } = useInAppBrowser();
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!url) return null;

  const openExternal = async () => {
    try {
      await launchApp(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--color-bg)' }}
      role="dialog"
      aria-label={`In-app browser: ${title}`}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}
      >
        <Globe size={15} style={{ color: 'var(--color-accent)' }} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" style={{ color: 'var(--color-text)' }}>{title}</div>
          <div className="truncate text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{host}</div>
        </div>
        {loading && <Loader2 size={14} className="animate-spin shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />}
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          title="Reload"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <RotateCw size={14} />
        </button>
        {isTauri() && (
          <button
            type="button"
            onClick={() => void openBrowserWindow(url, title).catch(() => {})}
            title="Open in a separate in-app browser window (works even if the site blocks embedding)"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs"
            style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            <AppWindow size={13} /> Window
          </button>
        )}
        <button
          type="button"
          onClick={() => void openExternal()}
          title="Open in system browser"
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs"
          style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
        >
          <ExternalLink size={13} /> External
        </button>
        <button
          type="button"
          onClick={closeInAppBrowser}
          title="Close"
          aria-label="Close in-app browser"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <X size={16} />
        </button>
      </div>
      <iframe
        key={reloadKey}
        ref={iframeRef}
        src={url}
        title={title}
        className="flex-1 w-full border-0"
        style={{ background: '#fff' }}
        onLoad={() => setLoading(false)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
      />
      <div
        className="px-3 py-1.5 text-[11px] shrink-0"
        style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-tertiary)', background: 'var(--color-bg-secondary)' }}
      >
        Some sites block embedding — if the page stays blank, use Window (desktop app) or External. Sign-in and browsing stay inside OpenJarvis either way.
      </div>
    </div>
  );
}
