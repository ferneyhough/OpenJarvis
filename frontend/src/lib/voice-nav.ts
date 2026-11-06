/**
 * Voice navigation commands — "Jarvis open apps", "go to settings",
 * "play channel XYZ", "close the browser", etc.
 *
 * Parsing is pure; execution happens in InputArea where router/store access
 * lives. Cross-component effects use window CustomEvents:
 *   jarvis:open-section   { section: string }
 *   jarvis:close-section  {}
 *   jarvis:media-tab      { tab: 'guide'|'movies'|'shows'|'local'|'links' }
 *   jarvis:catalog-search { kind: 'movie'|'series', query: string }
 *   jarvis:guide-play     { name: string }
 *   jarvis:toggle-sidebar {}
 */

export type VoiceNavAction =
  | { type: 'navigate'; path: string }
  | { type: 'open-section'; section: string }
  | { type: 'close-section' }
  | { type: 'toggle-sidebar' }
  | { type: 'media-tab'; tab: 'guide' | 'movies' | 'shows' | 'local' | 'links' }
  | { type: 'catalog-search'; kind: 'movie' | 'series'; query: string }
  | { type: 'guide-play'; name: string }
  | { type: 'open-app'; name: string; url: string }
  | { type: 'close-target'; target: string }
  | { type: 'pc-action'; action: string }
  | { type: 'system-launch'; app: string };

