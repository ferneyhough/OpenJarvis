import { isTauri } from './api';

export type MediaDocumentKind = 'playlist' | 'guide';

export async function fetchMediaDocument(url: string, kind: MediaDocumentKind): Promise<string> {
  if (!isTauri()) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Enter a complete source URL.');
    }
    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error('Use an HTTP or HTTPS source URL without embedded credentials.');
    }
    const response = await fetch(parsed);
    if (!response.ok) throw new Error(`The source returned HTTP ${response.status}.`);
    const maxBytes = kind === 'playlist' ? 4 * 1024 * 1024 : 24 * 1024 * 1024;
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error(`The source exceeds the ${maxBytes} byte size limit.`);
    }
    if (!response.body) throw new Error('The source did not return a readable response.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error(`The source exceeds the ${maxBytes} byte size limit.`);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
    } catch {
      throw new Error('The source is not valid UTF-8 text.');
    }
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('fetch_media_document', { url, kind });
}

export async function playMediaUrl(url: string): Promise<void> {
  if (!isTauri()) {
    throw new Error('Playing TV streams in VLC is available in OpenJarvis Desktop.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('play_media_url', { url });
}
