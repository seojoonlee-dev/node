import { set, clear, keys } from 'idb-keyval';
import demoSeed from './demoSeed.md?raw';

// Seed/reset helpers for the IndexedDB-backed web demo. Shared by the storage
// adapter (api.indexeddb.ts) and the Settings "Demo" tab so there is a single
// source of truth for the default note.
const SEED_FLAG = 'graphwrite-demo-seeded';

const seed = () => set('Note/Note.md', demoSeed);

// On first visit, drop the sample note into an empty store. The flag ensures we
// never re-seed after the user deliberately clears their notes.
export const seedIfNeeded = async () => {
  if (localStorage.getItem(SEED_FLAG)) return;
  if (((await keys()) as string[]).length === 0) await seed();
  localStorage.setItem(SEED_FLAG, '1');
};

// Wipe every note and all settings (font reverts to the Domine default, startup
// note, sidebar, etc.), then restore the default note.
export const resetDemo = async () => {
  await clear();
  localStorage.clear();
  await seed();
  localStorage.setItem(SEED_FLAG, '1');
};
