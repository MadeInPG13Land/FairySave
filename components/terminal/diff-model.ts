/**
 * What changed in a save since it was opened (or last saved), as a list of
 * changes that can each be undone on their own: a whole field, one entry of a
 * list (a pin, a tape, the flares you added), or one field of an object.
 */
import { findCosmetic, findItem } from '@/lib/game-data';
import { isObject, type JsonObject, type JsonValue } from '@/lib/save';

export type ChangeKind = 'field' | 'added' | 'removed' | 'changed';

export interface Change {
  /** Stable enough for React keys within one render. */
  id: string;
  /** The top-level field this change lives in. */
  key: string;
  kind: ChangeKind;
  /** The field name, or the entry ("Flare x2", "Bigweave pin", "salePercent"). */
  label: string;
  /** "152688 -> 777", "54 entries -> 51 entries", "salePercent 20 -> 60". */
  detail?: string;
  /** The field's value with just this change undone, given its value now. undefined deletes the field. */
  undo: (current: JsonValue | undefined) => JsonValue | undefined;
  /** The reverse of undo: the field's value with this change applied again. */
  redo: (current: JsonValue | undefined) => JsonValue | undefined;
}

export interface FieldDiff {
  key: string;
  /** The field as a whole; undoing it restores the original value. */
  head: Change;
  /** For lists and objects: the individual entries that changed. */
  entries: Change[];
  /** Plain values: how they read before and after ("67", "999"). */
  from?: string;
  to?: string;
  /** Lists and objects: what happened inside, in words ("2 removed", "1 field changed"). */
  summary?: string;
}

const MAX_TEXT = 40;
const shorten = (value: string, max = MAX_TEXT) => (value.length > max ? `${value.slice(0, max - 3)}...` : value);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const json = (value: unknown) => JSON.stringify(value);

function show(value: unknown): string {
  if (value === undefined) return '—';
  if (Array.isArray(value)) return `[${plural(value.length, 'entry', 'entries')}]`;
  if (typeof value === 'string') return value === '' ? '""' : shorten(value);
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  return shorten(json(value));
}

/** A readable name for one entry of a list field: "Flare", "Bigweave pin", "Medkit 20%". */
export function entryLabel(key: string, entry: unknown): string {
  if (typeof entry === 'string') {
    if (key === 'unlockedCosmetics') {
      const cosmetic = findCosmetic(entry);
      return cosmetic ? `${cosmetic.label} ${cosmetic.type.toLowerCase()}` : entry;
    }
    return entry;
  }
  if (isObject(entry)) {
    // Train items keep their item under savedItemData.
    if (isObject(entry.savedItemData)) return entryLabel(key, entry.savedItemData);
    if ('itemName' in entry || 'itemDataName' in entry) {
      const name = findItem(entry)?.label ?? String(entry.itemName ?? entry.itemDataName);
      return typeof entry.salePercent === 'number' ? `${name} ${entry.salePercent}%` : name;
    }
    for (const field of ['name', 'title', 'id', 'key']) if (typeof entry[field] === 'string') return entry[field] as string;
  }
  return show(entry);
}

/** Identity of a list entry, so an edited entry shows as changed, not removed + added. */
function entryIdentity(entry: unknown): string | null {
  if (!isObject(entry)) return null;
  if (isObject(entry.savedItemData)) return entryIdentity(entry.savedItemData);
  const id = entry.itemName ?? entry.itemDataName ?? entry.name ?? entry.title ?? entry.id;
  return typeof id === 'string' ? id : null;
}

/** "salePercent 20 -> 40" for each field that differs. */
function objectChanges(before: JsonObject, after: JsonObject): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => json(before[field]) !== json(after[field]))
    .map((field) => `${field} ${shorten(show(before[field]), 16)} -> ${shorten(show(after[field]), 16)}`);
}

const asList = (value: JsonValue | undefined): JsonValue[] => (Array.isArray(value) ? value : []);

/** Replaces the first entry equal to `from` with `to`. */
function swap(current: JsonValue | undefined, from: JsonValue, to: JsonValue): JsonValue[] {
  const list = [...asList(current)];
  const at = list.findIndex((other) => json(other) === json(from));
  if (at >= 0) list[at] = to;
  return list;
}

/** An object with one field set (or removed when the value is undefined). */
function withField(current: JsonValue | undefined, field: string, value: JsonValue | undefined): JsonObject {
  const next = { ...(isObject(current) ? current : {}) };
  if (value === undefined) delete next[field];
  else next[field] = value;
  return next;
}

/** Removes one occurrence of each value (by JSON) from a list. */
function withoutEach(list: JsonValue[], remove: JsonValue[]): JsonValue[] {
  const left = [...list];
  for (const value of remove) {
    const at = left.findIndex((entry) => json(entry) === json(value));
    if (at >= 0) left.splice(at, 1);
  }
  return left;
}