function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/^(?:hey |ok |okay )?jarvis\s+/, '')
    .replace(/^please\s+/, '')
    .replace(/\s+please$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pill/section aliases → HubSection id (custom pills resolved separately). */
const SECTION_ALIASES: Record<string, string> = {
  kids: 'kids',
  'kids apps': 'kids',
  crypto: 'crypto',
  cryptocurrency: 'crypto',
  bitcoin: 'crypto',
  apps: 'apps',
  'apps tab': 'apps',
  mods: 'mods',
  modding: 'mods',
  'mod tools': 'mods',
  create: 'create',
  'create tab': 'create',
  creator: 'create',
  'photo editor': 'create',
  'smart home': 'smart_home',
  'smart home apps': 'smart_home',
  smarthome: 'smart_home',
  productivity: 'productivity',
  finance: 'finance',
  financial: 'finance',
  banking: 'finance',
  news: 'news',
  health: 'health',
  fitness: 'health',
  travel: 'travel',
  trips: 'travel',
  education: 'education',
  learning: 'education',
  school: 'education',
  shopping: 'shopping',
  shop: 'shopping',
  tools: 'toolbox',
  utilities: 'toolbox',
  privacy: 'toolbox',
  vpn: 'toolbox',
  music: 'music',
  browsers: 'browsers',
  browser: 'browsers',
  games: 'games',
  gaming: 'games',
  social: 'social',
  media: 'media',
  record: 'record',
  recording: 'record',
  remote: 'remote',
  'remote access': 'remote',
  stores: 'stores',
  store: 'stores',
  ai: 'ai',
  'ai tools': 'ai',
  developer: 'toolbox',
  dev: 'toolbox',
  coding: 'toolbox',
  system: 'toolbox',
  'pc care': 'toolbox',
  cleaner: 'toolbox',
  cleaning: 'toolbox',
  security: 'toolbox',
  antivirus: 'toolbox',
  'antivirus software': 'toolbox',
  files: 'toolbox',
  'file explorer': 'toolbox',
  'my files': 'toolbox',
  toolbox: 'toolbox',
  'pc tools': 'toolbox',
  'system tools': 'toolbox',
  'jarvis toolbox': 'toolbox',
  os: 'os',
  'operating systems': 'os',
  'operating system': 'os',
  'windows builds': 'os',
  'windows isos': 'os',
  'windows iso': 'os',
  'os pill': 'os',
  'download windows': 'os',
  'windows download': 'os',
  'prompt lab': 'prompt_lab',
  'prompt playground': 'prompt_lab',
  'jailbreak': 'prompt_lab',
  'ai jailbreak': 'prompt_lab',
};

const PAGE_ALIASES: Record<string, string> = {
  chat: '/',
  home: '/',
  main: '/',
  dashboard: '/dashboard',
  stats: '/dashboard',
  settings: '/settings',
  preferences: '/settings',
  config: '/settings',
  agents: '/agents',
  agent: '/agents',
  'data sources': '/data-sources',
  sources: '/data-sources',
  'get started': '/get-started',
  onboarding: '/get-started',
  logs: '/logs',
  log: '/logs',
  media: '/media',
};

const MEDIA_TAB_ALIASES: Record<string, VoiceNavAction> = {
  guide: { type: 'media-tab', tab: 'guide' },
  guides: { type: 'media-tab', tab: 'guide' },
  'tv guide': { type: 'media-tab', tab: 'guide' },
  'television guide': { type: 'media-tab', tab: 'guide' },
  tv: { type: 'media-tab', tab: 'guide' },
  television: { type: 'media-tab', tab: 'guide' },
  movies: { type: 'media-tab', tab: 'movies' },
  movie: { type: 'media-tab', tab: 'movies' },
  shows: { type: 'media-tab', tab: 'shows' },
  'tv shows': { type: 'media-tab', tab: 'shows' },
  series: { type: 'media-tab', tab: 'shows' },
  'local media': { type: 'media-tab', tab: 'local' },
  local: { type: 'media-tab', tab: 'local' },
  downloads: { type: 'media-tab', tab: 'local' },
  links: { type: 'media-tab', tab: 'links' },
};

const SYSTEM_APP_ALIASES: Record<string, string> = {
  'file explorer': 'explorer',
  explorer: 'explorer',
  files: 'explorer',
  notepad: 'notepad',
  calculator: 'calculator',
  calc: 'calculator',
  paint: 'paint',
  'microsoft paint': 'paint',
  wordpad: 'wordpad',
  'command prompt': 'command prompt',
  cmd: 'command prompt',
  powershell: 'powershell',
  terminal: 'terminal',
  'task manager': 'task manager',
  'windows settings': 'settings',
  'system settings': 'settings',
  'control panel': 'control panel',
  // Control Panel applets
  'programs and features': 'programs and features',
  'uninstall a program': 'uninstall a program',
  'installed programs': 'programs and features',
  'power options': 'power options',
  'power plan': 'power options',
  'internet options': 'internet options',
  'mouse settings': 'mouse',
  'keyboard settings': 'keyboard',
  'display settings': 'display',
  'sound settings': 'sound',
  'date and time': 'date and time',
  'regional settings': 'region',
  'user accounts': 'user accounts',
  'windows defender': 'windows defender',
  'windows security': 'windows security',
  'bitlocker': 'bitlocker',
  'credential manager': 'credential manager',
  'indexing options': 'indexing options',
  'windows features': 'windows features',
  'optional features': 'windows features',
  'environment variables': 'environment variables',
  'system properties': 'system properties',
  // System tools
  'device manager': 'device manager',
  'disk management': 'disk management',
  'computer management': 'computer management',
  'services': 'services',
  'event viewer': 'event viewer',
  'task scheduler': 'task scheduler',
  'system configuration': 'system configuration',
  msconfig: 'system configuration',
  'system information': 'system information',
  'directx diagnostics': 'directx diagnostics',
  dxdiag: 'directx diagnostics',
  'resource monitor': 'resource monitor',
  'performance monitor': 'performance monitor',
  'registry editor': 'registry editor',
  regedit: 'registry editor',
  'local users': 'local users',
  'group policy': 'group policy',
  'windows security console': 'windows security console',
  'disk cleanup': 'disk cleanup',
  'defrag and optimize': 'defrag and optimize',
  'memory diagnostic': 'memory diagnostic',
  'print management': 'print management',
  'shared folders': 'shared folders',
  'odbc data sources': 'odbc data sources',
  // Windows apps
  'snipping tool': 'snipping tool',
  'steps recorder': 'steps recorder',
  'character map': 'character map',
  'on screen keyboard': 'on-screen keyboard',
  'on-screen keyboard': 'on-screen keyboard',
  magnifier: 'magnifier',
  narrator: 'narrator',
  'voice access': 'voice access',
  'windows media player': 'windows media player',
  photos: 'photos',
  'microsoft store': 'store',
  'xbox app': 'xbox app',
  'get help': 'get help',
  'feedback hub': 'feedback hub',
  camera: 'camera',
};

const PC_ACTION_PATTERNS: Array<[RegExp, string]> = [
  [/^(?:scan|check|analyse|analyze)\b.*\b(?:pc|computer|disk|junk|files|folders|drive|system)\b/, 'scan'],
  [/^find\b.*\b(?:empty folders?|dead (?:links?|shortcuts?)|junk|duplicate files?)\b/, 'scan'],
  [/^(?:clean|clear|wipe|remove junk from|free up space on)\b.*\b(?:pc|computer|disk|junk|temp|c drive|drive c)\b/, 'clean-all'],
  [/^(?:clean|delete|remove)\b.*\btemp(?:orary)? files?\b/, 'clean-temp'],
  [/^(?:clean|delete|remove)\b.*\b(?:dead|broken) (?:links?|shortcuts?)\b/, 'clean-links'],
  [/^(?:clean|delete|remove)\b.*\bempty folders?\b/, 'clean-folders'],
  [/^(?:defrag|optimi[sz]e|trim)\b.*\b(?:pc|computer|disk|drive|c drive|drive c|ssd|hdd)\b/, 'defrag'],
  [/^(?:defrag|optimi[sz]e)\s*$/, 'defrag'],
];

const OPEN_VERBS = /^(?:open|launch|start|show|go to|take me to|navigate to|bring up|pull up|switch to|select)\s+(.+)$/;
const CLOSE_VERBS = /^(?:close|exit|hide|dismiss|quit|minimize|collapse|shut)\s+(.+)$/;
const SEARCH_VERBS = /^(?:search|find|look up|look for)\s+(.+)$/;

export interface VoiceNavAppEntry {
  name: string;
  url: string;
  section: string;
}

/** Resolve a spoken target to a hub app across every section + custom pills. */
export function findVoiceApp(
  target: string,
  entries: VoiceNavAppEntry[],
  customApps: { name: string; url: string; section: string }[],
): VoiceNavAppEntry | null {
  const t = target.replace(/^the /, '').trim();
  if (!t) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const nt = norm(t);
  const all: VoiceNavAppEntry[] = [
    ...entries,
    ...customApps.map((a) => ({ name: a.name, url: a.url, section: a.section })),
  ];
  // Exact name match first, then normalized, then substring.
  const exact = all.find((a) => a.name.toLowerCase() === t);
  if (exact) return exact;
  const normMatch = all.find((a) => norm(a.name) === nt);
  if (normMatch) return normMatch;
  const words = nt.split(' ').filter(Boolean);
  return (
    all.find((a) => {
      const na = norm(a.name);
      return na === nt || na.includes(nt) || (nt.length >= 4 && words.every((w) => na.includes(w)));
    }) ?? null
  );
}

/**
 * Parse a voice transcript into a navigation action.
 * Returns null when the text isn't a nav command (falls through to chat).
 */
export function parseVoiceNavCommand(
  text: string,
  appEntries: VoiceNavAppEntry[],
  customApps: { name: string; url: string; section: string }[],
  customSections: { id: string; label: string }[],
): VoiceNavAction | null {
  const t = normalize(text);
  if (!t) return null;

  // "Jarvis, menu" / "open the menu" / "toggle sidebar"
  if (/^(?:open |show |toggle )?(?:the )?(?:menu|sidebar|side panel|left panel|panel)$/.test(t) || t === 'menu') {
    return { type: 'toggle-sidebar' };
  }
  if (/^(?:close|hide|collapse) (?:the )?(?:menu|sidebar|side panel|left panel|panel)$/.test(t)) {
    return { type: 'close-section' };
  }

  // PC care commands: "clean my pc", "scan for junk", "defrag the drive"
  for (const [re, action] of PC_ACTION_PATTERNS) {
    if (re.test(t)) return { type: 'pc-action', action };
  }

  // Close commands
  const close = t.match(CLOSE_VERBS);
  if (close) {
    const target = close[1].replace(/^the /, '').trim();
    if (/^(?:in app |built in )?(?:browser|web page|webpage|page|window|overlay|tab)$/.test(target)) {
      return { type: 'close-target', target: 'browser' };
    }
    if (/^(?:music|music player|media player|player|audio)$/.test(target)) {
      return { type: 'close-target', target: 'player' };
    }
    if (/^(?:section|panel|pill|hub|apps panel)$/.test(target)) {
      return { type: 'close-section' };
    }
    if (target === 'settings') return { type: 'navigate', path: '/' };
    return { type: 'close-target', target };
  }

  // Channel playback: "play channel CNN", "tune to ESPN", "channel fox"
  const channel = t.match(/^(?:play|tune to|switch to|go to|watch)\s+(?:the\s+)?channel\s+(.+)$/)
    ?? t.match(/^channel\s+(.+)$/);
  if (channel) {
    return { type: 'guide-play', name: channel[1].trim() };
  }

  // Media search: "watch the matrix", "find me dune", "search for interstellar"
  const watch = t.match(/^(?:watch|stream|find|search for|look for|play)\s+(.+)$/);
  const search = t.match(SEARCH_VERBS);
  const mediaQ = watch?.[1] ?? search?.[1];
  if (mediaQ && !MEDIA_TAB_ALIASES[mediaQ.trim()]) {
    const q = mediaQ.trim();
    if (SECTION_ALIASES[q]) return { type: 'open-section', section: SECTION_ALIASES[q] };
    if (PAGE_ALIASES[q]) return { type: 'navigate', path: PAGE_ALIASES[q] };
    const app = findVoiceApp(q, appEntries, customApps);
    if (app) return { type: 'open-app', name: app.name, url: app.url };
    const kind = /\b(series|show)\b/.test(t) ? 'series' : 'movie';
    return { type: 'catalog-search', kind, query: q };
  }

  // Open/go-to commands
  const open = t.match(OPEN_VERBS);
  if (open) {
    const target = open[1].replace(/^the /, '').trim();
    if (!target) return null;

    if (MEDIA_TAB_ALIASES[target]) {
      return MEDIA_TAB_ALIASES[target];
    }
    if (PAGE_ALIASES[target]) return { type: 'navigate', path: PAGE_ALIASES[target] };
    // "open settings models" → settings page
    if (/^settings\b/.test(target)) return { type: 'navigate', path: '/settings' };
    if (SECTION_ALIASES[target]) return { type: 'open-section', section: SECTION_ALIASES[target] };
    // Custom pill by label
    const custom = customSections.find((s) => s.label.toLowerCase() === target || s.label.toLowerCase().includes(target));
    if (custom) return { type: 'open-section', section: custom.id };

    if (SYSTEM_APP_ALIASES[target]) return { type: 'system-launch', app: SYSTEM_APP_ALIASES[target] };

    const app = findVoiceApp(target, appEntries, customApps);
    if (app) return { type: 'open-app', name: app.name, url: app.url };
    return null;
  }

  // Bare section/page names: "kids", "settings", "games"
  if (MEDIA_TAB_ALIASES[t]) return MEDIA_TAB_ALIASES[t];
  if (PAGE_ALIASES[t]) return { type: 'navigate', path: PAGE_ALIASES[t] };
  if (SECTION_ALIASES[t]) return { type: 'open-section', section: SECTION_ALIASES[t] };
  const customBare = customSections.find((s) => s.label.toLowerCase() === t);
  if (customBare) return { type: 'open-section', section: customBare.id };
  if (SYSTEM_APP_ALIASES[t]) return { type: 'system-launch', app: SYSTEM_APP_ALIASES[t] };
  const appBare = findVoiceApp(t, appEntries, customApps);
  if (appBare && appBare.name.toLowerCase() === t) {
    return { type: 'open-app', name: appBare.name, url: appBare.url };
  }

  return null;
}
