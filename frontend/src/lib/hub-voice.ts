import { isTauri, launchApp } from './api';
import { clearLastLaunchedGameLauncher } from './game-launchers';

export interface HubVoiceApp {
  id: string;
  name: string;
  url: string;
  settingsId: string;
  category: 'social' | 'media' | 'record' | 'remote' | 'stores' | 'ai' | 'browsers';
  aliases: string[];
  apiKey?: string;
}

export const hubVoiceApps: HubVoiceApp[] = [
  { id: 'browser-chrome', name: 'Google Chrome', url: 'https://www.google.com/chrome/', settingsId: 'browser-chrome', category: 'browsers', aliases: ['chrome', 'google chrome'] },
  { id: 'browser-edge', name: 'Microsoft Edge', url: 'https://www.microsoft.com/edge/', settingsId: 'browser-edge', category: 'browsers', aliases: ['edge', 'microsoft edge'] },
  { id: 'browser-firefox', name: 'Firefox', url: 'https://www.mozilla.org/firefox/', settingsId: 'browser-firefox', category: 'browsers', aliases: ['firefox', 'fire fox'] },
  { id: 'browser-brave', name: 'Brave', url: 'https://brave.com/', settingsId: 'browser-brave', category: 'browsers', aliases: ['brave', 'brave browser'] },
  { id: 'browser-opera', name: 'Opera', url: 'https://www.opera.com/', settingsId: 'browser-opera', category: 'browsers', aliases: ['opera', 'opera browser'] },
  { id: 'browser-vivaldi', name: 'Vivaldi', url: 'https://vivaldi.com/', settingsId: 'browser-vivaldi', category: 'browsers', aliases: ['vivaldi'] },
  { id: 'browser-tor', name: 'Tor Browser', url: 'https://www.torproject.org/', settingsId: 'browser-tor', category: 'browsers', aliases: ['tor', 'tor browser'] },
  { id: 'discord', name: 'Discord', url: 'https://discord.com/app', settingsId: 'discord', category: 'social', aliases: ['discord'] },
  { id: 'telegram', name: 'Telegram', url: 'https://web.telegram.org/', settingsId: 'telegram', category: 'social', aliases: ['telegram'] },
  { id: 'whatsapp', name: 'WhatsApp', url: 'https://web.whatsapp.com/', settingsId: 'whatsapp', category: 'social', aliases: ['whatsapp', 'whats app'] },
  { id: 'slack', name: 'Slack', url: 'https://slack.com/signin', settingsId: 'slack', category: 'social', aliases: ['slack'] },
  { id: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/', settingsId: 'facebook', category: 'social', aliases: ['facebook'] },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/', settingsId: 'instagram', category: 'social', aliases: ['instagram'] },
  { id: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com/', settingsId: 'tiktok', category: 'social', aliases: ['tiktok', 'tik tok'] },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/', settingsId: 'youtube', category: 'media', aliases: ['youtube', 'you tube'] },
  { id: 'twitch', name: 'Twitch', url: 'https://www.twitch.tv/', settingsId: 'twitch', category: 'media', aliases: ['twitch'] },
  { id: 'plex', name: 'Plex', url: 'https://app.plex.tv/desktop/', settingsId: 'plex', category: 'media', aliases: ['plex'] },
  { id: 'netflix', name: 'Netflix', url: 'https://www.netflix.com/', settingsId: 'netflix', category: 'media', aliases: ['netflix'] },
  { id: 'prime-video', name: 'Prime Video', url: 'https://www.primevideo.com/', settingsId: 'prime-video', category: 'media', aliases: ['prime video', 'amazon prime video'] },
  { id: 'crave', name: 'Crave', url: 'https://www.crave.ca/', settingsId: 'crave', category: 'media', aliases: ['crave'] },
  { id: 'crunchyroll', name: 'Crunchyroll', url: 'https://www.crunchyroll.com/', settingsId: 'crunchyroll', category: 'media', aliases: ['crunchyroll', 'crunchy roll'] },
  { id: 'disney-plus', name: 'Disney+', url: 'https://www.disneyplus.com/', settingsId: 'disney-plus', category: 'media', aliases: ['disney plus', 'disney'] },
  { id: 'max', name: 'Max', url: 'https://www.max.com/', settingsId: 'max', category: 'media', aliases: ['max', 'hbo max'] },
  { id: 'hulu', name: 'Hulu', url: 'https://www.hulu.com/', settingsId: 'hulu', category: 'media', aliases: ['hulu'] },
  { id: 'paramount-plus', name: 'Paramount+', url: 'https://www.paramountplus.com/', settingsId: 'paramount-plus', category: 'media', aliases: ['paramount plus', 'paramount'] },
  { id: 'peacock', name: 'Peacock', url: 'https://www.peacocktv.com/', settingsId: 'peacock', category: 'media', aliases: ['peacock'] },
  { id: 'vlc', name: 'VLC', url: 'https://www.videolan.org/vlc/', settingsId: 'vlc', category: 'media', aliases: ['vlc'] },
  { id: 'tv-guide', name: 'TV Guide', url: 'https://www.xmltv.org/', settingsId: 'tv-guide', category: 'media', aliases: ['tv guide', 'television guide'] },
  { id: 'gg-deals', name: 'GG.deals', url: 'https://gg.deals/', settingsId: 'gg-deals', category: 'stores', aliases: ['gg deals', 'gg dot deals'] },
  { id: 'steam-store', name: 'Steam Store', url: 'https://store.steampowered.com/', settingsId: 'steam-store', category: 'stores', aliases: ['steam store'] },
  { id: 'epic-store', name: 'Epic Games Store', url: 'https://store.epicgames.com/', settingsId: 'epic-store', category: 'stores', aliases: ['epic store', 'epic games store'] },
  { id: 'gog-store', name: 'GOG Store', url: 'https://www.gog.com/', settingsId: 'gog-store', category: 'stores', aliases: ['gog store'] },
  { id: 'humble-store', name: 'Humble Bundle', url: 'https://www.humblebundle.com/store', settingsId: 'humble-store', category: 'stores', aliases: ['humble bundle', 'humble store'] },
  { id: 'itch-store', name: 'itch.io Store', url: 'https://itch.io/', settingsId: 'itch-store', category: 'stores', aliases: ['itch store', 'itch.io store'] },
  { id: 'xbox-store', name: 'Xbox Store', url: 'https://www.xbox.com/games/store', settingsId: 'xbox-store', category: 'stores', aliases: ['xbox store'] },
  { id: 'playstation-store', name: 'PlayStation Store', url: 'https://store.playstation.com/', settingsId: 'playstation-store', category: 'stores', aliases: ['playstation store', 'playstation'] },
  { id: 'live-twitch', name: 'Twitch Creator Dashboard', url: 'https://dashboard.twitch.tv/', settingsId: 'live-twitch', category: 'record', aliases: ['twitch dashboard', 'twitch live'] },
  { id: 'live-youtube', name: 'YouTube Live', url: 'https://studio.youtube.com/', settingsId: 'live-youtube', category: 'record', aliases: ['youtube live', 'youtube studio'] },
  { id: 'live-kick', name: 'Kick Creator Dashboard', url: 'https://kick.com/creator/dashboard', settingsId: 'live-kick', category: 'record', aliases: ['kick', 'kick live'] },
  { id: 'live-tiktok', name: 'TikTok LIVE Center', url: 'https://livecenter.tiktok.com/', settingsId: 'live-tiktok', category: 'record', aliases: ['tiktok live', 'tik tok live'] },
  { id: 'live-facebook', name: 'Facebook Live Producer', url: 'https://www.facebook.com/live/producer/', settingsId: 'live-facebook', category: 'record', aliases: ['facebook live'] },
  { id: 'live-rumble', name: 'Rumble Studio', url: 'https://rumble.com/studio', settingsId: 'live-rumble', category: 'record', aliases: ['rumble', 'rumble studio'] },
  { id: 'live-steam', name: 'Steam Broadcast', url: 'https://steamcommunity.com/broadcast/upload/', settingsId: 'live-steam', category: 'record', aliases: ['steam broadcast'] },
  { id: 'obs-studio', name: 'OBS Studio', url: 'https://obsproject.com/', settingsId: 'obs-studio', category: 'record', aliases: ['obs', 'obs studio'] },
  { id: 'prism-live-studio', name: 'PRISM Live Studio', url: 'https://prismlive.com/en_us/', settingsId: 'prism-live-studio', category: 'record', aliases: ['prism live', 'prism live studio'] },
  { id: 'streamlabs', name: 'Streamlabs', url: 'https://streamlabs.com/', settingsId: 'streamlabs', category: 'record', aliases: ['streamlabs', 'stream labs'] },
  { id: 'streamyard', name: 'StreamYard', url: 'https://streamyard.com/', settingsId: 'streamyard', category: 'record', aliases: ['streamyard', 'stream yard'] },
  { id: 'prism-launcher', name: 'Prism Launcher', url: 'https://prismlauncher.org/', settingsId: 'prism-launcher', category: 'record', aliases: ['prism launcher'] },
  { id: 'steam-link', name: 'Steam Link', url: 'https://store.steampowered.com/steamlink/about/', settingsId: 'steam-link', category: 'remote', aliases: ['steam link'] },
  { id: 'chrome-remote-desktop', name: 'Chrome Remote Desktop', url: 'https://remotedesktop.google.com/access/', settingsId: 'chrome-remote-desktop', category: 'remote', aliases: ['chrome remote desktop', 'google remote desktop'] },
  { id: 'anydesk', name: 'AnyDesk', url: 'https://anydesk.com/en', settingsId: 'anydesk', category: 'remote', aliases: ['anydesk', 'any desk'] },
  { id: 'teamviewer', name: 'TeamViewer', url: 'https://www.teamviewer.com/en/', settingsId: 'teamviewer', category: 'remote', aliases: ['teamviewer', 'team viewer'] },
  { id: 'rustdesk', name: 'RustDesk', url: 'https://rustdesk.com/', settingsId: 'rustdesk', category: 'remote', aliases: ['rustdesk', 'rust desk'] },
  { id: 'parsec', name: 'Parsec', url: 'https://parsec.app/', settingsId: 'parsec', category: 'remote', aliases: ['parsec'] },
  { id: 'openai', name: 'OpenAI', url: 'https://platform.openai.com/api-keys', settingsId: 'openai', category: 'ai', aliases: ['openai', 'open ai'], apiKey: 'OPENAI_API_KEY' },
  { id: 'anthropic', name: 'Anthropic', url: 'https://console.anthropic.com/settings/keys', settingsId: 'anthropic', category: 'ai', aliases: ['anthropic', 'claude'], apiKey: 'ANTHROPIC_API_KEY' },
  { id: 'google-ai', name: 'Google AI Studio', url: 'https://aistudio.google.com/app/apikey', settingsId: 'google', category: 'ai', aliases: ['google ai', 'google ai studio', 'gemini'], apiKey: 'GEMINI_API_KEY' },
  { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/keys', settingsId: 'openrouter', category: 'ai', aliases: ['openrouter'], apiKey: 'OPENROUTER_API_KEY' },
  { id: 'atlascloud', name: 'Atlas Cloud', url: 'https://cloud.atlascloud.ai/', settingsId: 'atlascloud', category: 'ai', aliases: ['atlas cloud'], apiKey: 'ATLASCLOUD_API_KEY' },
  { id: 'base44', name: 'Base44', url: 'https://base44.com/', settingsId: 'base44', category: 'ai', aliases: ['base44', 'base 44'] },
  { id: 'emergent', name: 'Emergent', url: 'https://emergent.sh/', settingsId: 'emergent', category: 'ai', aliases: ['emergent'] },
  { id: 'microsoft-copilot', name: 'Microsoft Copilot', url: 'https://copilot.microsoft.com/', settingsId: 'microsoft-copilot', category: 'ai', aliases: ['copilot', 'microsoft copilot'] },
];

function normalizeVoiceText(text: string): string {
  return text.toLocaleLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
}

const remoteAppProtocols: Record<string, string> = {
  'steam-link': 'steam://run/353380',
  anydesk: 'anydesk://',
  teamviewer: 'teamviewer10://',
  rustdesk: 'rustdesk://',
};

export async function openHubService(id: string, url: string): Promise<Window | null> {
  const protocolUrl = remoteAppProtocols[id];
  if (protocolUrl && isTauri()) {
    const { open } = await import('@tauri-apps/plugin-shell');
    try {
      await open(protocolUrl);
      return null;
    } catch {
      await open(url);
      return null;
    }
  }
  return openHubVoiceApp({
    id,
    name: id,
    url,
    settingsId: id,
    category: 'remote',
    aliases: [],
  });
}

export function parseHubAppVoiceCommand(text: string): HubVoiceApp | null {
  const match = normalizeVoiceText(text).match(/^(?:please )?(?:open|launch|start) (.+)$/);
  if (!match) return null;
  const target = match[1];
  return hubVoiceApps.find((app) => app.aliases.includes(target)) ?? null;
}

export async function openHubVoiceApp(app: HubVoiceApp): Promise<Window | null> {
  clearLastLaunchedGameLauncher();
  await launchApp(app.url);
  return null;
}
