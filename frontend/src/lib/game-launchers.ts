import { isTauri, launchApp } from './api';

export const gameLaunchers = [
  {
    id: 'steam',
    settingsId: 'steam-games',
    name: 'Steam',
    url: 'https://store.steampowered.com/',
    color: '#1b2838',
    description: 'Steam library, community, and games.',
    aliases: ['steam'],
  },
  {
    id: 'playnite',
    settingsId: 'playnite-games',
    name: 'Playnite',
    url: 'https://playnite.link/',
    color: '#00a2ed',
    description: 'Unified game library and launcher.',
    aliases: ['playnite'],
  },
  {
    id: 'xbox',
    settingsId: 'xbox-launcher',
    name: 'Xbox',
    url: 'https://www.xbox.com/play',
    color: '#107c10',
    description: 'Xbox app and PC Game Pass.',
    aliases: ['xbox', 'xbox app', 'game pass'],
  },
  {
    id: 'gog',
    settingsId: 'gog-galaxy',
    name: 'GOG Galaxy',
    url: 'https://www.gog.com/galaxy',
    color: '#86328a',
    description: 'GOG Galaxy and DRM-free games.',
    aliases: ['gog', 'gog galaxy'],
  },
  {
    id: 'epic',
    settingsId: 'epic-games-launcher',
    name: 'Epic Games',
    url: 'https://store.epicgames.com/',
    color: '#303030',
    description: 'Epic Games Launcher and library.',
    aliases: ['epic', 'epic games', 'epic games launcher'],
  },
  {
    id: 'ea',
    settingsId: 'ea-app',
    name: 'EA app',
    url: 'https://www.ea.com/ea-app',
    color: '#ff4747',
    description: 'EA app and game library.',
    aliases: ['ea', 'ea app'],
  },
  {
    id: 'ubisoft',
    settingsId: 'ubisoft-connect',
    name: 'Ubisoft Connect',
    url: 'https://ubisoftconnect.com/',
    color: '#0070ff',
    description: 'Ubisoft Connect and game library.',
    aliases: ['ubisoft', 'ubisoft connect'],
  },
  {
    id: 'battle-net',
    settingsId: 'battle-net',
    name: 'Battle.net',
    url: 'https://www.blizzard.com/apps/battle.net/desktop',
    color: '#148eff',
    description: 'Battle.net and Blizzard games.',
    aliases: ['battle net', 'battle.net', 'blizzard'],
  },
  {
    id: 'riot',
    settingsId: 'riot-client',
    name: 'Riot Client',
    url: 'https://www.riotgames.com/',
    color: '#d13639',
    description: 'Riot Client and Riot games.',
    aliases: ['riot', 'riot client'],
  },
  {
    id: 'rockstar',
    settingsId: 'rockstar-launcher',
    name: 'Rockstar Games',
    url: 'https://www.rockstargames.com/',
    color: '#f5b400',
    description: 'Rockstar Games Launcher and library.',
    aliases: ['rockstar', 'rockstar games', 'rockstar launcher'],
  },
  {
    id: 'itch',
    settingsId: 'itch-app',
    name: 'itch.io',
    url: 'https://itch.io/app',
    color: '#fa5c5c',
    description: 'itch.io app and indie games.',
    aliases: ['itch', 'itch.io', 'itch app'],
  },
  {
    id: 'amazon-games',
    settingsId: 'amazon-games',
    name: 'Amazon Games',
    url: 'https://gaming.amazon.com/',
    color: '#00a8e0',
    description: 'Amazon Games and Prime Gaming.',
    aliases: ['amazon games', 'prime gaming'],
  },
  {
    id: 'geforce-now',
    settingsId: 'geforce-now',
    name: 'GeForce NOW',
    url: 'https://play.geforcenow.com/',
    color: '#76b900',
    description: 'NVIDIA GeForce NOW cloud gaming.',
    aliases: ['geforce now', 'geforce'],
  },
  {
    id: 'amazon-luna',
    settingsId: 'amazon-luna',
    name: 'Amazon Luna',
    url: 'https://luna.amazon.com/',
    color: '#7c3aed',
    description: 'Amazon Luna cloud gaming.',
    aliases: ['amazon luna', 'luna'],
  },
  {
    id: 'heroic',
    settingsId: 'heroic-games-launcher',
    name: 'Heroic Games Launcher',
    url: 'https://heroicgameslauncher.com/',
    color: '#f97316',
    description: 'Open-source launcher for GOG and Epic games on Linux/Windows.',
    aliases: ['heroic', 'heroic games', 'heroic games launcher'],
  },
  {
    id: 'lutris',
    settingsId: 'lutris',
    name: 'Lutris',
    url: 'https://lutris.net/',
    color: '#e74c3c',
    description: 'Open-source game launcher and library manager.',
    aliases: ['lutris'],
  },
] as const;

export type GameLauncherId = (typeof gameLaunchers)[number]['id'];

let lastLaunchedByJarvis: GameLauncherId | null = null;
let lastLaunchedBrowserWindow: Window | null = null;

export function clearLastLaunchedGameLauncher(): void {
  lastLaunchedByJarvis = null;
  lastLaunchedBrowserWindow = null;
}

function normalizeVoiceText(text: string): string {
  return text.toLocaleLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseGameLauncherVoiceCommand(text: string): GameLauncherId | null {
  const match = normalizeVoiceText(text).match(/^(?:please )?(?:open|launch|start) (.+)$/);
  if (!match) return null;
  const target = match[1];
  return gameLaunchers.find((launcher) => launcher.aliases.some((alias) => alias === target))?.id ?? null;
}

export function isReturnToJarvisVoiceCommand(text: string): boolean {
  return ['return to jarvis', 'go back to jarvis', 'back to jarvis'].includes(normalizeVoiceText(text));
}

async function openExternal(url: string): Promise<Window | null> {
  await launchApp(url);
  return null;
}

export async function openGameLauncher(id: GameLauncherId): Promise<'desktop' | 'web'> {
  const launcher = gameLaunchers.find((entry) => entry.id === id);
  if (!launcher) throw new Error(`Unknown game launcher: ${id}`);
  clearLastLaunchedGameLauncher();

  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    if (await invoke<boolean>('open_game_launcher', { launcherId: id })) {
      lastLaunchedByJarvis = id;
      lastLaunchedBrowserWindow = null;
      return 'desktop';
    }
  }

  lastLaunchedBrowserWindow = await openExternal(launcher.url);
  lastLaunchedByJarvis = null;
  return 'web';
}

export async function closeLastGameLauncher(): Promise<boolean> {
  const launcherId = lastLaunchedByJarvis;
  if (lastLaunchedBrowserWindow && !lastLaunchedBrowserWindow.closed) {
    lastLaunchedBrowserWindow.close();
    const closed = lastLaunchedBrowserWindow.closed;
    if (closed) lastLaunchedBrowserWindow = null;
    return closed;
  }
  if (!launcherId || !isTauri()) return false;
  const { invoke } = await import('@tauri-apps/api/core');
  const closed = await invoke<boolean>('close_game_launcher', { launcherId });
  if (closed) lastLaunchedByJarvis = null;
  return closed;
}
