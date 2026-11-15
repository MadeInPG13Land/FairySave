'use client';

/**
 * Copies of save files taken right before FairySave overwrites them in place,
 * kept in IndexedDB (the browser can't write a .bak next to the file with
 * only a file handle). The newest few per file name are kept.
 */

const DB_NAME = 'fairysave-backups';
const STORE_NAME = 'backups';
const DB_VERSION = 1;
export const BACKUPS_KEPT = 5;

export interface Backup {
  id: string;
  fileName: string;
  text: string;
  savedAt: number;
}

/** The backups to delete so each file keeps only its newest `keep`. */
export function pruneBackups(list: Backup[], keep = BACKUPS_KEPT): Backup[] {
  const byFile = new Map<string, Backup[]>();
  for (const backup of list) byFile.set(backup.fileName, [...(byFile.get(backup.fileName) ?? []), backup]);
  return [...byFile.values()].flatMap((group) => [...group].sort((a, b) => b.savedAt - a.savedAt).slice(keep));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('byFile', 'fileName');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function forFile(store: IDBObjectStore, fileName: string): Promise<Backup[]> {
  return new Promise((resolve, reject) => {
    const request = store.index('byFile').getAll(fileName);
    request.onsuccess = () => resolve(request.result as Backup[]);
    request.onerror = () => reject(request.error);
  });
}

export async function addBackup(fileName: string, text: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const backup: Backup = { id: crypto.randomUUID(), fileName, text, savedAt: Date.now() };
      store.put(backup);
      // Prune inside the same transaction, from the request callback so it stays active.
      const existing = store.index('byFile').getAll(fileName);
      existing.onsuccess = () => pruneBackups(existing.result as Backup[]).forEach((old) => store.delete(old.id));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
  } catch {
    /* backups are best effort */
  }
}

/** Newest first. */
export async function listBackups(fileName: string): Promise<Backup[]> {
  try {
    const db = await openDatabase();
    const list = await forFile(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME), fileName);
    db.close();
    return list.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function getBackup(id: string): Promise<Backup | null> {
  try {
    const db = await openDatabase();
    const result = await new Promise<Backup | null>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve((request.result as Backup | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}
