import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Baby,
  Bitcoin,
  BrainCircuit,
  LineChart,
  Wallet,
  Code2,
  Download,
  Disc,
  ExternalLink,
  Gamepad2,
  Loader2,
  Mic,
  MessageCircle,
  Monitor,
  Phone,
  Play,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings,
  Square,
  ShoppingBag,
  Tv,
  Users,
  Video,
  Music2,
  Globe,
  LayoutGrid,
  Home,
  Briefcase,
  Landmark,
  Newspaper,
  HeartPulse,
  Plane,
  GraduationCap,
  ShoppingCart,
  Wrench,
  ShieldCheck,
  Lightbulb,
  Dumbbell,
  BookOpen,
  Star,
  Heart,
  Zap,
  Palette,
  Images,
  PanelLeft,
  HardDrive,
  Eraser,
  FolderOpen,
  Cpu,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import {
  isTauri,
  launchApp,
  fetchGuideDocument,
  launchGame,
  mcServer,
  fetchPcScan,
  runPcClean,
  startDefrag,
  fetchDefragStatus,
  browseFiles,
  fileAction,
  launchSystemApp,
  fetchLaunchableTargets,
  fetchOsKeySources,
  fetchOsKeys,
  fetchActivationStatus,
  installOsKey,
  fetchPcInfo,
  fetchPcDrives,
  fetchPcProcesses,
  killPcProcess,
  fetchStartupItems,
  toggleStartupItem,
  fetchRegistryOrphans,
  findDuplicates,
  fetchListeningPorts,
  shredFile,
  pcPower,
  type PcScanResult,
  type FileBrowseResult,
  type DefragStatus,
  type StartupItem,
  type PcProcess,
} from '../../lib/api';
import { getPlayniteLibrary, launchPlayniteGame, type PlayniteGame } from '../../lib/playnite';
import { getSteamLibrary, launchSteamGame, type SteamLibrary } from '../../lib/steam';
import { MediaPlayerModal, type MediaPlayerTarget } from '../MediaPlayerModal';
import { parseM3U, parseXMLTV, type GuideProgram, type M3UChannel } from '../../lib/media-guide';
import { useAppStore } from '../../lib/store';
import { useMusicStore } from '../../lib/music';
import { MUSIC_APPS } from '../../lib/music-commands';
import { useEnabledMusicApps } from '../PageDetails';
import { InstallerButton } from '../InstallerButton';
import { useHubCustom } from '../../lib/hub-custom';
import { openHubApp } from '../../lib/hub-open';
import type { HubCustomApp, OsKeySource } from '../../lib/api';
import { getCloudKeyStatus, fetchNativeApps } from '../../lib/api';
import { openVSCode } from '../../lib/developer';
import { openHubService } from '../../lib/hub-voice';
import {
  gameLaunchers,
  openGameLauncher,
  type GameLauncherId,
} from '../../lib/game-launchers';
import { PromptLabPanel } from './PromptLabPanel';

type HubSection =
  | 'kids' | 'crypto' | 'games' | 'social' | 'music' | 'browsers' | 'media'
  | 'record' | 'remote' | 'stores' | 'ai' | 'developer' | 'apps'
  | 'smart_home' | 'productivity' | 'finance' | 'news' | 'health'
  | 'travel' | 'education' | 'shopping' | 'tools' | 'privacy' | 'mods' | 'create'
  | 'system' | 'cleaner' | 'security' | 'files' | 'toolbox' | 'os'
  // User-defined pills get dynamic string ids.
  | (string & {});
type GameSource = 'steam' | 'playnite';

interface HubService {
  id: string;
  name: string;
  url: string;
  color: string;
  description: string;
  icon: typeof Tv;
}

const browserApps: HubService[] = [
  { id: 'browser-chrome', name: 'Google Chrome', url: 'https://www.google.com/chrome/', color: '#4285f4', description: 'Fast, widely supported browser.', icon: Globe },
  { id: 'browser-edge', name: 'Microsoft Edge', url: 'https://www.microsoft.com/edge/', color: '#0f7bd8', description: 'Built-in Windows browser.', icon: Globe },
  { id: 'browser-firefox', name: 'Firefox', url: 'https://www.mozilla.org/firefox/', color: '#ff7139', description: 'Privacy-focused open-source browser.', icon: Globe },
  { id: 'browser-brave', name: 'Brave', url: 'https://brave.com/', color: '#fb542b', description: 'Browser with built-in ad and tracker blocking.', icon: Globe },
  { id: 'browser-opera', name: 'Opera', url: 'https://www.opera.com/', color: '#ff1b2d', description: 'Browser with a built-in sidebar and VPN.', icon: Globe },
  { id: 'browser-vivaldi', name: 'Vivaldi', url: 'https://vivaldi.com/', color: '#ef3939', description: 'Highly customizable browser.', icon: Globe },
  { id: 'browser-tor', name: 'Tor Browser', url: 'https://www.torproject.org/', color: '#7d4698', description: 'Privacy browser that routes traffic through Tor.', icon: Globe },
  { id: 'browser-arc', name: 'Arc', url: 'https://arc.net/', color: '#ff5a1f', description: 'Design-forward browser with built-in spaces and tools.', icon: Globe },
  { id: 'browser-dia', name: 'Dia', url: 'https://www.diabrowser.com/', color: '#5b8def', description: 'AI-first browser from The Browser Company.', icon: Globe },
  { id: 'browser-comet', name: 'Comet', url: 'https://www.perplexity.ai/comet', color: '#20808d', description: 'AI browser from Perplexity.', icon: Globe },
  { id: 'browser-librewolf', name: 'Librewolf', url: 'https://librewolf.net/', color: '#7a8b00', description: 'Privacy-hardened Firefox fork.', icon: Globe },
];

const socialApps: HubService[] = [
  { id: 'discord', name: 'Discord', url: 'https://discord.com/app', color: '#5865f2', description: 'Communities, servers, and direct messages.', icon: MessageCircle },
  { id: 'telegram', name: 'Telegram', url: 'https://web.telegram.org/', color: '#229ed9', description: 'Chats and channels.', icon: Send },
  { id: 'whatsapp', name: 'WhatsApp', url: 'https://web.whatsapp.com/', color: '#25d366', description: 'Messages and calls.', icon: Phone },
  { id: 'slack', name: 'Slack', url: 'https://slack.com/signin', color: '#611f69', description: 'Team channels and workspaces.', icon: Users },
  { id: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/', color: '#0866ff', description: 'Friends, groups, and updates.', icon: Users },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/', color: '#d62976', description: 'Photos, reels, and stories.', icon: MessageCircle },
  { id: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com/', color: '#fe2c55', description: 'Short videos, creators, and live streams.', icon: Play },
  { id: 'x', name: 'X', url: 'https://x.com/', color: '#e7e9ea', description: 'Posts, news and conversations.', icon: MessageCircle },
  { id: 'reddit', name: 'Reddit', url: 'https://www.reddit.com/', color: '#ff4500', description: 'Communities, forums and discussions.', icon: MessageCircle },
  { id: 'pinterest', name: 'Pinterest', url: 'https://www.pinterest.com/', color: '#bd081c', description: 'Visual discovery — pins, boards and ideas.', icon: MessageCircle },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/', color: '#0a66c2', description: 'Professional network and jobs.', icon: Users },
  { id: 'snapchat', name: 'Snapchat', url: 'https://www.snapchat.com/', color: '#fffc00', description: 'Ephemeral messages and stories.', icon: MessageCircle },
  { id: 'threads', name: 'Threads', url: 'https://www.threads.net/', color: '#101010', description: 'Text-based social app from Meta.', icon: MessageCircle },
  { id: 'bluesky', name: 'Bluesky', url: 'https://bsky.app/', color: '#0085ff', description: 'Decentralized microblogging.', icon: MessageCircle },
  { id: 'mastodon', name: 'Mastodon', url: 'https://mastodon.social/', color: '#6364ff', description: 'Open federated social network.', icon: MessageCircle },
];

const mediaApps: HubService[] = [
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/', color: '#ff0033', description: 'Video search and viewing.', icon: Play },
  { id: 'twitch', name: 'Twitch', url: 'https://www.twitch.tv/', color: '#9146ff', description: 'Live streams, channels, and VODs.', icon: Play },
  { id: 'plex', name: 'Plex', url: 'https://app.plex.tv/desktop/', color: '#e5a00d', description: 'Your Plex media server and watch library.', icon: Tv },
  { id: 'netflix', name: 'Netflix', url: 'https://www.netflix.com/', color: '#e50914', description: 'Movies and series.', icon: Tv },
  { id: 'prime-video', name: 'Prime Video', url: 'https://www.primevideo.com/', color: '#00a8e1', description: 'Movies and series.', icon: Tv },
  { id: 'crave', name: 'Crave', url: 'https://www.crave.ca/', color: '#ed1c24', description: 'Stream TV series, movies, and originals with a Crave account.', icon: Tv },
  { id: 'crunchyroll', name: 'Crunchyroll', url: 'https://www.crunchyroll.com/', color: '#f47521', description: 'Anime streaming and simulcasts.', icon: Tv },
  { id: 'disney-plus', name: 'Disney+', url: 'https://www.disneyplus.com/', color: '#113ccf', description: 'Movies and series.', icon: Tv },
  { id: 'max', name: 'Max', url: 'https://www.max.com/', color: '#5b2bdb', description: 'Movies and series.', icon: Tv },
  { id: 'hulu', name: 'Hulu', url: 'https://www.hulu.com/', color: '#1ce783', description: 'TV and movies.', icon: Tv },
  { id: 'paramount-plus', name: 'Paramount+', url: 'https://www.paramountplus.com/', color: '#0064ff', description: 'TV and movies.', icon: Tv },
  { id: 'peacock', name: 'Peacock', url: 'https://www.peacocktv.com/', color: '#111827', description: 'TV and movies.', icon: Tv },
  { id: 'pluto-tv', name: 'Pluto TV', url: 'https://pluto.tv/', color: '#a3e635', description: 'Free live TV channels and movies — no account needed.', icon: Tv },
  { id: 'samsung-tv-plus', name: 'Samsung TV Plus', url: 'https://www.samsungtvplus.com/', color: '#1428a0', description: 'Free ad-supported live TV channels.', icon: Tv },
  { id: 'xumo', name: 'Xumo', url: 'https://xumo.tv/', color: '#7c3aed', description: 'Free live TV, movies and shows.', icon: Tv },
  { id: 'tubi', name: 'Tubi', url: 'https://tubitv.com/', color: '#ff5c39', description: 'Free movies and shows with ads.', icon: Tv },
  { id: 'kick', name: 'Kick', url: 'https://kick.com/', color: '#53fc18', description: 'Live streams — looser moderation than Twitch.', icon: Play },
  { id: 'dailymotion', name: 'Dailymotion', url: 'https://www.dailymotion.com/', color: '#0066dc', description: 'Video sharing and live streams.', icon: Play },
  { id: 'vimeo', name: 'Vimeo', url: 'https://vimeo.com/', color: '#17b3e8', description: 'Creator videos, films and live events.', icon: Play },
  { id: 'vlc', name: 'VLC', url: 'https://www.videolan.org/vlc/', color: '#ff8800', description: 'Local media and authorized TV streams.', icon: Play },
  { id: 'tv-guide', name: 'TV Guide', url: 'https://www.xmltv.org/', color: '#22d3ee', description: 'Combine your own M3U/M3U8 playlist with XMLTV schedule data.', icon: Tv },
];

const storeApps: HubService[] = [
  { id: 'gg-deals', name: 'GG.deals', url: 'https://gg.deals/', color: '#f97316', description: 'Compare game prices and deals.', icon: ShoppingBag },
  { id: 'steam-store', name: 'Steam Store', url: 'https://store.steampowered.com/', color: '#1b2838', description: 'Browse Steam games and offers.', icon: Gamepad2 },
  { id: 'epic-store', name: 'Epic Games Store', url: 'https://store.epicgames.com/', color: '#303030', description: 'Browse Epic games and offers.', icon: ShoppingBag },
  { id: 'gog-store', name: 'GOG', url: 'https://www.gog.com/', color: '#86328a', description: 'Browse DRM-free games and offers.', icon: ShoppingBag },
  { id: 'humble-store', name: 'Humble Bundle', url: 'https://www.humblebundle.com/store', color: '#cc4e00', description: 'Browse bundles and game offers.', icon: ShoppingBag },
  { id: 'itch-store', name: 'itch.io', url: 'https://itch.io/', color: '#fa5c5c', description: 'Discover indie games.', icon: ShoppingBag },
  { id: 'xbox-store', name: 'Xbox Store', url: 'https://www.xbox.com/games/store', color: '#107c10', description: 'Browse Xbox games and offers.', icon: ShoppingBag },
  { id: 'playstation-store', name: 'PlayStation Store', url: 'https://store.playstation.com/', color: '#003791', description: 'Browse PlayStation games and offers.', icon: ShoppingBag },
  { id: 'fanatical', name: 'Fanatical', url: 'https://www.fanatical.com/', color: '#ff6b00', description: 'Game keys and bundles at a discount.', icon: ShoppingBag },
  { id: 'green-man-gaming', name: 'Green Man Gaming', url: 'https://www.greenmangaming.com/', color: '#39ff14', description: 'Discounted game keys for PC.', icon: ShoppingBag },
  { id: 'indiegala', name: 'IndieGala', url: 'https://www.indiegala.com/', color: '#7c3aed', description: 'Indie bundles and daily giveaways.', icon: ShoppingBag },
];

const aiApps = [
  { id: 'openai', name: 'OpenAI', key: 'OPENAI_API_KEY', url: 'https://platform.openai.com/api-keys', color: '#10a37f' },
  { id: 'anthropic', name: 'Anthropic', key: 'ANTHROPIC_API_KEY', url: 'https://console.anthropic.com/settings/keys', color: '#d97757' },
  { id: 'google', name: 'Google AI Studio', key: 'GEMINI_API_KEY', url: 'https://aistudio.google.com/app/apikey', color: '#4285f4' },
  { id: 'openrouter', name: 'OpenRouter', key: 'OPENROUTER_API_KEY', url: 'https://openrouter.ai/keys', color: '#7c3aed' },
  { id: 'atlascloud', name: 'Atlas Cloud', key: 'ATLASCLOUD_API_KEY', url: 'https://cloud.atlascloud.ai/', color: '#0ea5e9' },
];

const aiTools: HubService[] = [
  { id: 'base44', name: 'Base44', url: 'https://base44.com/', color: '#635bff', description: 'AI app-building platform. Sign in with Base44 to use its hosted tools.', icon: BrainCircuit },
  { id: 'microsoft-copilot', name: 'Microsoft Copilot', url: 'https://copilot.microsoft.com/', color: '#4f6bed', description: 'Microsoft Copilot web app. Uses its own Microsoft sign-in and subscription.', icon: BrainCircuit },
  { id: 'xcrawl', name: 'XCrawl', url: 'https://www.xcrawl.ai/', color: '#0ea5e9', description: 'Web scraping API for agents — scrape/crawl/map/SERP as clean JSON or Markdown. Get a key at dash.xcrawl.com (1,000 free credits), then add it as an MCP server (see AGENTS.md).', icon: BrainCircuit },
  { id: 'huggingface', name: 'Hugging Face', url: 'https://huggingface.co/', color: '#ff9d00', description: 'Model hub — download open-weight models for offline use in Settings → Models.', icon: BrainCircuit },
  { id: 'ollama', name: 'Ollama', url: 'https://ollama.com/', color: '#ffffff', description: 'Local model runtime — powers OpenJarvis offline chat.', icon: BrainCircuit },
  { id: 'lm-studio', name: 'LM Studio', url: 'https://lmstudio.ai/', color: '#7c6cf0', description: 'Desktop app for running local LLMs.', icon: BrainCircuit },
  { id: 'jan', name: 'Jan', url: 'https://jan.ai/', color: '#e8e8e8', description: 'Open-source local AI chat app.', icon: BrainCircuit },
  { id: 'gpt4all', name: 'GPT4All', url: 'https://www.nomic.ai/gpt4all', color: '#00b894', description: 'Local AI desktop app — runs models fully offline.', icon: BrainCircuit },
  { id: 'anythingllm', name: 'AnythingLLM', url: 'https://anythingllm.com/', color: '#f59e0b', description: 'All-in-one local AI workspace with document chat.', icon: BrainCircuit },
  { id: 'open-webui', name: 'Open WebUI', url: 'https://openwebui.com/', color: '#111111', description: 'Self-hosted AI chat interface for Ollama and more.', icon: BrainCircuit },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/', color: '#20808d', description: 'AI answer engine with live web search.', icon: BrainCircuit },
  { id: 'poe', name: 'Poe', url: 'https://poe.com/', color: '#5930d6', description: 'Chat with many AI models in one place.', icon: BrainCircuit },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/', color: '#d97757', description: 'Anthropic\u2019s AI assistant.', icon: BrainCircuit },
  { id: 'mistral-le-chat', name: 'Mistral Le Chat', url: 'https://chat.mistral.ai/', color: '#ff7000', description: 'Mistral\u2019s free AI chat.', icon: BrainCircuit },
  { id: 'meta-ai', name: 'Meta AI', url: 'https://www.meta.ai/', color: '#0081fb', description: 'Meta\u2019s AI assistant.', icon: BrainCircuit },
  { id: 'grok', name: 'Grok', url: 'https://grok.com/', color: '#e7e9ea', description: 'xAI\u2019s assistant — needs an X account.', icon: BrainCircuit },
  { id: 'deepseek-chat', name: 'DeepSeek', url: 'https://chat.deepseek.com/', color: '#4d6bfe', description: 'DeepSeek chat — strong reasoning, free tier.', icon: BrainCircuit },
];

const streamingDestinations: HubService[] = [
  { id: 'live-twitch', name: 'Twitch Creator Dashboard', url: 'https://dashboard.twitch.tv/', color: '#9146ff', description: 'Manage your channel and start a live stream.', icon: Radio },
  { id: 'live-youtube', name: 'YouTube Live', url: 'https://studio.youtube.com/', color: '#ff0033', description: 'Create and manage YouTube live streams.', icon: Radio },
  { id: 'live-kick', name: 'Kick Creator Dashboard', url: 'https://kick.com/creator/dashboard', color: '#53fc18', description: 'Open Kick creator tools and streaming dashboard.', icon: Radio },
  { id: 'live-tiktok', name: 'TikTok LIVE Center', url: 'https://livecenter.tiktok.com/', color: '#fe2c55', description: 'Open TikTok LIVE tools; account eligibility may apply.', icon: Radio },
  { id: 'live-facebook', name: 'Facebook Live Producer', url: 'https://www.facebook.com/live/producer/', color: '#0866ff', description: 'Set up a Facebook Live broadcast.', icon: Radio },
  { id: 'live-rumble', name: 'Rumble Studio', url: 'https://rumble.com/studio', color: '#85c742', description: 'Open Rumble Studio to configure your own live broadcast.', icon: Radio },
  { id: 'live-steam', name: 'Steam Broadcast', url: 'https://steamcommunity.com/broadcast/upload/', color: '#1b2838', description: 'Open Steam Community broadcast settings for gameplay.', icon: Radio },
];

const streamingTools: HubService[] = [
  { id: 'obs-studio', name: 'OBS Studio', url: 'https://obsproject.com/', color: '#302e32', description: 'Free, open-source recording and live-streaming software.', icon: Video },
  { id: 'prism-live-studio', name: 'PRISM Live Studio', url: 'https://prismlive.com/en_us/', color: '#6c59ff', description: 'Streaming and live-production software; sign in and configure it with the provider.', icon: Video },
  { id: 'streamlabs', name: 'Streamlabs', url: 'https://streamlabs.com/', color: '#80f5d2', description: 'Streaming software and creator tools.', icon: Video },
  { id: 'streamyard', name: 'StreamYard', url: 'https://streamyard.com/', color: '#1768ff', description: 'Browser-based live production; sign in and choose your destinations.', icon: Video },
  { id: 'prism-launcher', name: 'Prism Launcher', url: 'https://prismlauncher.org/', color: '#5d8db8', description: 'Minecraft instance launcher (not the same as PRISM Live Studio).', icon: Gamepad2 },
  { id: 'loom', name: 'Loom', url: 'https://www.loom.com/', color: '#625df5', description: 'Quick screen-recording videos for sharing.', icon: Video },
  { id: 'descript', name: 'Descript', url: 'https://www.descript.com/', color: '#ff4b4b', description: 'Edit video and audio by editing the transcript.', icon: Video },
  { id: 'riverside', name: 'Riverside', url: 'https://riverside.com/', color: '#12b5a5', description: 'Studio-quality remote recording.', icon: Video },
  { id: 'capcut', name: 'CapCut', url: 'https://www.capcut.com/', color: '#111111', description: 'Free video editor — desktop and web.', icon: Video },
  { id: 'canva', name: 'Canva', url: 'https://www.canva.com/', color: '#8b3dff', description: 'Graphic design — thumbnails, posters, social posts.', icon: Video },
  { id: 'clipchamp', name: 'Clipchamp', url: 'https://clipchamp.com/', color: '#20c4f3', description: 'Microsoft\u2019s free video editor.', icon: Video },
  { id: 'davinci-resolve', name: 'DaVinci Resolve', url: 'https://www.blackmagicdesign.com/products/davinciresolve', color: '#f4b400', description: 'Pro-grade free video editor and color tools.', icon: Video },
  { id: 'audacity', name: 'Audacity', url: 'https://www.audacityteam.org/', color: '#0000cc', description: 'Free open-source audio editor.', icon: Video },
];

const remoteApps: HubService[] = [
  { id: 'steam-link', name: 'Steam Link', url: 'https://store.steampowered.com/steamlink/about/', color: '#1b2838', description: 'Stream your own Steam games to another supported device.', icon: Gamepad2 },
  { id: 'chrome-remote-desktop', name: 'Chrome Remote Desktop', url: 'https://remotedesktop.google.com/access/', color: '#4285f4', description: 'Access your own computers after installing and configuring Chrome Remote Desktop.', icon: Monitor },
  { id: 'anydesk', name: 'AnyDesk', url: 'https://anydesk.com/en', color: '#ef443b', description: 'Remote desktop software; install it on devices you own or are authorized to access.', icon: Monitor },
  { id: 'teamviewer', name: 'TeamViewer', url: 'https://www.teamviewer.com/en/', color: '#0e8ee7', description: 'Remote access and support; use only with the device owner’s permission.', icon: Monitor },
  { id: 'rustdesk', name: 'RustDesk', url: 'https://rustdesk.com/', color: '#2a85ff', description: 'Open-source remote desktop; configure your own clients or server.', icon: Monitor },
  { id: 'parsec', name: 'Parsec', url: 'https://parsec.app/', color: '#8f4bff', description: 'Low-latency remote desktop and game streaming for devices you control.', icon: Gamepad2 },
  { id: 'moonlight', name: 'Moonlight', url: 'https://moonlight-stream.org/', color: '#76b900', description: 'Open-source game streaming client — pairs with Sunshine.', icon: Gamepad2 },
  { id: 'sunshine', name: 'Sunshine', url: 'https://app.lizardbyte.dev/Sunshine/', color: '#f59e0b', description: 'Self-hosted game-stream host for Moonlight clients.', icon: Gamepad2 },
  { id: 'quick-assist', name: 'Quick Assist', url: 'https://support.microsoft.com/en-us/windows/get-help-with-quick-assist', color: '#0078d4', description: 'Built-in Windows screen-sharing for quick help.', icon: Monitor },
  { id: 'dwservice', name: 'DWService', url: 'https://www.dwservice.net/', color: '#00a8e1', description: 'Remote access agent — works behind NAT.', icon: Monitor },
  { id: 'zoho-assist', name: 'Zoho Assist', url: 'https://www.zoho.com/assist/', color: '#e42527', description: 'Remote support and unattended access.', icon: Monitor },
];

function appArtwork(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 300"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${color}" stop-opacity=".8"/><stop offset="1" stop-color="#10131a"/></linearGradient><radialGradient id="r"><stop stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="960" height="300" fill="url(#g)"/><circle cx="760" cy="90" r="220" fill="url(#r)"/><path d="M0 245 290 90l185 125 205-150 280 150v85H0z" fill="#080b12" fill-opacity=".26"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

async function openExternal(url: string) {
  await launchApp(url);
}

function ActionButton({
  children,
  active = false,
  onClick,
  title,
}: {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        background: active ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)',
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
      }}
    >
      {children}
    </button>
  );
}

