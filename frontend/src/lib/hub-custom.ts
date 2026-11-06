import { useEffect, useReducer } from 'react';
import { fetchHubCustom, type HubCustomData } from './api';

let cache: HubCustomData = { sections: [], apps: [] };
const listeners = new Set<() => void>();
let loaded = false;

export async function refreshHubCustom(): Promise<void> {
  try {
    cache = await fetchHubCustom();
  } catch {
    // Server unreachable — keep the last good snapshot.
  }
  loaded = true;
  listeners.forEach((listener) => listener());
}

/** Non-reactive snapshot of the custom hub cache (for voice commands etc.). */
export function getHubCustom(): HubCustomData {
  return cache;
}

/** Reactive access to user-defined hub pills/apps (server-side store). */
export function useHubCustom(): HubCustomData {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    if (!loaded) void refreshHubCustom();
    return () => {
      listeners.delete(force);
    };
  }, []);
  return cache;
}
