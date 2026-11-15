'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import { decodeBase64, decryptSave, encodeBase64, encryptSave, parseSaveJson, serializeSaveJson } from './crypto';
import { countChanges, detectSaveKind, type JsonObject, type JsonValue, type SaveKind } from './save';
import {
  downloadText,
  queryAccess,
  requestWriteAccess,
  writeText,
  type FileAccess,
  type PickedFile,
} from './file-access';
import { deleteFileHandle, getFileHandle, saveFileHandle } from './file-handle-store';
import { addBackup, getBackup } from './backup-store';
import { buildRegFile, decodeRegBytes, looksLikeRegExport, parseRegExport, regNameFor, type RegType } from './registry';
import { findSetting, isHiddenSetting } from './settings';

export type EditorView = 'guided' | 'json';

export interface SaveDoc {
  id: string;
  fileName: string;
  kind: SaveKind;
  data: JsonObject;
  /** Snapshot as loaded or last saved; used for "N changes" and revert. */
  original: JsonObject;
  handle: FileSystemFileHandle | null;
  access: FileAccess;
  view: EditorView;
  section: string | null;
  openedAt: number;
  /**
   * How it was last saved: written back to its file, or only downloaded as a copy
   * (which may never reach the game's folder, so it isn't the same as saved).
   */
  savedAs?: SaveResult;
  /** Settings docs only: each value's registry name and how it's stored. */
  registry?: Record<string, { regName: string; type: RegType }>;
}

export type SaveResult = 'file' | 'download';

interface EditorState {
  docs: SaveDoc[];
  activeId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  openFiles: (files: PickedFile[]) => Promise<void>;
  activate: (id: string) => void;
  close: (id?: string) => void;
  setField: (key: string, value: JsonValue | undefined) => void;
  replaceData: (data: JsonObject) => void;
  setView: (view: EditorView) => void;
  setSection: (section: string) => void;
  revert: () => void;
  /** Saves the active save; resolves to how it was saved, or null if it couldn't be. */
  save: (options?: { download?: boolean }) => Promise<SaveResult | null>;
  reload: () => Promise<void>;
  /** Loads a backup into the active save as unsaved changes. Never writes to disk. */
  restoreBackup: (id: string) => Promise<boolean>;
}

const STORAGE_KEY = 'fairysave:v2';

async function decodeSaveText(text: string): Promise<JsonObject> {
  const trimmed = text.trim();
  // Accept plain JSON too, handy for pasting a decrypted save back in.
  if (trimmed.startsWith('{')) return parseSaveJson(trimmed);
  return parseSaveJson(await decryptSave(decodeBase64(trimmed)));
}

/** A dropped or picked file: a save (encrypted or plain JSON), or a settings .reg export. */
async function readFile(file: File): Promise<{ kind: SaveKind; data: JsonObject; registry?: SaveDoc['registry'] }> {
  const text = decodeRegBytes(await file.arrayBuffer());
  if (!looksLikeRegExport(text)) {
    const data = await decodeSaveText(text);
    return { kind: detectSaveKind(data), data };
  }
  const entries = parseRegExport(text);
  const data: JsonObject = {};
  const registry: NonNullable<SaveDoc['registry']> = {};
  for (const [name, entry] of Object.entries(entries)) {
    // Unity's anonymous IDs and session counters: not settings, so never kept, shown or stored.
    if (isHiddenSetting(name)) continue;
    data[name] = entry.value;
    registry[name] = { regName: entry.regName, type: entry.type };
  }
  return { kind: 'settings', data, registry };
}

/**
 * The .reg to double-click: just the changed values, or (with nothing changed)
 * every value, so it's a full copy. Unity's own entries are never included.
 */
export function settingsRegFile(doc: Pick<SaveDoc, 'data' | 'original' | 'registry'>): Uint8Array<ArrayBuffer> {
  const keys = [...new Set([...Object.keys(doc.original), ...Object.keys(doc.data)])].filter((key) => !isHiddenSetting(key));
  const changed = keys.filter((key) => JSON.stringify(doc.data[key]) !== JSON.stringify(doc.original[key]));
  // Only values the registry can hold: a number or text (or deleted). Anything else typed into the JSON view is skipped.
  const writable = (key: string) => {
    const value = doc.data[key];
    return value === undefined || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
  };
  const entries = (changed.length ? changed : keys.filter((key) => key in doc.data)).filter(writable).map((key) => {
    const known = doc.registry?.[key];
    const value = doc.data[key];
    const type: RegType =
      known?.type ?? findSetting(key)?.type ?? (typeof value === 'string' ? 'string' : Number.isInteger(value) ? 'dword' : 'double');
    return { regName: known?.regName ?? regNameFor(key), type, value: value === undefined ? null : (value as number | string) };
  });
  return buildRegFile(entries) as Uint8Array<ArrayBuffer>;
}

