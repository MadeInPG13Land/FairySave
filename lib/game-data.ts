/**
 * Game catalogue. Raw data is generated from the game files by
 * `npm run extract -- <assetripper-export>`; this module only adds display
 * polish (labels, tones) and lookup helpers on top.
 */
import raw from '@/data/game-data.json';

export interface EnumEntry {
  key: string;
  value: number;
  label: string;
}

export interface WorldModifier extends EnumEntry {
  lootMultiplier: number | null;
  tone: 'positive' | 'negative' | 'neutral';
}

export interface Destination {
  name: string;
  subtitle: string;
  travelFee: number;
  isStaticLocation: boolean;
  locked: boolean;
  nonAccessible: boolean;
  outdoors: boolean;
  modifierAllowance: number;
  /** Not in the catalogue, discovered from keys in the loaded save. */
  discovered?: boolean;
}

export interface ItemDef {
  itemDataName: string;
  itemName: string;
  label: string;
  description: string;
  icon: string | null;
  alwaysEquipped: boolean;
  shop: { name: string; cost: number; description: string; saleAllowed: boolean; hidden: boolean } | null;
}

export interface CosmeticDef {
  id: string;
  type: 'PATCH' | 'PIN' | string;
  label: string;
  redeemable: boolean;
  bundle: string | null;
  icon: string | null;
}

export interface TapeDef {
  title: string;
  type: 'STARTER' | 'LOG' | 'MUSIC' | string;
  story: boolean;
  loop: boolean;
  typeSpeed: number;
  transcription: string;
  audio: string | null;
}

export interface DataDeckSkinDef extends EnumEntry {
  unlockKey: string | null;
}

/* -------------------------------------------------------------------------- */
/* Display tweaks                                                             */
/* -------------------------------------------------------------------------- */

const ITEM_LABELS: Record<string, string> = {
  Buoltcutters: 'Boltcutters',
  WalkieTalkie: 'Walkie-Talkie',
  FirstAidKit: 'Medkit',
  SprayMark: 'Environment Marker',
  StunLight: 'Stunlight',
  SledgeHammer: 'Sledgehammer',
  'Noisemaker (soda can)': 'Soda Can',
  TrainPager: 'Train Pager',
  VaultKeycard: 'Vault Keycard',
};

const ITEM_DESCRIPTIONS: Record<string, string> = {
  Pickaxe: "Griller's favorite item.",
};

const COSMETIC_LABELS: Record<string, string> = {
  usa: 'USA',
  mlm: 'MLM',
  ECD: 'ECD',
  lesbian: 'Lesbian',
  thwael: 'Thwael',
  vorz: 'Vorz',
  jmdog: 'Jmdog',
  clock: 'Clock',
  conchaeater: 'Conchaeater',
  anthran: 'Anthran',
  blank: 'Blank',
  threedave_pin: 'ThreeDave',
  threedave_patch: 'ThreeDave',
  spiderbutcher_pin: 'Spider × Butcher',
  'made in fairyland': 'Made in Fairyland',
  'made in fairyland patch': 'Made in Fairyland',
  'false world': 'False World (Mori Shion)',
};

const MODIFIER_LABELS: Record<string, string> = { EMP: 'EMP' };
const POSITIVE_MODIFIERS = new Set(['SURPLUS', 'VIGOR', 'SHADOWSTEP', 'UNLOCKED', 'SALVAGE', 'VITALITY']);
const NEUTRAL_MODIFIERS = new Set(['NONE', 'ERROR', 'DISPLACED']);

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

export const GAME_VERSION: number | null = raw.gameVersion;
export const CATALOGUE_DATE: string = raw.extractedAt;

