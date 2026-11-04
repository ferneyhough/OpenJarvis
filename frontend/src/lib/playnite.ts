import { isTauri } from './api';

export interface PlayniteStatus {
  supported: boolean;
  installed: boolean;
}

export interface PlayniteGame {
  id: string;
  name: string;
  installed: boolean;
  playtime: number;
  play_count: number;
  last_played: string | null;
  genres: string[];
  platforms: string[];
  source: string | null;
  favorite: boolean;
  hidden: boolean;
  completion: string | null;
}

export async function getPlayniteStatus(): Promise<PlayniteStatus> {
  if (!isTauri()) return { supported: false, installed: false };
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<PlayniteStatus>('get_playnite_status');
}

export async function openPlaynite(): Promise<void> {
  if (!isTauri()) {
    throw new Error('Playnite integration is available in OpenJarvis Desktop on Windows.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('open_playnite');
}

export async function getPlayniteLibrary(): Promise<PlayniteGame[]> {
  if (!isTauri()) {
    throw new Error('The Playnite library is available in OpenJarvis Desktop on Windows.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<PlayniteGame[]>('get_playnite_library');
}

export async function launchPlayniteGame(gameId: string): Promise<void> {
  if (!isTauri()) {
    throw new Error('Launching Playnite games is available in OpenJarvis Desktop on Windows.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('launch_playnite_game', { gameId });
}
