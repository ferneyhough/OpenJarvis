export interface ColorTheme {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  bg: string;
  bg2: string;
  bg3: string;
  surface: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  accentHover: string;
}

export const DEFAULT_THEME_ID = 'default';

export const DEFAULT_THEME_TILES: {
  id: string;
  name: string;
  mode: 'light' | 'dark' | 'system';
  bg: string;
  accent: string;
  text: string;
}[] = [
  { id: 'default-system', name: 'Default (System)', mode: 'system', bg: 'linear-gradient(90deg,#f9f9f9 50%,#0a0a0b 50%)', accent: '#0891b2', text: '#888888' },
  { id: 'default-light', name: 'Default Light', mode: 'light', bg: '#f9f9f9', accent: '#0891b2', text: '#09090b' },
  { id: 'default-dark', name: 'Default Dark', mode: 'dark', bg: '#0a0a0b', accent: '#22d3ee', text: '#ededef' },
];

export const COLOR_THEMES: ColorTheme[] = [
  { id: 'midnight', name: 'Midnight', mode: 'dark', bg: '#0b1020', bg2: '#111833', bg3: '#1a2347', surface: '#111833', text: '#e6ebff', text2: '#9aa6d6', text3: '#5d6a9c', accent: '#6c8cff', accentHover: '#8fa8ff' },
  { id: 'obsidian', name: 'Obsidian (AMOLED)', mode: 'dark', bg: '#000000', bg2: '#0a0a0a', bg3: '#141414', surface: '#0a0a0a', text: '#f2f2f2', text2: '#9a9a9a', text3: '#5a5a5a', accent: '#ffffff', accentHover: '#d4d4d4' },
  { id: 'dracula', name: 'Dracula', mode: 'dark', bg: '#282a36', bg2: '#21222c', bg3: '#343746', surface: '#2d2f3d', text: '#f8f8f2', text2: '#b6b9d0', text3: '#6272a4', accent: '#bd93f9', accentHover: '#d2b3ff' },
  { id: 'nord', name: 'Nord', mode: 'dark', bg: '#2e3440', bg2: '#3b4252', bg3: '#434c5e', surface: '#3b4252', text: '#eceff4', text2: '#aeb7c7', text3: '#7b88a1', accent: '#88c0d0', accentHover: '#a3d3e0' },
  { id: 'solarized-dark', name: 'Solarized Dark', mode: 'dark', bg: '#002b36', bg2: '#073642', bg3: '#0d4654', surface: '#073642', text: '#eee8d5', text2: '#93a1a1', text3: '#657b83', accent: '#2aa198', accentHover: '#4cc2b8' },
  { id: 'monokai', name: 'Monokai', mode: 'dark', bg: '#272822', bg2: '#1e1f1c', bg3: '#3e3d32', surface: '#2f302a', text: '#f8f8f2', text2: '#c2c2b5', text3: '#75715e', accent: '#a6e22e', accentHover: '#c0f060' },
  { id: 'tokyo-night', name: 'Tokyo Night', mode: 'dark', bg: '#1a1b26', bg2: '#16161e', bg3: '#24283b', surface: '#1f2335', text: '#c0caf5', text2: '#9aa5ce', text3: '#565f89', accent: '#7aa2f7', accentHover: '#9bb8fa' },
  { id: 'gruvbox-dark', name: 'Gruvbox Dark', mode: 'dark', bg: '#282828', bg2: '#32302f', bg3: '#3c3836', surface: '#32302f', text: '#ebdbb2', text2: '#bdae93', text3: '#928374', accent: '#fabd2f', accentHover: '#fcd05e' },
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha', mode: 'dark', bg: '#1e1e2e', bg2: '#181825', bg3: '#313244', surface: '#242438', text: '#cdd6f4', text2: '#a6adc8', text3: '#6c7086', accent: '#cba6f7', accentHover: '#dcc2fa' },
  { id: 'one-dark', name: 'One Dark', mode: 'dark', bg: '#282c34', bg2: '#21252b', bg3: '#333842', surface: '#2c313a', text: '#abb2bf', text2: '#8b92a0', text3: '#5c6370', accent: '#61afef', accentHover: '#82c0f3' },
  { id: 'ocean', name: 'Deep Ocean', mode: 'dark', bg: '#06141f', bg2: '#0a1f2e', bg3: '#10304a', surface: '#0a1f2e', text: '#dff3ff', text2: '#8fb8d0', text3: '#53788f', accent: '#22c1dc', accentHover: '#5ad8ee' },
  { id: 'forest', name: 'Forest', mode: 'dark', bg: '#0e1a14', bg2: '#13241b', bg3: '#1c3528', surface: '#13241b', text: '#e2f2e6', text2: '#93b59d', text3: '#5a7d65', accent: '#4ade80', accentHover: '#78ec9f' },
  { id: 'crimson', name: 'Crimson', mode: 'dark', bg: '#150a0c', bg2: '#1f1013', bg3: '#2e181c', surface: '#1f1013', text: '#f7e6e8', text2: '#c49aa0', text3: '#835a60', accent: '#ef4457', accentHover: '#f47a88' },
  { id: 'synthwave', name: 'Synthwave', mode: 'dark', bg: '#1a1033', bg2: '#241548', bg3: '#33205f', surface: '#241548', text: '#f5e9ff', text2: '#c3a5e8', text3: '#8062b0', accent: '#ff4fd8', accentHover: '#ff82e4' },
  { id: 'cyberpunk', name: 'Cyberpunk', mode: 'dark', bg: '#0d0d14', bg2: '#15151f', bg3: '#1f1f2e', surface: '#15151f', text: '#f8f9d2', text2: '#b9bb8c', text3: '#74755a', accent: '#fcee0a', accentHover: '#fff55c' },
  { id: 'rose-pine', name: 'Rosé Pine', mode: 'dark', bg: '#191724', bg2: '#1f1d2e', bg3: '#26233a', surface: '#1f1d2e', text: '#e0def4', text2: '#908caa', text3: '#6e6a86', accent: '#ebbcba', accentHover: '#f3d2d0' },
  { id: 'sunset', name: 'Sunset', mode: 'dark', bg: '#1c0f14', bg2: '#27151b', bg3: '#3a1f27', surface: '#27151b', text: '#ffeede', text2: '#d3a98f', text3: '#8f6a58', accent: '#ff8a4c', accentHover: '#ffa87c' },
  { id: 'solarized-light', name: 'Solarized Light', mode: 'light', bg: '#fdf6e3', bg2: '#eee8d5', bg3: '#e3dcc4', surface: '#fffaf0', text: '#073642', text2: '#586e75', text3: '#93a1a1', accent: '#268bd2', accentHover: '#1a6fae' },
  { id: 'gruvbox-light', name: 'Gruvbox Light', mode: 'light', bg: '#fbf1c7', bg2: '#f2e5bc', bg3: '#ebdbb2', surface: '#fdf6d8', text: '#3c3836', text2: '#665c54', text3: '#928374', accent: '#b57614', accentHover: '#8f5b0e' },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', mode: 'light', bg: '#eff1f5', bg2: '#e6e9ef', bg3: '#ccd0da', surface: '#ffffff', text: '#4c4f69', text2: '#6c6f85', text3: '#9ca0b0', accent: '#8839ef', accentHover: '#6c26c9' },
  { id: 'paper', name: 'Paper', mode: 'light', bg: '#f6f3ec', bg2: '#ece7db', bg3: '#ddd6c5', surface: '#fffdf8', text: '#2b2a27', text2: '#6b675e', text3: '#a09b8f', accent: '#c2410c', accentHover: '#9a3309' },
  { id: 'mint', name: 'Mint', mode: 'light', bg: '#eefaf4', bg2: '#dff3e8', bg3: '#c8e8d6', surface: '#ffffff', text: '#12372a', text2: '#4a7563', text3: '#86a899', accent: '#0f9d6b', accentHover: '#0b7a53' },
  { id: 'sakura', name: 'Sakura', mode: 'light', bg: '#fff1f5', bg2: '#fde3ec', bg3: '#f9ccdb', surface: '#ffffff', text: '#4a1d2f', text2: '#8a5568', text3: '#bf94a4', accent: '#e0467c', accentHover: '#b8335f' },
  { id: 'sand', name: 'Desert Sand', mode: 'light', bg: '#f8efe2', bg2: '#efe2cc', bg3: '#e2d0b3', surface: '#fffaf1', text: '#3b2f20', text2: '#7a6850', text3: '#ac9c82', accent: '#d97706', accentHover: '#b15f04' },
  { id: 'sky', name: 'Clear Sky', mode: 'light', bg: '#eef6ff', bg2: '#dfeeff', bg3: '#c8e0fb', surface: '#ffffff', text: '#0f2942', text2: '#4a6a8a', text3: '#8aa3bd', accent: '#1d7bea', accentHover: '#1560bd' },
];

