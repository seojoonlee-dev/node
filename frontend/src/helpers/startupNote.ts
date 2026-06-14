// The "startup note" is opened automatically when the app loads (if the user
// is landing on the home screen). Empty means no redirect. The demo defaults to
// the seeded "Note"; self-hosted defaults to empty.
const KEY = 'startupNote';
const isDemo = import.meta.env.VITE_STORAGE === 'indexeddb';

export const getStartupNote = (): string => {
  const stored = localStorage.getItem(KEY);
  if (stored === null) return isDemo ? 'Note' : '';
  return stored;
};

export const setStartupNote = (value: string): void => {
  localStorage.setItem(KEY, value.trim().replace(/^\/+/, ''));
};
