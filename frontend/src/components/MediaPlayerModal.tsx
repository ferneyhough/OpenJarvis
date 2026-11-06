import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { X } from 'lucide-react';
import { getBase } from '../lib/api';

export interface MediaPlayerTarget {
  /** Remote URL (https://…m3u8, mp4, YouTube link) or a local file path. */
  src: string;
  title?: string;
}

function youtubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*v=)([\w-]{6,})/,
    /youtu\.be\/([\w-]{6,})/,
    /youtube\.com\/(?:shorts|embed|live)\/([\w-]{6,})/,
    /youtube\.com\/watch\?.*v=([\w-]{6,})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function resolveSrc(src: string): { kind: 'youtube' | 'hls' | 'video' | 'file'; url: string } {
  const yt = youtubeId(src);
  if (yt) {
    return {
      kind: 'youtube',
      url: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`,
    };
  }
  const isRemote = /^https?:\/\//i.test(src);
  const isHls = /\.m3u8($|\?)/i.test(src) || src.includes('/playlist.m3u8');
  if (!isRemote) {
    // Local file path — serve through the backend media-file endpoint.
    return {
      kind: isHls ? 'hls' : 'video',
      url: `${getBase()}/v1/guide/media-file?path=${encodeURIComponent(src)}`,
    };
  }
  if (isHls) return { kind: 'hls', url: src };
  return { kind: 'video', url: src };
}

export function MediaPlayerModal({
  target,
  onClose,
}: {
  target: MediaPlayerTarget | null;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    const video = videoRef.current;
    if (!target || !video) return;
    const resolved = resolveSrc(target.src);
    if (resolved.kind === 'youtube') return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.pause();
    video.removeAttribute('src');
    video.load();

    if (resolved.kind === 'hls' && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError(`Stream error: ${data.type} (${data.details})`);
          hls.destroy();
          hlsRef.current = null;
        }
      });
      hls.loadSource(resolved.url);
      hls.attachMedia(video);
      void video.play().catch(() => {});
    } else {
      video.src = resolved.url;
      void video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, onClose]);

  if (!target) return null;
  const resolved = resolveSrc(target.src);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--color-text)' }}>
            {target.title || target.src}
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }} aria-label="Close player">
            <X size={18} />
          </button>
        </div>
        <div className="aspect-video bg-black">
          {resolved.kind === 'youtube' ? (
            <iframe
              src={resolved.url}
              title={target.title || 'YouTube video'}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video ref={videoRef} controls autoPlay playsInline className="w-full h-full" />
          )}
        </div>
        {error && (
          <p className="px-4 py-3 text-xs" style={{ color: 'var(--color-error, #f87171)' }}>
            {error} This source may not be playable inside Jarvis (DRM or unsupported format) — try opening it externally.
          </p>
        )}
        {resolved.kind === 'video' && resolved.url.startsWith(getBase()) === false && !/^https?:/i.test(target.src) && (
          <p className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Unsupported container — MP4, WebM, MKV(via HLS only) and M3U8 streams play best.
          </p>
        )}
      </div>
    </div>
  );
}