export const CUSTOM_BACKGROUND_KEY = 'openjarvis-custom-background';
export const APPEARANCE_EVENT = 'openjarvis-appearance-changed';

export function getCustomBackground(): string {
  try {
    return localStorage.getItem(CUSTOM_BACKGROUND_KEY) || '';
  } catch {
    return '';
  }
}

export function setCustomBackground(dataUrl: string): void {
  if (dataUrl) localStorage.setItem(CUSTOM_BACKGROUND_KEY, dataUrl);
  else localStorage.removeItem(CUSTOM_BACKGROUND_KEY);
  window.dispatchEvent(new Event(APPEARANCE_EVENT));
}

// Downscale so large photos fit in localStorage.
export function readImageAsDataUrl(file: File, maxSize = 1920): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not process the image.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}

const THEME_VARS = [
  '--color-bg', '--color-bg-secondary', '--color-bg-tertiary', '--color-surface', '--color-sidebar',
  '--color-border', '--color-border-subtle', '--color-text', '--color-text-secondary',
  '--color-text-tertiary', '--color-text-inverse', '--color-accent', '--color-accent-hover',
  '--color-accent-subtle', '--color-accent-glow', '--color-code-bg', '--color-input-bg',
  '--color-input-border', '--color-user-bubble', '--color-user-bubble-text', '--color-on-accent',
  '--color-disabled-bg',
];