/** "ff-settings.reg" -> "ff-settings.reg"; anything else gets a .reg ending. */
export const regFileName = (fileName: string) => `${fileName.replace(/\.[^.]+$/, '')}.reg`;

async function encodeSave(data: JsonObject): Promise<string> {
  return encodeBase64(await encryptSave(serializeSaveJson(data)));
}

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

function mutateActive(state: EditorState, update: (doc: SaveDoc) => SaveDoc): Partial<EditorState> {
  return { docs: state.docs.map((doc) => (doc.id === state.activeId ? update(doc) : doc)) };
}

export const useEditor = create<EditorState>((set, get) => ({
  docs: [],
  activeId: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    let docs: SaveDoc[] = [];
    let activeId: string | null = null;
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as {
        docs: Omit<SaveDoc, 'handle' | 'access'>[];
        activeId: string | null;
      } | null;
      if (stored?.docs?.length) {
        docs = stored.docs.map((doc) => ({ ...doc, handle: null, access: 'none' as FileAccess }));
        activeId = stored.activeId ?? docs[0].id;
      }
    } catch {
      /* corrupt storage; start fresh */
    }
    set({ docs, activeId, hydrated: true });

    // Reattach file handles so "Save" can write in place again.
    const restored = await Promise.all(
      docs.map(async (doc) => {
        try {
          const handle = await getFileHandle(doc.id);
          return handle ? { ...doc, handle, access: await queryAccess(handle) } : doc;
        } catch {
          return doc;
        }
      }),
    );
    set((state) => ({
      docs: state.docs.map((doc) => restored.find((entry) => entry.id === doc.id) ?? doc),
    }));
  },

  openFiles: async (files) => {
    let lastId: string | null = null;
    for (const { file, handle } of files) {
      try {
        const { kind, data, registry } = await readFile(file);

        // Re-opening the same file replaces it instead of duplicating it.
        const existing = await (async () => {
          for (const doc of get().docs) {
            if (handle && doc.handle && (await doc.handle.isSameEntry(handle))) return doc;
          }
          return null;
        })();

        const doc: SaveDoc = {
          id: existing?.id ?? crypto.randomUUID(),
          fileName: file.name,
          kind,
          data,
          original: data,
          handle,
          access: await queryAccess(handle),
          registry,
          view: kind === 'json' ? 'json' : 'guided',
          section: null,
          openedAt: Date.now(),
        };
        if (handle) await saveFileHandle(doc.id, handle).catch(() => undefined);
        set((state) => ({
          docs: existing ? state.docs.map((entry) => (entry.id === doc.id ? doc : entry)) : [...state.docs, doc],
        }));
        lastId = doc.id;
      } catch (error) {
        toast.error(`Couldn't open ${file.name}`, {
          description: errorMessage(error, 'The file is not a Forsaken Frontiers save or settings export.'),
        });
      }
    }
    if (lastId) set({ activeId: lastId });
  },

  activate: (id) => set({ activeId: id }),

  close: (id) =>
    set((state) => {
      const target = id ?? state.activeId;
      if (!target) return {};
      void deleteFileHandle(target).catch(() => undefined);
      const index = state.docs.findIndex((doc) => doc.id === target);
      const docs = state.docs.filter((doc) => doc.id !== target);
      const activeId =
        state.activeId === target ? (docs[Math.min(index, docs.length - 1)]?.id ?? null) : state.activeId;
      return { docs, activeId };
    }),

  setField: (key, value) =>
    set((state) =>
      mutateActive(state, (doc) => {
        const data = { ...doc.data };
        if (value === undefined) delete data[key];
        else data[key] = value;
        return { ...doc, data };
      }),
    ),

  replaceData: (data) =>
    set((state) => mutateActive(state, (doc) => ({ ...doc, data, kind: doc.kind === 'settings' ? 'settings' : detectSaveKind(data) }))),

  setView: (view) => set((state) => mutateActive(state, (doc) => ({ ...doc, view }))),

  setSection: (section) => set((state) => mutateActive(state, (doc) => ({ ...doc, section, view: 'guided' }))),

  revert: () => set((state) => mutateActive(state, (doc) => ({ ...doc, data: doc.original }))),

  save: async (options) => {
    const doc = get().docs.find((entry) => entry.id === get().activeId);
    if (!doc) return null;

    const markSaved = (access: FileAccess, savedAs: SaveResult) =>
      set((state) => ({
        docs: state.docs.map((entry) => (entry.id === doc.id ? { ...entry, original: entry.data, access, savedAs } : entry)),
      }));

    // A browser can't write to the registry: settings always come out as a .reg to double-click.
    if (doc.kind === 'settings') {
      const name = regFileName(doc.fileName);
      downloadText(name, settingsRegFile(doc));
      markSaved(doc.access, 'download');
      toast.success(`Downloaded ${name}`, { description: 'Close the game, then double-click it to apply.' });
      return 'download';
    }

    let encoded: string;
    try {
      encoded = await encodeSave(doc.data);
    } catch (error) {
      toast.error('Could not encrypt save', { description: errorMessage(error, 'Unknown error') });
      return null;
    }

    if (doc.handle && !options?.download) {
      const access = await requestWriteAccess(doc.handle);
      if (access === 'granted' || access === 'unsupported') {
        try {
          // Keep what's on disk now, so a bad edit can be undone with `restore`.
          try {
            await addBackup(doc.fileName, await (await doc.handle.getFile()).text());
          } catch {
            /* a failed backup must not block saving */
          }
          await writeText(doc.handle, encoded);
          markSaved(access, 'file');
          toast.success(`Saved ${doc.fileName}`, { description: 'Written back to the original file.' });
          return 'file';
        } catch (error) {
          toast.error('Could not write to the file', {
            description: `${errorMessage(error, 'Write failed')}. Downloading a copy instead.`,
          });
        }
      } else {
        toast.message('Write permission denied', { description: 'Downloading a copy instead.' });
      }
    }

    downloadText(doc.fileName, encoded);
    markSaved(doc.access, 'download');
    toast.success(`Downloaded ${doc.fileName}`, {
      description: 'Replace the file in your save folder with this one.',
    });
    return 'download';
  },

  reload: async () => {
    const doc = get().docs.find((entry) => entry.id === get().activeId);
    if (!doc?.handle) return;
    try {
      const { kind, data, registry } = await readFile(await doc.handle.getFile());
      set((state) => ({
        docs: state.docs.map((entry) => (entry.id === doc.id ? { ...entry, data, original: data, kind, registry } : entry)),
      }));
      toast.success('Reloaded from disk');
    } catch (error) {
      toast.error('Reload failed', { description: errorMessage(error, 'Could not read the file') });
    }
  },

  restoreBackup: async (id) => {
    const backup = await getBackup(id);
    if (!backup) {
      toast.error('Backup not found');
      return false;
    }
    try {
      get().replaceData(await decodeSaveText(backup.text));
      return true;
    } catch (error) {
      toast.error('Could not read that backup', { description: errorMessage(error, 'Unknown error') });
      return false;
    }
  },
}));

