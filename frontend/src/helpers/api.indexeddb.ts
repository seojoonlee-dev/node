// IndexedDB storage adapter for the standalone web demo (demo.graphwrite.app).
// Mirrors the HTTP backend's contract in api.http.ts: each note is a folder
// containing a same-named ".md" file, so keys are full ".md" paths
// (e.g. "Projects/Ideas/Ideas.md") and rename/delete operate on the folder.
import { get, set, del, keys } from 'idb-keyval';
import demoSeed from './demoSeed.md?raw';

const INVALID = /[\\/:*?"<>|]/;
const dirname = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const basename = (p: string) => p.split('/').pop() || '';
const join = (...parts: string[]) => parts.filter(Boolean).join('/');
const allKeys = async () => (await keys()) as string[];

// On first visit, drop a sample "Note" into an empty store so the demo isn't
// blank. The flag ensures we never re-seed after the user clears their notes.
const SEED_FLAG = 'graphwrite-demo-seeded';
const seedIfNeeded = async () => {
  if (localStorage.getItem(SEED_FLAG)) return;
  if ((await allKeys()).length === 0) {
    await set('Note/Note.md', demoSeed);
  }
  localStorage.setItem(SEED_FLAG, '1');
};

export const getServerIp = () => 'indexeddb'; // the demo has no server

export const fetchFilesList = async () => {
  await seedIfNeeded();
  return { success: true, files: await allKeys() };
};

export const loadFile = async (filePath: string) => {
  const content = await get<string>(filePath);
  return content === undefined
    ? { success: false, notFound: true }
    : { success: true, content, notFound: false };
};

export const saveFile = async (filePath: string, content: string) => {
  await set(filePath, content);
  return new Response(null, { status: 200 });
};

export const saveFileOnUnload = (filePath: string, content: string) => {
  void set(filePath, content);
};

export const createFile = async (currentPath: string, fileName?: string) => {
  const baseDir = currentPath || '';
  let name = fileName ? fileName.trim() : 'NewFile';
  if (fileName && (!name || INVALID.test(name))) {
    return { success: false, message: 'File names can\'t contain \\, /, :, *, ?, ", <, >, and |.' };
  }

  const ks = await allKeys();
  const exists = (n: string) => ks.includes(join(baseDir, n, `${n}.md`));

  if (fileName) {
    if (exists(name)) {
      return {
        success: false,
        message: `A file named "${name}" already exists in this location.`,
        filePath: join(baseDir, name),
      };
    }
  } else {
    let i = 0;
    while (exists(name)) name = `NewFile${++i}`;
  }

  const dir = join(baseDir, name);
  await set(join(dir, `${name}.md`), '');
  return { success: true, filePath: dir };
};

export const renameFile = async (filePath: string, newTitle: string) => {
  const title = basename(newTitle).replace(/\.md$/, '').trim();
  if (!title || INVALID.test(title)) {
    throw new Error('File names can\'t contain \\, /, :, *, ?, ", <, >, and |.');
  }

  const oldDir = dirname(filePath);
  const newDir = join(dirname(oldDir), title);
  const oldFile = `${oldDir}/${basename(filePath)}`;
  const ks = await allKeys();

  if (newDir !== oldDir && ks.some((k) => k.startsWith(newDir + '/'))) {
    throw new Error(`A file named "${title}" already exists in this location.`);
  }

  // Move the whole folder: re-prefix every descendant key, and rename the
  // note's own file to match the new title.
  for (const k of ks) {
    if (!k.startsWith(oldDir + '/')) continue;
    const newKey = k === oldFile ? `${newDir}/${title}.md` : newDir + k.slice(oldDir.length);
    const content = await get<string>(k);
    await del(k);
    await set(newKey, content ?? '');
  }
  return { success: true, filePath: newDir };
};

export const deleteFile = async (filePath: string) => {
  const folder = dirname(filePath);
  const ks = await allKeys();
  await Promise.all(ks.filter((k) => k.startsWith(folder + '/')).map((k) => del(k)));
  return new Response(null, { status: 200 });
};