function SteamGames() {
  const navigate = useNavigate();
  const steamId64 = useAppStore((state) => state.settings.steamId64);
  const [library, setLibrary] = useState<SteamLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      setLibrary(await getSteamLibrary(steamId64, forceRefresh));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [steamId64]);

  useEffect(() => {
    void load();
  }, [load]);

  const games = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (library?.games ?? []).filter((game) => !needle || game.name.toLocaleLowerCase().includes(needle));
  }, [library?.games, query]);

  const launch = async (appId: number) => {
    setLaunching(appId);
    try {
      await launchSteamGame(appId);
    } catch (launchError) {
      toast.error(launchError instanceof Error ? launchError.message : String(launchError));
    } finally {
      setLaunching(null);
    }
  };

  return (
    <section className="mt-3 min-w-0" aria-label="Steam library">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {loading
            ? 'Loading your Steam library…'
            : !library?.supported
              ? 'Steam library access is available in the Windows desktop app.'
              : !library.installed
                ? 'Install Steam to browse local games.'
                : `${library.games.length} games · ${library.games.filter((game) => game.installed).length} installed`}
        </p>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          aria-label="Refresh Steam library"
          className="rounded-md p-2 disabled:opacity-50"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Settings size={13} /> Steam settings
        </button>
      </div>
      {library?.nowPlaying && (
        <p className="mt-2 text-xs" role="status" style={{ color: 'var(--color-success)' }}>
          Playing now: {library.nowPlaying.name}
        </p>
      )}
      {library?.apiError && <p className="mt-2 text-xs" role="status" style={{ color: 'var(--color-text-secondary)' }}>{library.apiError}</p>}
      {error && <p className="mt-2 text-xs" role="alert" style={{ color: 'var(--color-error)' }}>{error}</p>}
      {games.length > 8 && (
        <label className="mt-3 flex max-w-sm items-center gap-2 rounded-lg px-3" style={{ border: '1px solid var(--color-border)' }}>
          <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a Steam game"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-text)' }}
          />
        </label>
      )}
      {games.length > 0 ? (
        <ul className="mt-2 max-h-64 divide-y overflow-y-auto pr-1" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {games.map((game) => (
            <li key={game.appId} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--color-text)' }}>
                {game.name}
                <span className="ml-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {game.installed ? 'Installed' : 'Not installed'}
                  {game.playtimeHours > 0 && ` · ${game.playtimeHours.toFixed(1)} h`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void launch(game.appId)}
                disabled={!game.installed || launching !== null}
                title={game.installed ? `Launch ${game.name}` : 'Install this game in Steam to launch it'}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                style={{ color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
              >
                {launching === game.appId ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Launch
              </button>
            </li>
          ))}
        </ul>
      ) : !loading && library?.games.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {library.installed ? 'No local games found. Add your public profile in Steam settings to load online games.' : 'No games to show.'}
        </p>
      ) : !loading && games.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>No games match that search.</p>
      ) : null}
    </section>
  );
}