const BG_LAYER_ID = 'oj-bg-layer';

function mix(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

export interface AppearanceInput {
  theme: 'light' | 'dark' | 'system';
  colorTheme?: string;
  backgroundOpacity?: number;
}

export function applyAppearance({ theme, colorTheme, backgroundOpacity = 80 }: AppearanceInput): void {
  const root = document.documentElement;
  const picked = COLOR_THEMES.find((t) => t.id === colorTheme);
  const image = getCustomBackground();

  root.classList.remove('dark', 'light');
  const mode = picked ? picked.mode : theme;
  if (mode === 'dark') root.classList.add('dark');
  else if (mode === 'light') root.classList.add('light');

  for (const name of THEME_VARS) root.style.removeProperty(name);

  const panel = image ? Math.max(0, Math.min(100, backgroundOpacity)) : 100;
  if (picked) {
    const set = (name: string, value: string) => root.style.setProperty(name, value);
    set('--color-bg', image ? mix(picked.bg, panel) : picked.bg);
    set('--color-bg-secondary', image ? mix(picked.bg2, panel) : picked.bg2);
    set('--color-bg-tertiary', picked.bg3);
    set('--color-surface', image ? mix(picked.surface, panel) : picked.surface);
    set('--color-sidebar', mix(picked.bg2, image ? panel : 85));
    set('--color-border', mix(picked.text, 14));
    set('--color-border-subtle', mix(picked.text, 7));
    set('--color-text', picked.text);
    set('--color-text-secondary', picked.text2);
    set('--color-text-tertiary', picked.text3);
    set('--color-text-inverse', picked.bg);
    set('--color-accent', picked.accent);
    set('--color-accent-hover', picked.accentHover);
    set('--color-accent-subtle', mix(picked.accent, 12));
    set('--color-accent-glow', mix(picked.accent, 32));
    set('--color-code-bg', picked.bg2);
    set('--color-input-bg', picked.bg2);
    set('--color-input-border', mix(picked.text, 18));
    set('--color-user-bubble', mix(picked.accent, 18));
    set('--color-user-bubble-text', picked.text);
    set('--color-on-accent', picked.bg);
    set('--color-disabled-bg', picked.bg3);
  } else if (image) {
    const base = root.classList.contains('dark') ? '#0a0a0b' : '#f9f9f9';
    const second = root.classList.contains('dark') ? '#121214' : '#ffffff';
    root.style.setProperty('--color-bg', mix(base, panel));
    root.style.setProperty('--color-bg-secondary', mix(second, panel));
    root.style.setProperty('--color-surface', mix(second, panel));
    root.style.setProperty('--color-sidebar', mix(second, panel));
  }

  let layer = document.getElementById(BG_LAYER_ID);
  if (image) {
    if (!layer) {
      layer = document.createElement('div');
      layer.id = BG_LAYER_ID;
      layer.setAttribute('aria-hidden', 'true');
      document.body.prepend(layer);
    }
    layer.style.cssText =
      'position:fixed;inset:0;z-index:0;pointer-events:none;background-size:cover;' +
      'background-position:center;background-repeat:no-repeat;' +
      `background-image:url("${image}")`;
    const app = document.getElementById('root');
    if (app) {
      app.style.position = 'relative';
      app.style.zIndex = '1';
    }
  } else if (layer) {
    layer.remove();
  }
}
