import { describe, expect, it } from 'vitest';
import { decodeBase64, decryptSave, encodeBase64, encryptSave, parseSaveJson, serializeSaveJson } from './crypto';
import { countChanges, createTrainItem, detectSaveKind, unknownKeys, vector } from './save';
import {
  DESTINATIONS,
  GENDERS,
  LOBBY_PRIVACY,
  WORLD_MODIFIERS,
  dataDeckSkinsFor,
  destinationsFor,
  findItem,
  findTape,
} from './game-data';

describe('encryption', () => {
  it('round-trips a save through AES + base64', async () => {
    const save = { characterName: 'Test', rankLevel: 5, tapes: ['Influence'] };
    const encoded = encodeBase64(await encryptSave(serializeSaveJson(save)));
    const decoded = parseSaveJson(await decryptSave(decodeBase64(encoded)));
    expect(decoded).toEqual(save);
  });
});

describe('save model', () => {
  it('detects profile and world saves', () => {
    expect(detectSaveKind({ characterName: 'x' })).toBe('player');
    expect(detectSaveKind({ credits: 1, trainItems: [] })).toBe('world');
    expect(detectSaveKind({ hello: 1 })).toBe('json');
  });

  it('reports fields without a dedicated editor', () => {
    const world = { credits: 1, 'Outer ShoreLootSaturation': 100, 'fairydust.apocalypse.run': '1|2' };
    expect(unknownKeys('world', world)).toEqual(['fairydust.apocalypse.run']);
    expect(unknownKeys('player', { rankLevel: 1, dataDeckSkin_new_unlocked: true, brandNew: 1 })).toEqual(['brandNew']);
  });

  it('builds vectors with Unity derived fields', () => {
    const v = vector(3, 0, 4);
    expect(v.magnitude).toBe(5);
    expect(v.sqrMagnitude).toBe(25);
    expect(v.normalized).toMatchObject({ x: 0.6, z: 0.8, magnitude: 1 });
  });

  it('creates train items in the v2100 shape near existing items', () => {
    const existing = [{ savedItemData: { position: { x: 10, y: 2, z: 30 } } }];
    const item = createTrainItem({ itemDataName: 'Flare', itemName: 'flare' }, existing);
    expect(item).toMatchObject({ hasDurability: false, inReclamationUnit: false });
    expect(item.savedItemData).toMatchObject({ itemDataName: 'Flare', position: { x: 10, y: 2, z: 30 } });
  });

  it('counts top-level changes', () => {
    expect(countChanges({ a: 1, b: [1] }, { a: 1, b: [1, 2], c: true })).toBe(2);
  });
});

describe('game catalogue', () => {
  it('uses the game enums, not guesses', () => {
    expect(GENDERS.find((g) => g.value === 0)?.key).toBe('FEMALE');
    expect(LOBBY_PRIVACY.find((p) => p.value === 0)?.key).toBe('FRIENDS');
    expect(WORLD_MODIFIERS.find((m) => m.key === 'FOG')?.value).toBe(9);
    expect(WORLD_MODIFIERS.find((m) => m.key === 'UNLOCKED')?.value).toBe(15);
  });

  it('includes v2100 content', () => {
    expect(DESTINATIONS.map((d) => d.name)).toContain('Outer Shore');
    expect(findItem({ itemDataName: 'Flare' })?.label).toBe('Flare');
    expect(findItem({ itemDataName: 'Buoltcutters', itemName: 'boltcutters' })?.label).toBe('Boltcutters');
    expect(findItem('soda')?.itemDataName).toBe('Noisemaker (soda can)');
  });

  it('matches tape titles loosely', () => {
    expect(findTape('the champions of 12 a.m')?.title).toBe('the champions of 12 a.m.');
  });

  it('discovers destinations and skins from the save itself', () => {
    const discovered = destinationsFor({ 'Brand New PlaceLootSaturation': 50 });
    expect(discovered.at(-1)).toMatchObject({ name: 'Brand New Place', discovered: true });
    expect(dataDeckSkinsFor({ dataDeckSkin_neon_unlocked: true }).at(-1)?.label).toBe('Neon');
  });
});
