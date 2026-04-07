'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import { decodeBase64, decryptSave, encodeBase64, encryptSave, formatSaveJson, parseSaveJson, serializeSaveJson } from '@/src/crypto';
import { detectSection } from '@/src/editor';
import type { JsonObject } from '@/src/types';
import {
  EditorSection,
  FileAccessStatus,
  FileStatus,
  TabKind,
  type EditorTab,
  type PlayerData,
  type WorldData,
} from './types';
import { deleteFileHandle, getFileHandle, saveFileHandle } from './file-handle-store';

const STORAGE_KEY = 'fairysavetool-tabs-state';

type OpenFilePickerWindow = Window &
  typeof globalThis & {
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      excludeAcceptAllOption?: boolean;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle[]>;
  };

type PermissionedFileHandle = FileSystemFileHandle & {
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

function mapPermissionState(permission: PermissionState): FileAccessStatus {
  switch (permission) {
    case 'granted':
      return FileAccessStatus.Granted;
    case 'prompt':
      return FileAccessStatus.Prompt;
    case 'denied':
      return FileAccessStatus.Denied;
  }
}

function createEmptyTab(): EditorTab {
  return {
    id: crypto.randomUUID(),
    title: 'New Tab',
    kind: TabKind.Empty,
    fileName: null,
    fileHandle: null,
    fileAccessStatus: FileAccessStatus.None,
    fileStatus: FileStatus.Empty,
    lastAction: null,
    playerData: null,
    worldData: null,
    rawJson: '',
    jsonMode: false,
    isModified: false,
  };
}

function deriveTabKind(playerData: PlayerData | null, worldData: WorldData | null, rawJson: string): TabKind {
  if (playerData) {
    return TabKind.Player;
  }

  if (worldData) {
    return TabKind.World;
  }

  if (rawJson.trim()) {
    return TabKind.Json;
  }

  return TabKind.Empty;
}

function deriveTabTitle(tab: Pick<EditorTab, 'kind' | 'fileName' | 'playerData' | 'worldData'>): string {
  if (tab.fileName) {
    return tab.fileName;
  }

  if (tab.kind === TabKind.Player) {
    return tab.playerData?.characterName || 'Player Save';
  }

  if (tab.kind === TabKind.World) {
    return tab.worldData?.worldData?.uiName || 'World Save';
  }

  if (tab.kind === TabKind.Json) {
    return 'JSON';
  }

  return 'New Tab';
}

function syncTab(tab: EditorTab): EditorTab {
  const kind = deriveTabKind(tab.playerData, tab.worldData, tab.rawJson);
  return {
    ...tab,
    kind,
    title: deriveTabTitle({ ...tab, kind }),
  };
}

function updateTab(tabs: EditorTab[], id: string, updater: (tab: EditorTab) => EditorTab): EditorTab[] {
  return tabs.map((tab) => (tab.id === id ? syncTab(updater(tab)) : tab));
}

function getSaveFileName(tab: EditorTab) {
  return tab.fileName ?? `${tab.title}.fs`;
}

function getRestoredFileAction(previousAction: string | null, fileAccessStatus: FileAccessStatus) {
  if (previousAction) {
    return previousAction;
  }

  return fileAccessStatus === FileAccessStatus.Granted
    ? 'Restored direct file access'
    : 'File access needs to be reconnected';
}

async function getFileAccessStatus(handle: FileSystemFileHandle | null | undefined): Promise<FileAccessStatus> {
  if (!handle) {
    return FileAccessStatus.None;
  }

  const permissionedHandle = handle as PermissionedFileHandle;
  if (typeof permissionedHandle.queryPermission !== 'function') {
    return FileAccessStatus.Unsupported;
  }

  try {
    const permission = await permissionedHandle.queryPermission({ mode: 'readwrite' });
    return mapPermissionState(permission);
  } catch {
    return FileAccessStatus.Prompt;
  }

  return FileAccessStatus.Prompt;
}

async function requestFileWriteAccess(handle: FileSystemFileHandle | null | undefined): Promise<FileAccessStatus> {
  if (!handle) {
    return FileAccessStatus.None;
  }

  const currentStatus = await getFileAccessStatus(handle);
  if (
    currentStatus === FileAccessStatus.Granted ||
    currentStatus === FileAccessStatus.Unsupported ||
    currentStatus === FileAccessStatus.None
  ) {
    return currentStatus;
  }

  const permissionedHandle = handle as PermissionedFileHandle;
  if (typeof permissionedHandle.requestPermission !== 'function') {
    return FileAccessStatus.Unsupported;
  }

  try {
    const permission = await permissionedHandle.requestPermission({ mode: 'readwrite' });
    return mapPermissionState(permission);
  } catch {
    return FileAccessStatus.Denied;
  }

  return FileAccessStatus.Denied;
}

async function ensureDirectSaveAccess(handle: FileSystemFileHandle | null | undefined): Promise<FileAccessStatus> {
  if (!handle) {
    return FileAccessStatus.None;
  }

  const requestedStatus = await requestFileWriteAccess(handle);
  if (
    requestedStatus === FileAccessStatus.Granted ||
    requestedStatus === FileAccessStatus.Unsupported ||
    requestedStatus === FileAccessStatus.None
  ) {
    return requestedStatus;
  }

  try {
    const writable = await handle.createWritable();
    await writable.close();
    return await getFileAccessStatus(handle);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return FileAccessStatus.Denied;
    }

    return FileAccessStatus.Denied;
  }
}

