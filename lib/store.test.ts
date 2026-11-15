import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeBase64, encryptSave, serializeSaveJson } from './crypto';
import type { JsonObject } from './save';
import { closeWithConfirm, settingsRegFile, useEditor } from './store';
import { buildRegFile, decodeRegBytes } from './registry';
import { downloadText } from './file-access';
import { toast } from 'sonner';

vi.mock('./file-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./file-access')>()),
  downloadText: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), message: vi.fn(), warning: vi.fn() }),
}));

async function encrypted(data: JsonObject) {
  return encodeBase64(await encryptSave(serializeSaveJson(data)));
}
const picked = (text: string | Uint8Array, name = 'fairy engine save_1.fs', handle: FileSystemFileHandle | null = null) => ({
  // jsdom's File can't read itself, so hand the store a minimal stand-in.
  file: {
    name,
    arrayBuffer: async () => {
      const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  } as unknown as File,
  handle,
});
const active = () => useEditor.getState().docs.find((d) => d.id === useEditor.getState().activeId)!;

beforeEach(() => {
  useEditor.setState({ docs: [], activeId: null, hydrated: true });
  vi.clearAllMocks();
});

describe('editor store', () => {
  it('opens an encrypted world save', async () => {
    await useEditor.getState().openFiles([picked(await encrypted({ credits: 1, trainItems: [] }))]);
    expect(useEditor.getState().docs).toHaveLength(1);
    expect(active().kind).toBe('world');
    expect(active().data.credits).toBe(1);
  });

  it('accepts plain JSON', async () => {
    await useEditor.getState().openFiles([picked('{"credits": 2, "trainItems": []}')]);
    expect(active().data.credits).toBe(2);
  });

  it('rejects files that are not saves', async () => {
    await useEditor.getState().openFiles([picked('not a save at all')]);
    expect(useEditor.getState().docs).toHaveLength(0);
    expect(toast.error).toHaveBeenCalled();
  });

  it('replaces a file that is opened again instead of duplicating it', async () => {
    const handle = { isSameEntry: async () => true } as unknown as FileSystemFileHandle;
    await useEditor.getState().openFiles([picked('{"credits": 1, "trainItems": []}', 'a.fs', handle)]);
    const id = active().id;
    await useEditor.getState().openFiles([picked('{"credits": 9, "trainItems": []}', 'a.fs', handle)]);
    expect(useEditor.getState().docs).toHaveLength(1);
    expect(active().id).toBe(id);
    expect(active().data.credits).toBe(9);
  });

  it('edits data but not the original, and deletes on undefined', async () => {
    await useEditor.getState().openFiles([picked('{"credits": 1, "trainItems": []}')]);
    useEditor.getState().setField('credits', 5);
    expect(active().data.credits).toBe(5);
    expect(active().original.credits).toBe(1);
    useEditor.getState().setField('credits', undefined);
    expect('credits' in active().data).toBe(false);
  });

  it('reverts to the original', async () => {
    await useEditor.getState().openFiles([picked('{"credits": 1, "trainItems": []}')]);
    useEditor.getState().setField('credits', 5);
    useEditor.getState().revert();
    expect(active().data.credits).toBe(1);
  });

  it('downloads when there is no file handle, then counts as saved', async () => {
    await useEditor.getState().openFiles([picked('{"credits": 1, "trainItems": []}')]);
    useEditor.getState().setField('credits', 5);
    // A download is only a copy; it's recorded as such so it isn't shown as written.
    await expect(useEditor.getState().save()).resolves.toBe('download');
    expect(active().savedAs).toBe('download');
    expect(downloadText).toHaveBeenCalledTimes(1);
    expect(vi.mocked(downloadText).mock.calls[0][0]).toBe('fairy engine save_1.fs');
    expect(active().original).toEqual(active().data);
  });

  it('closing the active save activates a neighbour, then nothing', async () => {
    await useEditor.getState().openFiles([picked('{"a": 1}', 'one.fs'), picked('{"b": 1}', 'two.fs')]);
    useEditor.getState().close();
    expect(useEditor.getState().docs).toHaveLength(1);
    expect(active().fileName).toBe('one.fs');
    useEditor.getState().close();
    expect(useEditor.getState().activeId).toBeNull();
  });

  it('asks before closing a save with unsaved changes', async () => {
    await useEditor.getState().openFiles([picked('{"credits": 1, "trainItems": []}')]);
    useEditor.getState().setField('credits', 5);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(closeWithConfirm()).toBe(false);
    expect(useEditor.getState().docs).toHaveLength(1);
    confirm.mockReturnValue(true);
    expect(closeWithConfirm()).toBe(true);
    expect(useEditor.getState().docs).toHaveLength(0);
    confirm.mockRestore();
  });
});

describe('keeping saves between visits', () => {
  it('warns once when browser storage is full', async () => {
    await useEditor.getState().openFiles([picked('{"credits": 1, "trainItems": []}')]);
    vi.useFakeTimers();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      useEditor.getState().setField('credits', 2);
      vi.advanceTimersByTime(300);
      useEditor.getState().setField('credits', 3);
      vi.advanceTimersByTime(300);
      expect(toast.warning).toHaveBeenCalledTimes(1);
    } finally {
      setItem.mockRestore();
      vi.useRealTimers();
    }
  });

  it('opens a settings .reg export and saves only the changes as a .reg', async () => {
    const reg = buildRegFile([
      { regName: 'FlavorIndex_h2996959227', type: 'dword', value: 11 },
      { regName: 'MasterVolume_h2602803985', type: 'double', value: 0.5 },
      { regName: 'unity.cloud_userid_h2665564582', type: 'string', value: 'abc' },
    ]);
    await useEditor.getState().openFiles([picked(reg, 'ff-settings.reg')]);
    expect(active().kind).toBe('settings');
    expect(active().data).toEqual({ FlavorIndex: 11, MasterVolume: 0.5 });

    useEditor.getState().setField('FlavorIndex', 3);
    const out = decodeRegBytes(settingsRegFile(active()).buffer);
    expect(out).toContain('"FlavorIndex_h2996959227"=dword:00000003');
    expect(out).not.toContain('MasterVolume');
    expect(out).not.toContain('unity.cloud_userid');

    expect(await useEditor.getState().save()).toBe('download');
    expect(vi.mocked(downloadText).mock.calls[0][0]).toBe('ff-settings.reg');
    expect(active().original.FlavorIndex).toBe(3);

    // A value the registry can't hold (typed into the JSON view) is never written.
    useEditor.getState().setField('MasterVolume', { oops: true });
    expect(decodeRegBytes(settingsRegFile(active()).buffer)).not.toContain('MasterVolume');
  });
});
