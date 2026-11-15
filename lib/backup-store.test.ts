import { describe, expect, it } from 'vitest';
import { listBackups, pruneBackups, type Backup } from './backup-store';

const backup = (fileName: string, savedAt: number): Backup => ({ id: `${fileName}-${savedAt}`, fileName, text: '', savedAt });

describe('backup pruning', () => {
  it('keeps the newest five of a file', () => {
    const list = [1, 2, 3, 4, 5, 6, 7].map((t) => backup('a', t));
    expect(pruneBackups(list).map((b) => b.savedAt).sort()).toEqual([1, 2]);
  });

  it('prunes each file on its own', () => {
    const list = [...[1, 2, 3, 4, 5, 6].map((t) => backup('a', t)), backup('b', 1), backup('b', 2)];
    expect(pruneBackups(list).map((b) => b.id)).toEqual(['a-1']);
  });

  it('deletes nothing under the limit', () => {
    expect(pruneBackups([backup('a', 1), backup('a', 2)])).toEqual([]);
  });

  it('lists nothing when IndexedDB is unavailable', async () => {
    await expect(listBackups('x')).resolves.toEqual([]);
  });
});
