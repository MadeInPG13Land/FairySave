'use client';

/**
 * Inline forms for the terminal. `show <section>` and `edit <section>` both
 * print one of these: a live view of the save where every value can be
 * changed in place. `edit` just starts with the cursor in the first field.
 *
 * Keys: Tab / Up / Down move between fields, Left / Right cycle options,
 * Space toggles, Enter commits a number and moves on, Esc returns to the prompt.
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import {
  COSMETICS,
  CYCLE_DIFFICULTIES,
  GAME_MODES,
  GENDERS,
  ITEMS,
  LOBBY_PRIVACY,
  PATCHES,
  PINS,
  SALE_ITEMS,
  TAPES,
  WORLD_MODIFIERS,
  dataDeckSkinsFor,
  destinationKeys,
  destinationsFor,
  findItem,
  findTape,
  prettify,
} from '@/lib/game-data';
import {
  asArray,
  asStringArray,
  isObject,
  unknownKeys,
  type JsonObject,
  type JsonValue,
  type SaveKind,
} from '@/lib/save';
import { Undo2, X } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { SETTING_GROUPS, findSetting, otherSettingKeys, settingsIn, type SettingGroup } from '@/lib/settings';
import { TermIcon } from './icon';
import { clampNumber, useSudo } from './sudo';
import type { Tone } from './commands';

/* -------------------------------------------------------------------------- */
/* Model                                                                      */
/* -------------------------------------------------------------------------- */

type Option = { value: string | number; label: string };

type Control =
  | {
      kind: 'number';
      /** The stored value; `set` takes stored values too. */
      value: unknown;
      set: (v: number) => void;
      /** Limits, in stored units. */
      min?: number;
      max?: number;
      int?: boolean;
      /**
       * Shown multiplied by this (100 for a 0..1 value shown as a percentage).
       * Only the display is scaled, so undo puts back the exact stored value.
       */
      scale?: number;
      suffix?: string;
      width?: number;
      dim?: boolean;
    }
  | { kind: 'text'; value: unknown; set: (v: string) => void; width?: number }
  | { kind: 'enum'; value: unknown; set: (v: string | number) => void; options: Option[] }
  | { kind: 'bool'; value: unknown; set: (v: boolean) => void; label?: string }
  | { kind: 'action'; label: string; run: () => void; danger?: boolean };

interface Row {
  id: string;
  tag: string;
  tone: Tone;
  label: string;
  note?: string;
  controls: Control[];
  /** A placeholder line (e.g. "+ new sale"): dimmed until you use it. */
  ghost?: boolean;
}

export interface FormDef {
  rows: Row[];
  filterable?: boolean;
  /** Headings for the control columns, when a row has several. */
  columns?: string[];
  actions?: { label: string; run: () => void }[];
  empty?: string;
}

const INT_MAX = 2147483647;

/**
 * The directories inside a save. A section with children is a folder of
 * sections; child ids are paths like "cosmetics/pins".
 */
export interface SectionDef {
  id: string;
  summary: string;
  children?: SectionDef[];
}

export const SECTIONS: Record<SaveKind, SectionDef[]> = {
  player: [
    { id: 'profile', summary: 'name, rank, prestige and flags' },
    {
      id: 'cosmetics',
      summary: 'pins and patches: equipped and unlocked',
      children: [
        { id: 'cosmetics/slots', summary: 'what is equipped in the two pin and two patch slots' },
        { id: 'cosmetics/pins', summary: 'unlock pins' },
        { id: 'cosmetics/patches', summary: 'unlock patches' },
      ],
    },
    { id: 'tapes', summary: 'collected tapes and logs' },
    { id: 'deck', summary: 'data-deck skins' },
    { id: 'other', summary: 'fields without a dedicated editor' },
  ],
  world: [
    { id: 'run', summary: 'mode, cycle, travel and lobby' },
    { id: 'economy', summary: 'credits, debt and trader sales' },
    { id: 'destinations', summary: 'loot and modifiers per stop' },
    { id: 'items', summary: 'items stored on the train' },
    { id: 'stats', summary: 'lifetime totals' },
    { id: 'other', summary: 'fields without a dedicated editor' },
  ],
  json: [{ id: 'other', summary: 'every field' }],
  settings: [
    ...SETTING_GROUPS.map((group) => ({ id: group.id, summary: group.summary })),
    { id: 'other', summary: 'window size, monitor and the rest' },
  ],
};

/** Every section, folders and their children, depth first. */
export function allSections(kind: SaveKind): SectionDef[] {
  const walk = (list: SectionDef[]): SectionDef[] => list.flatMap((s) => [s, ...walk(s.children ?? [])]);
  return walk(SECTIONS[kind]);
}

