// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseEnum, readAssetFields, readList, unescapeDoubleQuoted } from './unity-parse.mjs';

describe('parseEnum', () => {
  it('reads explicit values', () => {
    expect(parseEnum('public enum GameMode { ENDLESS = 0, STARLESS = 4 }', 'GameMode')).toEqual([
      { key: 'ENDLESS', value: 0 },
      { key: 'STARLESS', value: 4 },
    ]);
  });

  it('counts on from the previous value when one is left out', () => {
    expect(parseEnum('enum E { A, B = 5, C }', 'E')?.map((e) => e.value)).toEqual([0, 5, 6]);
  });

  it('ignores comments, attributes and a trailing comma', () => {
    const source = `enum E {
      // the first one
      A = 1, /* old */
      [Obsolete("x")] B = 2,
    }`;
    expect(parseEnum(source, 'E')).toEqual([
      { key: 'A', value: 1 },
      { key: 'B', value: 2 },
    ]);
  });

  it('reads shifts, hex and negatives', () => {
    expect(parseEnum('enum F { A = 1 << 3, B = 0x10, C = -1 }', 'F')?.map((e) => e.value)).toEqual([8, 16, -1]);
  });

  it('handles a base type', () => {
    expect(parseEnum('enum G : byte { A = 2 }', 'G')).toEqual([{ key: 'A', value: 2 }]);
  });

  it('returns null when the enum is missing', () => {
    expect(parseEnum('enum Other { A }', 'GameMode')).toBeNull();
  });

  it('does not match an enum whose name only starts the same', () => {
    expect(parseEnum('enum GameModeExtra { A = 9 }', 'GameMode')).toBeNull();
  });

  it('throws on a value it cannot read instead of writing NaN', () => {
    expect(() => parseEnum('enum E { A = 1, B = A | 2 }', 'E')).toThrow(/can't read value of B/);
  });
});

describe('Unity YAML', () => {
  it('reads top-level asset fields, including multi-line strings', () => {
    const text = ['MonoBehaviour:', '  itemName: lantern', '  description: "Light the flame.', '    Fear the fog."', '  cost: 125'].join('\n');
    expect(readAssetFields(text)).toEqual({ itemName: 'lantern', description: 'Light the flame. Fear the fog.', cost: '125' });
  });

  it('reads list items written at the key indent', () => {
    const lines = ['  shopItems:', '  - name: flare', '    cost: 20', '  - name: pager', '    cost: 300', '  other: 1'];
    expect(readList(lines, 0)).toEqual([
      { name: 'flare', cost: '20' },
      { name: 'pager', cost: '300' },
    ]);
  });

  it('unescapes double-quoted strings', () => {
    expect(unescapeDoubleQuoted('a\\nb \\"c\\"')).toBe('a\nb "c"');
    expect(unescapeDoubleQuoted('joined\\\n  on')).toBe('joinedon');
  });
});
