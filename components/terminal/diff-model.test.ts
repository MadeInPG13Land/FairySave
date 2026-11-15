import { describe, expect, it } from 'vitest';
import type { JsonObject } from '@/lib/save';
import { diffDoc } from './diff-model';

const flare = (fuel = 0) => ({ savedItemData: { itemDataName: 'Flare', itemName: 'flare' }, fuel });

describe('diffDoc', () => {
  it('lists plain field changes and undoes them', () => {
    const [field] = diffDoc({ credits: 100 }, { credits: 777 });
    expect(field.head).toMatchObject({ label: 'credits', detail: '100 -> 777' });
    expect(field.entries).toEqual([]);
    expect(field.head.undo(777)).toBe(100);
  });

  it('a field that did not exist before undoes to deleted', () => {
    const [field] = diffDoc({}, { extra: 1 });
    expect(field.head.undo(1)).toBeUndefined();
  });

  it('names removed cosmetics and puts one back on its own', () => {
    const original: JsonObject = { unlockedCosmetics: ['abandoned_pin', 'debt_pin', 'usa'] };
    const data: JsonObject = { unlockedCosmetics: ['usa'] };
    const [field] = diffDoc(original, data);
    expect(field.head.detail).toBe('3 entries -> 1 entry · 2 removed');
    expect(field.entries.map((e) => [e.kind, e.label])).toEqual([
      ['removed', 'Abandoned pin'],
      ['removed', 'Debt pin'],
    ]);
    expect(field.entries[1].undo(data.unlockedCosmetics)).toEqual(['usa', 'debt_pin']);
  });

  it('groups added repeats and undoes the group', () => {
    const before = [flare(1)];
    const after = [flare(1), flare(), flare()];
    const [field] = diffDoc({ trainItems: before }, { trainItems: after });
    expect(field.entries.map((e) => [e.kind, e.label])).toEqual([['added', 'Flare x2']]);
    expect(field.entries[0].undo(after)).toEqual(before);
  });

  it('shows an edited entry as a change and undoes just that edit', () => {
    const before = [{ itemName: 'medkit', salePercent: 20 }, { itemName: 'sledgehammer', salePercent: 10 }];
    const after = [{ itemName: 'medkit', salePercent: 60 }, { itemName: 'sledgehammer', salePercent: 10 }];
    const [field] = diffDoc({ saleItems: before }, { saleItems: after });
    expect(field.entries).toHaveLength(1);
    expect(field.entries[0]).toMatchObject({ kind: 'changed', detail: 'salePercent 20 -> 60' });
    expect(field.entries[0].undo(after)).toEqual(before);
  });

  it('undoes one field of an object at a time', () => {
    const [field] = diffDoc({ deck: { skin: 1, owned: true } }, { deck: { skin: 4, owned: true, extra: 1 } });
    expect(field.entries.map((e) => e.label)).toEqual(['skin', 'extra']);
    expect(field.entries[0].undo({ skin: 4, owned: true, extra: 1 })).toEqual({ skin: 1, owned: true, extra: 1 });
    expect(field.entries[1].undo({ skin: 4, owned: true, extra: 1 })).toEqual({ skin: 4, owned: true });
  });

  it('notices a reorder with nothing added or removed', () => {
    const [field] = diffDoc({ tapes: ['a', 'b'] }, { tapes: ['b', 'a'] });
    expect(field.head.detail).toBe('2 entries -> 2 entries · same entries, new order');
  });

  it('every change can be redone after an undo', () => {
    const original: JsonObject = {
      credits: 100,
      unlockedCosmetics: ['abandoned_pin', 'usa'],
      trainItems: [flare(1)],
      saleItems: [{ itemName: 'medkit', salePercent: 20 }],
      deck: { skin: 1 },
    };
    const data: JsonObject = {
      credits: 777,
      unlockedCosmetics: ['usa'],
      trainItems: [flare(1), flare(), flare()],
      saleItems: [{ itemName: 'medkit', salePercent: 60 }],
      deck: { skin: 4 },
    };
    for (const field of diffDoc(original, data)) {
      for (const change of [field.head, ...field.entries]) {
        const now = data[change.key];
        const undone = change.undo(now);
        expect(undone, `${change.label} undo`).not.toEqual(now);
        expect(change.redo(undone), `${change.label} redo`).toEqual(now);
      }
    }
  });
});