export function prettify(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const GAME_MODES: EnumEntry[] = raw.gameModes;
export const CYCLE_DIFFICULTIES: EnumEntry[] = raw.cycleDifficulties;
export const GENDERS: EnumEntry[] = raw.genders;
export const LOBBY_PRIVACY: EnumEntry[] = raw.lobbyPrivacy.map((entry) =>
  entry.key === 'INVITE' ? { ...entry, label: 'Invite only' } : entry,
);

export const WORLD_MODIFIERS: WorldModifier[] = raw.worldModifiers.map((modifier) => ({
  ...modifier,
  label: MODIFIER_LABELS[modifier.key] ?? modifier.label,
  tone: POSITIVE_MODIFIERS.has(modifier.key)
    ? 'positive'
    : NEUTRAL_MODIFIERS.has(modifier.key)
      ? 'neutral'
      : 'negative',
}));

export const DESTINATIONS: Destination[] = raw.destinations;

export const ITEMS: ItemDef[] = raw.items.map((item) => ({
  itemDataName: item.itemDataName,
  itemName: item.itemName,
  label: ITEM_LABELS[item.itemDataName] ?? prettify(item.itemDataName),
  description: item.shop?.description || ITEM_DESCRIPTIONS[item.itemDataName] || '',
  icon: item.icon,
  alwaysEquipped: item.alwaysEquipped,
  shop: item.shop,
}));

export const SALE_ITEMS = ITEMS.filter((item) => item.shop?.saleAllowed);

export const COSMETICS: CosmeticDef[] = raw.cosmetics.map((cosmetic) => ({
  ...cosmetic,
  label:
    COSMETIC_LABELS[cosmetic.id] ??
    prettify(cosmetic.id.replace(/_(pin|patch)$/i, '')),
}));

export const PINS = COSMETICS.filter((cosmetic) => cosmetic.type === 'PIN');
export const PATCHES = COSMETICS.filter((cosmetic) => cosmetic.type === 'PATCH');

export const TAPES: TapeDef[] = raw.tapes;
export const TAPE_GROUPS: { type: string; label: string }[] = [
  { type: 'STARTER', label: 'Training' },
  { type: 'LOG', label: 'Data-deck logs' },
  { type: 'MUSIC', label: 'Music' },
];

export const DATA_DECK_SKINS: DataDeckSkinDef[] = raw.dataDeckSkins.map((skin) =>
  skin.key === 'ECD' ? { ...skin, label: 'ECD' } : skin,
);

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

export function findItem(ref: { itemDataName?: unknown; itemName?: unknown } | string | null | undefined) {
  if (!ref) return undefined;
  const candidates =
    typeof ref === 'string' ? [norm(ref)] : [norm(ref.itemDataName), norm(ref.itemName)].filter(Boolean);
  return ITEMS.find((item) =>
    candidates.some(
      (candidate) =>
        candidate === norm(item.itemDataName) ||
        candidate === norm(item.itemName) ||
        candidate === norm(item.shop?.name),
    ),
  );
}

export function findModifier(value: unknown) {
  return WORLD_MODIFIERS.find((modifier) => modifier.value === Number(value));
}

export function findCosmetic(id: string | null | undefined) {
  return id ? COSMETICS.find((cosmetic) => cosmetic.id === id) : undefined;
}

/** Tape titles occasionally gain punctuation between game versions. */
const looseTitle = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export function findTape(title: string) {
  return TAPES.find((tape) => tape.title === title) ?? TAPES.find((tape) => looseTitle(tape.title) === looseTitle(title));
}

export function destinationKeys(name: string) {
  return {
    loot: `${name}LootSaturation`,
    modifier: `WorldModifier_${name}`,
    effective: `EffectiveWorldModifier_${name}`,
  };
}

/**
 * Catalogue destinations plus any destination the save mentions that the
 * catalogue doesn't know about yet (new game content shows up automatically).
 */
export function destinationsFor(save: Record<string, unknown>): Destination[] {
  const known = new Set(DESTINATIONS.map((destination) => destination.name));
  const discovered: Destination[] = [];
  for (const key of Object.keys(save)) {
    const match = /^(.+)LootSaturation$/.exec(key) ?? /^WorldModifier_(.+)$/.exec(key);
    const name = match?.[1];
    if (name && !known.has(name)) {
      known.add(name);
      discovered.push({
        name,
        subtitle: '',
        travelFee: 0,
        isStaticLocation: false,
        locked: false,
        nonAccessible: false,
        outdoors: false,
        modifierAllowance: 0,
        discovered: true,
      });
    }
  }
  return [...DESTINATIONS, ...discovered];
}

/** Data-deck skins plus any `dataDeckSkin_<x>_unlocked` flag the save has that we don't. */
export function dataDeckSkinsFor(save: Record<string, unknown>): DataDeckSkinDef[] {
  const known = new Set(DATA_DECK_SKINS.map((skin) => skin.unlockKey));
  const extra: DataDeckSkinDef[] = Object.keys(save)
    .filter((key) => /^dataDeckSkin_.+_unlocked$/.test(key) && !known.has(key))
    .map((key, index) => {
      const name = key.replace(/^dataDeckSkin_|_unlocked$/g, '');
      return { key: name.toUpperCase(), value: 1000 + index, label: prettify(name), unlockKey: key };
    });
  return [...DATA_DECK_SKINS, ...extra];
}
