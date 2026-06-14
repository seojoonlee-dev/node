// App font setting. The whole UI/editor inherits the `--app-font` CSS variable;
// changing it here re-themes everything except code blocks (which stay mono).
// Domine is self-hosted via Fontsource (bundled .woff2, no third-party CDN); the
// browser only fetches it when the user actually selects it.
import '@fontsource/domine/latin-400.css';
import '@fontsource/domine/latin-700.css';

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

const KEY = 'appFont';
const DEFAULT = FONTS.find((f) => f.name === 'Domine') ?? FONTS[0];

export const getFontName = (): string => localStorage.getItem(KEY) || DEFAULT.name;

const stackFor = (name: string): string => (FONTS.find((f) => f.name === name) ?? DEFAULT).stack;

export const applyFont = (name: string = getFontName()): void => {
  document.documentElement.style.setProperty('--app-font', stackFor(name));
};

export const setFont = (name: string): void => {
  localStorage.setItem(KEY, name);
  applyFont(name);
};
