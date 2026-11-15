/**
 * Save file model. The game writes two kinds of file:
 *   - "fairy engine PersistentData.fs"  player profile (rank, cosmetics, tapes...)
 *   - "fairy engine save_N.fs"          a world / run (credits, train items...)
 *
 * Both are AES-CBC encrypted, base64 encoded JSON (see lib/crypto.ts).
 * The editor never drops unknown keys, so new fields added by game updates
 * survive a round trip and show up under "Other fields".
 */
import { DATA_DECK_SKINS } from './game-data';
import { otherSettingKeys } from './settings';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

/** settings: the game's registry settings, from a .reg export (see lib/registry.ts). */
export type SaveKind = 'player' | 'world' | 'json' | 'settings';

export function detectSaveKind(data: JsonObject): SaveKind {
  if ('characterName' in data || 'rankLevel' in data || 'unlockedCosmetics' in data) return 'player';
  if ('gamemode' in data || 'credits' in data || 'worldData' in data || 'trainItems' in data) return 'world';
  return 'json';
}

/* -------------------------------------------------------------------------- */
/* Known fields                                                               */
/* -------------------------------------------------------------------------- */

export const PLAYER_KNOWN_KEYS = new Set<string>([
  'characterName',
  'age',
  'gender',
  'registered',
  'characterInitialized',
  'rankLevel',
  'rankExp',
  'xpNeeded',
  'prestige',
  'unlockedCosmetics',
  'pin1',
  'pin2',
  'patch1',
  'patch2',
  'tapes',
  'logs',
  'hasDoorStunnedBefore',
  'hasBeenWoundedBefore',
  'hasBeenInfectedBefore',
  'seenTravelFeeTip',
  'seenDeckSkinTip',
  'dataDeckSkin',
  'snakeHighScore',
  ...DATA_DECK_SKINS.flatMap((skin) => (skin.unlockKey ? [skin.unlockKey] : [])),
]);

export const WORLD_KNOWN_KEYS = new Set<string>([
  'gamemode',
  'hasBeenToFinalDestination',
  'timeToPayDebt',
  'cyclesCompletedForDifficultyIncrease',
  'cycleDifficulty',
  'debt',
  'debtPayed',
  'credits',
  'baseDebtForScaling',
  'scrapBin',
  'sellingForPercentage',
  'saleItems',
  'days',
  'maxPlayers',
  'privacy',
  'daysRemaining',
  'debtBeforeChanged',
  'lastPOI',
  'totalDeaths',
  'totalDowns',
  'totalCreditsEarned',
  'totalCreditsSpent',
  'cyclesCompleted',
  'trainItems',
  'playerFID',
  'worldData',
]);

const WORLD_DYNAMIC_KEY = /^(.+LootSaturation|WorldModifier_.+|EffectiveWorldModifier_.+)$/;
const PLAYER_DYNAMIC_KEY = /^dataDeckSkin_.+_unlocked$/;

/** Keys the guided editor doesn't have a dedicated control for. */
export function unknownKeys(kind: SaveKind, data: JsonObject): string[] {
  if (kind === 'player') {
    return Object.keys(data).filter((key) => !PLAYER_KNOWN_KEYS.has(key) && !PLAYER_DYNAMIC_KEY.test(key));
  }
  if (kind === 'world') {
    return Object.keys(data).filter((key) => !WORLD_KNOWN_KEYS.has(key) && !WORLD_DYNAMIC_KEY.test(key));
  }
  if (kind === 'settings') return otherSettingKeys(data);
  return Object.keys(data);
}

/* -------------------------------------------------------------------------- */
/* Train items                                                                */
/* -------------------------------------------------------------------------- */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
  [key: string]: JsonValue;
}

/** Unity serialises Vector3 with its derived properties; keep them consistent. */
export function vector(x: number, y: number, z: number): Vector3 {
  const sqrMagnitude = x * x + y * y + z * z;
  const magnitude = Math.sqrt(sqrMagnitude);
  const base = { x, y, z, magnitude, sqrMagnitude };
  if (magnitude === 0) {
    return { ...base, normalized: { x: 0, y: 0, z: 0, magnitude: 0, sqrMagnitude: 0 } };
  }
  return {
    ...base,
    normalized: { x: x / magnitude, y: y / magnitude, z: z / magnitude, magnitude: 1, sqrMagnitude: 1 },
  };
}

export function readVector(value: unknown): { x: number; y: number; z: number } {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return { x: Number(v.x ?? 0), y: Number(v.y ?? 0), z: Number(v.z ?? 0) };
}

/** Optional per-item state introduced in game v2100 (durability, fuel...). */
export const TRAIN_ITEM_STATE = [
  { flag: 'hasDurability', key: 'durability', label: 'Durability', step: 1 },
  { flag: 'hasFuel', key: 'fuel', label: 'Fuel', step: 0.1 },
  { flag: 'hasBatteryCharge', key: 'batteryCharge', label: 'Battery charge', step: 0.1 },
  { flag: 'hasPaint', key: 'paint', label: 'Paint', step: 1 },
  { flag: 'hasReclamationBaseCost', key: 'reclamationBaseCost', label: 'Reclamation cost', step: 10 },
] as const;

/** A position inside the train car, used when no other item is available to copy from. */
const DEFAULT_TRAIN_POSITION = { x: 22.5, y: 2.9, z: 25 };

export function createTrainItem(
  item: { itemDataName: string; itemName: string },
  existing: JsonValue[] = [],
): JsonObject {
  const sibling = existing.find(
    (entry): entry is JsonObject => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)),
  );
  const siblingData = sibling?.savedItemData as JsonObject | undefined;
  const position = siblingData?.position ? readVector(siblingData.position) : DEFAULT_TRAIN_POSITION;

  return {
    inReclamationUnit: false,
    reclamationOffset: vector(0, 0, 0),
    hasReclamationBaseCost: false,
    reclamationBaseCost: 0,
    hasDurability: false,
    durability: 0,
    hasFuel: false,
    fuel: 0,
    hasBatteryCharge: false,
    batteryCharge: 0,
    hasPaint: false,
    paint: 0,
    savedItemData: {
      itemDataName: item.itemDataName,
      itemName: item.itemName,
      rarityId: 0,
      itemLevel: 0,
      requiredLevel: 0,
      value: 0,
      position: vector(position.x, position.y, position.z),
      rotation: vector(0, 0, 0),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

export function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function asArray(value: unknown): JsonValue[] {
  return Array.isArray(value) ? (value as JsonValue[]) : [];
}

/** Number of top-level keys whose value differs between two saves. */
export function countChanges(a: JsonObject | null, b: JsonObject | null): number {
  if (!a || !b) return 0;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let changes = 0;
  for (const key of keys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changes += 1;
  }
  return changes;
}
