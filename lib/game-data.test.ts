// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** Sanity checks on the catalogue written by `npm run extract`. Run after every extraction. */
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/game-data.json'), 'utf8'));

const ENUMS = ['gameModes', 'genders', 'lobbyPrivacy', 'cycleDifficulties', 'worldModifiers', 'modifierAllowanceFlags', 'dataDeckSkins'];
const duplicates = (list: string[]) => list.filter((value, index) => list.indexOf(value) !== index);

describe('game-data.json', () => {
  it.each(ENUMS)('%s has integer values and unique keys', (name) => {
    const entries = data[name] as { key: string; value: number }[];
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) expect(Number.isInteger(entry.value), `${name}.${entry.key}`).toBe(true);
    expect(duplicates(entries.map((e) => e.key))).toEqual([]);
  });

  it('has unique names', () => {
    expect(duplicates(data.cosmetics.map((c: { id: string }) => c.id))).toEqual([]);
    expect(duplicates(data.tapes.map((t: { title: string }) => t.title))).toEqual([]);
    expect(duplicates(data.destinations.map((d: { name: string }) => d.name))).toEqual([]);
    expect(duplicates(data.items.map((i: { itemName: string }) => i.itemName))).toEqual([]);
  });

  it('points at icon and audio files that exist', () => {
    const paths = [...data.items, ...data.cosmetics, ...data.tapes]
      .flatMap((entry: { icon?: string; audio?: string }) => [entry.icon, entry.audio])
      .filter((p): p is string => Boolean(p));
    const missing = paths.filter((p) => !fs.existsSync(path.join(root, 'public', p)));
    expect(missing).toEqual([]);
  });
});