/** Sections that render a form (everything except folders). */
export const leafSections = (kind: SaveKind) => allSections(kind).filter((s) => !s.children);

export const findSection = (kind: SaveKind, id: string | null) => (id ? allSections(kind).find((s) => s.id === id) : undefined);

/** What is directly inside a folder, or the top level of the save when id is null. */
export const childSections = (kind: SaveKind, id: string | null): SectionDef[] =>
  id === null ? SECTIONS[kind] : (findSection(kind, id)?.children ?? []);

/** "cosmetics/pins" -> "pins" */
export const sectionBase = (id: string) => id.slice(id.lastIndexOf('/') + 1);

/** "cosmetics/pins" -> "cosmetics", "profile" -> null */
export const sectionParent = (id: string) => (id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : null);

/**
 * Resolves a section name or path relative to `within` (null = the save's top
 * level). Exact names win over prefixes. Unless `strict`, a single name that
 * isn't here but names exactly one section elsewhere also resolves, so
 * `show pins` works from anywhere in the profile.
 */
export function resolveSectionId(kind: SaveKind, name: string, within: string | null = null, strict = false): string | null {
  const pick = (list: SectionDef[], part: string) =>
    list.find((s) => sectionBase(s.id) === part) ?? list.find((s) => sectionBase(s.id).startsWith(part));
  const parts = name.toLowerCase().split('/').filter(Boolean);
  if (parts.length === 0) return null;
  let at: string | null = within;
  for (const part of parts) {
    const next = pick(childSections(kind, at), part);
    if (!next) {
      if (strict || parts.length > 1) return null;
      const elsewhere = allSections(kind).filter((s) => sectionBase(s.id) === part);
      return elsewhere.length === 1 ? elsewhere[0].id : null;
    }
    at = next.id;
  }
  return at;
}

const options = (list: { value: number; label: string }[]): Option[] => list.map((e) => ({ value: e.value, label: e.label }));
const modifierOptions: Option[] = WORLD_MODIFIERS.map((m) => ({
  value: m.value,
  label: m.lootMultiplier ? `${m.label} x${m.lootMultiplier}` : m.label,
}));