function PlayniteGames() {
  const [games, setGames] = useState<PlayniteGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [installedOnly, setInstalledOnly] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [launching, setLaunching] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setGames(await getPlayniteLibrary());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredGames = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return games.filter((game) => {
      if (!showHidden && game.hidden) return false;
      if (installedOnly && !game.installed) return false;
      const searchable = [
        game.name,
        game.source,
        ...(game.genres ?? []),
        ...(game.platforms ?? []),
      ].join(' ').toLocaleLowerCase();
      return words.every((word) => searchable.includes(word));
    });
  }, [games, installedOnly, query, showHidden]);

  const launch = async (game: PlayniteGame) => {
    setLaunching(game.id);
    try {
      await launchPlayniteGame(game.id);
    } catch (launchError) {
      toast.error(launchError instanceof Error ? launchError.message : String(launchError));
    } finally {
      setLaunching('');
    }
  };

  return (
    <section className="mt-3 min-w-0" aria-label="Playnite library">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {loading ? 'Loading your Playnite library…' : `${filteredGames.length} of ${games.length} games`}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh Playnite library"
          className="rounded-md p-2 disabled:opacity-50"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        </button>
      </div>
      {games.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex max-w-sm flex-1 items-center gap-2 rounded-lg px-3" style={{ border: '1px solid var(--color-border)' }}>
            <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, genre, platform"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text)' }}
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={installedOnly} onChange={(event) => setInstalledOnly(event.target.checked)} />
            Installed
          </label>
          <label className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />
            Include hidden
          </label>
        </div>
      )}
      {error && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" role="alert" style={{ color: 'var(--color-error)' }}>
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="underline underline-offset-2">Try again</button>
        </div>
      )}
      {filteredGames.length > 0 ? (
        <ul className="mt-2 max-h-64 divide-y overflow-y-auto pr-1" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {filteredGames.map((game) => {
            const lastPlayedDate = game.last_played ? new Date(game.last_played) : null;
            const lastPlayed = lastPlayedDate && !Number.isNaN(lastPlayedDate.getTime())
              ? `Last played ${lastPlayedDate.toLocaleDateString()}`
              : '';
            const playtime = game.playtime > 0
              ? `${Math.floor(game.playtime / 3600)} h ${Math.floor((game.playtime % 3600) / 60)} min`
              : '';
            const details = [
              game.installed ? 'Installed' : 'Not installed',
              game.source,
              playtime,
              game.play_count > 0 ? `${game.play_count} launches` : '',
              game.completion,
              ...(game.genres ?? []),
              ...(game.platforms ?? []),
              lastPlayed,
            ].filter(Boolean);
            return (
              <li key={game.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
                <div className="min-w-[12rem] flex-1">
                  <p className="truncate text-sm" style={{ color: 'var(--color-text)' }}>
                    {game.name}
                    {game.favorite && <span className="ml-2 text-xs" style={{ color: 'var(--color-accent)' }}>Favorite</span>}
                    {game.hidden && <span className="ml-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Hidden</span>}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    {details.join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void launch(game)}
                  disabled={launching !== ''}
                  aria-label={`Open ${game.name} in Playnite`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs disabled:opacity-50"
                  style={{ color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
                >
                  {launching === game.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Playnite
                </button>
              </li>
            );
          })}
        </ul>
      ) : !loading && !error ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {games.length === 0
            ? 'No Playnite export found. Open or restart Playnite with the OpenJarvis Bridge enabled, then refresh.'
            : 'No games match these filters.'}
        </p>
      ) : null}
    </section>
  );
}

function GamesPanel() {
  const navigate = useNavigate();
  const enabledApps = useAppStore((state) => state.settings.hubEnabledApps);
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  const [source, setSource] = useState<GameSource | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>('steam');
  const [opening, setOpening] = useState<string | null>(null);
  const availableLaunchers = gameLaunchers.filter(
    (launcher) => developerModeEnabled || enabledApps.includes(launcher.settingsId),
  );
  const selectedLauncher = availableLaunchers.find((launcher) => launcher.id === selectedId)
    ?? availableLaunchers[0];
  const visibleSource = availableLaunchers.some((launcher) => launcher.id === source) ? source : null;

  const openApp = async (appId: GameLauncherId) => {
    setOpening(appId);
    try {
      const location = await openGameLauncher(appId);
      if (location === 'web') toast.info(`${gameLaunchers.find((launcher) => launcher.id === appId)?.name} desktop app not found; opened its website.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="px-4 pb-4">
      {selectedLauncher && (
        <div
          className="mb-3 flex min-h-24 flex-col justify-end rounded-lg bg-cover bg-center px-4 py-3"
          style={{
            backgroundImage: `${appArtwork(selectedLauncher.color)}, linear-gradient(115deg, ${selectedLauncher.color}88, var(--color-bg-secondary))`,
            border: '1px solid var(--color-border)',
          }}
          aria-live="polite"
        >
          <span className="text-lg font-semibold text-white">{selectedLauncher.name}</span>
          <span className="text-xs text-white/85">{selectedLauncher.description}</span>
          {selectedLauncher.id === 'steam' || selectedLauncher.id === 'playnite' ? (
            <button
              type="button"
              onClick={() => void openApp(selectedLauncher.id)}
              disabled={opening !== null}
              className="mt-2 inline-flex min-h-8 w-fit items-center gap-1.5 rounded-md px-2.5 text-xs disabled:opacity-50"
              style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            >
              {opening === selectedLauncher.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpRight size={13} />}
              Open {selectedLauncher.name}
            </button>
          ) : null}
        </div>
      )}
      {availableLaunchers.length === 0 && (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Enable game launchers in Settings → Games to list them here.
          <button type="button" onClick={() => navigate('/settings')} className="ml-1 underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Open Settings</button>
        </p>
      )}
      {availableLaunchers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Game launchers">
          {availableLaunchers.map((launcher) => (
            <button
              key={launcher.id}
              type="button"
              onMouseEnter={() => setSelectedId(launcher.id)}
              onFocus={() => setSelectedId(launcher.id)}
              onClick={() => {
                setSelectedId(launcher.id);
                if (launcher.id === 'steam' || launcher.id === 'playnite') {
                  setSource(launcher.id);
                } else {
                  setSource(null);
                  void openApp(launcher.id);
                }
              }}
              aria-pressed={selectedLauncher?.id === launcher.id}
              disabled={opening !== null && opening !== launcher.id}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
              style={{
                color: selectedLauncher?.id === launcher.id ? launcher.color : 'var(--color-text-secondary)',
                background: selectedLauncher?.id === launcher.id ? `${launcher.color}18` : 'var(--color-bg-secondary)',
                border: `1px solid ${selectedLauncher?.id === launcher.id ? launcher.color : 'var(--color-border)'}`,
              }}
            >
              {opening === launcher.id ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
              {launcher.name}
              {launcher.id !== 'steam' && launcher.id !== 'playnite' && <ExternalLink size={11} />}
            </button>
          ))}
        </div>
      )}
      {visibleSource === 'steam' && <SteamGames />}
      {visibleSource === 'playnite' && <PlayniteGames />}
    </div>
  );
}

const kidsApps: HubService[] = [
  { id: 'youtube-kids', name: 'YouTube Kids', url: 'https://www.youtube.com/kids', color: '#ff0033', description: 'Kid-friendly videos picked for younger viewers.', icon: Play },
  { id: 'messenger-kids', name: 'Messenger Kids', url: 'https://www.messenger.com/', color: '#a033ff', description: 'Video calls and messages for kids — needs a parent\'s Facebook account.', icon: MessageCircle },
  { id: 'pbskids', name: 'PBS Kids', url: 'https://pbskids.org/', color: '#0074bc', description: 'Free educational games and videos for kids.', icon: Tv },
  { id: 'nickjr', name: 'Nick Jr.', url: 'https://www.nickjr.com/', color: '#ff6f00', description: 'Games and videos for preschoolers.', icon: Tv },
  { id: 'google-classroom', name: 'Google Classroom', url: 'https://classroom.google.com/', color: '#0f9d58', description: 'School assignments and classes — sign in with the school Google account.', icon: Tv },
  { id: 'abcmouse', name: 'ABCmouse', url: 'https://www.abcmouse.com/', color: '#ff6b35', description: 'Learning games and books for ages 2–8 — needs a subscription.', icon: Tv },
  { id: 'khan-kids', name: 'Khan Academy Kids', url: 'https://www.khanacademy.org/kids', color: '#1865d8', description: 'Free reading, math and logic games for young kids.', icon: Tv },
  { id: 'toca-boca', name: 'Toca Boca', url: 'https://tocaboca.com/', color: '#ff5fa2', description: 'Creative play apps for preschoolers.', icon: Tv },
  { id: 'lego-builder', name: 'LEGO Builder', url: 'https://www.lego.com/en-us/kids', color: '#e3000b', description: 'LEGO games, videos and building ideas for kids.', icon: Tv },
];

function KidsPanel() {
  const navigate = useNavigate();
  const [launching, setLaunching] = useState<string | null>(null);
  const [serverBusy, setServerBusy] = useState(false);

  const hostMinecraftServer = async () => {
    setServerBusy(true);
    try {
      const status = await mcServer('status');
      if (status.running) {
        toast.info('Minecraft server is already running.');
        return;
      }
      toast.message('Setting up Minecraft server (first run downloads ~60 MB)…');
      await mcServer('start');
      toast.success('Minecraft server started — friends can join on port 25565.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setServerBusy(false);
    }
  };

  const launchBundledGame = async (kind: 'portablemc' | 'roblox') => {
    setLaunching(kind);
    try {
      await launchGame({ kind });
      toast.success(kind === 'portablemc' ? 'Starting Minecraft…' : 'Starting Roblox…');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLaunching(null);
    }
  };

  return (
    <div className="space-y-3 px-4 pb-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Kids apps">
        {kidsApps.map((app) => {
          const Icon = app.icon;
          return (
            <span key={app.id} className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => void openHubApp(app.url, app.name)}
                title={app.description}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors"
                style={{
                  color: app.color,
                  background: `${app.color}18`,
                  border: `1px solid ${app.color}55`,
                }}
              >
                <Icon size={14} />
                {app.name}
                <ExternalLink size={11} />
              </button>
              <InstallerButton url={app.url} name={app.name} color={app.color} />
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Kids games">
        <button
          type="button"
          onClick={() => void launchBundledGame('portablemc')}
          disabled={launching !== null}
          title="Launches the bundled PortableMC — installs and starts the latest Minecraft release"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-50"
          style={{ color: '#62a944', background: '#62a94418', border: '1px solid #62a94455' }}
        >
          {launching === 'portablemc' ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
          Minecraft
        </button>
        <button
          type="button"
          onClick={() => void launchBundledGame('roblox')}
          disabled={launching !== null}
          title="Launches the newest installed Roblox player"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-50"
          style={{ color: '#e2231a', background: '#e2231a18', border: '1px solid #e2231a55' }}
        >
          {launching === 'roblox' ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
          Roblox
        </button>
        <button
          type="button"
          onClick={() => void hostMinecraftServer()}
          disabled={serverBusy || launching !== null}
          title="Downloads the official dedicated server + Java runtime once, then hosts it for friends to join"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-50"
          style={{ color: '#4ade80', background: '#4ade8018', border: '1px solid #4ade8055' }}
        >
          {serverBusy ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
          Host MC Server
        </button>
        <button
          type="button"
          onClick={() => navigate('/media')}
          title="Cartoon, anime and kids channels have their own guide section"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm"
          style={{ color: 'var(--color-accent)', background: 'var(--color-accent-subtle)', border: '1px solid var(--color-border)' }}
        >
          <Baby size={14} /> Kids TV guide
        </button>
      </div>
      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        Messenger Kids runs inside the Messenger mobile/desktop apps and needs a parent&apos;s Facebook
        account — the tile opens Messenger. Cartoons, anime and kids channels live in Media → IPTV → Kids.
      </p>
    </div>
  );
}

interface CryptoGroup {
  label: string;
  apps: HubService[];
}

const cryptoGroups: CryptoGroup[] = [
  {
    label: 'Exchanges — buy, sell & trade',
    apps: [
      { id: 'coinbase', name: 'Coinbase', url: 'https://www.coinbase.com/', color: '#0052ff', description: 'Major US exchange — buy, sell, stake and earn crypto.', icon: Bitcoin },
      { id: 'kraken', name: 'Kraken', url: 'https://www.kraken.com/', color: '#5741d9', description: 'Exchange with low fees, futures and staking.', icon: Bitcoin },
      { id: 'crypto-com', name: 'Crypto.com', url: 'https://crypto.com/', color: '#002b4c', description: 'Exchange plus DeFi wallet and card.', icon: Bitcoin },
      { id: 'gemini', name: 'Gemini', url: 'https://www.gemini.com/', color: '#00dcfa', description: 'Regulated US exchange with insurance on digital assets.', icon: Bitcoin },
      { id: 'kucoin', name: 'KuCoin', url: 'https://www.kucoin.com/', color: '#24ae8f', description: 'Exchange with the widest altcoin selection.', icon: Bitcoin },
      { id: 'bitstamp', name: 'Bitstamp', url: 'https://www.bitstamp.net/', color: '#1a1a1a', description: 'One of the oldest exchanges — simple buy/sell.', icon: Bitcoin },
    ],
  },
  {
    label: 'AI trading bots',
    apps: [
      { id: 'pionex', name: 'Pionex', url: 'https://www.pionex.com/', color: '#1a7f5a', description: 'Exchange with built-in free AI trading bots.', icon: BrainCircuit },
      { id: '3commas', name: '3Commas', url: 'https://3commas.io/', color: '#2f80ed', description: 'Automated crypto trading bots and DCA.', icon: BrainCircuit },
      { id: 'cryptohopper', name: 'Cryptohopper', url: 'https://www.cryptohopper.com/', color: '#4f8ff7', description: 'AI-powered strategy bots for 100+ exchanges.', icon: BrainCircuit },
      { id: 'coinrule', name: 'Coinrule', url: 'https://coinrule.com/', color: '#7c5cff', description: 'No-code rule builder — "if this then that" trading.', icon: BrainCircuit },
      { id: 'bitsgap', name: 'Bitsgap', url: 'https://bitsgap.com/', color: '#00d4a6', description: 'Trading bots, signals and portfolio tools.', icon: BrainCircuit },
    ],
  },
  {
    label: 'Market graphs & data',
    apps: [
      { id: 'coingecko', name: 'CoinGecko', url: 'https://www.coingecko.com/', color: '#16a085', description: 'Prices, charts and market data for every crypto.', icon: LineChart },
      { id: 'coinmarketcap', name: 'CoinMarketCap', url: 'https://coinmarketcap.com/', color: '#3861fb', description: 'Market cap rankings and charts.', icon: LineChart },
      { id: 'tradingview', name: 'TradingView', url: 'https://www.tradingview.com/', color: '#2962ff', description: 'Professional charts and technical analysis.', icon: LineChart },
      { id: 'coinstats', name: 'CoinStats', url: 'https://coinstats.app/', color: '#f7931a', description: 'Portfolio tracker with live charts.', icon: LineChart },
    ],
  },
  {
    label: 'Mining & earn',
    apps: [
      { id: 'kryptex', name: 'Kryptex', url: 'https://www.kryptex.com/en/', color: '#f97316', description: 'Cloud mining, mining contracts and the Kryptex Miner app.', icon: Bitcoin },
      { id: 'nicehash', name: 'NiceHash', url: 'https://www.nicehash.com/', color: '#3b82f6', description: 'Hashpower marketplace — sell or buy mining power.', icon: Bitcoin },
      { id: 'salad', name: 'Salad', url: 'https://salad.com/', color: '#22c55e', description: 'Share idle GPU/CPU power and earn crypto payouts.', icon: Bitcoin },
      { id: 'cudo-miner', name: 'Cudo Miner', url: 'https://cudominer.com/', color: '#a855f7', description: 'Free miner app — auto-switches to the most profitable coin.', icon: Bitcoin },
      { id: 'honeygain', name: 'Honeygain', url: 'https://www.honeygain.com/', color: '#facc15', description: 'Earn from unused bandwidth (pays in BTC/JumpToken).', icon: Bitcoin },
      { id: 'earnapp', name: 'EarnApp', url: 'https://earnapp.com/', color: '#38bdf8', description: 'Bandwidth-sharing earnings paid in BTC or gift cards.', icon: Bitcoin },
    ],
  },
  {
    label: 'Mining pools',
    apps: [
      { id: 'f2pool', name: 'F2Pool', url: 'https://www.f2pool.com/', color: '#f97316', description: 'Largest BTC mining pool — PPS+ payouts.', icon: Bitcoin },
      { id: 'antpool', name: 'Antpool', url: 'https://www.antpool.com/', color: '#3b82f6', description: 'Major pool for BTC and many altcoins.', icon: Bitcoin },
      { id: 'viabtc', name: 'ViaBTC', url: 'https://viabtc.com/', color: '#22c55e', description: 'Pool plus cloud mining and exchange.', icon: Bitcoin },
      { id: 'braiins', name: 'Braiins Pool', url: 'https://braiins.com/pool', color: '#a855f7', description: 'Bitcoin-only pool with FPPS+ payouts.', icon: Bitcoin },
      { id: 'foundry', name: 'Foundry USA', url: 'https://foundrydigital.com/', color: '#64748b', description: 'US-based pool — reputable, institutional grade.', icon: Bitcoin },
      { id: 'poolin', name: 'Poolin', url: 'https://www.poolin.com/', color: '#ef4444', description: 'Large multi-coin pool with low fees.', icon: Bitcoin },
      { id: 'ctpool', name: 'CTPool', url: 'https://ctpool.net/en/', color: '#06b6d4', description: 'Kaspa/CTC mining pool with solo and pooled options.', icon: Bitcoin },
    ],
  },
  {
    label: 'Faucets — small crypto rewards',
    apps: [
      { id: 'earnbitmoon', name: 'Earnbitmoon', url: 'https://earnbitmoon.club/', color: '#f59e0b', description: 'Faucet claims plus offerwalls and PTC tasks.', icon: Bitcoin },
      { id: 'fire-faucet', name: 'Fire Faucet', url: 'https://firefaucet.win/', color: '#ef4444', description: 'Faucet with games, staking and a rewards marketplace.', icon: Bitcoin },
      { id: 'freebitcoin', name: 'FreeBitcoin', url: 'https://freebitcoin.com/', color: '#f7931a', description: 'Long-running BTC faucet — roll every 30 min for a chance at 0.0001+ BTC.', icon: Bitcoin },
      { id: 'cointiply', name: 'Cointiply', url: 'https://cointiply.com/', color: '#22c55e', description: 'Faucet plus offerwalls, surveys and PTC earning.', icon: Bitcoin },
      { id: 'faucetpay', name: 'FaucetPay', url: 'https://faucetpay.io/', color: '#3b82f6', description: 'Faucet list, wallet and micro-earning ecosystem.', icon: Bitcoin },
      { id: 'adbtc', name: 'AdBTC.top', url: 'https://adbtc.top/', color: '#a855f7', description: 'Watch ads and complete tasks for BTC rewards.', icon: Bitcoin },
    ],
  },
  {
    label: 'Wallets',
    apps: [
      { id: 'coinbase-wallet', name: 'Coinbase Wallet', url: 'https://www.coinbase.com/wallet', color: '#0052ff', description: 'Self-custody wallet — separate from the exchange account.', icon: Wallet },
      { id: 'exodus', name: 'Exodus', url: 'https://www.exodus.com/', color: '#6c5ce7', description: 'Desktop/mobile wallet with built-in exchange.', icon: Wallet },
      { id: 'electrum', name: 'Electrum', url: 'https://electrum.org/', color: '#519be5', description: 'Lightweight Bitcoin wallet — open source.', icon: Wallet },
      { id: 'metamask', name: 'MetaMask', url: 'https://metamask.io/', color: '#f6851b', description: 'The standard Web3/Ethereum wallet.', icon: Wallet },
      { id: 'trust-wallet', name: 'Trust Wallet', url: 'https://trustwallet.com/', color: '#3375bb', description: 'Mobile wallet supporting 10M+ assets.', icon: Wallet },
      { id: 'ledger-live', name: 'Ledger Live', url: 'https://www.ledger.com/', color: '#000000', description: 'Hardware wallet companion app.', icon: Wallet },
      { id: 'tangem', name: 'Tangem', url: 'https://tangem.com/', color: '#1a1a1a', description: 'Smartcard hardware wallet — no seed phrase.', icon: Wallet },
      { id: 'nc-wallet', name: 'NC Wallet', url: 'https://app.nc-wallet.com/', color: '#7c3aed', description: 'Multi-chain self-custody wallet.', icon: Wallet },
    ],
  },
];

interface HubGroup {
  label: string;
  apps: HubService[];
}

const smartHomeGroups: HubGroup[] = [
  {
    label: 'Hubs & platforms',
    apps: [
      { id: 'home-assistant', name: 'Home Assistant', url: 'https://www.home-assistant.io/', color: '#18bcf2', description: 'Open-source smart-home hub — local control, no cloud.', icon: Home },
      { id: 'smartthings', name: 'SmartThings', url: 'https://www.smartthings.com/', color: '#1f6feb', description: 'Samsung\u2019s smart-home app for hubs and devices.', icon: Home },
      { id: 'google-home', name: 'Google Home', url: 'https://home.google.com/', color: '#4285f4', description: 'Control Nest and Works-with-Google devices.', icon: Home },
      { id: 'amazon-alexa', name: 'Alexa', url: 'https://alexa.amazon.com/', color: '#00d4aa', description: 'Amazon voice assistant — routines, devices, drops.', icon: Home },
      { id: 'homey', name: 'Homey', url: 'https://www.homey.app/', color: '#6c5ce7', description: 'Athom\u2019s local-first smart-home hub.', icon: Home },
    ],
  },
  {
    label: 'Lights, cameras & sensors',
    apps: [
      { id: 'philips-hue', name: 'Philips Hue', url: 'https://www.philips-hue.com/en-us', color: '#0066ff', description: 'Hue lights, scenes and rooms.', icon: Lightbulb },
      { id: 'ring', name: 'Ring', url: 'https://ring.com/', color: '#1f6feb', description: 'Doorbells, cameras and alarm.', icon: Home },
      { id: 'nest', name: 'Google Nest', url: 'https://store.google.com/us/category/nest', color: '#4285f4', description: 'Nest thermostats, cameras and doorbells.', icon: Home },
      { id: 'ecobee', name: 'ecobee', url: 'https://www.ecobee.com/', color: '#2dd4bf', description: 'Smart thermostats and sensors.', icon: Home },
      { id: 'tp-link-kasa', name: 'Kasa', url: 'https://www.kasasmart.com/', color: '#3b82f6', description: 'TP-Link smart plugs, bulbs and cameras.', icon: Home },
      { id: 'switchbot', name: 'SwitchBot', url: 'https://www.switch-bot.com/', color: '#00b894', description: 'Robot buttons, curtains and sensors.', icon: Home },
    ],
  },
];

const productivityGroups: HubGroup[] = [
  {
    label: 'Work suites & notes',
    apps: [
      { id: 'microsoft-365', name: 'Microsoft 365', url: 'https://www.microsoft365.com/', color: '#d83b01', description: 'Word, Excel, Outlook, Teams and OneDrive.', icon: Briefcase },
      { id: 'google-workspace', name: 'Google Workspace', url: 'https://workspace.google.com/', color: '#4285f4', description: 'Docs, Sheets, Gmail and Drive.', icon: Briefcase },
      { id: 'notion', name: 'Notion', url: 'https://www.notion.so/', color: '#111111', description: 'Notes, docs, wikis and project boards.', icon: Briefcase },
      { id: 'obsidian', name: 'Obsidian', url: 'https://obsidian.md/', color: '#7c3aed', description: 'Local-first markdown notes — works offline.', icon: Briefcase },
      { id: 'todoist', name: 'Todoist', url: 'https://todoist.com/', color: '#e44332', description: 'Task manager with natural-language entry.', icon: Briefcase },
    ],
  },
  {
    label: 'Boards & planning',
    apps: [
      { id: 'trello', name: 'Trello', url: 'https://trello.com/', color: '#0052cc', description: 'Kanban boards for projects.', icon: Briefcase },
      { id: 'asana', name: 'Asana', url: 'https://asana.com/', color: '#f06a6a', description: 'Team task and project management.', icon: Briefcase },
      { id: 'clickup', name: 'ClickUp', url: 'https://clickup.com/', color: '#7b68ee', description: 'All-in-one work platform.', icon: Briefcase },
      { id: 'monday', name: 'monday.com', url: 'https://monday.com/', color: '#ff3d57', description: 'Work OS with boards, docs and automations.', icon: Briefcase },
    ],
  },
  {
    label: 'Meetings & scheduling',
    apps: [
      { id: 'zoom', name: 'Zoom', url: 'https://zoom.us/', color: '#2d8cff', description: 'Video meetings and webinars.', icon: Monitor },
      { id: 'teams', name: 'Microsoft Teams', url: 'https://teams.microsoft.com/', color: '#6264a7', description: 'Chat, calls and collaboration.', icon: Monitor },
      { id: 'google-meet', name: 'Google Meet', url: 'https://meet.google.com/', color: '#00897b', description: 'Browser video meetings.', icon: Monitor },
      { id: 'webex', name: 'Webex', url: 'https://www.webex.com/', color: '#00bcf2', description: 'Cisco video meetings.', icon: Monitor },
      { id: 'calendly', name: 'Calendly', url: 'https://calendly.com/', color: '#006bff', description: 'Scheduling links — let people book you.', icon: Monitor },
      { id: 'doodle', name: 'Doodle', url: 'https://doodle.com/', color: '#579ff9', description: 'Group scheduling polls.', icon: Monitor },
    ],
  },
];

const financeGroups: HubGroup[] = [
  {
    label: 'Payments & transfers',
    apps: [
      { id: 'paypal', name: 'PayPal', url: 'https://www.paypal.com/', color: '#003087', description: 'Payments, transfers and buyer protection.', icon: Wallet },
      { id: 'venmo', name: 'Venmo', url: 'https://venmo.com/', color: '#008cff', description: 'Social payments app.', icon: Wallet },
      { id: 'cash-app', name: 'Cash App', url: 'https://cash.app/', color: '#00d632', description: 'Payments, investing and Bitcoin.', icon: Wallet },
      { id: 'wise', name: 'Wise', url: 'https://wise.com/', color: '#9fe870', description: 'Low-cost international transfers.', icon: Wallet },
      { id: 'revolut', name: 'Revolut', url: 'https://www.revolut.com/', color: '#000000', description: 'Multi-currency account and card.', icon: Wallet },
    ],
  },
  {
    label: 'Investing & banking',
    apps: [
      { id: 'questrade', name: 'Questrade', url: 'https://www.questrade.com/', color: '#00a651', description: 'Canadian discount brokerage.', icon: LineChart },
      { id: 'wealthsimple', name: 'Wealthsimple', url: 'https://www.wealthsimple.com/', color: '#000000', description: 'Canadian investing and banking app.', icon: LineChart },
      { id: 'interactive-brokers', name: 'Interactive Brokers', url: 'https://www.interactivebrokers.com/', color: '#d52b1e', description: 'Global brokerage for stocks, options, futures.', icon: LineChart },
      { id: 'tangerine', name: 'Tangerine', url: 'https://www.tangerine.ca/', color: '#ff8200', description: 'Canadian no-fee chequing and savings.', icon: Landmark },
    ],
  },
  {
    label: 'Budgeting & tracking',
    apps: [
      { id: 'ynab', name: 'YNAB', url: 'https://www.ynab.com/', color: '#4a90e2', description: 'Zero-based budgeting app.', icon: Landmark },
      { id: 'monarch', name: 'Monarch Money', url: 'https://www.monarch.com/', color: '#6c5ce7', description: 'Budgeting and net-worth tracking.', icon: Landmark },
      { id: 'copilot-money', name: 'Copilot Money', url: 'https://copilot.money/', color: '#111111', description: 'AI-assisted budgeting for iPhone/Android.', icon: Landmark },
    ],
  },
];

const newsGroups: HubGroup[] = [
  {
    label: 'Canadian news',
    apps: [
      { id: 'cbc', name: 'CBC', url: 'https://www.cbc.ca/', color: '#f5423a', description: 'Canada\u2019s public broadcaster — news and TV.', icon: Newspaper },
      { id: 'ctv-news', name: 'CTV News', url: 'https://www.ctvnews.ca/', color: '#0055a5', description: 'Canadian national and local news.', icon: Newspaper },
      { id: 'global-news', name: 'Global News', url: 'https://globalnews.ca/', color: '#005baa', description: 'Canadian news with a watch hub.', icon: Newspaper },
      { id: 'globe-mail', name: 'Globe and Mail', url: 'https://www.theglobeandmail.com/', color: '#1a3c6e', description: 'Canadian business and national news.', icon: Newspaper },
      { id: 'toronto-star', name: 'Toronto Star', url: 'https://www.thestar.com/', color: '#00205b', description: 'Toronto and Ontario news.', icon: Newspaper },
    ],
  },
  {
    label: 'World news',
    apps: [
      { id: 'bbc-news', name: 'BBC News', url: 'https://www.bbc.com/news', color: '#bb1919', description: 'UK public broadcaster news.', icon: Newspaper },
      { id: 'cnn', name: 'CNN', url: 'https://www.cnn.com/', color: '#cc0000', description: 'US and world news.', icon: Newspaper },
      { id: 'reuters', name: 'Reuters', url: 'https://www.reuters.com/', color: '#ff8000', description: 'Wire-service news and markets.', icon: Newspaper },
      { id: 'associated-press', name: 'AP News', url: 'https://apnews.com/', color: '#003da5', description: 'Associated Press headlines.', icon: Newspaper },
      { id: 'al-jazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/', color: '#a40000', description: 'Qatar-based international news.', icon: Newspaper },
    ],
  },
  {
    label: 'Weather & environment',
    apps: [
      { id: 'weather-network', name: 'The Weather Network', url: 'https://www.theweathernetwork.com/', color: '#005baa', description: 'Canadian forecasts and alerts.', icon: Newspaper },
      { id: 'accuweather', name: 'AccuWeather', url: 'https://www.accuweather.com/', color: '#f58220', description: 'Minute-by-minute forecasts.', icon: Newspaper },
      { id: 'eccc', name: 'Environment Canada', url: 'https://weather.gc.ca/', color: '#d52b1e', description: 'Official Canadian weather warnings.', icon: Newspaper },
      { id: 'windy', name: 'Windy', url: 'https://www.windy.com/', color: '#2b9ff2', description: 'Animated wind, rain and storm maps.', icon: Newspaper },
    ],
  },
];

const healthGroups: HubGroup[] = [
  {
    label: 'Fitness & activity',
    apps: [
      { id: 'myfitnesspal', name: 'MyFitnessPal', url: 'https://www.myfitnesspal.com/', color: '#0066cc', description: 'Calorie and macro tracking.', icon: Dumbbell },
      { id: 'strava', name: 'Strava', url: 'https://www.strava.com/', color: '#fc4c02', description: 'Run, ride and workout tracking.', icon: Dumbbell },
      { id: 'alltrails', name: 'AllTrails', url: 'https://www.alltrails.com/', color: '#4285f4', description: 'Hiking trails and maps.', icon: Dumbbell },
      { id: 'peloton', name: 'Peloton', url: 'https://www.onepeloton.com/', color: '#d2281c', description: 'Classes and equipment.', icon: Dumbbell },
      { id: 'fitbit', name: 'Fitbit', url: 'https://www.fitbit.com/', color: '#00b0b9', description: 'Wearables and health metrics.', icon: Dumbbell },
    ],
  },
  {
    label: 'Mind & sleep',
    apps: [
      { id: 'headspace', name: 'Headspace', url: 'https://www.headspace.com/', color: '#f47d31', description: 'Meditation and sleep app.', icon: HeartPulse },
      { id: 'calm', name: 'Calm', url: 'https://www.calm.com/', color: '#1e2a4a', description: 'Meditation, sleep stories and music.', icon: HeartPulse },
      { id: 'medisafe', name: 'Medisafe', url: 'https://www.medisafe.com/', color: '#2d8cff', description: 'Medication reminders and interaction checks.', icon: HeartPulse },
    ],
  },
];

const travelGroups: HubGroup[] = [
  {
    label: 'Maps & transit',
    apps: [
      { id: 'google-maps', name: 'Google Maps', url: 'https://maps.google.com/', color: '#34a853', description: 'Directions, transit and traffic.', icon: Plane },
      { id: 'apple-maps', name: 'Apple Maps', url: 'https://maps.apple.com/', color: '#007aff', description: 'Apple\u2019s maps — works in any browser.', icon: Plane },
      { id: 'waze', name: 'Waze', url: 'https://www.waze.com/', color: '#33ccff', description: 'Crowd-sourced driving directions.', icon: Plane },
      { id: 'transit-app', name: 'Transit', url: 'https://transitapp.com/', color: '#00a86b', description: 'Real-time public transit times.', icon: Plane },
      { id: 'flightradar24', name: 'Flightradar24', url: 'https://www.flightradar24.com/', color: '#f7931a', description: 'Live flight tracking.', icon: Plane },
    ],
  },
  {
    label: 'Book & stay',
    apps: [
      { id: 'airbnb', name: 'Airbnb', url: 'https://www.airbnb.com/', color: '#ff5a5f', description: 'Homes, rooms and experiences.', icon: Plane },
      { id: 'booking', name: 'Booking.com', url: 'https://www.booking.com/', color: '#003580', description: 'Hotels and stays worldwide.', icon: Plane },
      { id: 'expedia', name: 'Expedia', url: 'https://www.expedia.com/', color: '#ffd700', description: 'Flights, hotels and car rentals.', icon: Plane },
      { id: 'hotels-com', name: 'Hotels.com', url: 'https://www.hotels.com/', color: '#dc1e2a', description: 'Hotel booking with rewards.', icon: Plane },
      { id: 'kayak', name: 'Kayak', url: 'https://www.kayak.com/', color: '#ff6900', description: 'Compare flights, hotels and cars.', icon: Plane },
    ],
  },
  {
    label: 'Rideshare',
    apps: [
      { id: 'uber', name: 'Uber', url: 'https://www.uber.com/', color: '#000000', description: 'Rides, food delivery and packages.', icon: Plane },
      { id: 'lyft', name: 'Lyft', url: 'https://www.lyft.com/', color: '#ff00bf', description: 'Rideshare and bike/scooter rentals.', icon: Plane },
    ],
  },
];

const educationGroups: HubGroup[] = [
  {
    label: 'Learn & courses',
    apps: [
      { id: 'khan-academy', name: 'Khan Academy', url: 'https://www.khanacademy.org/', color: '#1865d8', description: 'Free lessons in math, science and more.', icon: GraduationCap },
      { id: 'duolingo', name: 'Duolingo', url: 'https://www.duolingo.com/', color: '#58cc02', description: 'Language learning games.', icon: GraduationCap },
      { id: 'coursera', name: 'Coursera', url: 'https://www.coursera.org/', color: '#0056d2', description: 'University courses and certificates.', icon: GraduationCap },
      { id: 'edx', name: 'edX', url: 'https://www.edx.org/', color: '#0b42a3', description: 'MIT/Harvard-style online courses.', icon: GraduationCap },
      { id: 'codecademy', name: 'Codecademy', url: 'https://www.codecademy.com/', color: '#f0c000', description: 'Interactive coding lessons.', icon: GraduationCap },
    ],
  },
  {
    label: 'Research & reading',
    apps: [
      { id: 'google-scholar', name: 'Google Scholar', url: 'https://scholar.google.com/', color: '#4285f4', description: 'Academic paper search.', icon: BookOpen },
      { id: 'pubmed', name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/', color: '#2164a5', description: 'Biomedical research database.', icon: BookOpen },
      { id: 'libby', name: 'Libby', url: 'https://www.overdrive.com/apps/libby/', color: '#e4002b', description: 'Free ebooks and audiobooks via your library.', icon: BookOpen },
      { id: 'open-library', name: 'Open Library', url: 'https://openlibrary.org/', color: '#a66a00', description: 'Free ebooks — one million+ titles.', icon: BookOpen },
    ],
  },
];

const shoppingGroups: HubGroup[] = [
  {
    label: 'Big retailers',
    apps: [
      { id: 'amazon-ca', name: 'Amazon.ca', url: 'https://www.amazon.ca/', color: '#ff9900', description: 'Everything store — Canadian site.', icon: ShoppingCart },
      { id: 'walmart-ca', name: 'Walmart.ca', url: 'https://www.walmart.ca/', color: '#0071dc', description: 'Groceries, electronics and more.', icon: ShoppingCart },
      { id: 'best-buy-ca', name: 'Best Buy Canada', url: 'https://www.bestbuy.ca/', color: '#0046be', description: 'Electronics and appliances.', icon: ShoppingCart },
      { id: 'canadian-tire', name: 'Canadian Tire', url: 'https://www.canadiantire.ca/', color: '#d52b1e', description: 'Auto, sports and home — Canadian.', icon: ShoppingCart },
      { id: 'costco', name: 'Costco', url: 'https://www.costco.ca/', color: '#e31837', description: 'Warehouse club — online ordering.', icon: ShoppingCart },
    ],
  },
  {
    label: 'Marketplaces',
    apps: [
      { id: 'ebay', name: 'eBay', url: 'https://www.ebay.ca/', color: '#e53238', description: 'New and used — auctions and buy-it-now.', icon: ShoppingCart },
      { id: 'etsy', name: 'Etsy', url: 'https://www.etsy.com/', color: '#f1641e', description: 'Handmade, vintage and craft goods.', icon: ShoppingCart },
      { id: 'facebook-marketplace', name: 'Facebook Marketplace', url: 'https://www.facebook.com/marketplace', color: '#0866ff', description: 'Buy and sell locally.', icon: ShoppingCart },
      { id: 'kijiji', name: 'Kijiji', url: 'https://www.kijiji.ca/', color: '#30a0dc', description: 'Canada\u2019s classifieds site.', icon: ShoppingCart },
    ],
  },
  {
    label: 'Deals & coupons',
    apps: [
      { id: 'honey', name: 'Honey', url: 'https://www.joinhoney.com/', color: '#ff9c00', description: 'Auto-applies coupon codes at checkout.', icon: ShoppingCart },
      { id: 'rakuten', name: 'Rakuten', url: 'https://www.rakuten.ca/', color: '#bf0000', description: 'Cash-back shopping portal.', icon: ShoppingCart },
      { id: 'slickdeals', name: 'Slickdeals', url: 'https://slickdeals.net/', color: '#ff6f00', description: 'Community-verified deal alerts.', icon: ShoppingCart },
    ],
  },
];

const toolsGroups: HubGroup[] = [
  {
    label: 'File & system tools',
    apps: [
      { id: '7zip', name: '7-Zip', url: 'https://www.7-zip.org/', color: '#d32f2f', description: 'Free archive extractor/compressor.', icon: Wrench },
      { id: 'filezilla', name: 'FileZilla', url: 'https://filezilla-project.org/', color: '#bf0000', description: 'FTP/SFTP file transfer.', icon: Wrench },
      { id: 'everything', name: 'Everything', url: 'https://www.voidtools.com/', color: '#f59e0b', description: 'Instant filename search for Windows.', icon: Wrench },
      { id: 'powertoys', name: 'PowerToys', url: 'https://learn.microsoft.com/windows/powertoys/', color: '#0078d4', description: 'Microsoft\u2019s Windows power tools.', icon: Wrench },
      { id: 'notepad-plus-plus', name: 'Notepad++', url: 'https://notepad-plus-plus.org/', color: '#90e59a', description: 'Lightweight code/text editor.', icon: Wrench },
      { id: 'sharex', name: 'ShareX', url: 'https://getsharex.com/', color: '#00b050', description: 'Screenshots, screen recording and file sharing.', icon: Wrench },
    ],
  },
  {
    label: 'Media & audio utilities',
    apps: [
      { id: 'handbrake', name: 'HandBrake', url: 'https://handbrake.fr/', color: '#f58220', description: 'Video transcoder — rip and compress.', icon: Video },
      { id: 'lossless-scaling', name: 'Lossless Scaling', url: 'https://losslessscaling.com/', color: '#7c3aed', description: 'Upscale games and video smoothly.', icon: Video },
      { id: 'foobar2000', name: 'foobar2000', url: 'https://www.foobar2000.org/', color: '#f7931a', description: 'Lightweight advanced music player.', icon: Music2 },
      { id: 'calibre', name: 'Calibre', url: 'https://calibre-ebook.com/', color: '#e4002b', description: 'Ebook library and converter.', icon: BookOpen },
      { id: 'paint-net', name: 'Paint.NET', url: 'https://www.getpaint.net/', color: '#ff8c00', description: 'Free image editor for Windows.', icon: Wrench },
    ],
  },
];

const privacyGroups: HubGroup[] = [
  {
    label: 'VPNs',
    apps: [
      { id: 'mullvad', name: 'Mullvad', url: 'https://mullvad.net/', color: '#e4002b', description: 'Flat-rate VPN — account number only, no email.', icon: ShieldCheck },
      { id: 'protonvpn', name: 'Proton VPN', url: 'https://protonvpn.com/', color: '#6d4aff', description: 'Swiss no-logs VPN with free tier.', icon: ShieldCheck },
      { id: 'ivpn', name: 'IVPN', url: 'https://www.ivpn.net/', color: '#00b0b9', description: 'Audited privacy VPN.', icon: ShieldCheck },
      { id: 'windscribe', name: 'Windscribe', url: 'https://windscribe.com/', color: '#00a8e1', description: 'VPN with a free 10 GB/month tier.', icon: ShieldCheck },
      { id: 'tunnelbear', name: 'TunnelBear', url: 'https://www.tunnelbear.com/', color: '#ffb700', description: 'Simple VPN — good for beginners.', icon: ShieldCheck },
    ],
  },
  {
    label: 'Passwords & security',
    apps: [
      { id: 'bitwarden', name: 'Bitwarden', url: 'https://bitwarden.com/', color: '#175cd3', description: 'Open-source password manager — free tier.', icon: ShieldCheck },
      { id: 'keepassxc', name: 'KeePassXC', url: 'https://keepassxc.org/', color: '#519be5', description: 'Offline password database — no cloud.', icon: ShieldCheck },
      { id: '1password', name: '1Password', url: 'https://1password.com/', color: '#1e6fff', description: 'Popular family/team password manager.', icon: ShieldCheck },
      { id: 'nextdns', name: 'NextDNS', url: 'https://nextdns.io/', color: '#0085ff', description: 'Encrypted DNS — blocks ads and trackers network-wide.', icon: ShieldCheck },
    ],
  },
  {
    label: 'Search & privacy tools',
    apps: [
      { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/', color: '#de5833', description: 'Privacy-focused search engine.', icon: ShieldCheck },
      { id: 'startpage', name: 'Startpage', url: 'https://www.startpage.com/', color: '#6cbf4f', description: 'Google results without tracking.', icon: ShieldCheck },
      { id: 'privacy-com', name: 'Privacy.com', url: 'https://www.privacy.com/', color: '#1a1a1a', description: 'Virtual cards that lock after one use.', icon: ShieldCheck },
    ],
  },
];

const modsGroups: HubGroup[] = [
  {
    label: 'Mod managers',
    apps: [
      { id: 'mod-organizer-2', name: 'Mod Organizer 2', url: 'https://github.com/ModOrganizer2/modorganizer', color: '#00a8e1', description: 'The standard load-order manager for Bethesda games — profiles, plugins, MO2 keeps mods isolated.', icon: Gamepad2 },
      { id: 'vortex', name: 'Vortex', url: 'https://www.nexusmods.com/vortex', color: '#7c3aed', description: 'Nexus Mods\u2019 official mod manager — auto-deploys mods for many games.', icon: Gamepad2 },
      { id: 'nexus-mods-app', name: 'Nexus Mods App', url: 'https://www.nexusmods.com/site/mods/666', color: '#d43d2a', description: 'Desktop app for downloading and managing Nexus collections.', icon: Gamepad2 },
    ],
  },
  {
    label: 'Load order & plugin tools',
    apps: [
      { id: 'wrye-bash', name: 'Wrye Bash', url: 'https://github.com/wrye1/wryebash', color: '#f59e0b', description: 'Load-order optimizer, conflict detector and patcher for Skyrim/Fallout.', icon: Wrench },
      { id: 'xedit', name: 'xEdit', url: 'https://github.com/TES5Edit/TES5Edit', color: '#4ade80', description: 'Universal plugin editor — clean masters, fix conflicts, remove ITMs.', icon: Wrench },
      { id: 'loot', name: 'LOOT', url: 'https://github.com/loot/loot', color: '#38bdf8', description: 'Plugin load-order sorter for Oblivion through Starfield.', icon: Wrench },
      { id: 'boss', name: 'BOSS', url: 'https://github.com/mwild1/BOSS', color: '#fb923c', description: 'Load-order sorter (older games, works alongside LOOT).', icon: Wrench },
    ],
  },
  {
    label: 'Mod platforms',
    apps: [
      { id: 'nexus-mods', name: 'Nexus Mods', url: 'https://www.nexusmods.com/', color: '#d43d2a', description: 'Largest mod repository — Skyrim, Fallout, Cyberpunk, WoW and more.', icon: Gamepad2 },
      { id: 'modrinth', name: 'Modrinth', url: 'https://modrinth.com/', color: '#1bd96a', description: 'Minecraft mods, shaders and resource packs.', icon: Gamepad2 },
      { id: 'curseforge', name: 'CurseForge', url: 'https://www.curseforge.com/', color: '#f1641e', description: 'Minecraft, WoW and game mods with a desktop app.', icon: Gamepad2 },
    ],
  },
  {
    label: 'Game-specific helpers',
    apps: [
      { id: 'skse', name: 'SKSE', url: 'http://skse.silverlock.org/', color: '#8b5cf6', description: 'Skyrim Script Extender — required by most Skyrim mods.', icon: Gamepad2 },
      { id: 'f4se', name: 'F4SE', url: 'http://f4se.silverlock.org/', color: '#0ea5e9', description: 'Fallout 4 Script Extender.', icon: Gamepad2 },
      { id: 'bethini', name: 'BethINI', url: 'https://github.com/meh321/BethINI', color: '#10b981', description: 'Auto-configures INI files for Skyrim/Fallout — big FPS gains.', icon: Wrench },
      { id: 'skyrim-cc', name: 'Skyrim Script Extender (AE)', url: 'https://www.nexusmods.com/skyrimspecialedition/mods/30379', color: '#a855f7', description: 'Updated SKSE build for Skyrim Special/Anniversary Edition.', icon: Gamepad2 },
    ],
  },
];

const createGroups: HubGroup[] = [
  {
    label: 'Photo editors',
    apps: [
      { id: 'photopea', name: 'Photopea', url: 'https://www.photopea.com/', color: '#112f52', description: 'Free browser Photoshop clone — layers, PSD support, no install.', icon: Images },
      { id: 'gimp', name: 'GIMP', url: 'https://www.gimp.org/', color: '#4e9a51', description: 'Free open-source Photoshop alternative.', icon: Images },
      { id: 'krita', name: 'Krita', url: 'https://krita.org/', color: '#3b6ea5', description: 'Digital painting and illustration — great with a tablet.', icon: Images },
      { id: 'photoshop', name: 'Photoshop', url: 'https://www.adobe.com/products/photoshop.html', color: '#31a8ff', description: 'Industry-standard photo editor (subscription).', icon: Images },
      { id: 'affinity-photo', name: 'Affinity Photo', url: 'https://affinity.serif.com/photo/', color: '#0186ff', description: 'Pro photo editor — one-time purchase, no subscription.', icon: Images },
      { id: 'pixlr', name: 'Pixlr', url: 'https://pixlr.com/', color: '#f97316', description: 'Free browser photo editor — quick edits and templates.', icon: Images },
      { id: 'fotor', name: 'Fotor', url: 'https://www.fotor.com/', color: '#7c3aed', description: 'Photo editor with AI tools and templates.', icon: Images },
      { id: 'luminar-ne', name: 'Luminar Neo', url: 'https://skylum.com/luminar', color: '#0ea5e9', description: 'AI photo editor — one-time purchase.', icon: Images },
      { id: 'darktable', name: 'darktable', url: 'https://www.darktable.org/', color: '#8b5cf6', description: 'Free RAW developer and photo workflow tool.', icon: Images },
      { id: 'rawtherapee', name: 'RawTherapee', url: 'https://www.rawtherapee.com/', color: '#f59e0b', description: 'Free RAW photo processor with advanced controls.', icon: Images },
    ],
  },
  {
    label: 'Design & illustration',
    apps: [
      { id: 'canva-design', name: 'Canva', url: 'https://www.canva.com/', color: '#8b3dff', description: 'Posters, cards, invitations and social graphics — free tier.', icon: Palette },
      { id: 'figma', name: 'Figma', url: 'https://www.figma.com/', color: '#a259ff', description: 'Interface and graphic design in the browser.', icon: Palette },
      { id: 'inkscape', name: 'Inkscape', url: 'https://inkscape.org/', color: '#ed8b00', description: 'Free vector graphics editor (SVG).', icon: Palette },
      { id: 'ibis-paint', name: 'ibis Paint', url: 'https://ibispaint.com/', color: '#ff6b9d', description: 'Free drawing app — huge brush library.', icon: Palette },
      { id: 'procreate', name: 'Procreate', url: 'https://procreate.com/', color: '#1e88e5', description: 'iPad illustration app (Apple devices).', icon: Palette },
    ],
  },
  {
    label: 'Video editors',
    apps: [
      { id: 'premiere-pro', name: 'Premiere Pro', url: 'https://www.adobe.com/products/premiere.html', color: '#9999ff', description: 'Professional video editor (subscription).', icon: Video },
      { id: 'filmora', name: 'Filmora', url: 'https://filmora.wondershare.com/', color: '#2d8cff', description: 'Easy video editor with effects and templates.', icon: Video },
      { id: 'openshot', name: 'OpenShot', url: 'https://www.openshot.org/', color: '#4caf50', description: 'Free open-source video editor.', icon: Video },
      { id: 'shotcut', name: 'Shotcut', url: 'https://shotcut.org/', color: '#2e7d32', description: 'Free open-source video editor — no watermark.', icon: Video },
      { id: 'kdenlive', name: 'Kdenlive', url: 'https://kdenlive.org/', color: '#4a90d9', description: 'Free open-source video editor for Windows/Linux.', icon: Video },
    ],
  },
  {
    label: 'Audio & music makers',
    apps: [
      { id: 'ocenaudio', name: 'ocenaudio', url: 'https://www.ocenaudio.com/', color: '#00a8e1', description: 'Fast, clean audio editor for Windows.', icon: Music2 },
      { id: 'lmms', name: 'LMMS', url: 'https://lmms.io/', color: '#8bc34a', description: 'Free music-production software — make beats.', icon: Music2 },
      { id: 'bandlab', name: 'BandLab', url: 'https://www.bandlab.com/', color: '#ff4d6d', description: 'Browser DAW — record, mix and share music.', icon: Music2 },
      { id: 'soundtrap', name: 'Soundtrap', url: 'https://www.soundtrap.com/', color: '#00b8d9', description: 'Online music studio — collab in real time.', icon: Music2 },
    ],
  },
];

const cleanerGroups: HubGroup[] = [
  {
    label: 'Disk & junk cleaners',
    apps: [
      { id: 'ccleaner', name: 'CCleaner', url: 'https://www.ccleaner.com/', color: '#f05a28', description: 'Popular junk-file, registry and browser cleaner.', icon: Eraser },
      { id: 'iobit-asc', name: 'IObit Advanced SystemCare', url: 'https://www.iobit.com/en/advanced-systemcare.php', color: '#2f80ed', description: 'All-in-one optimizer: junk, registry, startup, privacy sweep.', icon: Eraser },
      { id: 'bleachbit', name: 'BleachBit', url: 'https://www.bleachbit.org/', color: '#8bc34a', description: 'Free open-source cleaner — deep system and browser wipe.', icon: Eraser },
      { id: 'glary-utilities', name: 'Glary Utilities', url: 'https://www.glarysoft.com/', color: '#00a8e1', description: 'Registry, disk and privacy cleaner suite.', icon: Eraser },
      { id: 'wise-care', name: 'Wise Care 365', url: 'https://www.wisecleaner.com/wise-care-365.html', color: '#4caf50', description: 'Cleaner + optimizer with health checks.', icon: Eraser },
      { id: 'slimcleaner', name: 'SlimCleaner', url: 'https://slimcleaner.com/', color: '#7c3aed', description: 'Fast junk and privacy cleaner.', icon: Eraser },
      { id: 'system-mechanic', name: 'IObit Uninstaller', url: 'https://www.iobit.com/en/iobit-uninstaller.php', color: '#f97316', description: 'Remove programs completely — leftovers included.', icon: Eraser },
    ],
  },
  {
    label: 'Uninstallers & leftover removal',
    apps: [
      { id: 'geek-uninstaller', name: 'Geek Uninstaller', url: 'https://geekuninstaller.com/', color: '#546e7a', description: 'Lightweight portable uninstaller — no install needed.', icon: Eraser },
      { id: 'bcuninstaller', name: 'BCUninstaller', url: 'https://www.bcuninstaller.com/', color: '#e53935', description: 'Bulk uninstaller — remove many programs at once.', icon: Eraser },
      { id: 'revo-uninstaller', name: 'Revo Uninstaller', url: 'https://www.revouninstaller.com/', color: '#00897b', description: 'Deep-clean uninstaller with leftover scanning.', icon: Eraser },
      { id: 'your-uninstaller', name: 'Your Uninstaller', url: 'https://www.crystaloffice.com/products/your-uninstaller/', color: '#5c6bc0', description: 'Free uninstaller that hunts orphan registry entries.', icon: Eraser },
    ],
  },
  {
    label: 'Registry & startup tools',
    apps: [
      { id: 'autoruns', name: 'Autoruns', url: 'https://learn.microsoft.com/en-us/sysinternals/downloads/autoruns', color: '#00b4d8', description: 'Sysinternals — see everything that auto-starts on boot.', icon: Eraser },
      { id: 'process-explorer', name: 'Process Explorer', url: 'https://learn.microsoft.com/en-us/sysinternals/downloads/process-explorer', color: '#00b4d8', description: 'Sysinternals process manager — deeper than Task Manager.', icon: Eraser },
      { id: 'wise-registry', name: 'Wise Registry Cleaner', url: 'https://www.wisecleaner.com/wise-registry-cleaner.html', color: '#4caf50', description: 'Registry scan and repair tool.', icon: Eraser },
    ],
  },
  {
    label: 'Duplicate & space finders',
    apps: [
      { id: 'dupe-guru', name: 'dupeGuru', url: 'https://dupeguru.voltaicideas.net/', color: '#f9a825', description: 'Free open-source duplicate file finder.', icon: Eraser },
      { id: 'windirstat', name: 'WinDirStat', url: 'https://windirstat.net/', color: '#ff7043', description: 'Visual disk-usage treemap — find what eats space.', icon: Eraser },
      { id: 'treesize', name: 'TreeSize Free', url: 'https://www.jam-software.com/treesizefree', color: '#42a5f5', description: 'Folder-size explorer to hunt space hogs.', icon: Eraser },
      { id: 'duplicate-photo', name: 'Awesome Duplicate Photo Finder', url: 'https://www.duplicatephotofinder.com/', color: '#ab47bc', description: 'Finds duplicate and similar photos.', icon: Eraser },
    ],
  },
];

const securityGroups: HubGroup[] = [
  {
    label: 'Antivirus',
    apps: [
      { id: 'bitdefender', name: 'Bitdefender', url: 'https://www.bitdefender.com/', color: '#0071ce', description: 'Top-rated antivirus with malware and ransomware protection.', icon: ShieldCheck },
      { id: 'norton', name: 'Norton', url: 'https://us.norton.com/', color: '#ffc400', description: 'Antivirus + VPN + password manager suite.', icon: ShieldCheck },
      { id: 'mcafee', name: 'McAfee', url: 'https://www.mcafee.com/', color: '#d32323', description: 'Antivirus with identity protection add-ons.', icon: ShieldCheck },
      { id: 'kaspersky', name: 'Kaspersky', url: 'https://www.kaspersky.com/', color: '#00a65a', description: 'Antivirus, VPN and password manager.', icon: ShieldCheck },
      { id: 'avast', name: 'Avast', url: 'https://www.avast.com/', color: '#ff7800', description: 'Free antivirus with optional paid features.', icon: ShieldCheck },
      { id: 'avg', name: 'AVG', url: 'https://www.avg.com/', color: '#00b140', description: 'Free antivirus — same engine as Avast.', icon: ShieldCheck },
      { id: 'eset', name: 'ESET', url: 'https://www.eset.com/', color: '#0066b3', description: 'Lightweight, low-resource antivirus.', icon: ShieldCheck },
      { id: 'sophos-home', name: 'Sophos Home', url: 'https://home.sophos.com/', color: '#00a0dc', description: 'Free business-grade protection for home PCs.', icon: ShieldCheck },
      { id: 'trend-micro', name: 'Trend Micro', url: 'https://www.trendmicro.com/', color: '#e4002b', description: 'Antivirus plus web threat protection.', icon: ShieldCheck },
      { id: 'defender', name: 'Windows Defender', url: 'https://support.microsoft.com/en-us/windows/security', color: '#0078d4', description: 'Built-in protection — keep it updated, add Malwarebytes on top.', icon: ShieldCheck },
    ],
  },
  {
    label: 'Malware scanners & removal',
    apps: [
      { id: 'malwarebytes', name: 'Malwarebytes', url: 'https://www.malwarebytes.com/', color: '#6c5ce7', description: 'On-demand malware scanner — free version available.', icon: ShieldCheck },
      { id: 'hitmanpro', name: 'HitmanPro', url: 'https://www.hitmanpro.com/', color: '#2d9cdb', description: 'Second-opinion cloud scanner for stubborn malware.', icon: ShieldCheck },
      { id: 'zemana', name: 'Zemana AntiMalware', url: 'https://www.zemana.com/', color: '#f44336', description: 'Free on-demand antimalware scanner.', icon: ShieldCheck },
      { id: 'kaspersky-vrt', name: 'Kaspersky Virus Removal Tool', url: 'https://www.kaspersky.com/downloads/virus-removal-tool', color: '#00a65a', description: 'Free standalone virus remover — no install.', icon: ShieldCheck },
      { id: 'eSET-online', name: 'ESET Online Scanner', url: 'https://www.eset.com/online-scanner/', color: '#0066b3', description: 'Free browser-based second-opinion scan.', icon: ShieldCheck },
    ],
  },
  {
    label: 'Identity & breach monitoring',
    apps: [
      { id: 'haveibeenpwned', name: 'Have I Been Pwned', url: 'https://haveibeenpwned.com/', color: '#1a1a1a', description: 'Check if your email appeared in data breaches.', icon: ShieldCheck },
      { id: 'firefox-monitor', name: 'Firefox Monitor', url: 'https://monitor.mozilla.org/', color: '#ff7139', description: 'Free breach alerts for your email.', icon: ShieldCheck },
      { id: 'bitwarden-security', name: 'Bitwarden', url: 'https://bitwarden.com/', color: '#175DDC', description: 'Open-source password manager — free tier.', icon: ShieldCheck },
    ],
  },
];

const osGroups: HubGroup[] = [
  {
    label: 'Official Microsoft sources',
    apps: [
      { id: 'ms-win11-iso', name: 'Windows 11 ISO', url: 'https://www.microsoft.com/software-download/windows11', color: '#0078d4', description: 'Official Windows 11 disk image download from Microsoft.', icon: Monitor },
      { id: 'ms-media-creation', name: 'Media Creation Tool', url: 'https://www.microsoft.com/software-download/windows11', color: '#0078d4', description: 'Microsoft tool to create bootable USB or ISO.', icon: Download },
      { id: 'ms-adk', name: 'Windows ADK / WinPE', url: 'https://learn.microsoft.com/en-us/windows-hardware/get-started/adk-install', color: '#0078d4', description: 'Assessment and Deployment Kit for custom Windows PE images.', icon: Cpu },
      { id: 'ms-eval', name: 'Windows Evaluation', url: 'https://www.microsoft.com/en-us/evalcenter/evaluate-windows-11-enterprise', color: '#0078d4', description: '90-day evaluation of Windows Enterprise editions.', icon: Monitor },
      { id: 'ms-surface-recovery', name: 'Surface Recovery', url: 'https://support.microsoft.com/surface/recovery-image', color: '#0078d4', description: 'Official recovery images for Surface devices.', icon: HardDrive },
    ],
  },
  {
    label: 'Community builds (unofficial — use at your own risk)',
    apps: [
      { id: 'tiny11builder', name: 'tiny11builder', url: 'https://github.com/ntdevlabs/tiny11builder', color: '#8b5cf6', description: 'Builds a debloated Windows 11 ISO from your own official ISO — the safest community option.', icon: Cpu },
      { id: 'ghostspectre', name: 'GhostSpectre ISOs', url: 'https://ghostspectre.the-ninja.jp/20H2.21H1.HOME.X64.html', color: '#f59e0b', description: 'Unofficial modified Windows ISOs (20H2/21H1). Modified by a third party — verify hashes and scan before use.', icon: Monitor },
      { id: 'atlasos', name: 'AtlasOS', url: 'https://atlasos.net/', color: '#10b981', description: 'Community debloated Windows builds — unofficial, review before installing.', icon: Monitor },
      { id: 'winutil', name: 'ChrisTitusTech winutil', url: 'https://github.com/ChrisTitusTech/winutil', color: '#3b82f6', description: 'Popular Windows debloat/optimization script — runs on a stock ISO, no modified image needed.', icon: Cpu },
    ],
  },
  {
    label: 'USB & boot tools',
    apps: [
      { id: 'rufus', name: 'Rufus', url: 'https://rufus.ie/', color: '#f59e0b', description: 'The standard tool for writing bootable USB drives.', icon: Download },
      { id: 'ventoy', name: 'Ventoy', url: 'https://www.ventoy.net/', color: '#22c55e', description: 'Multiboot USB — drop ISOs on the drive and pick at boot.', icon: HardDrive },
      { id: 'balena-etcher', name: 'balenaEtcher', url: 'https://etcher.balena.io/', color: '#0078d4', description: 'Dead-simple ISO-to-USB writer.', icon: Download },
      { id: 'hirens', name: 'Hiren\'s BootCD PE', url: 'https://www.hirensbootcd.org/', color: '#ef4444', description: 'Recommended — the standard Windows rescue/repair environment with hundreds of tools.', icon: Cpu },
      { id: 'strelec', name: 'Sergei Strelec', url: 'https://s-train.club/sergei-strelec/', color: '#a855f7', description: 'Popular WinPE rescue environment — unofficial build, use at your own risk.', icon: Cpu },
    ],
  },
  {
    label: 'PowerISO & disk tools',
    apps: [
      { id: 'poweriso', name: 'PowerISO', url: 'https://www.poweriso.com/download.htm', color: '#7c3aed', description: 'ISO mounter/burner — closed-source freeware; Rufus or Ventoy cover the same jobs.', icon: HardDrive },
      { id: 'oscdimg-alt', name: 'Windows ADK oscdimg', url: 'https://learn.microsoft.com/en-us/windows-hardware/get-started/adk-install', color: '#0078d4', description: 'Microsoft\'s own command-line ISO builder (free with the ADK).', icon: Cpu },
    ],
  },
  {
    label: 'Activation tools',
    apps: [
      { id: 'showkeyplus', name: 'ShowKeyPlus', url: 'https://www.nirsoft.net/utils/product-key.html', color: '#0ea5e9', description: 'Views the Windows product key already installed on this PC.', icon: Monitor },
      { id: 'ms-activation', name: 'Activation settings', url: 'ms-settings:activation', color: '#0078d4', description: 'Opens Windows activation settings.', icon: Settings },
    ],
  },
];

function ActivationCard() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [sources, setSources] = useState<OsKeySource[]>([]);
  const [keys, setKeys] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchOsKeySources().then(setSources).catch(() => {});
  }, []);

  const checkStatus = async () => {
    setBusy('status'); setMsg('');
    try {
      const r = await fetchActivationStatus();
      setStatus(r.output || 'No output');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Status check failed');
    } finally { setBusy(null); }
  };

  const loadKeys = async (sourceId: string) => {
    setBusy(`keys-${sourceId}`); setMsg('');
    try {
      const r = await fetchOsKeys(sourceId);
      setKeys((prev) => ({ ...prev, [sourceId]: r.keys }));
      if (r.count === 0) setMsg('No keys found in that source.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Key fetch failed');
    } finally { setBusy(null); }
  };

  const installKey = async (key: string) => {
    setBusy(`install-${key}`); setMsg('');
    try {
      const r = await installOsKey(key);
      setMsg(r.ok ? `Key installed: ${key}` : `Install failed: ${r.output.slice(0, 200)}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Install failed');
    } finally { setBusy(null); }
  };

  const smallBtn = 'text-[11px] px-2 py-1 rounded cursor-pointer disabled:opacity-50';
  const smallBtnStyle = { background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' } as const;

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Windows activation</h3>
      <div className="text-[11px] mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
        Keys below are fetched from public lists — installing one does not activate Windows by itself.
        Activation still requires a legitimate license or KMS server.
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button className={smallBtn} style={smallBtnStyle} disabled={busy !== null} onClick={() => void checkStatus()}>
          {busy === 'status' ? 'Checking…' : 'Check activation status'}
        </button>
        <button className={smallBtn} style={smallBtnStyle} onClick={() => void launchSystemApp('ms-settings:activation')}>
          Open activation settings
        </button>
      </div>
      {status && (
        <pre className="text-[11px] mb-3 p-2 rounded overflow-x-auto whitespace-pre-wrap" style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>{status}</pre>
      )}
      <div className="space-y-2">
        {sources.map((s) => (
          <div key={s.id}>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--color-text)' }}>{s.name}</span>
              <button className={smallBtn} style={smallBtnStyle} disabled={busy !== null}
                onClick={() => void loadKeys(s.id)}>
                {busy === `keys-${s.id}` ? 'Fetching…' : keys[s.id] ? 'Refetch' : 'Fetch keys'}
              </button>
              <a href={s.url.replace('api.github.com/repos/benevides/PowerISO-KEYS/contents', 'github.com/benevides/PowerISO-KEYS')}
                target="_blank" rel="noopener noreferrer" className="text-[11px]"
                style={{ color: 'var(--color-accent)' }}>source</a>
            </div>
            {keys[s.id] && keys[s.id].length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {keys[s.id].slice(0, 60).map((k) => (
                  <button key={k} className="text-[11px] px-2 py-1 rounded font-mono"
                    style={{ ...smallBtnStyle, color: 'var(--color-text)' }}
                    disabled={busy !== null}
                    title="Install this key (slmgr /ipk) — does not activate"
                    onClick={() => void installKey(k)}>
                    {busy === `install-${k}` ? '…' : k}
                  </button>
                ))}
                {keys[s.id].length > 60 && (
                  <span className="text-[11px] self-center" style={{ color: 'var(--color-text-tertiary)' }}>+{keys[s.id].length - 60} more</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {msg && <div className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>{msg}</div>}
    </div>
  );
}

function OSPanel() {
  return (
    <div className="space-y-4 px-4 pb-4">
      <ActivationCard />
      <GroupedAppsPanel groups={osGroups} note="Official Microsoft downloads first; community builds are unofficial — the download arrow grabs real installers where available." />
    </div>
  );
}

function PcCareCard() {
  const [scan, setScan] = useState<PcScanResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [defrag, setDefrag] = useState<DefragStatus | null>(null);

  const refreshDefrag = useCallback(() => {
    fetchDefragStatus().then(setDefrag).catch(() => {});
  }, []);

  useEffect(() => { refreshDefrag(); }, [refreshDefrag]);
  useEffect(() => {
    if (!defrag?.running) return;
    const t = window.setInterval(refreshDefrag, 5000);
    return () => window.clearInterval(t);
  }, [defrag?.running, refreshDefrag]);

  const doScan = useCallback(async (deep = false) => {
    setBusy(deep ? 'deep' : 'scan'); setMsg(deep ? 'Deep scanning whole PC (slower)…' : 'Scanning…');
    try {
      setScan(await fetchPcScan(deep));
      setMsg('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setBusy(null);
    }
  }, []);

  const doClean = useCallback(async (opts: { temp?: boolean; dead_links?: boolean; empty_dirs?: boolean }, label: string) => {
    setBusy(label); setMsg(`Cleaning ${label}…`);
    try {
      const r = await runPcClean(opts);
      setMsg(`Freed ${(r.freed_bytes / 1e6).toFixed(1)} MB — ${r.removed_files} files, ${r.removed_dirs} folders${r.errors ? `, ${r.errors} skipped` : ''}.`);
      void doScan();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Clean failed');
    } finally {
      setBusy(null);
    }
  }, [doScan]);

  const doDefrag = useCallback(async () => {
    setBusy('defrag'); setMsg('Starting disk optimization…');
    try {
      await startDefrag();
      setMsg('Optimization running in the background — this can take a while on HDDs.');
      refreshDefrag();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to start');
    } finally {
      setBusy(null);
    }
  }, [refreshDefrag]);

  // Voice: "Jarvis clean my pc", "scan for junk", "defrag", "find empty folders".
  useEffect(() => {
    const onAction = (e: Event) => {
      const action = (e as CustomEvent<{ action?: string }>).detail?.action;
      if (action === 'scan') void doScan();
      else if (action === 'clean-temp') void doClean({ temp: true }, 'temp files');
      else if (action === 'clean-links') void doClean({ dead_links: true }, 'dead shortcuts');
      else if (action === 'clean-folders') void doClean({ empty_dirs: true }, 'empty folders');
      else if (action === 'clean-all') void doClean({ temp: true, dead_links: true, empty_dirs: true }, 'everything');
      else if (action === 'defrag') void doDefrag();
    };
    window.addEventListener('jarvis:pc-action', onAction);
    return () => window.removeEventListener('jarvis:pc-action', onAction);
  }, [doScan, doClean, doDefrag]);

  const btn = 'text-xs px-2.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-50';
  const btnStyle = { background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' } as const;

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <HardDrive size={16} style={{ color: 'var(--color-accent)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>PC Care</h3>
        <span className="flex-1" />
        <button onClick={() => void doScan()} disabled={busy !== null} className={btn} style={btnStyle} title="Scan your profile folders">
          {busy === 'scan' ? 'Scanning…' : 'Scan PC'}
        </button>
        <button onClick={() => void doScan(true)} disabled={busy !== null} className={btn} style={btnStyle} title="Scan all of C:\Users and ProgramData — slower">
          {busy === 'deep' ? 'Deep scanning…' : 'Deep scan (whole PC)'}
        </button>
      </div>

      {scan && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
          <div className="rounded-lg p-2" style={btnStyle}>
            <div style={{ color: 'var(--color-text-tertiary)' }}>Disk free</div>
            <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{scan.disk.free_gb} GB</div>
          </div>
          <div className="rounded-lg p-2" style={btnStyle}>
            <div style={{ color: 'var(--color-text-tertiary)' }}>Temp junk</div>
            <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{(scan.temp.bytes / 1e6).toFixed(0)} MB · {scan.temp.count} files</div>
          </div>
          <div className="rounded-lg p-2" style={btnStyle}>
            <div style={{ color: 'var(--color-text-tertiary)' }}>Empty folders</div>
            <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{scan.empty_dirs.count}</div>
          </div>
          <div className="rounded-lg p-2" style={btnStyle}>
            <div style={{ color: 'var(--color-text-tertiary)' }}>Dead shortcuts</div>
            <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{scan.dead_links.count}</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => void doClean({ temp: true }, 'temp files')} disabled={busy !== null} className={btn} style={btnStyle}>Clean temp files</button>
        <button onClick={() => void doClean({ dead_links: true }, 'dead shortcuts')} disabled={busy !== null} className={btn} style={btnStyle}>Remove dead links</button>
        <button onClick={() => void doClean({ empty_dirs: true }, 'empty folders')} disabled={busy !== null} className={btn} style={btnStyle}>Remove empty folders</button>
        <button onClick={() => void doClean({ temp: true, dead_links: true, empty_dirs: true }, 'everything')} disabled={busy !== null} className={btn}
          style={{ ...btnStyle, borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}>Clean all</button>
        <button onClick={() => void doDefrag()} disabled={busy !== null || defrag?.running} className={btn} style={btnStyle}>
          {defrag?.running ? 'Optimizing…' : 'Optimize disk'}
        </button>
      </div>

      {defrag?.running && <div className="text-xs mb-2" style={{ color: 'var(--color-accent)' }}>Disk optimization running…</div>}
      {defrag && !defrag.running && defrag.finished && (
        <div className="text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
          Last optimization finished{defrag.returncode === 0 ? ' successfully' : ` (code ${defrag.returncode})`}.
        </div>
      )}
      {msg && <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{msg}</div>}
      <div className="text-[11px] mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
        Cleaning only touches temp files, dead shortcuts and empty folders inside your profile — never your documents or downloads.
        Say "Jarvis scan my PC" or "Jarvis clean my PC" to run it by voice.
      </div>
    </div>
  );
}

function FilesCard() {
  const [data, setData] = useState<FileBrowseResult | null>(null);
  const [pathInput, setPathInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async (p?: string) => {
    setBusy(true); setMsg('');
    try {
      const d = await browseFiles(p);
      setData(d);
      setPathInput(d.path);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Browse failed');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (path: string, action: 'open' | 'reveal' | 'delete') => {
    setMsg('');
    try {
      await fileAction(path, action);
      if (action === 'delete') void load(data?.path);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Action failed');
    }
  };

  const rowBtn = 'text-[11px] px-1.5 py-0.5 rounded cursor-pointer';
  const rowBtnStyle = { color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' } as const;

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <FolderOpen size={16} style={{ color: 'var(--color-accent)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>File Explorer</h3>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => data?.parent && void load(data.parent)} disabled={!data?.parent || busy}
          className="text-xs px-2 py-1 rounded cursor-pointer disabled:opacity-40"
          style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>Up</button>
        <input
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load(pathInput)}
          placeholder="C:\ path…"
          className="flex-1 text-xs px-2 py-1 rounded outline-none"
          style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
        />
        <button onClick={() => void load(pathInput)} disabled={busy}
          className="text-xs px-2 py-1 rounded cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>Go</button>
      </div>
      {msg && <div className="text-xs mb-2" style={{ color: 'var(--color-danger, #ef4444)' }}>{msg}</div>}
      <div className="max-h-64 overflow-y-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
        {!data && <div className="text-xs p-3" style={{ color: 'var(--color-text-tertiary)' }}>Loading…</div>}
        {data && (
          <table className="w-full text-xs">
            <tbody>
              {data.dirs.map((d) => (
                <tr key={d.path} className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                  onClick={() => void load(d.path)}>
                  <td className="px-2 py-1" style={{ color: 'var(--color-accent)' }}>📁 {d.name}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <button className={rowBtn} style={rowBtnStyle} onClick={(e) => { e.stopPropagation(); void act(d.path, 'open'); }}>Open</button>
                    <button className={rowBtn} style={rowBtnStyle} onClick={(e) => { e.stopPropagation(); void act(d.path, 'reveal'); }}>Reveal</button>
                  </td>
                </tr>
              ))}
              {data.files.map((f) => (
                <tr key={f.path}>
                  <td className="px-2 py-1" style={{ color: 'var(--color-text)' }}>📄 {f.name}
                    <span className="ml-2" style={{ color: 'var(--color-text-tertiary)' }}>{(f.size / 1e6).toFixed(1)} MB</span>
                  </td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <button className={rowBtn} style={rowBtnStyle} onClick={() => void act(f.path, 'open')}>Open</button>
                    <button className={rowBtn} style={rowBtnStyle} onClick={() => void act(f.path, 'reveal')}>Reveal</button>
                    <button className={rowBtn} style={{ ...rowBtnStyle, color: 'var(--color-danger, #ef4444)' }}
                      onClick={() => { if (window.confirm(`Delete ${f.name}?`)) void act(f.path, 'delete'); }}>Delete</button>
                  </td>
                </tr>
              ))}
              {data.dirs.length === 0 && data.files.length === 0 && (
                <tr><td className="px-2 py-3 text-center" style={{ color: 'var(--color-text-tertiary)' }}>Empty folder</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <div className="text-[11px] mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
        Browse any folder on this PC. Open launches the file/folder, Reveal shows it in Explorer, Delete removes files (folders only if empty).
      </div>
    </div>
  );
}

type ToolboxTool = 'info' | 'drives' | 'processes' | 'startup' | 'registry' | 'duplicates' | 'ports' | 'shred' | 'power';

function ToolboxCard() {
  const [tool, setTool] = useState<ToolboxTool | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  const [drives, setDrives] = useState<{ drive: string; total: number; used: number; free: number; free_gb: number }[]>([]);
  const [procs, setProcs] = useState<PcProcess[]>([]);
  const [startup, setStartup] = useState<StartupItem[]>([]);
  const [orphans, setOrphans] = useState<{ name: string; location: string; key: string }[]>([]);
  const [dupPath, setDupPath] = useState('C:\\Users');
  const [dups, setDups] = useState<{ groups: { size: number; files: string[] }[]; group_count: number; wasted_bytes: number } | null>(null);
  const [ports, setPorts] = useState<{ port: number; addr: string; pid: number | null; process: string }[]>([]);
  const [shredPath, setShredPath] = useState('');

  const TOOLS: { id: ToolboxTool; label: string }[] = [
    { id: 'info', label: 'System Info' },
    { id: 'drives', label: 'Drives' },
    { id: 'processes', label: 'Processes' },
    { id: 'startup', label: 'Startup Manager' },
    { id: 'registry', label: 'Registry Orphans' },
    { id: 'duplicates', label: 'Duplicate Finder' },
    { id: 'ports', label: 'Open Ports' },
    { id: 'shred', label: 'File Shredder' },
    { id: 'power', label: 'Power' },
  ];

  const gb = (b: number) => `${(b / 1e9).toFixed(1)} GB`;
  const mb = (b: number) => `${(b / 1e6).toFixed(1)} MB`;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg('');
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const loadTool = (t: ToolboxTool) => {
    setTool(t); setMsg('');
    if (t === 'info') void run(async () => setInfo(await fetchPcInfo()));
    if (t === 'drives') void run(async () => setDrives((await fetchPcDrives()).drives));
    if (t === 'processes') void run(async () => setProcs((await fetchPcProcesses()).processes));
    if (t === 'startup') void run(async () => setStartup((await fetchStartupItems()).items));
    if (t === 'registry') void run(async () => setOrphans((await fetchRegistryOrphans()).orphans));
    if (t === 'ports') void run(async () => setPorts((await fetchListeningPorts()).ports));
  };

  const smallBtn = 'text-[11px] px-2 py-1 rounded cursor-pointer disabled:opacity-50';
  const smallBtnStyle = { background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' } as const;

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Wrench size={16} style={{ color: 'var(--color-accent)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Jarvis Toolbox</h3>
        <span className="flex-1" />
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => loadTool(t.id)}
            className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer"
            style={{
              background: tool === t.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-secondary)',
              color: tool === t.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              border: `1px solid ${tool === t.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && <div className="text-xs mb-2" style={{ color: 'var(--color-danger, #ef4444)' }}>{msg}</div>}
      {busy && <div className="text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Working…</div>}

      {tool === 'info' && info && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {Object.entries(info).map(([k, v]) => (
            <div key={k} className="rounded-lg p-2" style={smallBtnStyle}>
              <div style={{ color: 'var(--color-text-tertiary)' }}>{k.replace(/_/g, ' ')}</div>
              <div className="font-semibold break-all" style={{ color: 'var(--color-text)' }}>
                {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tool === 'drives' && (
        <div className="space-y-1 text-xs">
          {drives.map((d) => (
            <div key={d.drive} className="flex items-center gap-3">
              <span className="w-10 font-semibold" style={{ color: 'var(--color-text)' }}>{d.drive}</span>
              <div className="flex-1 h-2 rounded" style={{ background: 'var(--color-border)' }}>
                <div className="h-2 rounded" style={{ width: `${Math.min(100, (d.used / d.total) * 100)}%`, background: 'var(--color-accent)' }} />
              </div>
              <span style={{ color: 'var(--color-text-tertiary)' }}>{gb(d.free)} free of {gb(d.total)}</span>
            </div>
          ))}
        </div>
      )}

      {tool === 'processes' && (
        <div className="max-h-56 overflow-y-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-xs">
            <thead><tr style={{ color: 'var(--color-text-tertiary)' }}>
              <th className="text-left px-2 py-1">PID</th><th className="text-left px-2 py-1">Name</th>
              <th className="text-right px-2 py-1">Memory</th><th className="px-2 py-1"></th>
            </tr></thead>
            <tbody>
              {procs.map((p) => (
                <tr key={p.pid} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td className="px-2 py-1" style={{ color: 'var(--color-text-tertiary)' }}>{p.pid}</td>
                  <td className="px-2 py-1" style={{ color: 'var(--color-text)' }}>{p.name}</td>
                  <td className="px-2 py-1 text-right" style={{ color: 'var(--color-text)' }}>{p.mem_mb} MB</td>
                  <td className="px-2 py-1 text-right">
                    <button className={smallBtn} style={{ ...smallBtnStyle, color: 'var(--color-danger, #ef4444)' }}
                      onClick={() => { if (window.confirm(`Kill ${p.name} (${p.pid})?`)) void run(async () => { await killPcProcess(p.pid); setProcs((await fetchPcProcesses()).processes); }); }}>
                      Kill
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tool === 'startup' && (
        <div className="max-h-56 overflow-y-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-xs">
            <tbody>
              {startup.map((s) => (
                <tr key={`${s.hive}|${s.name}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td className="px-2 py-1" style={{ color: 'var(--color-text)' }}>{s.name}
                    <div className="truncate max-w-md" style={{ color: 'var(--color-text-tertiary)' }}>{s.command}</div>
                  </td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <span className="mr-2 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{s.hive}</span>
                    <button className={smallBtn} style={smallBtnStyle}
                      onClick={() => void run(async () => { await toggleStartupItem(s); setStartup((await fetchStartupItems()).items); })}>
                      {s.enabled === 'true' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tool === 'registry' && (
        <div className="text-xs">
          <div className="mb-2" style={{ color: 'var(--color-text-secondary)' }}>{orphans.length} orphaned uninstall entries found.</div>
          <div className="max-h-48 overflow-y-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
            {orphans.map((o) => (
              <div key={o.key} className="px-2 py-1" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                {o.name} <span style={{ color: 'var(--color-text-tertiary)' }}>— {o.location}</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
            Review-only — removing registry entries is done via an uninstaller (Cleaner pill), not here.
          </div>
        </div>
      )}

      {tool === 'duplicates' && (
        <div className="text-xs space-y-2">
          <div className="flex gap-2">
            <input value={dupPath} onChange={(e) => setDupPath(e.target.value)}
              className="flex-1 px-2 py-1 rounded outline-none" style={smallBtnStyle} placeholder="Folder to scan…" />
            <button className={smallBtn} style={smallBtnStyle} disabled={busy}
              onClick={() => void run(async () => setDups(await findDuplicates(dupPath)))}>Scan</button>
          </div>
          {dups && (
            <div>
              <div className="mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                {dups.group_count} duplicate groups — up to {gb(dups.wasted_bytes)} reclaimable.
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
                {dups.groups.map((g, i) => (
                  <div key={i} className="px-2 py-1" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <span style={{ color: 'var(--color-accent)' }}>{mb(g.size)}</span>
                    {g.files.map((f) => (
                      <div key={f} className="truncate" style={{ color: 'var(--color-text-tertiary)' }}>{f}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tool === 'ports' && (
        <div className="max-h-56 overflow-y-auto rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-xs">
            <tbody>
              {ports.map((p) => (
                <tr key={`${p.port}-${p.pid}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td className="px-2 py-1" style={{ color: 'var(--color-text)' }}>{p.process}</td>
                  <td className="px-2 py-1" style={{ color: 'var(--color-text-tertiary)' }}>{p.addr}:{p.port} · PID {p.pid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tool === 'shred' && (
        <div className="text-xs space-y-2">
          <div className="flex gap-2">
            <input value={shredPath} onChange={(e) => setShredPath(e.target.value)}
              className="flex-1 px-2 py-1 rounded outline-none" style={smallBtnStyle} placeholder="Full path to file…" />
            <button className={smallBtn} style={{ ...smallBtnStyle, color: 'var(--color-danger, #ef4444)' }} disabled={busy || !shredPath}
              onClick={() => {
                if (window.confirm(`Permanently shred ${shredPath}? This cannot be undone.`)) {
                  void run(async () => { await shredFile(shredPath); setMsg('File shredded.'); setShredPath(''); });
                }
              }}>Shred</button>
          </div>
          <div style={{ color: 'var(--color-text-tertiary)' }}>Overwrites the file 3× before deleting — for sensitive files only.</div>
        </div>
      )}

      {tool === 'power' && (
        <div className="flex flex-wrap gap-2 text-xs">
          <button className={smallBtn} style={smallBtnStyle} onClick={() => void run(() => pcPower('lock').then(() => setMsg('Locked.')))}>Lock</button>
          <button className={smallBtn} style={smallBtnStyle} onClick={() => void run(() => pcPower('sleep').then(() => setMsg('Sleeping…')))}>Sleep</button>
          <button className={smallBtn} style={smallBtnStyle}
            onClick={() => void run(() => pcPower('cancel-shutdown').then(() => setMsg('Shutdown cancelled.')))}>Cancel shutdown</button>
          <button className={smallBtn} style={{ ...smallBtnStyle, color: 'var(--color-danger, #ef4444)' }}
            onClick={() => { if (window.confirm('Restart this PC in 60 seconds?')) void run(() => pcPower('restart', true).then(() => setMsg('Restart scheduled.'))); }}>Restart</button>
          <button className={smallBtn} style={{ ...smallBtnStyle, color: 'var(--color-danger, #ef4444)' }}
            onClick={() => { if (window.confirm('Shut down this PC in 60 seconds?')) void run(() => pcPower('shutdown', true).then(() => setMsg('Shutdown scheduled.'))); }}>Shut down</button>
        </div>
      )}
    </div>
  );
}

function WindowsLaunchCard() {
  const [groups, setGroups] = useState<Record<string, Record<string, string>>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchLaunchableTargets().then((r) => setGroups(r.groups)).catch(() => {});
  }, []);

  const launch = async (label: string) => {
    setMsg('');
    try {
      await launchSystemApp(label);
      toast.success(`${label} launched.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Launch failed');
      toast.error(`Could not launch ${label}`);
    }
  };

  const entries = Object.entries(groups);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Windows control</h3>
      <div className="text-[11px] mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
        Control Panel applets, Win+X menu items, and system tools — everything the right-click Windows button offers, launchable from here or by voice.
      </div>
      <div className="space-y-3">
        {entries.map(([group, items]) => (
          <div key={group}>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>{group}</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(items).map((label) => (
                <button key={label} onClick={() => void launch(label)} title={items[label]}
                  className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer"
                  style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {msg && <div className="text-xs mt-2" style={{ color: 'var(--color-danger, #ef4444)' }}>{msg}</div>}
    </div>
  );
}

function ToolboxPanel() {
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  const apps = [
    { name: 'File Explorer', app: 'explorer', desc: 'Windows file manager' },
    { name: 'Notepad', app: 'notepad', desc: 'Plain-text editor' },
    { name: 'Calculator', app: 'calculator', desc: 'Windows calculator' },
    { name: 'Paint', app: 'paint', desc: 'Image editor' },
    { name: 'Command Prompt', app: 'command prompt', desc: 'cmd.exe' },
    { name: 'PowerShell', app: 'powershell', desc: 'PowerShell console' },
    { name: 'Task Manager', app: 'task manager', desc: 'Processes & performance' },
    { name: 'Windows Settings', app: 'settings', desc: 'System settings app' },
  ];
  const [msg, setMsg] = useState('');
  const launch = async (app: string, name: string) => {
    setMsg('');
    try {
      await launchSystemApp(app);
      toast.success(`${name} launched.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Launch failed');
      toast.error(`Could not launch ${name}`);
    }
  };
  return (
    <div className="space-y-4 px-4 pb-4">
      <PcCareCard />
      <ToolboxCard />
      <FilesCard />
      <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Windows apps</h3>
        <div className="flex flex-wrap gap-2">
          {apps.map((a) => (
            <button key={a.app} onClick={() => void launch(a.app, a.name)} title={a.desc}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm"
              style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
              {a.name}
            </button>
          ))}
        </div>
        {msg && <div className="text-xs mt-2" style={{ color: 'var(--color-danger, #ef4444)' }}>{msg}</div>}
        <div className="text-[11px] mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
          Or say it: "Jarvis open notepad", "Jarvis open calculator", "Jarvis open file explorer".
        </div>
      </div>
      <WindowsLaunchCard />
      <GroupedAppsPanel groups={toolsGroups} note="The download arrow fetches the real installer — files land in ~/.openjarvis/installers first." />
      <GroupedAppsPanel groups={cleanerGroups} note="Cleaners and uninstallers — the download arrow grabs the real installer where one exists." />
      <GroupedAppsPanel groups={securityGroups} note="Antivirus needs a real install — the download arrow fetches it; Malwarebytes free is a good second-opinion scanner." />
      <GroupedAppsPanel groups={privacyGroups} note="VPNs and password managers require your own accounts — use official sites only for sign-up." />
      {developerModeEnabled && <DeveloperPanel />}
      <ActivationCard />
      <GroupedAppsPanel groups={osGroups} note="Official Microsoft downloads first; community builds are unofficial — the download arrow grabs real installers where available." />
    </div>
  );
}

function GroupedAppsPanel({ groups, note }: { groups: HubGroup[]; note?: string }) {
  return (
    <div className="space-y-4 px-4 pb-4">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
            {group.label}
          </h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label={group.label}>
            {group.apps.map((app) => {
              const Icon = app.icon;
              return (
                <span key={app.id} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void openHubApp(app.url, app.name)}
                    title={app.description}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors"
                    style={{
                      color: app.color,
                      background: `${app.color}18`,
                      border: `1px solid ${app.color}55`,
                    }}
                  >
                    <Icon size={14} />
                    {app.name}
                    <ExternalLink size={11} />
                  </button>
                  <InstallerButton url={app.url} name={app.name} color={app.color} />
                </span>
              );
            })}
          </div>
        </div>
      ))}
      {note && (
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{note}</p>
      )}
    </div>
  );
}

function CryptoPanel() {
  return (
    <GroupedAppsPanel
      groups={cryptoGroups as HubGroup[]}
      note="These open in your browser — exchanges require account signup and KYC. Not financial advice."
    />
  );
}

function ConnectedServicesPanel({ apps, category }: { apps: HubService[]; category: 'social' | 'stores' | 'media' | 'record' | 'remote' | 'ai' | 'browsers' }) {
  const navigate = useNavigate();
  const enabledApps = useAppStore((state) => state.settings.hubEnabledApps);
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  const visibleApps = category === 'ai'
    ? apps
    : apps.filter((app) => developerModeEnabled || enabledApps.includes(app.id));
  const [selectedId, setSelectedId] = useState<string | null>(visibleApps[0]?.id ?? null);
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const urlKey = visibleApps.map((app) => app.url).join('|');
  useEffect(() => {
    if (!urlKey) return;
    fetchNativeApps(urlKey.split('|')).then(setInstalled).catch(() => {});
  }, [urlKey]);
  const [opening, setOpening] = useState('');
  const selectedApp = visibleApps.find((app) => app.id === selectedId) ?? visibleApps[0];

  const openLink = async (app: HubService) => {
    setSelectedId(app.id);
    setOpening(app.id);
    try {
      await openHubApp(app.url, app.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setOpening('');
    }
  };

  return (
    <div className="space-y-3 px-4 pb-4">
      {visibleApps.length === 0 ? (
        <p className="py-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Set up apps in Settings → {category === 'social' ? 'Social' : category === 'stores' ? 'Stores' : category === 'media' ? 'Media' : category === 'record' ? 'Record and live stream' : category === 'remote' ? 'Remote access and play' : category === 'browsers' ? 'Browsers' : 'API Keys'} to show them here.
          <button type="button" onClick={() => navigate('/settings')} className="ml-1 underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Open Settings</button>
        </p>
      ) : (
        <>
          {selectedApp && (
            <div
              className="flex min-h-24 flex-col justify-end rounded-lg bg-cover bg-center px-4 py-3"
              style={{
                backgroundImage: `${appArtwork(selectedApp.color)}, linear-gradient(115deg, ${selectedApp.color}88, var(--color-bg-secondary))`,
                border: '1px solid var(--color-border)',
              }}
              aria-live="polite"
            >
              <span className="text-lg font-semibold text-white">{selectedApp.name}</span>
              <span className="text-xs text-white/85">{selectedApp.description}</span>
              <span className="mt-0.5 text-[11px] text-white/75">
                {installed[selectedApp.url]
                  ? 'Desktop app found — opens the app.'
                  : 'Desktop app not found — opens the website.'}
              </span>
              {category === 'social' && (
                <span className="mt-1 text-[11px] text-white/75">
                  Feed previews are not available in OpenJarvis yet. Open the service to see its feed; OpenJarvis does not access private content.
                </span>
              )}
              <span className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void openLink(selectedApp)}
                  disabled={opening !== ''}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs disabled:opacity-50"
                  style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                >
                  {opening === selectedApp.id ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                  Open {selectedApp.name}
                </button>
                <InstallerButton url={selectedApp.url} name={selectedApp.name} color={selectedApp.color} />
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Available ${category} apps`}>
            {visibleApps.map((app) => {
              const Icon = app.icon;
              return (
                <span key={app.id} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onMouseEnter={() => setSelectedId(app.id)}
                    onFocus={() => setSelectedId(app.id)}
                    onClick={() => void openLink(app)}
                    aria-pressed={selectedApp?.id === app.id}
                    title={installed[app.url] ? `Open ${app.name} app` : `Open ${app.name} website`}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      color: selectedApp?.id === app.id ? app.color : 'var(--color-text-secondary)',
                      background: selectedApp?.id === app.id ? `${app.color}18` : 'var(--color-bg-secondary)',
                      border: `1px solid ${selectedApp?.id === app.id ? app.color : 'var(--color-border)'}`,
                    }}
                  >
                    {opening === app.id ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
                    {app.name}
                    <ExternalLink size={11} />
                  </button>
                  <InstallerButton url={app.url} name={app.name} color={app.color} />
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SocialPanel() {
  return <ConnectedServicesPanel apps={socialApps} category="social" />;
}

function BrowsersPanel() {
  return <ConnectedServicesPanel apps={browserApps} category="browsers" />;
}

function StoresPanel() {
  return <ConnectedServicesPanel apps={storeApps} category="stores" />;
}

function MediaPanel() {
  const navigate = useNavigate();
  const enabledApps = useAppStore((state) => state.settings.hubEnabledApps);
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  const showGuide = developerModeEnabled || enabledApps.includes('tv-guide');
  const [sources, setSources] = useState({ playlist: '', guide: '' });
  const [youtubeQuery, setYoutubeQuery] = useState('');
  const [channels, setChannels] = useState<M3UChannel[]>([]);
  const [programs, setPrograms] = useState<Map<string, GuideProgram[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [playerTarget, setPlayerTarget] = useState<MediaPlayerTarget | null>(null);
  const [englishOnly, setEnglishOnly] = useState(true);
  const [error, setError] = useState('');
  const [guideError, setGuideError] = useState('');

  const visibleChannels = useMemo(
    () => englishOnly
      ? channels.filter((channel) => !channel.language || /^(en|eng|english)([-_].*)?$/i.test(channel.language))
      : channels,
    [channels, englishOnly],
  );

  const loadGuide = async () => {
    if (!sources.playlist.trim()) {
      setError('Enter an M3U or M3U8 playlist URL first.');
      return;
    }
    setLoading(true);
    setError('');
    setGuideError('');
    try {
      const playlistText = await fetchGuideDocument(sources.playlist.trim(), 'playlist');
      const parsedChannels = parseM3U(playlistText);
      if (parsedChannels.length === 0) {
        throw new Error('The playlist contains no supported channels. Check its URL and M3U format.');
      }
      setChannels(parsedChannels);
      setPrograms(new Map());
      if (sources.guide.trim()) {
        try {
          const guideText = await fetchGuideDocument(sources.guide.trim(), 'guide');
          const parsedPrograms = parseXMLTV(guideText);
          if (parsedPrograms.size === 0) {
            setGuideError('The XMLTV file contains no usable programme entries.');
          } else {
            setPrograms(parsedPrograms);
          }
        } catch (guideLoadError) {
          setGuideError(guideLoadError instanceof Error ? guideLoadError.message : String(guideLoadError));
        }
      }
    } catch (loadError) {
      setChannels([]);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  };

  const playChannel = (channel: M3UChannel) => {
    setError('');
    setPlayerTarget({ src: channel.url, title: channel.name });
  };

  const searchYoutube = async (event: FormEvent) => {
    event.preventDefault();
    const query = youtubeQuery.trim();
    if (!query) return;
    try {
      await openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    } catch (openError) {
      toast.error(openError instanceof Error ? openError.message : String(openError));
    }
  };

  return (
    <div className="space-y-4 px-4 pb-4">
      {(developerModeEnabled || enabledApps.includes('youtube')) && (
        <form onSubmit={(event) => void searchYoutube(event)} className="flex flex-wrap items-center gap-2">
          <Play size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <label className="sr-only" htmlFor="youtube-search">Search YouTube</label>
          <input
            id="youtube-search"
            value={youtubeQuery}
            onChange={(event) => setYoutubeQuery(event.target.value)}
            placeholder="Search YouTube"
            className="h-9 min-w-[12rem] flex-1 rounded-lg bg-transparent px-3 text-sm outline-none"
            style={{ color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
          />
          <button type="submit" className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
            <ArrowUpRight size={14} /> Open YouTube
          </button>
        </form>
      )}
      <ConnectedServicesPanel apps={mediaApps.filter((app) => app.id !== 'tv-guide')} category="media" />
      {showGuide ? <div className="space-y-3">
        <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>TV guide</h3>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Add an M3U/M3U8 playlist and optional XMLTV guide you are authorized to use. Streaming apps remain in their own services; only playlist channels and guide data can be combined here.
        </p>
        <div className="grid gap-2 xl:grid-cols-2">
          <label className="space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Playlist URL
            <input
              value={sources.playlist}
              onChange={(event) => setSources((current) => ({ ...current, playlist: event.target.value }))}
              placeholder="https://…/channels.m3u8"
              className="h-9 w-full rounded-lg bg-transparent px-3 text-sm outline-none"
              style={{ color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            />
          </label>
          <label className="space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            XMLTV guide URL (optional)
            <input
              value={sources.guide}
              onChange={(event) => setSources((current) => ({ ...current, guide: event.target.value }))}
              placeholder="https://…/guide.xml"
              className="h-9 w-full rounded-lg bg-transparent px-3 text-sm outline-none"
              style={{ color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void loadGuide()}
            disabled={loading}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-50"
            style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Load guide
          </button>
          <label className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={englishOnly} onChange={(event) => setEnglishOnly(event.target.checked)} />
            English channels
          </label>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Playlist and guide documents load through the local server — no CORS issues.</span>
        </div>
      </div> : (
        <p className="px-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Enable TV Guide in Settings → Media to load your own playlist and schedule.
          <button type="button" onClick={() => navigate('/settings')} className="ml-1 underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Open Settings</button>
        </p>
      )}
      {showGuide && error && <p role="alert" className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>}
      {showGuide && guideError && <p role="status" className="text-xs" style={{ color: 'var(--color-error)' }}>Playlist loaded, but the TV schedule could not load: {guideError}</p>}
      {showGuide && channels.length > 0 && (
        <div className="min-w-0">
          <p className="mb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {visibleChannels.length} channels{englishOnly ? ' · English metadata filter on' : ''}
          </p>
          <ul className="max-h-64 divide-y overflow-y-auto pr-1" style={{ borderColor: 'var(--color-border-subtle)' }}>
            {visibleChannels.map((channel) => {
              const entries = programs.get(channel.id) ?? [];
              const now = Date.now();
              const current = entries.find((program) => program.start <= now && program.stop > now);
              const next = entries.find((program) => program.start > now);
              return (
                <li key={`${channel.id}:${channel.url}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="min-w-[12rem] flex-1 truncate text-sm" style={{ color: 'var(--color-text)' }}>
                    {channel.name}
                    {current && <span className="ml-2 text-xs" style={{ color: 'var(--color-accent)' }}>Now: {current.title}</span>}
                    {!current && next && <span className="ml-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Next: {next.title}</span>}
                  </span>
                  {channel.group && <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{channel.group}</span>}
                  <button
                    type="button"
                    onClick={() => playChannel(channel)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                    style={{ color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
                  >
                    <Play size={12} />
                    Play
                  </button>
                </li>
              );
            })}
          </ul>
          {visibleChannels.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No channels match the English filter.</p>}
        </div>
      )}
      <MediaPlayerModal target={playerTarget} onClose={() => setPlayerTarget(null)} />
    </div>
  );
}

function LocalRecorder() {
  const settings = useAppStore((state) => state.settings);
  const [recording, setRecording] = useState(false);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true);
  const [includeMicrophone, setIncludeMicrophone] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recordingUrl, setRecordingUrl] = useState('');
  const [recordingName, setRecordingName] = useState('');
  const displayStreamRef = useRef<MediaStream | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const releaseCapture = useCallback(() => {
    for (const stream of [
      displayStreamRef.current,
      microphoneStreamRef.current,
      recorderStreamRef.current,
    ]) {
      stream?.getTracks().forEach((track) => track.stop());
    }
    if (previewRef.current) previewRef.current.srcObject = null;
    displayStreamRef.current = null;
    microphoneStreamRef.current = null;
    recorderStreamRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    releaseCapture();
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  }, [recordingUrl, releaseCapture]);

  const startRecording = async () => {
    setError('');
    setNotice('');
    setElapsedSeconds(0);
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser does not support local screen recording. Use an up-to-date browser or a dedicated recorder such as OBS Studio.');
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: includeSystemAudio,
      });
      displayStreamRef.current = displayStream;
      if (previewRef.current) {
        previewRef.current.srcObject = displayStream;
        void previewRef.current.play().catch(() => undefined);
      }

      const microphoneStream = includeMicrophone
        ? await navigator.mediaDevices.getUserMedia({ audio: true })
        : null;
      microphoneStreamRef.current = microphoneStream;

      const outputTracks = [...displayStream.getVideoTracks()];
      const audioInputs = [displayStream, ...(microphoneStream ? [microphoneStream] : [])]
        .filter((stream) => stream.getAudioTracks().length > 0);
      if (audioInputs.length > 0) {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        await audioContext.resume();
        const mix = audioContext.createMediaStreamDestination();
        for (const stream of audioInputs) {
          audioContext.createMediaStreamSource(
            new MediaStream(stream.getAudioTracks()),
          ).connect(mix);
        }
        outputTracks.push(...mix.stream.getAudioTracks());
      }
      const recorderStream = new MediaStream(outputTracks);
      recorderStreamRef.current = recorderStream;
      const mimeType = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(
        recorderStream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError('Recording stopped because the browser reported a media error.');
        releaseCapture();
        setRecording(false);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });
        if (blob.size > 0) {
          const previousUrl = recordingUrl;
          if (previousUrl) URL.revokeObjectURL(previousUrl);
          const url = URL.createObjectURL(blob);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          setRecordingName(`OpenJarvis-recording-${timestamp}.webm`);
          setRecordingUrl(url);
          const hasSystemAudio = displayStream.getAudioTracks().length > 0;
          if (includeSystemAudio && !hasSystemAudio) {
            setNotice('The selected screen or window did not provide system audio; the video was recorded without it.');
          } else {
            setNotice('Recording saved locally in memory. Download it to keep a copy.');
          }
        } else {
          setError('No video data was captured. Choose a screen or window and try again.');
        }
        chunksRef.current = [];
        releaseCapture();
        setRecording(false);
      };
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorder.state === 'recording') recorder.stop();
      }, { once: true });
      recorder.start(1000);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((current) => current + 1);
      }, 1000);
      setRecording(true);
      if (includeSystemAudio && displayStream.getAudioTracks().length === 0) {
        setNotice('The chosen source may not provide system audio. Recording will continue with any available microphone audio.');
      }
    } catch (captureError) {
      releaseCapture();
      const message = captureError instanceof Error ? captureError.message : String(captureError);
      setError(message.toLowerCase().includes('permission')
        ? 'Screen or microphone permission was denied. Allow capture in the browser prompt and try again.'
        : `Could not start recording: ${message}`);
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
  };

  const destinations = streamingDestinations.filter((app) =>
    settings.developerModeEnabled || settings.hubEnabledApps.includes(app.id),
  );
  const tools = streamingTools.filter((app) =>
    settings.developerModeEnabled || settings.hubEnabledApps.includes(app.id),
  );

  return (
    <div className="space-y-4 px-4 pb-4">
      <section className="space-y-3" aria-label="Local screen recording">
        <div>
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Record your screen or gameplay</h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Captures locally in your browser; no OpenJarvis backend, AI account, or internet connection is used. Recording is not uploaded or added to a remote library.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={includeSystemAudio} disabled={recording} onChange={(event) => setIncludeSystemAudio(event.target.checked)} />
            System audio (if supported)
          </label>
          <label className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={includeMicrophone} disabled={recording} onChange={(event) => setIncludeMicrophone(event.target.checked)} />
            Microphone
          </label>
          {!recording ? (
            <button type="button" onClick={() => void startRecording()} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
              <Disc size={15} /> Choose screen and record
            </button>
          ) : (
            <button type="button" onClick={stopRecording} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm" style={{ background: 'var(--color-error)', color: 'white' }}>
              <Square size={13} /> Stop · {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
            </button>
          )}
        </div>
        {recording && (
          <video ref={previewRef} autoPlay muted playsInline className="max-h-56 w-full rounded-lg bg-black object-contain" aria-label="Recording preview" />
        )}
        {error && <p role="alert" className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
        {notice && <p role="status" className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{notice}</p>}
        {recordingUrl && !recording && (
          <a href={recordingUrl} download={recordingName} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm underline underline-offset-2" style={{ color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}>
            <Download size={14} /> Download {recordingName}
          </a>
        )}
      </section>
      <section className="space-y-2" aria-label="Livestream destinations">
        <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Livestream platforms</h3>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Open the provider's own creator dashboard to sign in and stream. Jarvis does not record or download other people's streams.
        </p>
        {destinations.length > 0
          ? <ConnectedServicesPanel apps={destinations} category="record" />
          : <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Enable destinations in Settings → Record and live stream.</p>}
      </section>
      <section className="space-y-2" aria-label="Streaming and game tools">
        <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Streaming and game tools</h3>
        {tools.length > 0
          ? <ConnectedServicesPanel apps={tools} category="record" />
          : <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Enable tools in Settings → Record and live stream.</p>}
      </section>
      <p className="inline-flex items-start gap-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        <Mic size={13} className="mt-0.5 shrink-0" />
        System audio capture depends on browser and operating-system support. Use OBS or PRISM Live Studio for advanced scenes, encoding, and multistream setup.
      </p>
    </div>
  );
}

function RemotePanel() {
  const enabledApps = useAppStore((state) => state.settings.hubEnabledApps);
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  const apps = remoteApps.filter((app) =>
    developerModeEnabled || enabledApps.includes(app.id),
  );

  return (
    <div className="space-y-3 px-4 pb-4">
      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        OpenJarvis Desktop tries the installed app first when it supports direct launch, then opens the official page if the app is unavailable. These links do not connect devices for you; configure each service and only access devices you own or have permission to use.
      </p>
      {apps.length > 0
        ? <ConnectedServicesPanel apps={apps} category="remote" />
        : <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Enable services in Settings → Remote access and play.</p>}
    </div>
  );
}

function AIPlatformPanel() {
  const navigate = useNavigate();
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  const enabledApps = useAppStore((state) => state.settings.hubEnabledApps);
  const serverInfo = useAppStore((state) => state.serverInfo);
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getCloudKeyStatus()
      .then((status) => {
        if (active) setKeyStatus(status);
      })
      .catch((statusError: unknown) => {
        if (active) setError(statusError instanceof Error ? statusError.message : String(statusError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const apps: HubService[] = aiApps
    .filter((app) => developerModeEnabled || keyStatus[app.key])
    .map((app) => ({
      id: app.id,
      name: app.name,
      url: app.url,
      color: app.color,
      description: keyStatus[app.key] ? 'API key configured in OpenJarvis secure settings.' : 'Add an API key in Settings to use this provider.',
      icon: BrainCircuit,
    }));
  const localModelConfigured = Boolean(serverInfo?.model);

  return (
    <div className="space-y-3 px-4 pb-4">
      {localModelConfigured && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
          Local AI · {serverInfo?.engine} · {serverInfo?.model}
        </div>
      )}
      {loading && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Checking configured AI providers…</p>}
      {error && <p role="alert" className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
      {!loading && apps.length === 0 && !localModelConfigured && (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          No AI platform is connected yet. Configure a provider in Settings → API Keys.
          <button type="button" onClick={() => navigate('/settings')} className="ml-1 underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Open Settings</button>
        </p>
      )}
      {(apps.length > 0 || localModelConfigured) && (
        <section aria-label="Cloud AI services">
          <h3 className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>Cloud AI services</h3>
          {apps.length > 0
            ? <ConnectedServicesPanel apps={apps} category="ai" />
            : <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No cloud provider API keys are configured. Local inference remains available.</p>}
        </section>
      )}
      <section aria-label="AI tools">
        <h3 className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>AI tools</h3>
        {aiTools.filter((app) => developerModeEnabled || enabledApps.includes(app.id)).length > 0 ? (
          <ConnectedServicesPanel
            apps={aiTools.filter((app) => developerModeEnabled || enabledApps.includes(app.id))}
            category="ai"
          />
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Enable Base44 or Microsoft Copilot in Settings → AI and cloud tools to show them here.
            <button type="button" onClick={() => navigate('/settings')} className="ml-1 underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Open Settings</button>
          </p>
        )}
      </section>
      {developerModeEnabled && (
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Showing supported providers; a provider is usable only after its API key or local endpoint is configured.
        </p>
      )}
    </div>
  );
}

function DeveloperPanel() {
  const navigate = useNavigate();
  const settings = useAppStore((state) => state.settings);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  const openEditor = async () => {
    setOpening(true);
    setError('');
    try {
      await openVSCode(settings.vscodeExecutablePath, settings.developerWorkspacePath);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="space-y-3 px-4 pb-4">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Open the configured project in your existing VS Code install. Coding requests can continue in the regular Chat; available tools depend on your configured model and backend.
      </p>
      <button
        type="button"
        onClick={() => void openEditor()}
        disabled={opening}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-50"
        style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
      >
        {opening ? <Loader2 size={14} className="animate-spin" /> : <Code2 size={14} />}
        {opening ? 'Opening VS Code…' : 'Open VS Code'}
      </button>
      <button type="button" onClick={() => navigate('/settings')} className="ml-3 text-xs underline underline-offset-2" style={{ color: 'var(--color-text-secondary)' }}>
        Developer settings
      </button>
      {error && <p role="alert" className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
    </div>
  );
}

const MUSIC_APP_COLORS: Record<string, string> = {
  'youtube-music': '#ff0000',
  spotify: '#1db954',
  'apple-music': '#fa243c',
  'amazon-music': '#00a8e1',
  tidal: '#000000',
  soundcloud: '#ff5500',
  audible: '#f8991c',
  deezer: '#a238ff',
  pandora: '#005483',
  bandcamp: '#629aa9',
  qobuz: '#5a4fcf',
  mixcloud: '#5b5bd6',
  iheartradio: '#ed1c24',
  'music-iheartradio': '#ed1c24',
};

function musicServiceApps(apps: Array<{ id: string; label: string; url: string }>): HubService[] {
  return apps.map((app) => ({
    id: app.id,
    name: app.label,
    url: app.url,
    color: MUSIC_APP_COLORS[app.id] ?? '#22d3ee',
    description: `Open ${app.label} inside Jarvis.`,
    icon: Music2,
  }));
}

function MusicPanel() {
  const openPlayer = useMusicStore((s) => s.openPlayer);
  const playlists = useMusicStore((s) => s.playlists);
  const playTracks = useMusicStore((s) => s.playTracks);
  const addLocalFiles = useMusicStore((s) => s.addLocalFiles);
  const fileRef = useRef<HTMLInputElement>(null);
  const enabledApps = useEnabledMusicApps();
  const developerMode = useAppStore((s) => s.settings.developerModeEnabled);
  const apps = developerMode ? MUSIC_APPS : enabledApps;
  const onFiles = (list: FileList | null) => {
    const tracks = addLocalFiles(Array.from(list ?? []));
    if (tracks.length === 0) {
      toast.error('No audio files found in that selection.');
      return;
    }
    playTracks(tracks);
    openPlayer();
  };
  return (
    <div className="space-y-3 px-4 pb-4">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Play local files and playlists in the Jarvis player, or open a music app. Say &ldquo;Jarvis open Spotify&rdquo;, &ldquo;pause&rdquo;, &ldquo;next&rdquo; or &ldquo;Jarvis return&rdquo;.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openPlayer}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm"
          style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
        >
          <Music2 size={14} /> Open music player
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm"
          style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
        >
          Add local media
        </button>
        <button
          type="button"
          onClick={openPlayer}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm"
          style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
        >
          Add playlist
        </button>
        <input
          ref={fileRef} type="file" hidden multiple accept="audio/*"
          onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
        />
      </div>
      {playlists.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {playlists.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { playTracks(p.tracks); openPlayer(); }}
              className="rounded-lg px-2.5 py-1"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              ▶ {p.name} ({p.tracks.length})
            </button>
          ))}
        </div>
      )}
      <div>
        {apps.length ? (
          <GroupedAppsPanel
            groups={[{ label: 'Music apps', apps: musicServiceApps(apps) }]}
            note="Tiles open inside Jarvis — installer first when one exists, otherwise the site loads in the built-in browser."
          />
        ) : (
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No music apps activated yet. Turn on Developer Mode, then activate apps in Settings → Music. Activated apps stay here afterwards.</p>
        )}
      </div>
    </div>
  );
}

interface AppsGroup {
  label: string;
  apps: HubService[];
}

const appsGroups: AppsGroup[] = [
  {
    label: 'Streaming devices',
    apps: [
      { id: 'roku', name: 'Roku', url: 'https://my.roku.com/', color: '#6a0dad', description: 'Roku account — add channels, manage your streaming devices.', icon: Tv },
      { id: 'fire-tv', name: 'Fire TV', url: 'https://www.amazon.com/fire-tv', color: '#00a8e1', description: 'Amazon Fire TV Stick / Cube — shop and setup.', icon: Tv },
      { id: 'apple-tv', name: 'Apple TV', url: 'https://www.apple.com/tv-app/', color: '#1d1d1f', description: 'Apple TV app and Apple TV 4K setup.', icon: Tv },
      { id: 'chromecast', name: 'Chromecast / Google TV', url: 'https://store.google.com/us/category/streaming_devices', color: '#4285f4', description: 'Google TV streamers and Chromecast devices.', icon: Tv },
      { id: 'nvidia-shield', name: 'NVIDIA Shield', url: 'https://www.nvidia.com/en-us/geforce-now/shield/', color: '#76b900', description: 'Shield TV Pro — the most powerful Android TV streamer.', icon: Tv },
      { id: 'onn', name: 'ONN Google TV', url: 'https://www.walmart.com/browse/electronics/onn-google-tv/3944_124576365', color: '#ffc220', description: 'Walmart ONN 4K Google TV boxes — budget streamer.', icon: Tv },
      { id: 'tivo-stream', name: 'TiVo Stream', url: 'https://www.tivo.com/products/tivo-stream', color: '#00b3e6', description: 'TiVo Stream 4K Android TV streamer.', icon: Tv },
    ],
  },
  {
    label: 'Media center apps',
    apps: [
      { id: 'kodi', name: 'Kodi', url: 'https://kodi.tv/', color: '#3d7dc4', description: 'Free open-source media center for any device.', icon: Tv },
      { id: 'jellyfin', name: 'Jellyfin', url: 'https://jellyfin.org/', color: '#00a4dc', description: 'Free software media system — your own Netflix.', icon: Tv },
      { id: 'emby', name: 'Emby', url: 'https://emby.media/', color: '#52b54b', description: 'Media server with apps for every platform.', icon: Tv },
      { id: 'stremio', name: 'Stremio', url: 'https://www.stremio.com/', color: '#3a7bd5', description: 'Streaming center — movies, series, live TV in one app.', icon: Tv },
      { id: 'plex-app', name: 'Plex', url: 'https://www.plex.tv/download/', color: '#e5a00d', description: 'Download the Plex desktop/server apps.', icon: Tv },
      { id: 'vlc-app', name: 'VLC', url: 'https://www.videolan.org/vlc/download-windows/', color: '#ff8800', description: 'Download VLC for Windows directly.', icon: Play },
    ],
  },
  {
    label: 'Popular apps',
    apps: [
      { id: 'netflix-app', name: 'Netflix', url: 'https://www.netflix.com/download', color: '#e50914', description: 'Download the Netflix app for Windows.', icon: Tv },
      { id: 'disney-app', name: 'Disney+', url: 'https://www.disneyplus.com/', color: '#113ccf', description: 'Movies and series from Disney, Marvel, Star Wars.', icon: Tv },
      { id: 'hbomax-app', name: 'Max', url: 'https://www.max.com/download', color: '#5b2bdb', description: 'HBO Max movies and series.', icon: Tv },
      { id: 'spotify', name: 'Spotify', url: 'https://www.spotify.com/download/', color: '#1db954', description: 'Music streaming — download the desktop app.', icon: Music2 },
      { id: 'vlc-media', name: 'VLC Media Player', url: 'https://www.videolan.org/', color: '#ff8800', description: 'Plays almost any video/audio file.', icon: Play },
      { id: 'audacity', name: 'Audacity', url: 'https://www.audacityteam.org/download/', color: '#0000cc', description: 'Free audio editor and recorder.', icon: Music2 },
    ],
  },
];

function AppsPanel() {
  return (
    <div className="space-y-4 px-4 pb-4">
      {appsGroups.map((group) => (
        <div key={group.label}>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
            {group.label}
          </h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label={group.label}>
            {group.apps.map((app) => {
              const Icon = app.icon;
              return (
                <span key={app.id} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void openHubApp(app.url, app.name)}
                    title={app.description}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors"
                    style={{
                      color: app.color,
                      background: `${app.color}18`,
                      border: `1px solid ${app.color}55`,
                    }}
                  >
                    <Icon size={14} />
                    {app.name}
                    <ExternalLink size={11} />
                  </button>
                  <InstallerButton url={app.url} name={app.name} color={app.color} />
                </span>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        The download arrow grabs the real installer from the site and runs it — files land in
        ~/.openjarvis/installers first. Device tiles open setup/account pages (streamers don&apos;t install on this PC).
      </p>
    </div>
  );
}

const CUSTOM_SECTION_ICONS: Record<string, typeof Tv> = {
  star: Star,
  heart: Heart,
  gamepad: Gamepad2,
  music: Music2,
  tv: Tv,
  globe: Globe,
  wrench: Wrench,
  shield: ShieldCheck,
  home: Home,
  briefcase: Briefcase,
  plane: Plane,
  book: BookOpen,
  cart: ShoppingCart,
  bot: BrainCircuit,
  zap: Zap,
};

function customSectionIcon(name: string): typeof Tv {
  return CUSTOM_SECTION_ICONS[name] ?? Star;
}

/** Tiles for user-added apps — same look as built-in hub tiles. */
function CustomAppTiles({ apps }: { apps: HubCustomApp[] }) {
  return (
    <>
      {apps.map((app) => {
        const color = app.color || '#22d3ee';
        const Icon = LayoutGrid;
        return (
          <span key={app.id} className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => void openHubApp(app.url, app.name)}
              title={app.description || app.name}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors"
              style={{
                color,
                background: `${color}18`,
                border: `1px solid ${color}55`,
              }}
            >
              <Icon size={14} />
              {app.name}
              <ExternalLink size={11} />
            </button>
            <InstallerButton url={app.url} name={app.name} color={color} />
          </span>
        );
      })}
    </>
  );
}

/** "My apps" block appended to a built-in pill when the user added tiles to it. */
function CustomAppsBlock({ section }: { section: string }) {
  const { apps } = useHubCustom();
  const mine = apps.filter((app) => app.section === section);
  if (mine.length === 0) return null;
  return (
    <div className="px-4 pb-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
        My apps
      </h3>
      <div className="flex flex-wrap gap-2" role="group" aria-label="My apps">
        <CustomAppTiles apps={mine} />
      </div>
    </div>
  );
}

/** Panel body for a user-created pill. */
function CustomPillPanel({ sectionId, label }: { sectionId: string; label: string }) {
  const navigate = useNavigate();
  const { apps } = useHubCustom();
  const mine = apps.filter((app) => app.section === sectionId);
  return (
    <div className="px-4 pb-4">
      {mine.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
          <CustomAppTiles apps={mine} />
        </div>
      ) : (
        <p className="py-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          No apps in this pill yet — add some in{' '}
          <button type="button" onClick={() => navigate('/settings')} className="underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>
            Settings → Custom hub pills &amp; apps
          </button>
          , or ask Jarvis to add one.
        </p>
      )}
    </div>
  );
}

export interface HubVoiceEntry {
  name: string;
  url: string;
  section: string;
}

/** Every launchable app tile across all hub sections — used by voice commands. */
export function allHubVoiceEntries(): HubVoiceEntry[] {
  const grouped = (
    groups: Array<{ apps: HubService[] }>,
    section: string,
  ): HubVoiceEntry[] => groups.flatMap((g) => g.apps.map((a) => ({ name: a.name, url: a.url, section })));
  const flat = (apps: HubService[], section: string): HubVoiceEntry[] =>
    apps.map((a) => ({ name: a.name, url: a.url, section }));
  const entries: HubVoiceEntry[] = [
    ...flat(kidsApps, 'kids'),
    ...grouped(cryptoGroups, 'crypto'),
    ...grouped(appsGroups, 'apps'),
    ...grouped(modsGroups, 'mods'),
    ...grouped(createGroups, 'create'),
    ...grouped(smartHomeGroups, 'smart_home'),
    ...grouped(productivityGroups, 'productivity'),
    ...grouped(financeGroups, 'finance'),
    ...grouped(newsGroups, 'news'),
    ...grouped(healthGroups, 'health'),
    ...grouped(travelGroups, 'travel'),
    ...grouped(educationGroups, 'education'),
    ...grouped(shoppingGroups, 'shopping'),
    ...grouped(toolsGroups, 'tools'),
    ...grouped(privacyGroups, 'privacy'),
    ...grouped(cleanerGroups, 'cleaner'),
    ...grouped(securityGroups, 'security'),
    ...grouped(osGroups, 'os'),
    ...flat(musicServiceApps(MUSIC_APPS), 'music'),
    ...flat(browserApps, 'browsers'),
    ...flat(socialApps, 'social'),
    ...flat(mediaApps, 'media'),
    ...flat(streamingDestinations, 'record'),
    ...flat(streamingTools, 'record'),
    ...flat(remoteApps, 'remote'),
    ...flat(storeApps, 'stores'),
    ...aiTools.map((a) => ({ name: a.name, url: a.url, section: 'ai' })),
    ...aiApps.map((a) => ({ name: a.name, url: a.url, section: 'ai' })),
  ];
  // Dedupe by name+url, preferring the first (most specific) section.
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.name.toLowerCase()}|${e.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function MainPageHub() {
  const navigate = useNavigate();
  const [section, setSection] = useState<HubSection | null>(null);
  const [visitedSections, setVisitedSections] = useState<Set<HubSection>>(() => new Set());
  const developerModeEnabled = useAppStore((state) => state.settings.developerModeEnabled);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const { sections: customSections } = useHubCustom();
  useEffect(() => {
    if (!developerModeEnabled && section === 'developer') setSection(null);
  }, [developerModeEnabled, section]);
  const selectSection = (next: HubSection) => {
    setSection((current) => current === next ? null : next);
    setVisitedSections((current) => new Set(current).add(next));
  };

  // Voice commands: "Jarvis open mods", "close panel", "menu".
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ section?: string }>).detail?.section;
      if (!id) return;
      setSection(id as HubSection);
      setVisitedSections((current) => new Set(current).add(id as HubSection));
    };
    const onClose = () => setSection(null);
    const onToggleMenu = () => toggleSidebar();
    window.addEventListener('jarvis:open-section', onOpen);
    window.addEventListener('jarvis:close-section', onClose);
    window.addEventListener('jarvis:toggle-sidebar', onToggleMenu);
    return () => {
      window.removeEventListener('jarvis:open-section', onOpen);
      window.removeEventListener('jarvis:close-section', onClose);
      window.removeEventListener('jarvis:toggle-sidebar', onToggleMenu);
    };
  }, [toggleSidebar]);

  return (
    <section className="shrink-0 border-b px-4 pt-2" style={{ borderColor: 'var(--color-border)' }} aria-label="Games, social, media, remote access, stores, and AI">
      <nav className="flex flex-wrap items-center gap-2 pb-2" aria-label="Main page sections">
        <ActionButton active={sidebarOpen} onClick={toggleSidebar} title="Open the side menu">
          <PanelLeft size={15} /> Menu
        </ActionButton>
        <ActionButton active={false} onClick={() => navigate('/media')} title="Open TV, movie and show guides">
          <Tv size={15} /> Guides
        </ActionButton>
        <ActionButton active={section === 'kids'} onClick={() => selectSection('kids')}>
          <Baby size={15} /> Kids
        </ActionButton>
        <ActionButton active={section === 'crypto'} onClick={() => selectSection('crypto')}>
          <Bitcoin size={15} /> Crypto
        </ActionButton>
        <ActionButton active={section === 'apps'} onClick={() => selectSection('apps')}>
          <LayoutGrid size={15} /> Apps
        </ActionButton>
        <ActionButton active={section === 'mods'} onClick={() => selectSection('mods')}>
          <Wrench size={15} /> Mods
        </ActionButton>
        <ActionButton active={section === 'create'} onClick={() => selectSection('create')}>
          <Palette size={15} /> Create
        </ActionButton>
        <ActionButton active={section === 'smart_home'} onClick={() => selectSection('smart_home')}>
          <Home size={15} /> Smart Home
        </ActionButton>
        <ActionButton active={section === 'productivity'} onClick={() => selectSection('productivity')}>
          <Briefcase size={15} /> Productivity
        </ActionButton>
        <ActionButton active={section === 'finance'} onClick={() => selectSection('finance')}>
          <Landmark size={15} /> Finance
        </ActionButton>
        <ActionButton active={section === 'news'} onClick={() => selectSection('news')}>
          <Newspaper size={15} /> News
        </ActionButton>
        <ActionButton active={section === 'health'} onClick={() => selectSection('health')}>
          <HeartPulse size={15} /> Health
        </ActionButton>
        <ActionButton active={section === 'travel'} onClick={() => selectSection('travel')}>
          <Plane size={15} /> Travel
        </ActionButton>
        <ActionButton active={section === 'education'} onClick={() => selectSection('education')}>
          <GraduationCap size={15} /> Education
        </ActionButton>
        <ActionButton active={section === 'shopping'} onClick={() => selectSection('shopping')}>
          <ShoppingCart size={15} /> Shopping
        </ActionButton>
        {/* Toolbox and OS live in the Menu drawer, not the pill bar. */}
        <ActionButton active={section === 'music'} onClick={() => selectSection('music')}>
          <Music2 size={15} /> Music
        </ActionButton>
        <ActionButton active={section === 'browsers'} onClick={() => selectSection('browsers')}>
          <Globe size={15} /> Browsers
        </ActionButton>
        <ActionButton active={section === 'games'} onClick={() => selectSection('games')}>
          <Gamepad2 size={15} /> Games
        </ActionButton>
        <ActionButton active={section === 'social'} onClick={() => selectSection('social')}>
          <ArrowUpRight size={15} /> Social
        </ActionButton>
        <ActionButton active={section === 'media'} onClick={() => selectSection('media')}>
          <Tv size={15} /> Media
        </ActionButton>
        <ActionButton active={section === 'record'} onClick={() => selectSection('record')}>
          <Disc size={15} /> Record
        </ActionButton>
        <ActionButton active={section === 'remote'} onClick={() => selectSection('remote')}>
          <Monitor size={15} /> Remote
        </ActionButton>
        <ActionButton active={section === 'stores'} onClick={() => selectSection('stores')}>
          <ShoppingBag size={15} /> Stores
        </ActionButton>
        <ActionButton active={section === 'ai'} onClick={() => selectSection('ai')}>
          <BrainCircuit size={15} /> AI
        </ActionButton>
        {/* Toolbox + OS live in the Menu drawer, not the pill bar. */}
        {customSections.map((custom) => {
          const Icon = customSectionIcon(custom.icon);
          return (
            <ActionButton key={custom.id} active={section === custom.id} onClick={() => selectSection(custom.id)}>
              <Icon size={15} /> {custom.label}
            </ActionButton>
          );
        })}
      </nav>
      <div className={`max-h-[42vh] overflow-y-auto pb-2 relative ${section ? '' : 'hidden'}`}>
        {section && (
          <button
            type="button"
            onClick={() => setSection(null)}
            title="Close panel"
            aria-label="Close panel"
            className="sticky top-1 float-right z-10 ml-auto flex h-7 w-7 items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            <X size={14} />
          </button>
        )}
        {visitedSections.has('kids') && <div hidden={section !== 'kids'}><KidsPanel /><CustomAppsBlock section="kids" /></div>}
        {visitedSections.has('crypto') && <div hidden={section !== 'crypto'}><CryptoPanel /><CustomAppsBlock section="crypto" /></div>}
        {visitedSections.has('apps') && <div hidden={section !== 'apps'}><AppsPanel /><CustomAppsBlock section="apps" /></div>}
        {visitedSections.has('browsers') && <div hidden={section !== 'browsers'}><BrowsersPanel /><CustomAppsBlock section="browsers" /></div>}
        {visitedSections.has('games') && <div hidden={section !== 'games'}><GamesPanel /><CustomAppsBlock section="games" /></div>}
        {visitedSections.has('social') && <div hidden={section !== 'social'}><SocialPanel /><CustomAppsBlock section="social" /></div>}
        {visitedSections.has('music') && <div hidden={section !== 'music'}><MusicPanel /><CustomAppsBlock section="music" /></div>}
        {visitedSections.has('media') && <div hidden={section !== 'media'}><MediaPanel /><CustomAppsBlock section="media" /></div>}
        {visitedSections.has('record') && <div hidden={section !== 'record'}><LocalRecorder /><CustomAppsBlock section="record" /></div>}
        {visitedSections.has('remote') && <div hidden={section !== 'remote'}><RemotePanel /><CustomAppsBlock section="remote" /></div>}
        {visitedSections.has('stores') && <div hidden={section !== 'stores'}><StoresPanel /><CustomAppsBlock section="stores" /></div>}
        {visitedSections.has('ai') && <div hidden={section !== 'ai'}><AIPlatformPanel /><CustomAppsBlock section="ai" /></div>}
        {visitedSections.has('os') && <div hidden={section !== 'os'}><OSPanel /><CustomAppsBlock section="os" /></div>}
        {visitedSections.has('prompt_lab') && <div hidden={section !== 'prompt_lab'}><PromptLabPanel /></div>}
        {visitedSections.has('mods') && <div hidden={section !== 'mods'}><GroupedAppsPanel groups={modsGroups} note="Mod managers keep mods isolated from your game files — Nexus downloads need a free Nexus account; Modrinth and CurseForge are open." /><CustomAppsBlock section="mods" /></div>}
        {visitedSections.has('create') && <div hidden={section !== 'create'}><GroupedAppsPanel groups={createGroups} note="Photo, design, video and audio editors — the download arrow grabs the real installer; browser editors like Photopea and Canva open instantly." /><CustomAppsBlock section="create" /></div>}
        {visitedSections.has('smart_home') && <div hidden={section !== 'smart_home'}><GroupedAppsPanel groups={smartHomeGroups} note="These open the companion apps/sites — pair devices in each app. Home Assistant can run fully local on a Raspberry Pi or this PC." /><CustomAppsBlock section="smart_home" /></div>}
        {visitedSections.has('productivity') && <div hidden={section !== 'productivity'}><GroupedAppsPanel groups={productivityGroups} note="Sign in with each service in your browser — OpenJarvis opens the site or installed app." /><CustomAppsBlock section="productivity" /></div>}
        {visitedSections.has('finance') && <div hidden={section !== 'finance'}><GroupedAppsPanel groups={financeGroups} note="Banks and brokerages require your own account and verification — never enter banking passwords anywhere but the official site." /><CustomAppsBlock section="finance" /></div>}
        {visitedSections.has('news') && <div hidden={section !== 'news'}><GroupedAppsPanel groups={newsGroups} note="News sites open in your browser; weather links give current forecasts and official alerts." /><CustomAppsBlock section="news" /></div>}
        {visitedSections.has('health') && <div hidden={section !== 'health'}><GroupedAppsPanel groups={healthGroups} note="Health apps need your own accounts — OpenJarvis does not collect or store health data." /><CustomAppsBlock section="health" /></div>}
        {visitedSections.has('travel') && <div hidden={section !== 'travel'}><GroupedAppsPanel groups={travelGroups} note="Booking sites open in your browser — always confirm prices and policies on the official site." /><CustomAppsBlock section="travel" /></div>}
        {visitedSections.has('education') && <div hidden={section !== 'education'}><GroupedAppsPanel groups={educationGroups} note="Khan Academy and Libby are free; Coursera/edX courses are free to audit or paid for certificates." /><CustomAppsBlock section="education" /></div>}
        {visitedSections.has('shopping') && <div hidden={section !== 'shopping'}><GroupedAppsPanel groups={shoppingGroups} note="Retailers open in your browser — deals sites aggregate community-verified offers." /><CustomAppsBlock section="shopping" /></div>}
        {visitedSections.has('toolbox') && (
          <div hidden={section !== 'toolbox'}>
            <ToolboxPanel />
            <CustomAppsBlock section="system" />
            <CustomAppsBlock section="files" />
            <CustomAppsBlock section="toolbox" />
            <CustomAppsBlock section="tools" />
            <CustomAppsBlock section="privacy" />
            <CustomAppsBlock section="cleaner" />
            <CustomAppsBlock section="security" />
            {developerModeEnabled && <CustomAppsBlock section="developer" />}
            <CustomAppsBlock section="os" />
          </div>
        )}
        {customSections.map((custom) =>
          visitedSections.has(custom.id) ? (
            <div key={custom.id} hidden={section !== custom.id}>
              <CustomPillPanel sectionId={custom.id} label={custom.label} />
            </div>
          ) : null,
        )}
      </div>
    </section>
  );
}
