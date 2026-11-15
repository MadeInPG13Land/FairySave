/**
 * Browser file plumbing. Chromium browsers expose the File System Access API,
 * which lets us write a save back in place; everywhere else we fall back to a
 * plain <input type=file> and a download.
 */

export type FileAccess = 'none' | 'prompt' | 'granted' | 'denied' | 'unsupported';

type PermissionMode = { mode: 'read' | 'readwrite' };
type PermissionedHandle = FileSystemFileHandle & {
  queryPermission?: (descriptor: PermissionMode) => Promise<PermissionState>;
  requestPermission?: (descriptor: PermissionMode) => Promise<PermissionState>;
};
type PickerWindow = Window & {
  showOpenFilePicker?: (options: {
    multiple?: boolean;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle[]>;
};

export const SAVE_FOLDER = '%USERPROFILE%\\AppData\\LocalLow\\made in fairyland\\Forsaken Frontiers';

export function supportsInPlaceSave() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

export async function queryAccess(handle: FileSystemFileHandle | null): Promise<FileAccess> {
  if (!handle) return 'none';
  const permissioned = handle as PermissionedHandle;
  if (typeof permissioned.queryPermission !== 'function') return 'unsupported';
  try {
    return (await permissioned.queryPermission({ mode: 'readwrite' })) as FileAccess;
  } catch {
    return 'prompt';
  }
}

/** Must be called from a user gesture (click / key press). */
export async function requestWriteAccess(handle: FileSystemFileHandle): Promise<FileAccess> {
  const current = await queryAccess(handle);
  if (current === 'granted' || current === 'unsupported') return current;
  const permissioned = handle as PermissionedHandle;
  if (typeof permissioned.requestPermission !== 'function') return 'unsupported';
  try {
    return (await permissioned.requestPermission({ mode: 'readwrite' })) as FileAccess;
  } catch {
    return 'denied';
  }
}

export interface PickedFile {
  file: File;
  handle: FileSystemFileHandle | null;
}

function pickWithInput(): Promise<PickedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.fs,.bak,.txt,.reg';
    input.multiple = true;
    input.onchange = () => resolve(Array.from(input.files ?? []).map((file) => ({ file, handle: null })));
    input.oncancel = () => resolve([]);
    input.click();
  });
}

export async function pickSaveFiles(): Promise<PickedFile[]> {
  const pickerWindow = window as PickerWindow;
  if (!pickerWindow.showOpenFilePicker) return pickWithInput();
  try {
    const handles = await pickerWindow.showOpenFilePicker({
      multiple: true,
      types: [
        {
          description: 'Forsaken Frontiers save or settings export',
          accept: { 'application/octet-stream': ['.fs', '.bak', '.reg'], 'text/plain': ['.txt'] },
        },
      ],
    });
    return Promise.all(handles.map(async (handle) => ({ file: await handle.getFile(), handle })));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return [];
    return pickWithInput();
  }
}

/** Files from a drop event, with handles when the browser provides them. */
export async function filesFromDrop(dataTransfer: DataTransfer): Promise<PickedFile[]> {
  const items = Array.from(dataTransfer.items).filter((item) => item.kind === 'file');
  const results = await Promise.all(
    items.map(async (item): Promise<PickedFile | null> => {
      const withHandle = item as DataTransferItem & {
        getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
      };
      // getAsFile must be called synchronously-ish before the event is recycled.
      const file = item.getAsFile();
      try {
        const handle = await withHandle.getAsFileSystemHandle?.();
        if (handle && handle.kind === 'file') {
          const fileHandle = handle as FileSystemFileHandle;
          return { file: await fileHandle.getFile(), handle: fileHandle };
        }
      } catch {
        /* fall through to the plain file */
      }
      return file ? { file, handle: null } : null;
    }),
  );
  return results.filter((entry): entry is PickedFile => entry !== null);
}

export async function writeText(handle: FileSystemFileHandle, text: string) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export function downloadText(fileName: string, text: string | Uint8Array<ArrayBuffer>) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