/* Persist open documents (without file handles, which live in IndexedDB). */
if (typeof window !== 'undefined') {
  let timer: number | undefined;
  // Warn once when storage stops working, again only after it has recovered.
  let persistFailed = false;
  useEditor.subscribe((state) => {
    if (!state.hydrated) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            activeId: state.activeId,
            docs: state.docs.map(({ handle: _handle, access: _access, ...doc }) => doc),
          }),
        );
        persistFailed = false;
      } catch {
        // Storage full or blocked. Editing still works, but a reload would lose it.
        if (!persistFailed) {
          toast.warning("Couldn't keep your open saves for next time", {
            description: 'Browser storage is full or blocked. Save or download before closing this tab.',
          });
        }
        persistFailed = true;
      }
    }, 250);
  });
}

export function useActiveDoc() {
  return useEditor((state) => state.docs.find((doc) => doc.id === state.activeId) ?? null);
}

export function docChanges(doc: SaveDoc | null) {
  return doc ? countChanges(doc.original, doc.data) : 0;
}

/** Close a save, asking first if it has unsaved changes. Returns whether it closed. */
export function closeWithConfirm(id?: string): boolean {
  const state = useEditor.getState();
  const doc = state.docs.find((d) => d.id === (id ?? state.activeId));
  if (!doc) return false;
  const changes = docChanges(doc);
  if (changes > 0 && !window.confirm(`${doc.fileName} has ${changes} unsaved change${changes === 1 ? '' : 's'}. Close anyway?`)) {
    return false;
  }
  state.close(doc.id);
  return true;
}