async function openSaveFileWithPicker() {
  const pickerWindow = window as OpenFilePickerWindow;
  if (!pickerWindow.showOpenFilePicker) {
    return null;
  }

  const [handle] = await pickerWindow.showOpenFilePicker({
    multiple: false,
    excludeAcceptAllOption: false,
    types: [
      {
        description: 'Forsaken Frontiers save',
        accept: {
          'text/plain': ['.fs', '.txt'],
          'application/octet-stream': ['.fs'],
        },
      },
    ],
  });

  if (!handle) {
    return null;
  }

  const file = await handle.getFile();
  return { file, handle };
}

function openSaveFileWithInput(): Promise<{ file: File; handle: null } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.fs,.txt';
    input.onchange = () => {
      const file = input.files?.item(0);
      resolve(file ? { file, handle: null } : null);
    };
    input.click();
  });
}

async function pickSaveFile() {
  try {
    const picked = await openSaveFileWithPicker();
    if (picked) {
      return picked;
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      throw error;
    }
    return null;
  }

  return openSaveFileWithInput();
}

interface EditorStore {
  tabs: EditorTab[];
  activeTabId: string;
  newTab: () => void;
  closeTab: (id?: string) => void;
  activateTab: (id: string) => void;
  setLastAction: (action: string | null) => void;
  updatePlayerField: <K extends keyof PlayerData>(field: K, value: PlayerData[K]) => void;
  updateWorldField: <K extends keyof WorldData>(field: K, value: WorldData[K]) => void;
  setJsonMode: (enabled: boolean) => void;
  setRawJson: (json: string) => void;
  loadSampleData: (options?: { requestWriteAccess?: boolean }) => void;
  reconnectActiveFile: () => void;
  refreshActiveFile: () => Promise<void>;
  clearData: () => void;
  downloadFile: () => Promise<void>;
}

const initialTab = createEmptyTab();

