// Single source of truth for user settings, stored as one JSON object in
// localStorage. Stored values are merged over DEFAULTS so new settings added
// later just fall back to their default without breaking saved data.
//
// Theming works through CSS custom properties (see :root in app.css). A theme is
// a preset (dark/light) plus optional per-token overrides; applySettings() pushes
// the effective values onto :root. Syntax-highlight colors and code-block
// surfaces are intentionally NOT themed here — they stay dark in every theme.
import '@fontsource/domine/latin-400.css';
import '@fontsource/domine/latin-700.css';

const isDemo = import.meta.env.VITE_STORAGE === 'indexeddb';

export interface FontOption {
  name: string;
  stack: string;
}

export const FONTS: FontOption[] = [
  { name: 'Times New Roman', stack: `'Times New Roman', Times, serif` },
  { name: 'Georgia', stack: `Georgia, 'Times New Roman', serif` },
  { name: 'Domine', stack: `'Domine', Georgia, serif` },
  { name: 'System Sans', stack: `system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif` },
  { name: 'Arial', stack: `Arial, Helvetica, sans-serif` },
];

export type PresetName = 'dark' | 'light' | 'black';
export type ThemeName = PresetName | 'custom';

export interface ThemeTokens {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  danger: string;
  icon: string;
  codeBg: string;
}

export const TOKEN_LABELS: Record<keyof ThemeTokens, string> = {
  bg: 'Editor background',
  bgSecondary: 'Secondary background',
  bgTertiary: 'Text slection highlight color',
  text: 'Text',
  textMuted: 'Muted text',
  border: 'Border',
  accent: 'Accent',
  danger: 'Danger',
  icon: 'Icons',
  codeBg: 'Code block',
};

export const PRESETS: Record<PresetName, ThemeTokens> = {
  dark: {
    bg: '#282828',
    bgSecondary: '#1e1e1e',
    bgTertiary: '#5E5C64',
    text: '#FFF0E3',
    textMuted: '#9a928c',
    border: '#3a3a3a',
    accent: '#e0a96d',
    danger: '#6e2626',
    icon: '#FFF0E3',
    codeBg: '#1e1e1e',
  },
  light: {
    bg: '#ffffff',
    bgSecondary: '#F7F6F3',
    bgTertiary: '#e9e4dc',
    text: '#2b2824',
    textMuted: '#6e675f',
    border: '#ddd6cc',
    accent: '#b97e2e',
    danger: '#b23b3b',
    icon: '#2b2824',
    codeBg: '#F7F6F3',
  },
  black: {
    bg: '#000000',
    bgSecondary: '#000000',
    bgTertiary: '#313133',
    text: '#FFF0E3',
    textMuted: '#9a928c',
    border: '#3a3a3a',
    accent: '#e0a96d',
    danger: '#6e2626',
    icon: '#FFF0E3',
    codeBg: '#171717',
  },
};

export interface Settings {
  font: string;
  startupNote: string;
  theme: ThemeName;
  colors: Partial<ThemeTokens>;
}

const KEY = 'graphwrite-settings';

const DEFAULTS: Settings = {
  font: 'Domine',
  startupNote: isDemo ? 'Note' : '',
  theme: 'dark',
  colors: {},
};

export const loadSettings = (): Settings => {
  let stored: Partial<Settings> = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    stored = {};
  }
  return { ...DEFAULTS, ...stored, colors: { ...(stored.colors ?? {}) } };
};

type Listener = () => void;
const listeners = new Set<Listener>();
// Notified after any settings change so non-React consumers (the CodeMirror
// editor) can react — e.g. re-pick code highlighting when the theme changes.
export const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const saveSettings = (patch: Partial<Settings>): Settings => {
  const next = { ...loadSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  applySettings(next);
  listeners.forEach((listener) => listener());
  return next;
};

export const effectiveColors = (s: Settings = loadSettings()): ThemeTokens => {
  // Presets are fixed; 'custom' is the user's own palette (defaulting to dark
  // for any token they haven't set).
  if (s.theme === 'custom') return { ...PRESETS.dark, ...s.colors };
  return PRESETS[s.theme];
};

const fontStack = (name: string): string =>
  (FONTS.find((f) => f.name === name) ?? FONTS.find((f) => f.name === DEFAULTS.font)!).stack;

const cssVar = (token: string): string => '--' + token.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

export const applySettings = (s: Settings = loadSettings()): void => {
  const root = document.documentElement.style;
  root.setProperty('--app-font', fontStack(s.font));
  const colors = effectiveColors(s);
  (Object.keys(colors) as (keyof ThemeTokens)[]).forEach((token) => {
    root.setProperty(cssVar(token), colors[token]);
  });
};

// Convenience accessors for the settings UI.
export const getFont = () => loadSettings().font;
export const setFont = (name: string) => saveSettings({ font: name });

export const getStartupNote = () => loadSettings().startupNote;
export const setStartupNote = (value: string) =>
  saveSettings({ startupNote: value.trim().replace(/^\/+/, '') });

export const getTheme = () => loadSettings().theme;
export const setTheme = (theme: ThemeName) => saveSettings({ theme });

export const setColor = (token: keyof ThemeTokens, value: string) =>
  saveSettings({ colors: { ...loadSettings().colors, [token]: value } });

export const resetColors = () => saveSettings({ colors: {} });