/** Builds the rows for one section against the current save data. */
export function buildForm(section: string, data: JsonObject, kind: SaveKind, write: (key: string, value: JsonValue | undefined) => void, latest: () => JsonObject): FormDef {
  const num = (key: string, extra: Partial<Extract<Control, { kind: 'number' }>> = {}): Control => ({
    kind: 'number',
    value: data[key],
    set: (v) => write(key, v),
    ...extra,
  });
  const field = (key: string, label: string, control: Control, note?: string): Row => {
    const tag = control.kind === 'number' ? 'NUM' : control.kind === 'bool' ? 'BOOL' : control.kind === 'enum' ? 'ENUM' : 'STR';
    const tone: Tone = control.kind === 'number' ? 'gold' : control.kind === 'bool' ? 'violet' : control.kind === 'enum' ? 'mint' : 'cyan';
    return { id: key, tag, tone, label, note, controls: [control] };
  };
  const bool = (key: string, label: string, note?: string) =>
    field(key, label, { kind: 'bool', value: data[key], set: (v) => write(key, v) }, note);
  const enumField = (key: string, label: string, list: Option[]) =>
    field(key, label, { kind: 'enum', value: data[key], options: list, set: (v) => write(key, v) });

  // Game settings: rows from lib/settings.ts, for what's in this export.
  if (kind === 'settings') {
    const settingRow = (key: string): Row => {
      const def = findSetting(key);
      const value = data[key];
      if (!def) {
        const label = key.toLowerCase();
        return typeof value === 'string'
          ? field(key, label, { kind: 'text', value, set: (v) => write(key, v), width: 16 })
          : field(key, label, num(key, { int: Number.isInteger(value) }));
      }
      switch (def.kind) {
        case 'bool':
          return field(key, def.label, { kind: 'bool', value: Number(value) !== 0, set: (v) => write(key, v ? 1 : 0) });
        case 'enum':
          return field(key, def.label, { kind: 'enum', value: Number(value), options: def.options, set: (v) => write(key, Number(v)) });
        case 'percent':
          // Stored 0..1; shown as a percentage. Only the display is scaled.
          return field(key, def.label, num(key, { min: 0, max: def.max, scale: 100, suffix: '%' }));
        case 'number':
          return field(key, def.label, num(key, { min: def.min, max: def.max, int: def.int }));
        case 'text':
          return field(key, def.label, { kind: 'text', value, set: (v) => write(key, v), width: 16 });
      }
    };
    const keys = section === 'other' ? otherSettingKeys(data) : settingsIn(section as SettingGroup, data).map((s) => s.key);
    return { rows: keys.map(settingRow), empty: 'not in this export.' };
  }

  switch (`${kind}:${section}`) {
    case 'player:profile':
      return {
        rows: [
          field('characterName', 'name', { kind: 'text', value: data.characterName, set: (v) => write('characterName', v), width: 20 }),
          field('age', 'age', { kind: 'text', value: data.age, set: (v) => write('age', v), width: 6 }),
          enumField('gender', 'body type', options(GENDERS)),
          field('rankLevel', 'rank', num('rankLevel', { min: 1, max: INT_MAX, int: true })),
          field('rankExp', 'rank xp', num('rankExp', { min: 0 })),
          field('xpNeeded', 'xp needed', num('xpNeeded', { min: 0 })),
          field('prestige', 'prestige', num('prestige', { min: 0, max: INT_MAX, int: true })),
          field('snakeHighScore', 'snake high score', num('snakeHighScore', { min: 0, max: INT_MAX, int: true })),
          bool('registered', 'registered'),
          bool('characterInitialized', 'character initialized'),
          bool('hasDoorStunnedBefore', 'has stunned a door'),
          bool('hasBeenWoundedBefore', 'has been wounded'),
          bool('hasBeenInfectedBefore', 'has been infected'),
          bool('seenTravelFeeTip', 'seen travel fee tip'),
          bool('seenDeckSkinTip', 'seen deck skin tip'),
        ],
      };

    case 'player:cosmetics/slots':
    case 'player:cosmetics/pins':
    case 'player:cosmetics/patches': {
      const unlocked = new Set(asStringArray(data.unlockedCosmetics));
      const toggle = (id: string, on: boolean) => {
        const current = asStringArray(latest().unlockedCosmetics).filter((entry) => entry !== id);
        write('unlockedCosmetics', on ? [...current, id] : current);
      };

      if (section === 'cosmetics/slots') {
        const slot = (key: string, pool: typeof PINS): Row => ({
          id: key,
          tag: 'SLOT',
          tone: 'mint',
          label: key,
          controls: [
            {
              kind: 'enum',
              value: typeof data[key] === 'string' ? data[key] : '__none__',
              options: [{ value: '__none__', label: 'none' }, ...pool.map((c) => ({ value: c.id, label: c.label }))],
              set: (v) => {
                if (v === '__none__') return write(key, undefined);
                write(key, v);
                if (!asStringArray(latest().unlockedCosmetics).includes(String(v))) toggle(String(v), true);
              },
            },
          ],
        });
        return { rows: [slot('pin1', PINS), slot('pin2', PINS), slot('patch1', PATCHES), slot('patch2', PATCHES)] };
      }

      const pins = section === 'cosmetics/pins';
      const list = pins ? PINS : PATCHES;
      const ids = list.map((c) => c.id);
      const others = () => asStringArray(latest().unlockedCosmetics).filter((id) => !ids.includes(id));
      return {
        filterable: true,
        actions: [
          { label: 'unlock all', run: () => write('unlockedCosmetics', [...others(), ...ids]) },
          { label: 'lock all', run: () => write('unlockedCosmetics', others()) },
        ],
        rows: list.map(
          (c): Row => ({
            id: `c:${c.id}`,
            tag: pins ? 'PIN' : 'PATCH',
            tone: pins ? 'cyan' : 'magenta',
            label: c.label,
            note: c.bundle ? `${c.bundle} · ${c.id}` : c.id,
            controls: [{ kind: 'bool', value: unlocked.has(c.id), label: 'unlocked', set: (v) => toggle(c.id, v) }],
          }),
        ),
      };
    }

    case 'player:tapes': {
      const owned = asStringArray(data.tapes);
      const tones: Record<string, Tone> = { STARTER: 'cyan', LOG: 'gold', MUSIC: 'magenta' };
      const toggle = (title: string, type: string, on: boolean) => {
        const tape = findTape(title);
        const strip = (list: string[]) => list.filter((entry) => findTape(entry) !== tape);
        const now = latest();
        write('tapes', on ? [...strip(asStringArray(now.tapes)), title] : strip(asStringArray(now.tapes)));
        if (type === 'LOG') write('logs', on ? [...strip(asStringArray(now.logs)), title] : strip(asStringArray(now.logs)));
      };
      return {
        filterable: true,
        actions: [
          { label: 'collect all', run: () => write('tapes', TAPES.map((t) => t.title)) },
          { label: 'clear', run: () => write('tapes', []) },
        ],
        rows: TAPES.map((tape) => ({
          id: tape.title,
          tag: tape.type === 'STARTER' ? 'TRAIN' : tape.type,
          tone: tones[tape.type] ?? 'dim',
          label: tape.title,
          note: tape.story ? 'story' : undefined,
          controls: [
            {
              kind: 'bool',
              value: owned.some((entry) => findTape(entry) === tape),
              label: 'collected',
              set: (v) => toggle(tape.title, tape.type, v),
            },
          ],
        })),
      };
    }

    case 'player:deck': {
      const skins = dataDeckSkinsFor(data);
      return {
        actions: [{ label: 'unlock all', run: () => skins.forEach((s) => s.unlockKey && write(s.unlockKey, true)) }],
        rows: [
          enumField('dataDeckSkin', 'equipped', skins.map((s) => ({ value: s.value, label: s.label }))),
          ...skins
            .filter((s) => s.unlockKey)
            .map(
              (s): Row => ({
                id: s.unlockKey!,
                tag: 'SKIN',
                tone: 'violet',
                label: s.label,
                controls: [{ kind: 'bool', value: data[s.unlockKey!], label: 'unlocked', set: (v) => write(s.unlockKey!, v) }],
              }),
            ),
        ],
      };
    }

    case 'world:run':
      return {
        rows: [
          enumField('gamemode', 'game mode', options(GAME_MODES)),
          enumField('cycleDifficulty', 'cycle difficulty', options(CYCLE_DIFFICULTIES)),
          field('cyclesCompleted', 'cycles completed', num('cyclesCompleted', { min: 0, int: true })),
          field('cyclesCompletedForDifficultyIncrease', 'cycles to next difficulty', num('cyclesCompletedForDifficultyIncrease', { min: 0, int: true })),
          field('days', 'day', num('days', { min: 0, int: true })),
          field('daysRemaining', 'days remaining', num('daysRemaining', { min: 0, int: true })),
          bool('timeToPayDebt', 'debt due'),
          enumField('lastPOI', 'current destination', destinationsFor(data).map((d) => ({ value: d.name, label: d.name }))),
          bool('hasBeenToFinalDestination', 'pentagon unlocked'),
          field('maxPlayers', 'max players', num('maxPlayers', { min: 1, max: 16, int: true })),
          enumField('privacy', 'privacy', options(LOBBY_PRIVACY)),
        ],
      };

    case 'world:economy': {
      const sales = asArray(data.saleItems).filter(isObject);
      const updateSale = (index: number, patch: JsonObject) =>
        write('saleItems', asArray(latest().saleItems).filter(isObject).map((s, i) => (i === index ? { ...s, ...patch } : s)));
      // The last line is a placeholder: picking an item there adds it as a sale (at 20%),
      // and a fresh placeholder appears under it.
      const onSale = (item: (typeof SALE_ITEMS)[number]) => sales.some((s) => findItem(String(s.itemName)) === item);
      const free = SALE_ITEMS.filter((item) => !onSale(item));
      const newSale: Row | null = free.length
        ? {
            id: 'sale:new',
            tag: 'SALE',
            tone: 'orange',
            label: '+ new sale',
            ghost: true,
            controls: [
              {
                kind: 'enum',
                value: '__new__',
                options: [{ value: '__new__', label: 'pick an item' }, ...free.map((item) => ({ value: item.shop!.name, label: item.label }))],
                set: (v) => {
                  if (v === '__new__') return;
                  const current = asArray(latest().saleItems).filter(isObject);
                  write('saleItems', [...current, { itemName: String(v), salePercent: 20 }]);
                  // Carry on editing the sale just made (so → changes its item rather than adding more).
                  focusRowSoon(`sale:${current.length}`);
                },
              },
            ],
          }
        : null;
      return {
        rows: [
          field('credits', 'credits', num('credits', { min: 0, max: INT_MAX, int: true })),
          field('scrapBin', 'scrap bin value', num('scrapBin', { min: 0, max: INT_MAX, int: true })),
          field('sellingForPercentage', 'scrap sell rate', num('sellingForPercentage', { min: 0, max: 100, suffix: '%' })),
          field('debt', 'debt', num('debt', { min: 0, max: INT_MAX, int: true })),
          field('debtPayed', 'paid this cycle', num('debtPayed', { min: 0, max: INT_MAX, int: true })),
          field('debtBeforeChanged', 'debt before change', num('debtBeforeChanged', { min: 0, max: INT_MAX, int: true })),
          field('baseDebtForScaling', 'base debt for scaling', num('baseDebtForScaling', { min: 0, max: INT_MAX, int: true })),
          ...sales.map(
            (sale, index): Row => ({
              id: `sale:${index}`,
              tag: 'SALE',
              tone: 'orange',
              label: findItem(String(sale.itemName))?.label ?? String(sale.itemName),
              note: findItem(String(sale.itemName))?.shop ? `$${findItem(String(sale.itemName))!.shop!.cost}` : undefined,
              controls: [
                {
                  kind: 'enum',
                  value: sale.itemName,
                  options: SALE_ITEMS.map((item) => ({ value: item.shop!.name, label: item.label })),
                  set: (v) => updateSale(index, { itemName: v }),
                },
                { kind: 'number', value: sale.salePercent, min: 0, max: 100, int: true, suffix: '%', width: 4, set: (v) => updateSale(index, { salePercent: v }) },
                {
                  kind: 'action',
                  label: 'remove',
                  danger: true,
                  run: () => write('saleItems', asArray(latest().saleItems).filter((_, i) => i !== index)),
                },
              ],
            }),
          ),
          ...(newSale ? [newSale] : []),
        ],
      };
    }

    case 'world:destinations':
      return {
        filterable: true,
        columns: ['loot', 'shown modifier', 'actual modifier'],
        actions: [
          { label: 'refill loot', run: () => destinationsFor(latest()).forEach((d) => write(destinationKeys(d.name).loot, 100)) },
          {
            label: 'clear modifiers',
            run: () =>
              destinationsFor(latest()).forEach((d) => {
                write(destinationKeys(d.name).modifier, 0);
                write(destinationKeys(d.name).effective, 0);
              }),
          },
        ],
        rows: destinationsFor(data).map((d): Row => {
          const keys = destinationKeys(d.name);
          const here = data.lastPOI === d.name;
          return {
            id: d.name,
            tag: here ? 'HERE' : 'DEST',
            tone: here ? 'mint' : 'dim',
            label: d.name,
            note: d.discovered ? 'new' : undefined,
            controls: [
              { kind: 'number', value: data[keys.loot] ?? 100, min: 0, max: 100, int: true, suffix: '%', width: 4, set: (v) => write(keys.loot, v) },
              { kind: 'enum', value: data[keys.modifier] ?? 0, options: modifierOptions, set: (v) => write(keys.modifier, v) },
              { kind: 'enum', value: data[keys.effective] ?? 0, options: modifierOptions, set: (v) => write(keys.effective, v) },
            ],
          };
        }),
      };

    case 'world:items': {
      const items = asArray(data.trainItems).filter(isObject);
      const update = (index: number, patch: JsonObject) =>
        write('trainItems', asArray(latest().trainItems).filter(isObject).map((it, i) => (i === index ? { ...it, ...patch } : it)));
      return {
        filterable: true,
        empty: 'the train is empty. try `give flare`.',
        rows: items.map((entry, index): Row => {
          const saved = isObject(entry.savedItemData) ? entry.savedItemData : {};
          const def = findItem(saved);
          return {
            id: `item:${index}`,
            tag: `#${index + 1}`,
            tone: entry.inReclamationUnit ? 'orange' : 'cyan',
            label: def?.label ?? prettify(String(saved.itemDataName ?? 'unknown')),
            controls: [
              {
                kind: 'enum',
                value: def?.itemDataName ?? String(saved.itemDataName ?? ''),
                options: ITEMS.map((item) => ({ value: item.itemDataName, label: item.label })),
                set: (v) => {
                  const next = ITEMS.find((item) => item.itemDataName === v);
                  if (next) update(index, { savedItemData: { ...saved, itemDataName: next.itemDataName, itemName: next.itemName } });
                },
              },
              {
                kind: 'number',
                value: entry.durability ?? 0,
                min: 0,
                int: true,
                width: 4,
                dim: !entry.hasDurability,
                set: (v) => update(index, { durability: v, hasDurability: true }),
              },
              { kind: 'bool', value: entry.inReclamationUnit, label: 'reclaim', set: (v) => update(index, { inReclamationUnit: v }) },
              {
                kind: 'action',
                label: 'remove',
                danger: true,
                run: () => write('trainItems', asArray(latest().trainItems).filter((_, i) => i !== index)),
              },
            ],
          };
        }),
      };
    }

    case 'world:stats':
      return {
        rows: [
          field('totalDeaths', 'deaths', num('totalDeaths', { min: 0, int: true })),
          field('totalDowns', 'downs', num('totalDowns', { min: 0, int: true })),
          field('totalCreditsEarned', 'credits earned', num('totalCreditsEarned', { min: 0, max: INT_MAX, int: true })),
          field('totalCreditsSpent', 'credits spent', num('totalCreditsSpent', { min: 0, max: INT_MAX, int: true })),
        ],
      };

    default: {
      // "other": whatever the guided editor doesn't cover, typed by value.
      const keys = unknownKeys(kind, data);
      return {
        empty: 'nothing extra in this save.',
        rows: keys.map((key): Row => {
          const value = data[key];
          if (typeof value === 'number') return field(key, key, num(key));
          if (typeof value === 'boolean') return bool(key, key);
          if (typeof value === 'string') return field(key, key, { kind: 'text', value, set: (v) => write(key, v), width: 24 });
          return {
            id: key,
            tag: Array.isArray(value) ? 'LIST' : 'OBJ',
            tone: 'magenta',
            label: key,
            note: 'edit with set or json',
            controls: [],
          };
        }),
      };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The friendly name a save field has in the forms ("rankLevel" -> "rank"),
 * falling back to splitting the key ("unlockedCosmetics" -> "unlocked cosmetics").
 */
export function fieldLabel(kind: SaveKind, key: string, data: JsonObject): string {
  const noop = () => undefined;
  for (const section of leafSections(kind)) {
    if (section.id === 'other') continue;
    const row = buildForm(section.id, data, kind, noop, () => data).rows.find((r) => r.id === key);
    if (row) return row.label;
  }
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

/** A number as its field shows it: scaled for display, to one decimal place when scaled. */
export function shownNumber(control: { scale?: number }, value: number): number {
  return control.scale ? Math.round(value * control.scale * 10) / 10 : value;
}

/** Characters a single-value control needs to show its content without overflowing. */
function contentWidth(control: Control): number {
  switch (control.kind) {
    case 'enum':
      // Every option, so cycling through them never spills out.
      return Math.max(...control.options.map((o) => o.label.length)) + 5;
    case 'text':
      return Math.max(control.width ?? 16, String(control.value ?? '').length + 1) + 2;
    case 'number':
      return Math.max(control.width ?? 12, String(shownNumber(control, Number(control.value ?? 0))).length) + 2 + (control.suffix ? 2 : 0);
    case 'bool':
      return (control.label?.length ?? 0) + 5;
    case 'action':
      return control.label.length + 4;
  }
}

/** One shared width for a form's single-value column: its widest content, at least 24ch. */
function singleColumnWidth(rows: Row[]): string {
  const widths = rows.filter((row) => row.controls.length === 1).map((row) => contentWidth(row.controls[0]));
  return `${Math.max(24, ...widths)}ch`;
}

/** Width a control occupies, so headings and pickers align across rows. */
function columnWidth(control: Control | undefined) {
  if (!control) return undefined;
  if (control.kind === 'enum') return `${Math.max(...control.options.map((o) => o.label.length)) + 5}ch`;
  if (control.kind === 'number') return `${(control.width ?? 12) + 2 + (control.suffix ? 1.3 : 0)}ch`;
  return undefined;
}

/** Put the cursor on a row's first field once it has rendered (e.g. a sale just added). */
function focusRowSoon(rowId: string) {
  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-row="${rowId}"] [data-field]`)?.focus()),
  );
}

function moveFocus(from: HTMLElement, delta: number) {
  const form = from.closest('.term-form');
  if (!form) return;
  const fields = [...form.querySelectorAll<HTMLElement>('[data-field]')];
  const index = fields.indexOf(from);
  const next = fields[index + delta];
  if (next) return next.focus();
  // Past either end: back to the prompt, or around again in a full-screen view.
  const prompt = document.getElementById('term-input');
  if (prompt && delta > 0) prompt.focus();
  else if (!prompt) fields[delta > 0 ? 0 : fields.length - 1]?.focus();
}

function focusPrompt() {
  document.getElementById('term-input')?.focus();
}

/** Shared key handling: arrows/tab move, Esc leaves the form. */
export function navKeys(event: KeyboardEvent<HTMLElement>) {
  if (event.key === 'Escape') {
    event.preventDefault();
    focusPrompt();
    return true;
  }
  if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
    event.preventDefault();
    moveFocus(event.currentTarget, 1);
    return true;
  }
  if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
    event.preventDefault();
    moveFocus(event.currentTarget, -1);
    return true;
  }
  return false;
}

/** How a control's value reads in a "was …" note. */
function shownValue(control: Control, value: unknown): string {
  if (control.kind === 'enum') return control.options.find((o) => String(o.value) === String(value))?.label ?? String(value ?? 'none');
  if (control.kind === 'bool') return value ? 'on' : 'off';
  if (value === undefined || value === null || value === '') return 'empty';
  if (control.kind === 'number' && typeof value === 'number') return `${shownNumber(control, value)}${control.suffix ?? ''}`;
  return String(value);
}

/**
 * Rows whose values differ from the last saved (or opened) file: what they
 * were, and a way to put that back. Rows that didn't exist before are "new".
 */
export function rowChanges(now: FormDef, before: FormDef): Map<string, { was: string; undo?: () => void }> {
  const old = new Map(before.rows.map((row) => [row.id, row]));
  const out = new Map<string, { was: string; undo?: () => void }>();
  for (const row of now.rows) {
    if (row.ghost) continue;
    const prior = old.get(row.id);
    if (!prior) {
      out.set(row.id, { was: '' });
      continue;
    }
    const diffs = row.controls.flatMap((control, index) => {
      const then = prior.controls[index];
      if (control.kind === 'action' || !then || then.kind === 'action') return [];
      return JSON.stringify(control.value ?? null) === JSON.stringify(then.value ?? null) ? [] : [{ control, value: then.value }];
    });
    if (diffs.length === 0) continue;
    out.set(row.id, {
      was: diffs.map(({ control, value }) => shownValue(control, value)).join(', '),
      undo: () => {
        for (const { control, value } of diffs) (control.set as (v: unknown) => void)(value);
      },
    });
  }
  return out;
}

export function TermForm({
  docId,
  section,
  autofocus,
}: {
  docId: string;
  section: string;
  autofocus: boolean;
}) {
  const doc = useEditor((state) => state.docs.find((d) => d.id === docId) ?? null);
  const [filter, setFilter] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autofocus) return;
    rootRef.current?.querySelector<HTMLElement>('[data-field]')?.focus({ preventScroll: true });
  }, [autofocus]);

  if (!doc) return <p className="term-faint">(save closed)</p>;

  const write = (key: string, value: JsonValue | undefined) => {
    const state = useEditor.getState();
    if (state.activeId !== docId) state.activate(docId);
    state.setField(key, value);
  };
  const latest = () => useEditor.getState().docs.find((d) => d.id === docId)?.data ?? {};
  const form = buildForm(section, doc.data, doc.kind, write, latest);
  const changed = rowChanges(form, buildForm(section, doc.original, doc.kind, () => {}, () => doc.original));
  const q = filter.trim().toLowerCase();
  const rows = q ? form.rows.filter((row) => `${row.label} ${row.note ?? ''} ${row.tag}`.toLowerCase().includes(q)) : form.rows;

  return (
    <div
      ref={rootRef}
      className="term-form"
      style={{ '--single-width': singleColumnWidth(form.rows) } as CSSProperties}
      onKeyDown={(event) => {
        // Ctrl+Z on a changed row puts its saved value back.
        if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return;
        const rowId = (event.target as HTMLElement).closest('[data-row]')?.getAttribute('data-row');
        const undo = rowId ? changed.get(rowId)?.undo : undefined;
        if (!undo) return;
        event.preventDefault();
        undo();
      }}
    >
      {form.actions?.length ? (
        <div className="term-header term-header--actions">
          <span className="term-actions">
            {form.actions.map((action) => (
              <button key={action.label} type="button" className="term-action" onClick={action.run}>
                [ {action.label} ]
              </button>
            ))}
          </span>
        </div>
      ) : null}
      {form.filterable ? (
        <div className="term-filter">
          <span className="term-faint">/</span>
          <input
            data-field
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                moveFocus(event.currentTarget, 1);
              } else navKeys(event);
            }}
            placeholder="filter"
            className="term-field term-field--filter"
            aria-label={`Filter ${section}`}
            spellCheck={false}
          />
        </div>
      ) : null}
      {form.columns && rows.length > 0 ? (
        <div className="term-record term-row term-columns">
          <span />
          <span />
          <span className="term-controls">
            {form.columns.map((column, index) => (
              <span key={column} className="term-faint" style={{ minWidth: columnWidth(rows[0].controls[index]) }}>
                {column}
              </span>
            ))}
          </span>
          <span />
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="term-faint">{form.rows.length === 0 ? (form.empty ?? 'nothing here.') : 'no matches.'}</p>
      ) : (
        rows.map((row) => {
          const change = changed.get(row.id);
          return (
          <div
            key={row.id}
            data-row={row.id}
            className={['term-record term-row', row.ghost ? 'term-row--ghost' : '', change ? 'term-row--changed' : ''].join(' ').trim()}
          >
            <span className={`term-badge term-badge--${row.tone}`}>{row.tag}</span>
            <span className="term-key" title={row.label}>
              {row.label}
            </span>
            <span className={row.controls.length === 1 ? 'term-controls term-controls--single' : 'term-controls'}>
              {row.controls.map((control, index) => (
                <FormControl key={index} control={control} label={`${row.label} ${index + 1}`} />
              ))}
            </span>
            {change?.undo ? (
              <button type="button" className="term-note term-was" title="put the saved value back" aria-label={`undo, back to ${change.was}`} onClick={change.undo}>
                <s>{change.was}</s> <TermIcon icon={Undo2} />
              </button>
            ) : row.note && !change ? (
              <span className="term-note">{row.note}</span>
            ) : (
              <span />
            )}
          </div>
          );
        })
      )}
    </div>
  );
}

function FormControl({ control, label }: { control: Control; label: string }): ReactNode {
  switch (control.kind) {
    case 'number':
      return <NumberField control={control} label={label} />;
    case 'text':
      return (
        <input
          data-field
          value={String(control.value ?? '')}
          onChange={(event) => control.set(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              moveFocus(event.currentTarget, 1);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              /* let the caret move */
            } else navKeys(event);
          }}
          className="term-field"
          style={{ width: `${(control.width ?? 16) + 2}ch` }}
          aria-label={label}
          spellCheck={false}
        />
      );
    case 'enum': {
      const index = control.options.findIndex((o) => String(o.value) === String(control.value));
      const current = control.options[index];
      const cycle = (delta: number) => {
        const next = control.options[(Math.max(index, 0) + delta + control.options.length) % control.options.length];
        control.set(next.value);
      };
      return (
        <button
          type="button"
          data-field
          className="term-enum"
          style={{ minWidth: columnWidth(control) }}
          aria-label={label}
          onClick={(event) => cycle(event.shiftKey ? -1 : 1)}
          onKeyDown={(event) => {
            if (navKeys(event)) return;
            if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              cycle(1);
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault();
              cycle(-1);
            } else if (/^[a-z0-9]$/i.test(event.key)) {
              // Jump to the next option starting with that letter.
              const key = event.key.toLowerCase();
              const order = [...control.options.slice(index + 1), ...control.options.slice(0, index + 1)];
              const match = order.find((o) => o.label.toLowerCase().startsWith(key));
              if (match) control.set(match.value);
            }
          }}
        >
          <span className="term-faint">‹</span>
          <span className="term-enum-label">{current?.label ?? `${String(control.value)} (?)`}</span>
          <span className="term-faint">›</span>
        </button>
      );
    }
    case 'bool': {
      const on = Boolean(control.value);
      return (
        <button
          type="button"
          data-field
          role="checkbox"
          aria-checked={on}
          aria-label={label}
          className={on ? 'term-check term-check--on' : 'term-check'}
          onClick={() => control.set(!on)}
          onKeyDown={(event) => {
            if (navKeys(event)) return;
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              control.set(!on);
            }
          }}
        >
          [{on ? 'x' : ' '}]{control.label ? ` ${control.label}` : ''}
        </button>
      );
    }
    case 'action':
      return (
        <button
          type="button"
          data-field
          className={control.danger ? 'term-action term-action--danger' : 'term-action'}
          aria-label={`${label} ${control.label}`}
          onClick={control.run}
          onKeyDown={(event) => {
            navKeys(event);
          }}
        >
          {/* Destructive actions read as an icon and a word, not a cryptic bracket ([rm] looked like a checkbox). */}
          {control.danger ? (
            <>
              <TermIcon icon={X} /> {control.label}
            </>
          ) : (
            `[${control.label}]`
          )}
        </button>
      );
  }
}

function NumberField({ control, label }: { control: Extract<Control, { kind: 'number' }>; label: string }) {
  const numeric = Number(control.value ?? 0);
  const sudo = useSudo((state) => state.on);
  const scale = control.scale ?? 1;
  const display = (value: number) => String(Number.isFinite(value) ? shownNumber(control, value) : 0);
  const [text, setText] = useState(display(numeric));
  const [focused, setFocused] = useState(false);
  // The last value this field wrote, so a change from elsewhere (Ctrl+Z, undo
  // in diff) shows up even while you're in the box.
  const typed = useRef(numeric);

  useEffect(() => {
    if (!focused || numeric !== typed.current) {
      typed.current = numeric;
      setText(display(numeric));
    }
  }, [numeric, focused]);

  const commit = (next: string) => {
    setText(next);
    if (next.trim() === '' || next === '-') return;
    let parsed = Number(next.replace(/[_,]/g, ''));
    if (!Number.isFinite(parsed)) return;
    // Within the field's limits, or (under sudo) only the save format's own. Typed in display units.
    const limits = { int: control.int, min: control.min === undefined ? undefined : control.min * scale, max: control.max === undefined ? undefined : control.max * scale };
    parsed = clampNumber(parsed, limits, sudo);
    // Retyping what's already shown changes nothing (a scaled value is rounded on screen).
    if (parsed === shownNumber(control, numeric)) return;
    const stored = parsed / scale;
    typed.current = stored;
    control.set(stored);
  };

  return (
    <span className="term-num">
      <input
        data-field
        inputMode="decimal"
        value={text}
        onFocus={(event) => {
          setFocused(true);
          event.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          setText(display(numeric));
        }}
        onChange={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            moveFocus(event.currentTarget, 1);
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            /* caret */
          } else navKeys(event);
        }}
        className={control.dim ? 'term-field term-field--num term-field--dim' : 'term-field term-field--num'}
        style={{ width: `${(control.width ?? 12) + 2}ch` }}
        aria-label={label}
        spellCheck={false}
      />
      {control.suffix ? <span className="term-faint">{control.suffix}</span> : null}
    </span>
  );
}