export const useEditorStore = create<EditorStore>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,

  newTab: () =>
    set((state) => {
      const tab = createEmptyTab();
      return {
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      };
    }),

  closeTab: (id) =>
    set((state) => {
      const targetId = id ?? state.activeTabId;
      void deleteFileHandle(targetId);
      const nextTabs = state.tabs.filter((tab) => tab.id !== targetId);

      if (nextTabs.length === 0) {
        const emptyTab = createEmptyTab();
        return {
          tabs: [emptyTab],
          activeTabId: emptyTab.id,
        };
      }

      return {
        tabs: nextTabs,
        activeTabId: state.activeTabId === targetId ? nextTabs[Math.max(0, nextTabs.length - 1)].id : state.activeTabId,
      };
    }),

  activateTab: (id) => set({ activeTabId: id }),

  setLastAction: (action) =>
    set((state) => ({
      tabs: updateTab(state.tabs, state.activeTabId, (tab) => ({ ...tab, lastAction: action })),
    })),

  updatePlayerField: (field, value) =>
    set((state) => ({
      tabs: updateTab(state.tabs, state.activeTabId, (tab) => {
        const nextPlayer = tab.playerData ? { ...tab.playerData, [field]: value } : null;
        return {
          ...tab,
          playerData: nextPlayer,
          worldData: null,
          rawJson: nextPlayer ? JSON.stringify(nextPlayer, null, 2) : tab.rawJson,
          isModified: true,
          fileStatus: FileStatus.Modified,
          lastAction: `Updated ${String(field)}`,
        };
      }),
    })),

  updateWorldField: (field, value) =>
    set((state) => ({
      tabs: updateTab(state.tabs, state.activeTabId, (tab) => {
        const nextWorld = tab.worldData ? { ...tab.worldData, [field]: value } : null;
        return {
          ...tab,
          worldData: nextWorld,
          playerData: null,
          rawJson: nextWorld ? JSON.stringify(nextWorld, null, 2) : tab.rawJson,
          isModified: true,
          fileStatus: FileStatus.Modified,
          lastAction: `Updated ${String(field)}`,
        };
      }),
    })),

  setJsonMode: (enabled) =>
    set((state) => ({
      tabs: updateTab(state.tabs, state.activeTabId, (tab) => ({ ...tab, jsonMode: enabled })),
    })),

  setRawJson: (json) =>
    set((state) => {
      return {
        tabs: updateTab(state.tabs, state.activeTabId, (tab) => {
          const nextTab: EditorTab = {
            ...tab,
            rawJson: json,
          };

          if (!json.trim()) {
            return {
              ...nextTab,
              playerData: null,
              worldData: null,
              fileStatus: FileStatus.Empty,
              isModified: false,
              lastAction: 'Cleared JSON content',
            };
          }

          try {
            const parsed = parseSaveJson(json);
            const section = detectSection(parsed);

            if (section === EditorSection.Player) {
              return {
                ...nextTab,
                playerData: parsed as unknown as PlayerData,
                worldData: null,
                fileStatus: FileStatus.Modified,
                isModified: true,
                lastAction: 'Updated player save from JSON',
              };
            }

            if (section === EditorSection.World) {
              return {
                ...nextTab,
                worldData: parsed as unknown as WorldData,
                playerData: null,
                fileStatus: FileStatus.Modified,
                isModified: true,
                lastAction: 'Updated world save from JSON',
              };
            }

            return {
              ...nextTab,
              playerData: null,
              worldData: null,
              fileStatus: FileStatus.Modified,
              isModified: true,
              lastAction: 'Updated JSON save',
            };
          } catch {
            return {
              ...nextTab,
              fileStatus: FileStatus.Error,
              lastAction: 'JSON contains syntax errors',
            };
          }
        }),
      };
    }),

  loadSampleData: (options) => {
    void (async () => {
      const picked = await pickSaveFile();
      if (!picked) {
        return;
      }

      const { file, handle } = picked;
      let fileAccessStatus = await getFileAccessStatus(handle);
      if (options?.requestWriteAccess && handle) {
        fileAccessStatus = await ensureDirectSaveAccess(handle);
      }

      try {
        const rawInput = await file.text();
        const bytes = decodeBase64(rawInput);
        const decryptedText = await decryptSave(bytes);
        const parsed = parseSaveJson(decryptedText);
        const section = detectSection(parsed);

        set((state) => ({
          tabs: updateTab(state.tabs, state.activeTabId, (tab) => {
            if (section === EditorSection.Player) {
              return {
                ...tab,
                fileName: file.name,
                fileHandle: handle,
                fileAccessStatus,
                fileStatus: FileStatus.Decrypted,
                playerData: parsed as unknown as PlayerData,
                worldData: null,
                rawJson: formatSaveJson(parsed as JsonObject),
                lastAction: handle ? 'Opened and decrypted player save' : 'Loaded and decrypted player save',
                jsonMode: false,
                isModified: false,
              };
            }

            if (section === EditorSection.World) {
              return {
                ...tab,
                fileName: file.name,
                fileHandle: handle,
                fileAccessStatus,
                fileStatus: FileStatus.Decrypted,
                playerData: null,
                worldData: parsed as unknown as WorldData,
                rawJson: formatSaveJson(parsed as JsonObject),
                lastAction: handle ? 'Opened and decrypted world save' : 'Loaded and decrypted world save',
                jsonMode: false,
                isModified: false,
              };
            }

              return {
                ...tab,
                fileName: file.name,
                fileHandle: handle,
                fileAccessStatus,
                fileStatus: FileStatus.Decrypted,
                playerData: null,
                worldData: null,
                rawJson: formatSaveJson(parsed as JsonObject),
              lastAction: handle ? 'Opened JSON save data' : 'Loaded JSON save data',
              jsonMode: true,
              isModified: false,
            };
          }),
        }));
        if (handle) {
          await saveFileHandle(get().activeTabId, handle);
        }
      } catch (error) {
        set((state) => ({
          tabs: updateTab(state.tabs, state.activeTabId, (tab) => ({
            ...tab,
            fileName: file.name,
            fileHandle: handle,
            fileAccessStatus,
            fileStatus: FileStatus.Error,
            lastAction: error instanceof Error ? error.message : 'Failed to load save file',
          })),
        }));
      }
    })();
  },

  reconnectActiveFile: () => {
    get().loadSampleData({ requestWriteAccess: true });
  },

  refreshActiveFile: async () => {
    const state = get();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);

    if (!activeTab?.fileHandle) {
      set((current) => ({
        tabs: updateTab(current.tabs, current.activeTabId, (tab) => ({
          ...tab,
          fileStatus: FileStatus.Error,
          lastAction: 'No linked file available to refresh',
        })),
      }));
      toast.error('Refresh unavailable', {
        description: 'This tab is not currently linked to a local file.',
      });
      return;
    }

    try {
      const file = await activeTab.fileHandle.getFile();
      const rawInput = await file.text();
      const bytes = decodeBase64(rawInput);
      const decryptedText = await decryptSave(bytes);
      const parsed = parseSaveJson(decryptedText);
      const section = detectSection(parsed);
      const fileAccessStatus = await getFileAccessStatus(activeTab.fileHandle);

      set((current) => ({
        tabs: updateTab(current.tabs, current.activeTabId, (tab) => {
          if (section === EditorSection.Player) {
            return {
              ...tab,
              fileName: file.name,
              fileHandle: activeTab.fileHandle,
              fileAccessStatus,
              fileStatus: FileStatus.Decrypted,
              playerData: parsed as unknown as PlayerData,
              worldData: null,
              rawJson: formatSaveJson(parsed as JsonObject),
              lastAction: `Refreshed from ${file.name}`,
              jsonMode: false,
              isModified: false,
            };
          }

          if (section === EditorSection.World) {
            return {
              ...tab,
              fileName: file.name,
              fileHandle: activeTab.fileHandle,
              fileAccessStatus,
              fileStatus: FileStatus.Decrypted,
              playerData: null,
              worldData: parsed as unknown as WorldData,
              rawJson: formatSaveJson(parsed as JsonObject),
              lastAction: `Refreshed from ${file.name}`,
              jsonMode: false,
              isModified: false,
            };
          }

          return {
            ...tab,
            fileName: file.name,
            fileHandle: activeTab.fileHandle,
            fileAccessStatus,
            fileStatus: FileStatus.Decrypted,
            playerData: null,
            worldData: null,
            rawJson: formatSaveJson(parsed as JsonObject),
            lastAction: `Refreshed from ${file.name}`,
            jsonMode: true,
            isModified: false,
          };
        }),
      }));

      toast.success('Reloaded from disk', {
        description: `${file.name} was re-read from your local file.`,
      });
    } catch (error) {
      set((current) => ({
        tabs: updateTab(current.tabs, current.activeTabId, (tab) => ({
          ...tab,
          fileStatus: FileStatus.Error,
          lastAction: error instanceof Error ? error.message : 'Failed to refresh file',
        })),
      }));
      toast.error('Refresh failed', {
        description: error instanceof Error ? error.message : 'Failed to refresh file',
      });
    }
  },

  clearData: () =>
    set((state) => {
      void deleteFileHandle(state.activeTabId);
      return {
        tabs: updateTab(state.tabs, state.activeTabId, () => ({
          ...createEmptyTab(),
          id: state.activeTabId,
          lastAction: 'Closed file',
        })),
      };
    }),

  downloadFile: async () => {
    const state = get();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);

    if (!activeTab) {
      return;
    }

    const payload = activeTab.playerData ?? activeTab.worldData;
    if (!payload) {
      set({
        tabs: updateTab(state.tabs, state.activeTabId, (tab) => ({
          ...tab,
          fileStatus: FileStatus.Error,
          lastAction: 'No save data available to export',
        })),
      });
      return;
    }

    try {
      const minified = serializeSaveJson(payload as unknown as JsonObject);
      const encryptedBytes = await encryptSave(minified);
      const base64 = encodeBase64(encryptedBytes);
      const fileName = getSaveFileName(activeTab);

      if (activeTab.fileHandle) {
        const accessStatus = await requestFileWriteAccess(activeTab.fileHandle);

        if (accessStatus === FileAccessStatus.Granted || accessStatus === FileAccessStatus.Unsupported) {
          const writable = await activeTab.fileHandle.createWritable();
          await writable.write(base64);
          await writable.close();

        set((current) => ({
          tabs: updateTab(current.tabs, current.activeTabId, (tab) => ({
            ...tab,
            fileAccessStatus: accessStatus,
            lastAction: `Saved ${fileName}`,
            isModified: false,
            fileStatus: FileStatus.Ready,
          })),
        }));
        toast.success('Saved to original file', {
          description: `${fileName} was written back in place.`,
        });
        return;
      }

      set((current) => ({
          tabs: updateTab(current.tabs, current.activeTabId, (tab) => ({
            ...tab,
            fileAccessStatus: accessStatus,
            fileStatus: FileStatus.Error,
            lastAction: 'Direct save permission was denied',
          })),
        }));
        toast.error('Direct save permission denied', {
          description: 'The browser did not allow writing back to the original file.',
        });
        return;
      }

      const blob = new Blob([base64], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      set((current) => ({
        tabs: updateTab(current.tabs, current.activeTabId, (tab) => ({
          ...tab,
          fileAccessStatus: tab.fileAccessStatus,
          lastAction: `Downloaded ${fileName}`,
          isModified: false,
          fileStatus: FileStatus.Ready,
        })),
      }));
      toast.success('Exported save file', {
        description: `${fileName} was downloaded to your browser's save location.`,
      });
    } catch (error) {
      set((current) => ({
        tabs: updateTab(current.tabs, current.activeTabId, (tab) => ({
          ...tab,
          fileStatus: FileStatus.Error,
          lastAction: error instanceof Error ? error.message : 'Failed to export save',
        })),
      }));
      toast.error('Save failed', {
        description: error instanceof Error ? error.message : 'Failed to export save',
      });
    }
  },
}));

