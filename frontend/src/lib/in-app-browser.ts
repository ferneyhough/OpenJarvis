import { useSyncExternalStore } from 'react';

export interface InAppBrowserState {
  url: string | null;
  title: string;
}

let state: InAppBrowserState = { url: null, title: '' };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openInAppBrowser(url: string, title = ''): void {
  state = { url, title: title || url };
  emit();
}

export function closeInAppBrowser(): void {
  state = { url: null, title: '' };
  emit();
}

export function useInAppBrowser(): InAppBrowserState {
  return useSyncExternalStore(subscribe, () => state);
}
