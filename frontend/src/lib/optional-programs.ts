export interface OptionalProgram {
  id: string;
  hubId: string;
  name: string;
  description: string;
  advanced: boolean;
}

export const optionalPrograms: OptionalProgram[] = [
  {
    id: 'steam',
    hubId: 'steam-games',
    name: 'Steam',
    description: 'Steam games and desktop client',
    advanced: false,
  },
  {
    id: 'playnite',
    hubId: 'playnite-games',
    name: 'Playnite',
    description: 'Unified game library and launcher',
    advanced: false,
  },
  {
    id: 'epic',
    hubId: 'epic-games-launcher',
    name: 'Epic Games Launcher',
    description: 'Epic Games store and library',
    advanced: false,
  },
  {
    id: 'gog',
    hubId: 'gog-galaxy',
    name: 'GOG Galaxy',
    description: 'GOG library and game launcher',
    advanced: false,
  },
  {
    id: 'obs-studio',
    hubId: 'obs-studio',
    name: 'OBS Studio',
    description: 'Video recording and live streaming',
    advanced: false,
  },
  {
    id: 'vlc',
    hubId: 'vlc',
    name: 'VLC media player',
    description: 'Media player for local files and streams',
    advanced: false,
  },
  {
    id: 'ea',
    hubId: 'ea-app',
    name: 'EA app',
    description: 'EA games and library',
    advanced: true,
  },
  {
    id: 'ubisoft',
    hubId: 'ubisoft-connect',
    name: 'Ubisoft Connect',
    description: 'Ubisoft games and library',
    advanced: true,
  },
  {
    id: 'battle-net',
    hubId: 'battle-net',
    name: 'Battle.net',
    description: 'Blizzard games and library',
    advanced: true,
  },
  {
    id: 'prism-launcher',
    hubId: 'prism-launcher',
    name: 'Prism Launcher',
    description: 'Minecraft instance launcher',
    advanced: true,
  },
  {
    id: 'discord',
    hubId: 'discord',
    name: 'Discord',
    description: 'Discord desktop app',
    advanced: true,
  },
  {
    id: 'telegram',
    hubId: 'telegram',
    name: 'Telegram Desktop',
    description: 'Telegram desktop app',
    advanced: true,
  },
  {
    id: 'slack',
    hubId: 'slack',
    name: 'Slack',
    description: 'Slack desktop app',
    advanced: true,
  },
];

export function getOptionalPrograms(includeAdvanced: boolean): OptionalProgram[] {
  return optionalPrograms.filter((program) => includeAdvanced || !program.advanced);
}