if (typeof window !== 'undefined') {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { tabs?: EditorTab[]; activeTabId?: string };
      if (parsed.tabs && parsed.tabs.length > 0 && parsed.activeTabId) {
        useEditorStore.setState({
          tabs: parsed.tabs.map((tab) =>
            syncTab({
              ...tab,
              fileHandle: null,
              fileAccessStatus: FileAccessStatus.None,
            }),
          ),
          activeTabId: parsed.activeTabId,
        });
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  useEditorStore.subscribe((state) => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tabs: state.tabs.map((tab) => ({
          ...tab,
          fileHandle: null,
          fileAccessStatus: FileAccessStatus.None,
        })),
        activeTabId: state.activeTabId,
      }),
    );
  });

  void (async () => {
    const current = useEditorStore.getState();
    const restoredTabs = await Promise.all(
      current.tabs.map(async (tab) => {
        try {
          const handle = await getFileHandle(tab.id);
          if (!handle) {
            return tab;
          }

          const fileAccessStatus = await getFileAccessStatus(handle);
          return syncTab({
            ...tab,
            fileHandle: handle,
            fileAccessStatus,
            lastAction: getRestoredFileAction(tab.lastAction, fileAccessStatus),
          });
        } catch {
          return syncTab({
            ...tab,
            fileHandle: null,
            fileAccessStatus: FileAccessStatus.None,
          });
        }
      }),
    );

    useEditorStore.setState({
      tabs: restoredTabs,
    });
  })();
}