function listChanges(key: string, before: JsonValue[], after: JsonValue[]): Change[] {
  // Match identical entries first (as a multiset); what's left was added or removed.
  const unmatched = new Map<string, number>();
  after.forEach((entry) => unmatched.set(json(entry), (unmatched.get(json(entry)) ?? 0) + 1));
  const removed: JsonValue[] = [];
  for (const entry of before) {
    const left = unmatched.get(json(entry)) ?? 0;
    if (left > 0) unmatched.set(json(entry), left - 1);
    else removed.push(entry);
  }
  const added: JsonValue[] = [];
  for (const entry of after) {
    const left = unmatched.get(json(entry)) ?? 0;
    if (left > 0) {
      unmatched.set(json(entry), left - 1);
      added.push(entry);
    }
  }

  // An entry removed and one added with the same identity is an edit.
  const changes: Change[] = [];
  for (const entry of [...removed]) {
    const id = entryIdentity(entry);
    const match = id === null ? -1 : added.findIndex((other) => entryIdentity(other) === id);
    if (match < 0) continue;
    const [edited] = added.splice(match, 1);
    removed.splice(removed.indexOf(entry), 1);
    changes.push({
      id: `${key}:~:${json(edited)}`,
      key,
      kind: 'changed',
      label: entryLabel(key, edited),
      detail: objectChanges(entry as JsonObject, edited as JsonObject).slice(0, 3).join(', '),
      undo: (current) => swap(current, edited, entry),
      redo: (current) => swap(current, entry, edited),
    });
  }

  // Group same-looking entries ("Flare x2"); undoing the group undoes all of them.
  const group = (entries: JsonValue[], kind: 'added' | 'removed'): Change[] => {
    const byLabel = new Map<string, JsonValue[]>();
    entries.forEach((entry) => byLabel.set(entryLabel(key, entry), [...(byLabel.get(entryLabel(key, entry)) ?? []), entry]));
    return [...byLabel].map(([label, values]) => ({
      id: `${key}:${kind}:${label}`,
      key,
      kind,
      label: values.length > 1 ? `${label} x${values.length}` : label,
      undo: (current) => (kind === 'added' ? withoutEach(asList(current), values) : [...asList(current), ...values]),
      redo: (current) => (kind === 'added' ? [...asList(current), ...values] : withoutEach(asList(current), values)),
    }));
  };
  return [...group(added, 'added'), ...group(removed, 'removed'), ...changes];
}

function objectFieldChanges(key: string, before: JsonObject, after: JsonObject): Change[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => json(before[field]) !== json(after[field]))
    .map((field) => ({
      id: `${key}.${field}`,
      key,
      kind: 'changed' as const,
      label: field,
      detail: `${show(before[field])} -> ${show(after[field])}`,
      undo: (current: JsonValue | undefined) => withField(current, field, before[field]),
      redo: (current: JsonValue | undefined) => withField(current, field, after[field]),
    }));
}

/**
 * Every changed top-level field, with its entry-level changes. `display` can
 * word a plain value the way the editor shows it (settings: "50%", not 0.5).
 */
export function diffDoc(original: JsonObject, data: JsonObject, display?: (key: string, value: unknown) => string | null): FieldDiff[] {
  const keys = [...new Set([...Object.keys(original), ...Object.keys(data)])].filter((key) => json(original[key]) !== json(data[key]));
  return keys.map((key) => {
    const before = original[key];
    const after = data[key];
    const shown = (value: unknown) => display?.(key, value) ?? show(value);
    const entries =
      Array.isArray(before) && Array.isArray(after)
        ? listChanges(key, before, after)
        : isObject(before) && isObject(after)
          ? objectFieldChanges(key, before, after)
          : [];
    // In words, "3 removed" or "2 added, 1 changed"; signs like -3 read as arithmetic.
    const counts = ['added', 'removed', 'changed']
      .map((kind) => [kind, entries.filter((e) => e.kind === kind).length] as const)
      .filter(([, n]) => n > 0)
      .map(([kind, n]) => `${n} ${kind}`)
      .join(', ');
    const detail =
      Array.isArray(before) && Array.isArray(after)
        ? `${plural(before.length, 'entry', 'entries')} -> ${plural(after.length, 'entry', 'entries')} · ${counts || 'same entries, new order'}`
        : isObject(before) && isObject(after)
          ? `${plural(entries.length, 'field')} changed`
          : `${shown(before)} -> ${shown(after)}`;
    const plain = !(Array.isArray(before) && Array.isArray(after)) && !(isObject(before) && isObject(after));
    return {
      key,
      head: { id: key, key, kind: 'field', label: key, detail, undo: () => before, redo: () => after },
      entries,
      ...(plain
        ? { from: shown(before), to: shown(after) }
        : { summary: Array.isArray(before) ? counts || 'same entries, new order' : `${plural(entries.length, 'field')} changed` }),
    };
  });
}
