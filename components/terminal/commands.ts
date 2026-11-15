/**
 * The CRT theme's command line. Each command reads/writes the same editor
 * store as the regular UI and returns lines of output to print.
 */
import {
  COSMETICS,
  CYCLE_DIFFICULTIES,
  DESTINATIONS,
  GAME_MODES,
  GAME_VERSION,
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
  findCosmetic,
  findItem,
  findModifier,
  findTape,
  prettify,
  type EnumEntry,
} from '@/lib/game-data';
import {
  TRAIN_ITEM_STATE,
  asArray,
  asStringArray,
  createTrainItem,
  isObject,
  unknownKeys,
  type JsonObject,
  type JsonValue,
} from '@/lib/save';
import { regFileName, useEditor, type SaveDoc } from '@/lib/store';
import { SETTINGS_EXPORT_COMMAND } from '@/lib/registry';
import { displaySetting, findSetting, parseSetting, settingCompletions } from '@/lib/settings';
import { BACKUPS_KEPT, listBackups } from '@/lib/backup-store';
import { diffDoc } from './diff-model';
import { fieldLabel } from './forms';
import { childSections, findSection, resolveSectionId, sectionBase, sectionParent } from './forms';
import { FAIRYLAND_LOGO } from './credits-logo';
import { useSudo } from './sudo';

/* -------------------------------------------------------------------------- */
/* Output model                                                               */
/* -------------------------------------------------------------------------- */

export type Tone = 'cyan' | 'mint' | 'gold' | 'magenta' | 'violet' | 'orange' | 'red' | 'dim';

export type Line =
  | { kind: 'text'; text: string; tone?: Tone | 'fg' | 'faint' }
  | { kind: 'record'; tag: string; tone: Tone; key: string; value: string; note?: string; command?: string; nested?: boolean }
  | { kind: 'header'; title: string; meta?: string; actions?: { label: string; command: string }[] }
  | { kind: 'links'; links: { label: string; command: string }[]; prefix?: string }
  | { kind: 'error'; text: string }
  | { kind: 'form'; docId: string; section: string; autofocus: boolean }
  /** Live list of a save's changes; each can be undone on its own. */
  | { kind: 'diff'; docId: string }
  /** The full-screen save menu, starting on this save (if any). */
  | { kind: 'save-menu'; docId: string | null }
  /** What a full-screen session changed, printed when it closes. */
  | { kind: 'changes'; title: string; file: string; unsaved: boolean; fields: ChangeSummary[] }
  /** The start screen's guided intro (live: it shows the saves open right now). */
  | { kind: 'intro' }
  /** neofetch-style block: ASCII art beside a title and key/value rows. */
  | { kind: 'fetch'; art: string; title: string; rows: { key: string; value: string; href?: string }[] }
  | { kind: 'blank' };

/** Where the prompt is: home (~), inside one save's directory, or one of its sections. */
export interface Cwd {
  docId: string | null;
  section: string | null;
}

export const ROOT: Cwd = { docId: null, section: null };

export interface CommandContext {
  openPicker: () => Promise<void>;
  setTheme: (theme: string) => void;
  clear: () => void;
  cwd: Cwd;
}

/**
 * Every open save is a directory under ~, named after its file:
 * "fairy engine save_1.fs" is ~/save_1. Two files with the same name get -2, -3.
 */
export function dirName(doc: Pick<SaveDoc, 'id' | 'fileName'> & { kind?: SaveDoc['kind'] }): string {
  // Game settings are always ~/settings, whatever the export was called.
  const base = (d: Pick<SaveDoc, 'fileName'> & { kind?: SaveDoc['kind'] }) =>
    d.kind === 'settings' ? 'settings' : d.fileName.replace(/^fairy engine /i, '').replace(/\.[^.]+$/, '').trim().replace(/\s+/g, '-') || 'save';
  const name = base(doc);
  const same = useEditor.getState().docs.filter((d) => base(d).toLowerCase() === name.toLowerCase());
  const index = same.findIndex((d) => d.id === doc.id);
  return index > 0 ? `${name}-${index + 1}` : name;
}

/** The absolute path of a save or one of its sections, for links that must work from anywhere: ~/PersistentData/cosmetics/pins */
/** What to do with a downloaded file: settings get double-clicked, saves copied into the folder. */
export const downloadedNote = (doc: Pick<SaveDoc, 'fileName' | 'kind'>) =>
  doc.kind === 'settings'
    ? `downloaded ${regFileName(doc.fileName)}. close the game, then double-click it.`
    : `downloaded ${doc.fileName}. copy it into your save folder to use it in game.`;

export const pathOf = (doc: Pick<SaveDoc, 'id' | 'fileName'>, section: string | null = null) =>
  `~/${dirName(doc)}${section ? `/${section}` : ''}`;

const docFor = (cwd: Cwd) => (cwd.docId ? (useEditor.getState().docs.find((d) => d.id === cwd.docId) ?? null) : null);

/** ~, ~/save_1, ~/PersistentData/cosmetics */
export function cwdLabel(cwd: Cwd): string {
  const doc = docFor(cwd);
  if (!doc) return '~';
  return cwd.section ? `~/${dirName(doc)}/${cwd.section}` : `~/${dirName(doc)}`;
}

type Result = Line[] | Promise<Line[]>;

interface Command {
  name: string;
  aliases?: string[];
  usage: string;
  summary: string;
  run: (args: string[], raw: string, ctx: CommandContext) => Result;
}

const text = (value: string, tone?: Extract<Line, { kind: 'text' }>['tone']): Line => ({ kind: 'text', text: value, tone });
const error = (value: string): Line => ({ kind: 'error', text: value });
const blank: Line = { kind: 'blank' };
const record = (tag: string, tone: Tone, key: string, value: unknown, note?: string, command?: string): Line => ({
  kind: 'record',
  tag,
  tone,
  key,
  value: formatValue(value),
  note,
  command,
});

function formatValue(value: unknown): string {
  if (value === undefined) return '—';
  if (typeof value === 'string') return value === '' ? '""' : value;
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return JSON.stringify(value);
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Best match by exact, then prefix, then substring on the normalised label. */
function fuzzy<T>(query: string, list: T[], keys: (item: T) => string[]): T | undefined {
  const q = norm(query);
  if (!q) return undefined;
  const scored = (test: (candidate: string) => boolean) => list.find((item) => keys(item).some((k) => test(norm(k))));
  return scored((k) => k === q) ?? scored((k) => k.startsWith(q)) ?? scored((k) => k.includes(q));
}

function enumLabel(list: EnumEntry[], value: unknown) {
  return list.find((entry) => entry.value === Number(value))?.label ?? `unknown (${formatValue(value)})`;
}

/* -------------------------------------------------------------------------- */
/* Doc access                                                                 */
/* -------------------------------------------------------------------------- */

function activeDoc(): SaveDoc | null {
  const state = useEditor.getState();
  return state.docs.find((doc) => doc.id === state.activeId) ?? null;
}

/** Lines printed before a command's own output (e.g. an automatic save switch). */
let notices: Line[] = [];
/** The location while a command runs, and where it moves the prompt to. */
let currentCwd: Cwd = ROOT;
let nextCwd: Cwd | null = null;
const go = (cwd: Cwd) => {
  if (cwd.docId && cwd.docId !== useEditor.getState().activeId) useEditor.getState().activate(cwd.docId);
  nextCwd = cwd;
  currentCwd = cwd;
};
const enter = (doc: SaveDoc, section: string | null = null) => go({ docId: doc.id, section });
const kindName = (kind: SaveDoc['kind']) => (kind === 'player' ? 'profile' : kind);
const newest = (kind: SaveDoc['kind']) =>
  [...useEditor.getState().docs].filter((d) => d.kind === kind).sort((a, b) => b.openedAt - a.openedAt)[0];

/**
 * The save a command works on: the directory you're in. From ~ (or the wrong
 * kind of save) it moves into the right one and says so.
 */
function requireDoc(kind?: 'player' | 'world'): SaveDoc | Line[] {
  const here = docFor(currentCwd);
  if (here && (!kind || here.kind === kind)) return here;
  const docs = useEditor.getState().docs;
  if (docs.length === 0) return [error('no save open.'), { kind: 'links', prefix: 'try', links: [{ label: 'open', command: 'open' }] }];
  const match = kind ? (here?.kind === kind ? here : newest(kind)) : (activeDoc() ?? docs.at(-1)!);
  if (!match) {
    const what = kind === 'player' ? 'your profile, fairy engine PersistentData.fs' : 'a world save, fairy engine save_N.fs';
    return [
      error(`this works on ${what}, and none is open.`),
      { kind: 'links', prefix: 'open one with', links: [{ label: 'open', command: 'open' }] },
    ];
  }
  enter(match);
  notices.push(text(`cd ~/${dirName(match)}`, 'dim'));
  return match;
}

const set = (key: string, value: JsonValue | undefined) => useEditor.getState().setField(key, value);
const shortName = (doc: Pick<SaveDoc, 'fileName'>) => doc.fileName.replace(/^fairy engine /i, '');

/** Fields that hold an enum, so `set gamemode starless` works. */
const ENUM_FIELDS: Record<string, EnumEntry[]> = {
  gamemode: GAME_MODES,
  cycleDifficulty: CYCLE_DIFFICULTIES,
  gender: GENDERS,
  privacy: LOBBY_PRIVACY,
};

function parseValue(key: string, raw: string, current: unknown): JsonValue {
  const enumList = key === 'dataDeckSkin' ? dataDeckSkinsFor(activeDoc()?.data ?? {}) : ENUM_FIELDS[key];
  if (enumList) {
    const match = fuzzy(raw, enumList, (entry) => [entry.label, entry.key, String(entry.value)]);
    if (match) return match.value;
  }
  if (typeof current === 'number') {
    const number = Number(raw.replace(/[_,]/g, ''));
    if (!Number.isFinite(number)) throw new Error(`${key} expects a number.`);
    return number;
  }
  if (typeof current === 'boolean') {
    if (/^(true|on|yes|1)$/i.test(raw)) return true;
    if (/^(false|off|no|0)$/i.test(raw)) return false;
    throw new Error(`${key} expects true or false.`);
  }
  if (typeof current === 'string' || current === undefined) {
    try {
      const parsed = JSON.parse(raw);
      if (current === undefined) return parsed;
    } catch {
      /* plain string */
    }
    return raw.replace(/^"(.*)"$/, '$1');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${key} holds ${Array.isArray(current) ? 'a list' : 'an object'}; give it as JSON.`);
  }
}

/* -------------------------------------------------------------------------- */
/* Sections (rendered as live, editable forms; see forms.tsx)                 */
/* -------------------------------------------------------------------------- */

const tagFor = (value: unknown): [string, Tone] =>
  typeof value === 'number'
    ? ['NUM', 'gold']
    : typeof value === 'boolean'
      ? ['BOOL', 'violet']
      : typeof value === 'string'
        ? ['STR', 'cyan']
        : Array.isArray(value)
          ? ['LIST', 'magenta']
          : ['OBJ', 'orange'];

/** A section's form, or for a folder (like cosmetics) a listing of what's inside. */
function printSection(id: string, doc: SaveDoc, autofocus = false): Line[] | null {
  const section = findSection(doc.kind, id);
  if (!section) return null;
  if (!section.children) return [{ kind: 'form', docId: doc.id, section: id, autofocus }];
  return listing(doc, id);
}

/** A short status for a section in a folder listing, e.g. "12/29 unlocked". */
function sectionNote(doc: SaveDoc, id: string): string | undefined {
  const unlocked = new Set(asStringArray(doc.data.unlockedCosmetics));
  const count = (list: { id: string }[]) => `${list.filter((c) => unlocked.has(c.id)).length}/${list.length} unlocked`;
  if (id === 'cosmetics/pins') return count(PINS);
  if (id === 'cosmetics/patches') return count(PATCHES);
  if (id === 'cosmetics/slots') {
    const equipped = ['pin1', 'pin2', 'patch1', 'patch2'].filter((key) => typeof doc.data[key] === 'string' && doc.data[key] !== 'none');
    return `${equipped.length}/4 equipped`;
  }
  return undefined;
}

/** Top-level section names in a save. */
function sectionNames(doc: SaveDoc | null) {
  return childSections(doc?.kind ?? 'json', null).map((section) => section.id);
}


/* -------------------------------------------------------------------------- */
/* Commands                                                                   */
/* -------------------------------------------------------------------------- */

export const TOPICS = [
  { id: 'files', summary: 'open, move between and close saves', commands: ['open', 'settings', 'ls', 'cd', 'use', 'close'] },
  { id: 'inspect', summary: 'read what is in the save', commands: ['show', 'get', 'diff', 'json'] },
  { id: 'edit', summary: 'change fields, undo, write back', commands: ['edit', 'set', 'revert', 'save', 'export', 'backups', 'restore'] },
  { id: 'profile', summary: 'cosmetics, tapes and data-deck skins', commands: ['unlock', 'lock', 'equip'] },
  { id: 'world', summary: 'train items, trader and destinations', commands: ['give', 'drop', 'catalog', 'sale', 'loot', 'mod'] },
  { id: 'system', summary: 'screen and theme', commands: ['clear', 'theme', 'help', 'credits', 'sudo'] },
] as const;

/**
 * Which save `save` writes: the one named, else the one you're in, else the
 * only one with unsaved changes. With several unsaved and none chosen, it asks.
 */
function saveTarget(target: string | undefined): SaveDoc | Line[] {
  if (target) {
    const found = resolveTarget(currentCwd, target);
    const doc = found && 'dir' in found ? docFor(found.dir) : found && 'file' in found ? found.file.doc : (findDir(target) ?? null);
    return doc ?? [error(`save: no open save "${target}".`), ...hereLinks()];
  }
  const here = docFor(currentCwd);
  if (here) return here;
  const { docs } = useEditor.getState();
  const dirty = docs.filter((d) => countTopLevel(d) > 0);
  if (dirty.length === 1) return dirty[0];
  if (dirty.length === 0) return [text(docs.length ? 'nothing to save; every save is up to date.' : 'no save open.', 'dim')];
  return [
    text(`${dirty.length} saves have unsaved changes. which one?`, 'fg'),
    { kind: 'links', prefix: 'save', links: dirty.map((d) => ({ label: dirName(d), command: `save ${pathOf(d)}` })) },
  ];
}

/** The save directory a name points at: save_1, PersistentData (any case), or world/profile for the newest of that kind. */
function findDir(name: string): SaveDoc | undefined {
  const docs = useEditor.getState().docs;
  const lower = name.toLowerCase();
  const exact = docs.find((d) => dirName(d).toLowerCase() === lower);
  if (exact) return exact;
  if (lower === 'world') return newest('world');
  if (lower === 'profile') return newest('player');
  const prefixed = docs.filter((d) => dirName(d).toLowerCase().startsWith(lower));
  return prefixed.length === 1 ? prefixed[0] : undefined;
}

const isHome = (part: string) => part === '~' || part === '/' || part === 'home';
const isUp = (part: string) => part === '..' || part === 'back' || part === 'up';

/*
 * The filesystem: ~ holds one directory per open save. Inside a save, each
 * section is a file you open with `edit` (a live form); folders such as
 * cosmetics/ hold more files. `cd` only enters directories.
 */
type Target = { dir: Cwd } | { file: { doc: SaveDoc; id: string } };

const isFolder = (doc: SaveDoc, id: string | null) => Boolean(id && findSection(doc.kind, id)?.children);

/**
 * Where a path leads from `from`, without moving. `loose` lets a single name
 * match a file anywhere in the save (so `edit pins` works from the save root).
 */
function resolveTarget(from: Cwd, path: string, loose = false): Target | null {
  const parts = path.split('/').filter(Boolean);
  let at: Cwd = path.startsWith('~') || path.startsWith('/') ? ROOT : from;
  for (const [index, raw] of parts.entries()) {
    const part = raw.toLowerCase();
    const doc = docFor(at);
    if (isHome(part)) at = ROOT;
    else if (part === '.') continue;
    else if (isUp(part)) at = doc && at.section ? { docId: doc.id, section: sectionParent(at.section) } : ROOT;
    else if (!doc) {
      const dir = findDir(part);
      if (!dir) return null;
      at = { docId: dir.id, section: null };
    } else {
      const id = resolveSectionId(doc.kind, part, at.section, !(loose && parts.length === 1));
      if (!id) return null;
      if (isFolder(doc, id)) at = { docId: doc.id, section: id };
      else return index === parts.length - 1 ? { file: { doc, id } } : null;
    }
  }
  return { dir: at };
}

/** Move the prompt: a save, a folder, .., ~, or a path like ~/PersistentData/cosmetics. */
function changeDir(target: string): Line[] {
  const found = resolveTarget(currentCwd, target);
  const last = target.split('/').filter(Boolean).at(-1)?.toLowerCase() ?? target;
  if (!found) {
    const other = findDir(last);
    return [
      error(`cd: no such directory: ${target}`),
      ...(other && docFor(currentCwd) ? [text(`${dirName(other)} is in ~. try cd ~/${dirName(other)}.`, 'dim')] : []),
      ...hereLinks(),
    ];
  }
  if ('file' in found) {
    return [
      error(`cd: ${target} is a file, not a directory.`),
      { kind: 'links', prefix: 'open it with', links: [{ label: `edit ${target}`, command: `edit ${pathOf(found.file.doc, found.file.id)}` }] },
    ];
  }
  go(found.dir);
  const doc = docFor(found.dir);
  if (!doc || isHome(last) || isUp(last) || last === '.') return [];
  return found.dir.section ? listing(doc, found.dir.section) : contextHelp(doc, false);
}

/** Open a section file as a live form. */
function openFile(target: string, autofocus: boolean): Line[] {
  let found = resolveTarget(currentCwd, target, true);
  // From ~, look for the file in the open saves, the active one first.
  if (!found && !docFor(currentCwd)) {
    const { docs, activeId } = useEditor.getState();
    for (const doc of [...docs].sort((a, b) => Number(b.id === activeId) - Number(a.id === activeId))) {
      const hit = resolveTarget({ docId: doc.id, section: null }, target, true);
      if (hit && 'file' in hit) {
        found = hit;
        break;
      }
    }
  }
  if (!found) return [error(`no such file: ${target}`), ...hereLinks()];
  if ('dir' in found) {
    const doc = docFor(found.dir);
    if (!doc) return listHere();
    return [text(`${target} is a directory. cd ${target} to go in, or edit one of these:`, 'dim'), ...listing(doc, found.dir.section, false)];
  }
  useEditor.getState().activate(found.file.doc.id);
  return printSection(found.file.id, found.file.doc, autofocus)!;
}

/** Folders you can cd into from here. */
function subdirs(cwd: Cwd): string[] {
  const doc = docFor(cwd);
  if (!doc) return useEditor.getState().docs.map(dirName);
  return childSections(doc.kind, cwd.section)
    .filter((section) => section.children)
    .map((section) => sectionBase(section.id));
}

/** Files you can edit from here. */
function filesIn(cwd: Cwd): string[] {
  const doc = docFor(cwd);
  if (!doc) return [];
  return childSections(doc.kind, cwd.section)
    .filter((section) => !section.children)
    .map((section) => sectionBase(section.id));
}

/** Clickable names of what's in a directory: folders cd, files edit. */
function entryLinks(doc: SaveDoc, within: string | null): Line {
  return {
    kind: 'links',
    prefix: 'here:',
    links: childSections(doc.kind, within).map((section) => {
      const name = sectionBase(section.id);
      return section.children ? { label: `${name}/`, command: `cd ${pathOf(doc, section.id)}` } : { label: name, command: `edit ${pathOf(doc, section.id)}` };
    }),
  };
}

function hereLinks(): Line[] {
  const doc = docFor(currentCwd);
  if (!doc) {
    const docs = useEditor.getState().docs;
    return docs.length
      ? [{ kind: 'links', prefix: 'cd into', links: docs.map((d) => ({ label: dirName(d), command: `cd ${pathOf(d)}` })) }]
      : [{ kind: 'links', prefix: 'start with', links: [{ label: 'open', command: 'open' }] }];
  }
  return [entryLinks(doc, currentCwd.section)];
}

/** The contents of a save or folder: folders end in a slash, files open with edit. */
function listing(doc: SaveDoc, within: string | null, withHeader = true): Line[] {
  const folder = findSection(doc.kind, within);
  const header: Line[] =
    withHeader && folder
      ? [
          {
            kind: 'header',
            title: folder.id,
            actions: folder.id === 'cosmetics' ? [{ label: 'unlock all', command: 'unlock cosmetics' }, { label: 'lock all', command: 'lock cosmetics' }] : undefined,
          },
        ]
      : [];
  return [
    ...header,
    ...childSections(doc.kind, within).map((child) => {
      const name = sectionBase(child.id);
      return child.children
        ? record('DIR', 'cyan', `${name}/`, child.summary, undefined, `cd ${pathOf(doc, child.id)}`)
        : record('FILE', 'mint', name, child.summary, sectionNote(doc, child.id), `edit ${pathOf(doc, child.id)}`);
    }),
  ];
}

/** ls: saves at ~, files and folders inside a save. */
function listHere(at: Cwd = currentCwd): Line[] {
  const doc = docFor(at);
  const { docs } = useEditor.getState();
  if (!doc) {
    if (docs.length === 0) return [text('nothing here yet.', 'dim'), { kind: 'links', prefix: 'try', links: [{ label: 'open', command: 'open' }] }];
    return docs.map((d) => {
      const changes = countTopLevel(d);
      const tag = d.kind === 'player' ? 'PROF' : d.kind === 'world' ? 'WORLD' : d.kind === 'settings' ? 'PREFS' : 'JSON';
      return record(tag, d.kind === 'player' ? 'cyan' : d.kind === 'settings' ? 'mint' : 'gold', `${dirName(d)}/`, d.fileName, changes ? `${changes} unsaved` : kindName(d.kind), `cd ${pathOf(d)}`);
    });
  }
  return listing(doc, at.section, false);
}

/** What you can do from where you are. */
function contextHelp(doc: SaveDoc | null, full: boolean): Line[] {
  const cmd = (name: string) => {
    const command = findCommand(name)!;
    return { kind: 'record', tag: 'CMD', tone: 'mint', key: command.name, value: command.summary, note: command.usage, command: `help ${command.name}` } as Line;
  };
  if (!doc) {
    const docs = useEditor.getState().docs;
    return [
      text('you are home (~). every open save is a directory here.', 'dim'),
      ...(docs.length ? listHere() : [text('nothing open yet.', 'dim')]),
      blank,
      ...['open', 'ls', 'cd'].map(cmd),
      ...(full
        ? [blank, text('cd <save> to go in, tab completes names. help <topic> lists everything:', 'dim'), { kind: 'links', prefix: 'topics:', links: TOPICS.map((t) => ({ label: t.id, command: `help ${t.id}` })) } as Line]
        : []),
    ];
  }
  if (currentCwd.section) return [entryLinks(doc, currentCwd.section)];
  const local = doc.kind === 'world' ? ['give', 'drop', 'catalog', 'sale', 'loot', 'mod'] : doc.kind === 'player' ? ['unlock', 'lock', 'equip'] : [];
  if (!full) return [entryLinks(doc, null)];
  return [
    entryLinks(doc, null),
    text(`edit <file> opens it full screen. <field> <value> sets a field, e.g. ${doc.kind === 'world' ? 'credits 50000' : doc.kind === 'settings' ? 'FlavorIndex 3' : 'prestige 10'}.`, 'dim'),
    blank,
    ...local.map(cmd),
    ...['set', 'diff', 'save'].map(cmd),
  ];
}

/** The credits block: the game, who made it, and where to get it. Shown on start and by `credits`. */
export function creditsLine(): Line {
  return {
    kind: 'fetch',
    art: FAIRYLAND_LOGO,
    title: 'Forsaken Frontiers',
    rows: [
      { key: 'by', value: 'made in fairyland', href: 'https://madeinfairyland.com/' },
      { key: 'steam', value: 'store.steampowered.com/app/2810780', href: 'https://store.steampowered.com/app/2810780/' },
    ],
  };
}

const COMMANDS: Command[] = [
  {
    name: 'cd',
    aliases: ['go'],
    usage: 'cd <save|folder|..|~>',
    summary: 'move between directories: ~, a save, a section',
    run: ([target]) => changeDir(target ?? '~'),
  },
  {
    name: 'help',
    aliases: ['?', 'man'],
    usage: 'help [topic|command]',
    summary: 'what you can do from here',
    run: ([name]) => {
      const doc = docFor(currentCwd);
      if (!name) return contextHelp(doc, true);
      const topic = name ? TOPICS.find((t) => t.id === name.toLowerCase()) : undefined;
      if (topic) {
        return [
          { kind: 'header', title: `help ${topic.id}`, meta: topic.summary },
          ...topic.commands.map((commandName) => {
            const command = findCommand(commandName)!;
            return { kind: 'record', tag: 'CMD', tone: 'mint', key: command.name, value: command.summary, note: command.usage, command: `help ${command.name}` } as Line;
          }),
        ];
      }
      if (name) {
        const command = findCommand(name);
        if (!command) return [error(`no topic or command "${name}".`), { kind: 'links', prefix: 'topics:', links: TOPICS.map((t) => ({ label: t.id, command: `help ${t.id}` })) }];
        return [
          record('CMD', 'mint', command.name, command.summary),
          text(`usage: ${command.usage}`, 'dim'),
          ...(command.aliases?.length ? [text(`aka: ${command.aliases.join(', ')}`, 'faint')] : []),
        ];
      }
      return [
        text('commands are grouped by topic. pick one:', 'dim'),
        blank,
        ...TOPICS.map((t) => ({ kind: 'record', tag: 'TOPIC', tone: 'cyan', key: t.id, value: t.summary, note: t.commands.join(' '), command: `help ${t.id}` }) as Line),
        blank,
        doc
          ? { kind: 'links', prefix: 'quick look:', links: sectionNames(doc).map((section) => ({ label: section, command: `show ${section}` })) }
          : { kind: 'links', prefix: 'new here? start with', links: [{ label: 'open', command: 'open' }] },
        text('tab completes · up/down for history · drop .fs files anywhere', 'faint'),
      ];
    },
  },
  {
    name: 'open',
    usage: 'open',
    summary: 'pick save files to open',
    run: async (_args, _raw, ctx) => {
      const before = useEditor.getState().docs.length;
      await ctx.openPicker();
      if (useEditor.getState().docs.length === before) return [text('nothing opened.', 'dim')];
      return [];
    },
  },
  {
    name: 'settings',
    aliases: ['prefs', 'registry'],
    usage: 'settings',
    summary: "the game's settings (flavour, volumes, mouse…): go there, or how to load them",
    run: async () => {
      const doc = newest('settings');
      if (doc) {
        enter(doc);
        return listing(doc, null, false);
      }
      return [
        text('the game keeps these in the registry. export them, then drop the file here:', 'dim'),
        text(SETTINGS_EXPORT_COMMAND, 'fg'),
      ];
    },
  },
  {
    name: 'ls',
    aliases: ['dir', 'll'],
    usage: 'ls [folder]',
    summary: 'list what is here (or in a folder): saves at ~, files in a save',
    run: ([target]) => {
      if (!target) return listHere();
      const found = resolveTarget(currentCwd, target);
      if (!found) return [error(`ls: no such directory: ${target}`)];
      if ('file' in found) return [text(`${target} is a file.`, 'dim'), { kind: 'links', prefix: 'open it with', links: [{ label: `edit ${target}`, command: `edit ${pathOf(found.file.doc, found.file.id)}` }] }];
      return listHere(found.dir);
    },
  },
  {
    name: 'use',
    usage: 'use <n|name>',
    summary: 'go into an open save by number or name',
    run: ([target]) => {
      const { docs } = useEditor.getState();
      const doc = /^\d+$/.test(target ?? '') ? docs[Number(target) - 1] : (findDir(target ?? '') ?? fuzzy(target ?? '', docs, (d) => [d.fileName, shortName(d)]));
      if (!doc) return [error(`no open save "${target ?? ''}". see ls at ~.`)];
      enter(doc);
      return contextHelp(doc, false);
    },
  },
  {
    name: 'edit',
    aliases: ['vi', 'vim', 'nano', 'e'],
    usage: 'edit <file>',
    summary: 'open a file (profile, economy, pins...) as a form, cursor in the first field',
    run: ([name]) => {
      if (!name) return [text('edit which file?', 'dim'), ...(docFor(currentCwd) ? listHere() : hereLinks())];
      return openFile(name, true);
    },
  },
  {
    name: 'show',
    aliases: ['cat', 'view', 'less'],
    usage: 'show <file>',
    summary: 'print a file as a form without moving the cursor into it',
    run: ([name]) => {
      if (!name) return [text('show which file?', 'dim'), ...(docFor(currentCwd) ? listHere() : hereLinks())];
      return openFile(name, false);
    },
  },
  {
    name: 'get',
    usage: 'get <key>',
    summary: 'print one field',
    run: ([key]) => {
      const doc = requireDoc();
      if (Array.isArray(doc)) return doc;
      const actual = resolveKey(doc, key);
      if (!actual) return [error(`no field "${key ?? ''}".`)];
      const value = doc.data[actual];
      if (typeof value === 'object' && value !== null) return [text(JSON.stringify(value, null, 2), 'fg')];
      const [tag, tone] = tagFor(value);
      return [record(tag, tone, actual, value)];
    },
  },
  {
    name: 'set',
    usage: 'set <key> <value>',
    summary: 'change a field (numbers, true/false, enum names, JSON)',
    run: ([key, ...rest]) => {
      const doc = requireDoc();
      if (Array.isArray(doc)) return doc;
      if (!key || rest.length === 0) return [error('usage: set <key> <value>')];
      const actual = resolveKey(doc, key) ?? key;
      const before = doc.data[actual];
      // Game settings take the editor's units: `MasterVolume 50` is 50%, `Subtitles off`, `FlavorIndex melon`.
      const setting = doc.kind === 'settings' ? findSetting(actual) : undefined;
      try {
        const value = setting ? parseSetting(setting, rest.join(' ')) : parseValue(actual, rest.join(' '), before);
        set(actual, value);
        const enumList = actual === 'dataDeckSkin' ? dataDeckSkinsFor(doc.data) : ENUM_FIELDS[actual];
        const show = (v: unknown) =>
          setting ? (displaySetting(actual, v) ?? formatValue(v)) : enumList && v !== undefined ? enumLabel(enumList, v) : formatValue(v);
        return [record('SET', 'gold', actual, `${show(before)} -> ${show(value)}`, before === undefined ? 'new field' : undefined)];
      } catch (err) {
        return [error(err instanceof Error ? err.message : 'could not set that.')];
      }
    },
  },
  {
    name: 'unlock',
    usage: 'unlock <all|cosmetics|tapes|skins|id>',
    summary: 'unlock cosmetics, tapes or data-deck skins',
    run: (args) => toggleUnlock(args, true),
  },
  {
    name: 'lock',
    usage: 'lock <all|cosmetics|tapes|skins|id>',
    summary: 'the reverse of unlock',
    run: (args) => toggleUnlock(args, false),
  },
  {
    name: 'equip',
    usage: 'equip <pin1|pin2|patch1|patch2> <cosmetic|none>',
    summary: 'wear a pin or patch',
    run: ([slot, ...rest]) => {
      const doc = requireDoc('player');
      if (Array.isArray(doc)) return doc;
      if (!/^(pin|patch)[12]$/.test(slot ?? '')) return [error('slot must be pin1, pin2, patch1 or patch2.')];
      const query = rest.join(' ');
      if (/^none$/i.test(query)) {
        set(slot, undefined);
        return [record('SLOT', 'mint', slot, 'none')];
      }
      const pool = slot.startsWith('pin') ? PINS : PATCHES;
      const cosmetic = fuzzy(query, pool, (c) => [c.id, c.label]);
      if (!cosmetic) return [error(`no ${slot.startsWith('pin') ? 'pin' : 'patch'} matching "${query}".`)];
      set(slot, cosmetic.id);
      const unlocked = asStringArray(doc.data.unlockedCosmetics);
      if (!unlocked.includes(cosmetic.id)) set('unlockedCosmetics', [...unlocked, cosmetic.id]);
      return [record('SLOT', 'mint', slot, cosmetic.label, cosmetic.id)];
    },
  },
  {
    name: 'give',
    usage: 'give <item> [count]',
    summary: 'put items on the train',
    run: (args) => {
      const doc = requireDoc('world');
      if (Array.isArray(doc)) return doc;
      // Count can go anywhere: give 3 flare, give flare 3, give flare x3.
      const countIndex = args.findIndex((arg) => /^x?\d+$/i.test(arg));
      const count = countIndex >= 0 ? Math.max(1, Math.min(50, Number(args[countIndex].replace(/^x/i, '')))) : 1;
      const query = args.filter((_, i) => i !== countIndex).join(' ');
      if (!query) return [error('usage: give <item> [count]'), { kind: 'links', prefix: 'see', links: [{ label: 'catalog', command: 'catalog' }] }];
      const def = fuzzy(query, ITEMS, (item) => [item.label, item.itemDataName, item.itemName, item.shop?.name ?? '']);
      if (!def) return [error(`no item matching "${query}".`), { kind: 'links', prefix: 'see', links: [{ label: 'catalog', command: 'catalog' }] }];
      let items = asArray(doc.data.trainItems);
      for (let i = 0; i < count; i += 1) items = [...items, createTrainItem(def, items)];
      set('trainItems', items);
      return [record('GIVE', 'mint', def.label, `x${count}`, `${items.length} items on the train`)];
    },
  },
  {
    name: 'drop',
    usage: 'drop <#n|item|all>',
    summary: 'remove items from the train',
    run: ([target, ...rest]) => {
      const doc = requireDoc('world');
      if (Array.isArray(doc)) return doc;
      const items = asArray(doc.data.trainItems).filter(isObject);
      if (target === 'all') {
        set('trainItems', []);
        return [record('DROP', 'red', 'all items', `${items.length} removed`)];
      }
      const index = /^#?\d+$/.test(target ?? '') ? Number(target.replace('#', '')) - 1 : -1;
      if (index >= 0) {
        if (!items[index]) return [error(`no item #${index + 1}.`)];
        set('trainItems', items.filter((_, i) => i !== index));
        return [record('DROP', 'red', `#${index + 1}`, 'removed')];
      }
      const def = fuzzy([target, ...rest].join(' '), ITEMS, (item) => [item.label, item.itemDataName, item.itemName]);
      if (!def) return [error('usage: drop <#n|item|all>')];
      const kept = items.filter((entry) => findItem(isObject(entry.savedItemData) ? entry.savedItemData : {}) !== def);
      set('trainItems', kept);
      return [record('DROP', 'red', def.label, `${items.length - kept.length} removed`)];
    },
  },
  {
    name: 'catalog',
    aliases: ['shop'],
    usage: 'catalog',
    summary: 'every item in the game',
    run: () => [
      { kind: 'header', title: 'catalog', meta: `game v${GAME_VERSION}  ${ITEMS.length} items` },
      ...ITEMS.map((item) =>
        record('ITEM', item.shop?.saleAllowed ? 'cyan' : 'violet', item.label, item.shop ? `$${item.shop.cost.toLocaleString()}` : 'not sold', item.description.split('\n')[0], `give ${item.label.toLowerCase()}`),
      ),
    ],
  },
  {
    name: 'sale',
    usage: 'sale <item> <percent> | sale clear',
    summary: 'put an item on sale at the trader',
    run: (args) => {
      const doc = requireDoc('world');
      if (Array.isArray(doc)) return doc;
      if (args[0] === 'clear') {
        set('saleItems', []);
        return [record('SALE', 'orange', 'all', 'cleared')];
      }
      const percent = Number(args.pop());
      const def = fuzzy(args.join(' '), SALE_ITEMS, (item) => [item.label, item.shop!.name, item.itemDataName]);
      if (!def || !Number.isFinite(percent)) return [error('usage: sale <item> <percent>')];
      const sales = asArray(doc.data.saleItems).filter(isObject).filter((sale) => findItem(String(sale.itemName)) !== def);
      const clamped = Math.max(0, Math.min(100, Math.round(percent)));
      set('saleItems', [...sales, { itemName: def.shop!.name, salePercent: clamped }]);
      return [record('SALE', 'orange', def.label, `${clamped}% off`)];
    },
  },
  {
    name: 'loot',
    usage: 'loot <destination|all> <percent>',
    summary: 'set loot left at a stop',
    run: (args) => {
      const doc = requireDoc('world');
      if (Array.isArray(doc)) return doc;
      const percent = Number(args.pop());
      if (!Number.isFinite(percent)) return [error('usage: loot <destination|all> <percent>')];
      const value = Math.max(0, Math.min(100, Math.round(percent)));
      const all = destinationsFor(doc.data);
      const targets = args.join(' ') === 'all' ? all : [fuzzy(args.join(' '), all, (d) => [d.name])].filter(Boolean);
      if (targets.length === 0) return [error(`no destination "${args.join(' ')}".`)];
      targets.forEach((destination) => set(destinationKeys(destination!.name).loot, value));
      return targets.map((destination) => record('LOOT', 'gold', destination!.name, `${value}%`));
    },
  },
  {
    name: 'mod',
    aliases: ['modifier'],
    usage: 'mod <destination|all> <modifier>',
    summary: 'set the world modifier at a stop (shown and actual)',
    run: (args) => {
      const doc = requireDoc('world');
      if (Array.isArray(doc)) return doc;
      const modifier = fuzzy(args.pop() ?? '', WORLD_MODIFIERS, (m) => [m.label, m.key, String(m.value)]);
      if (!modifier) return [error(`unknown modifier. one of: ${WORLD_MODIFIERS.map((m) => m.label.toLowerCase()).join(', ')}`)];
      const all = destinationsFor(doc.data);
      const targets = args.join(' ') === 'all' ? all : [fuzzy(args.join(' '), all, (d) => [d.name])].filter(Boolean);
      if (targets.length === 0) return [error(`no destination "${args.join(' ')}".`)];
      targets.forEach((destination) => {
        const keys = destinationKeys(destination!.name);
        set(keys.modifier, modifier.value);
        set(keys.effective, modifier.value);
      });
      return targets.map((destination) => record('MOD', modifier.tone === 'positive' ? 'cyan' : modifier.value === 0 ? 'dim' : 'red', destination!.name, modifier.label));
    },
  },
  {
    name: 'diff',
    aliases: ['status'],
    usage: 'diff [save]',
    summary: 'what changed since opening / last save; tab through it and undo single changes',
    run: ([target]) => {
      // `diff ~/save_1` looks at another save without moving there.
      const found = target ? resolveTarget(currentCwd, target) : null;
      const named = found && 'dir' in found ? docFor(found.dir) : target ? (findDir(target) ?? null) : null;
      if (target && !named) return [error(`diff: no open save "${target}".`), ...hereLinks()];
      const doc = named ?? requireDoc();
      if (Array.isArray(doc)) return doc;
      if (countTopLevel(doc) === 0) return [text('no changes.', 'dim')];
      return [{ kind: 'diff', docId: doc.id }];
    },
  },
  {
    name: 'save',
    aliases: ['w', ':w'],
    usage: 'save [save]',
    summary: 'pick a save to write (or download); save <save> writes that one straight away',
    run: async ([target]) => {
      if (!target) {
        if (useEditor.getState().docs.length === 0) return [text('no save open.', 'dim'), { kind: 'links', prefix: 'try', links: [{ label: 'open', command: 'open' }] }];
        return [{ kind: 'save-menu', docId: docFor(currentCwd)?.id ?? null }];
      }
      const doc = saveTarget(target);
      if (Array.isArray(doc)) return doc;
      // Saving is allowed any time, changes or not. The store saves the active save, so make it this one.
      useEditor.getState().activate(doc.id);
      const how = await useEditor.getState().save();
      if (!how) return [error(`could not save ${shortName(doc)}.`)];
      return [
        text(how === 'file' ? `wrote ${shortName(doc)}.` : downloadedNote(doc), how === 'file' ? 'fg' : 'dim'),
      ];
    },
  },
  {
    name: 'export',
    usage: 'export',
    summary: 'download a copy',
    run: async () => {
      const doc = requireDoc();
      if (Array.isArray(doc)) return doc;
      useEditor.getState().activate(doc.id);
      await useEditor.getState().save({ download: true });
      return [text(downloadedNote(doc), 'fg')];
    },
  },
  {
    name: 'revert',
    usage: 'revert',
    summary: 'throw away unsaved changes',
    run: () => {
      const doc = requireDoc();
      if (Array.isArray(doc)) return doc;
      useEditor.getState().revert();
      return [text(`reverted ${shortName(doc)}.`, 'fg')];
    },
  },
  {
    name: 'backups',
    usage: 'backups',
    summary: 'list earlier copies of this file, kept before each save',
    run: async () => {
      const doc = requireDoc();
      if (Array.isArray(doc)) return doc;
      const list = await listBackups(doc.fileName);
      if (list.length === 0) {
        return [text(`no backups yet. the last ${BACKUPS_KEPT} versions are kept each time you save in place.`, 'dim')];
      }
      return [
        { kind: 'header', title: 'backups', meta: `${shortName(doc)}  newest first` },
        ...list.map((backup, index) =>
          record('BAK', 'gold', String(index + 1), new Date(backup.savedAt).toLocaleString(), `${Math.ceil(backup.text.length / 1024)} KB`, `restore ${index + 1}`),
        ),
        text('restore <n> loads one as unsaved changes; nothing is written until you save.', 'faint'),
      ];
    },
  },
  {
    name: 'restore',
    usage: 'restore <n>',
    summary: 'load a backup (see backups) as unsaved changes',
    run: async ([which]) => {
      const doc = requireDoc();
      if (Array.isArray(doc)) return doc;
      const list = await listBackups(doc.fileName);
      const backup = list[Number(which) - 1];
      if (!backup) return [error(`no backup ${which ?? ''}. see backups.`)];
      if (!(await useEditor.getState().restoreBackup(backup.id))) return [error('could not restore that backup.')];
      return [
        text(`restored backup ${which} from ${new Date(backup.savedAt).toLocaleString()}. check diff, then save.`, 'fg'),
        { kind: 'links', prefix: 'then', links: [{ label: 'diff', command: 'diff' }, { label: 'save', command: 'save' }, { label: 'revert', command: 'revert' }] },
      ];
    },
  },
  {
    name: 'close',
    usage: 'close [-f]',
    summary: 'close the current save (-f throws away unsaved changes)',
    run: ([flag]) => {
      const doc = requireDoc();
      if (Array.isArray(doc)) return doc;
      const changes = countTopLevel(doc);
      if (changes > 0 && flag !== '-f' && flag !== '--force') {
        return [
          error(`${shortName(doc)} has ${changes} unsaved change${changes === 1 ? '' : 's'}.`),
          { kind: 'links', prefix: 'then', links: [{ label: 'save', command: 'save' }, { label: 'revert', command: 'revert' }, { label: 'close -f', command: 'close -f' }] },
        ];
      }
      useEditor.getState().close(doc.id);
      go(ROOT);
      return [text(`closed ${shortName(doc)}. back home.`, 'fg'), ...hereLinks()];
    },
  },
  {
    name: 'json',
    usage: 'json',
    summary: 'print the whole decrypted save',
    run: () => {
      const doc = requireDoc();
      if (Array.isArray(doc)) return doc;
      return [text(JSON.stringify(doc.data, null, 2), 'fg')];
    },
  },
  {
    name: 'sudo',
    usage: 'sudo [on | off | <command>]',
    summary: 'lift the min/max limits on number fields (for fun; may break things in game)',
    run: async ([first, ...rest], _raw, ctx) => {
      const { on, set: setSudo } = useSudo.getState();
      const word = first?.toLowerCase();
      if (word === 'off' || word === '-k') {
        setSudo(false);
        return [text(on ? 'limits back on.' : 'limits are on.', 'dim')];
      }
      if (!word || word === 'on' || word === '-s' || word === '-i') {
        setSudo(true);
        return [text(on ? 'limits are already lifted.' : 'limits lifted.', 'dim')];
      }
      // `sudo edit run`: just for this command. A full-screen view it opens keeps
      // the limits lifted until you leave it; anything else puts them straight back.
      if (on) return dispatch([first, ...rest].join(' '), ctx);
      setSudo(true, true);
      const lines = await dispatch([first, ...rest].join(' '), ctx);
      if (!lines.some((line) => line.kind === 'form' || line.kind === 'diff')) setSudo(false);
      return lines;
    },
  },
  {
    name: 'credits',
    aliases: ['neofetch', 'about'],
    usage: 'credits',
    summary: 'credits to made in fairyland, who make Forsaken Frontiers',
    run: () => [creditsLine()],
  },
  {
    name: 'clear',
    aliases: ['cls'],
    usage: 'clear',
    summary: 'clear the screen',
    run: (_args, _raw, ctx) => {
      ctx.clear();
      return [];
    },
  },
  {
    name: 'theme',
    aliases: ['exit', 'gui'],
    usage: 'theme <dark|light|crt>',
    summary: 'switch theme; dark or light brings back the normal editor',
    run: ([name], raw, ctx) => {
      if (/^exit/.test(raw) && useSudo.getState().on) {
        useSudo.getState().set(false);
        return [text('limits back on.', 'dim')];
      }
      const theme = name ?? (/^(exit|gui)/.test(raw) ? 'dark' : '');
      if (!['dark', 'light', 'crt'].includes(theme)) return [error('usage: theme <dark|light|crt>')];
      ctx.setTheme(theme);
      return [text(`switching to ${theme}...`, 'dim')];
    },
  },
];

function findCommand(name: string) {
  const lower = name.toLowerCase();
  return COMMANDS.find((command) => command.name === lower || command.aliases?.includes(lower));
}

function resolveKey(doc: SaveDoc, key: string | undefined) {
  if (!key) return undefined;
  if (key in doc.data) return key;
  const lower = key.toLowerCase();
  return Object.keys(doc.data).find((candidate) => candidate.toLowerCase() === lower);
}

function countTopLevel(doc: SaveDoc) {
  const keys = new Set([...Object.keys(doc.original), ...Object.keys(doc.data)]);
  return [...keys].filter((key) => JSON.stringify(doc.original[key]) !== JSON.stringify(doc.data[key])).length;
}

function toggleUnlock(args: string[], on: boolean): Line[] {
  const doc = requireDoc('player');
  if (Array.isArray(doc)) return doc;
  const [what, ...rest] = args;
  const verb = on ? 'unlocked' : 'locked';
  const out: Line[] = [];
  const cosmetics = () => {
    set('unlockedCosmetics', on ? COSMETICS.map((c) => c.id) : []);
    out.push(record(on ? 'UNLK' : 'LOCK', on ? 'mint' : 'red', 'cosmetics', `${COSMETICS.length} ${verb}`));
  };
  const tapes = () => {
    set('tapes', on ? TAPES.map((t) => t.title) : []);
    out.push(record(on ? 'UNLK' : 'LOCK', on ? 'mint' : 'red', 'tapes', `${TAPES.length} ${verb}`));
  };
  const skins = () => {
    const list = dataDeckSkinsFor(doc.data).filter((skin) => skin.unlockKey);
    list.forEach((skin) => set(skin.unlockKey!, on));
    out.push(record(on ? 'UNLK' : 'LOCK', on ? 'mint' : 'red', 'data-deck skins', `${list.length} ${verb}`));
  };

  if (what === 'all') {
    cosmetics();
    tapes();
    skins();
    return out;
  }
  if (what === 'cosmetics') return (cosmetics(), out);
  if (what === 'tapes') return (tapes(), out);
  if (what === 'skins') return (skins(), out);

  // A single tape (`unlock tape <title>`), skin, or cosmetic.
  const query = (what === 'tape' || what === 'skin' ? rest : args).join(' ');
  if (what !== 'skin') {
    const tape = what === 'tape' ? fuzzy(query, TAPES, (t) => [t.title]) : undefined;
    if (tape) {
      const owned = asStringArray(doc.data.tapes).filter((title) => findTape(title) !== tape);
      set('tapes', on ? [...owned, tape.title] : owned);
      return [record(on ? 'UNLK' : 'LOCK', on ? 'mint' : 'red', tape.title, verb)];
    }
    const cosmetic = what !== 'tape' ? fuzzy(query, COSMETICS, (c) => [c.id, c.label]) : undefined;
    if (cosmetic) {
      const unlocked = asStringArray(doc.data.unlockedCosmetics).filter((id) => id !== cosmetic.id);
      set('unlockedCosmetics', on ? [...unlocked, cosmetic.id] : unlocked);
      return [record(on ? 'UNLK' : 'LOCK', on ? 'mint' : 'red', cosmetic.label, verb, cosmetic.id)];
    }
  }
  const skin = fuzzy(query, dataDeckSkinsFor(doc.data).filter((s) => s.unlockKey), (s) => [s.label, s.key]);
  if (skin) {
    set(skin.unlockKey!, on);
    return [record(on ? 'UNLK' : 'LOCK', on ? 'mint' : 'red', `${skin.label} skin`, verb)];
  }
  return [error(`nothing matching "${query}". try ${on ? 'unlock' : 'lock'} all|cosmetics|tapes|skins.`)];
}

/* -------------------------------------------------------------------------- */
/* Entry points                                                               */
/* -------------------------------------------------------------------------- */

/** Splits on spaces, keeping "quoted strings" together. */
export function tokenize(input: string) {
  return [...input.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2]);
}

export interface CommandResult {
  lines: Line[];
  cwd: Cwd | null;
}

export async function runCommand(input: string, ctx: CommandContext): Promise<CommandResult> {
  notices = [];
  nextCwd = null;
  currentCwd = ctx.cwd;
  // Forms in the scrollback can activate a different save; commands always act
  // on the directory you're in.
  const state = useEditor.getState();
  if (ctx.cwd.docId && ctx.cwd.docId !== state.activeId && state.docs.some((d) => d.id === ctx.cwd.docId)) {
    state.activate(ctx.cwd.docId);
  }
  const lines = await dispatch(input, ctx);
  const result = { lines: [...notices, ...lines], cwd: nextCwd };
  notices = [];
  return result;
}

async function dispatch(input: string, ctx: CommandContext): Promise<Line[]> {
  const [name, ...args] = tokenize(input.trim());
  if (!name) return [];
  const doc = docFor(currentCwd);
  // Inside a save, `<field> <value>` wins over a command of the same name
  // (`credits 5000` sets credits; bare `credits` shows the credits).
  const fieldFirst = doc && args.length > 0 && resolveKey(doc, name);
  const command = findCommand(name);
  if (command && !fieldFirst) return command.run(args, input.trim(), ctx);

  const lower = name.toLowerCase();

  // A bare directory name or path (save_1, economy, .., ~, save_1/economy) acts like cd.
  // A bare name or path: directories (save_1, cosmetics, .., ~) act like cd,
  // files (profile, economy, pins) open like edit.
  if (args.length === 0) {
    if (isHome(lower) || isUp(lower)) return changeDir(name);
    const target = resolveTarget(currentCwd, name, true);
    if (target) return 'file' in target ? openFile(name, false) : changeDir(name);
  }

  // Inside a save, `credits 50000` is short for `set credits 50000`.
  if (doc && args.length > 0 && resolveKey(doc, name)) {
    return findCommand('set')!.run([name, ...args], `set ${input}`, ctx);
  }
  // Topic names point at their help page.
  if (TOPICS.some((topic) => topic.id === name.toLowerCase())) {
    return [text(`${name.toLowerCase()} is a help topic, not a command.`, 'dim'), ...(await findCommand('help')!.run([name], `help ${name}`, ctx))];
  }
  return [error(`command not found: ${name}`), { kind: 'links', prefix: 'type', links: [{ label: 'help', command: 'help' }] }];
}

/**
 * Path completions: "sa" -> "save_1/", "PersistentData/cos" -> "PersistentData/cosmetics/".
 * Folders end in "/" so you can keep tabbing; files are included when `files` is set.
 */
function pathCompletions(cwd: Cwd, partial: string, files = false): string[] {
  const slash = partial.lastIndexOf('/');
  const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : '';
  const found = dirPart ? resolveTarget(cwd, dirPart) : { dir: cwd };
  if (!found || !('dir' in found)) return [];
  return [...subdirs(found.dir).map((name) => `${dirPart}${name}/`), ...(files ? filesIn(found.dir).map((name) => `${dirPart}${name}`) : [])];
}

/**
 * Tab completion candidates for the token under the cursor. Candidates that
 * end in "/" are directories; the shell leaves no space after them so you can
 * keep tabbing down the path.
 */
export function completions(input: string, cwd: Cwd = ROOT): string[] {
  const tokens = tokenize(input);
  const trailingSpace = /\s$/.test(input);
  const current = trailingSpace ? '' : (tokens.at(-1) ?? '');
  const index = trailingSpace ? tokens.length : Math.max(tokens.length - 1, 0);
  const doc = docFor(cwd) ?? activeDoc();
  const head = tokens[0]?.toLowerCase();

  // "sudo <command>" completes like the command on its own, plus "off".
  const sudo = /^\s*sudo\s+/i.exec(input);
  if (head === 'sudo' && sudo) {
    const inner = completions(input.slice(sudo[0].length), cwd);
    const words = index === 1 ? ['off', 'on'].filter((w) => w.startsWith(current.toLowerCase())) : [];
    return [...new Set([...words, ...inner])];
  }

  let pool: string[] = [];
  if (index === 0) {
    const fields = docFor(cwd) && current ? Object.keys(docFor(cwd)!.data) : [];
    pool = current.includes('/') ? pathCompletions(cwd, current, true) : [...pathCompletions(cwd, current, true), ...COMMANDS.map((c) => c.name), ...fields];
  } else if ((head === 'cd' || head === 'go') && index === 1) {
    pool = pathCompletions(cwd, current);
    if (!current) pool = docFor(cwd) ? [...pool, '..', '~'] : pool;
  } else if (head === 'use' && index === 1) {
    pool = useEditor.getState().docs.map(dirName);
  } else if (['edit', 'show'].includes(findCommand(head ?? '')?.name ?? '') && index === 1) {
    pool = pathCompletions(cwd, current, true);
  } else if ((head === 'get' || head === 'set') && index === 1 && doc) {
    pool = Object.keys(doc.data);
  } else if (head === 'set' && index === 2 && doc) {
    const key = tokens[1];
    const list = key === 'dataDeckSkin' ? dataDeckSkinsFor(doc.data) : ENUM_FIELDS[key];
    pool =
      doc.kind === 'settings'
        ? settingCompletions(key)
        : list
          ? list.map((entry) => entry.label.toLowerCase().replace(/\s+/g, '-'))
          : typeof doc.data[key] === 'boolean'
            ? ['true', 'false']
            : [];
  } else if (head === 'give' || head === 'drop' || head === 'sale') {
    pool = ITEMS.map((item) => item.label.toLowerCase().replace(/\s+/g, '-'));
  } else if ((head === 'loot' || head === 'mod') && doc) {
    pool = index === 1 ? ['all', ...destinationsFor(doc.data).map((d) => d.name.toLowerCase().replace(/\s+/g, '-'))] : WORLD_MODIFIERS.map((m) => m.label.toLowerCase());
  } else if (head === 'unlock' || head === 'lock') {
    pool = ['all', 'cosmetics', 'tapes', 'skins', 'tape', 'skin'];
  } else if (head === 'equip') {
    pool = index === 1 ? ['pin1', 'pin2', 'patch1', 'patch2'] : ['none', ...(tokens[1]?.startsWith('pin') ? PINS : PATCHES).map((c) => c.id.replace(/\s+/g, '-'))];
  } else if (head === 'theme') {
    pool = ['dark', 'light', 'crt'];
  } else if (head === 'help') {
    pool = [...TOPICS.map((t) => t.id), ...COMMANDS.map((c) => c.name)];
  }
  const lower = current.toLowerCase();
  return [...new Set(pool)].filter((candidate) => candidate.toLowerCase().startsWith(lower));
}

/* -------------------------------------------------------------------------- */
/* Inline suggestions (ghost text after the cursor)                           */
/* -------------------------------------------------------------------------- */

/** One thing Tab can fill in: the whole input after accepting it. */
export interface Candidate {
  value: string;
  /** Completions get a trailing space unless they're a folder; the empty-prompt next step is taken as-is. */
  from: 'completion' | 'context';
  /** Short name for the list printed when there are several. */
  label: string;
}

export interface Suggestion {
  /** Faint text shown after what's typed. */
  ghost: string;
  /** Everything Tab can step through, best first. Empty for pure hints like "<item> [count]". */
  candidates: Candidate[];
}

/** The argument part of a usage line: "give <item> [count]" -> "<item> [count]". */
function usageArgs(name: string): string | null {
  const usage = findCommand(name)?.usage;
  return usage && usage.includes(' ') ? usage.slice(usage.indexOf(' ') + 1) : null;
}

/** The most useful thing to type next when the prompt is empty, from what's open and where you are. */
function nextStep(cwd: Cwd): string | null {
  const { docs, activeId } = useEditor.getState();
  if (docs.length === 0) return 'open';
  const doc = docFor(cwd);
  if (!doc) {
    const pick = docs.find((d) => d.id === activeId) ?? docs[0];
    return `cd ${dirName(pick)}`;
  }
  if (countTopLevel(doc) > 0) return 'diff';
  const first = childSections(doc.kind, cwd.section)[0];
  if (!first) return 'ls';
  return first.children ? `cd ${sectionBase(first.id)}` : `edit ${sectionBase(first.id)}`;
}

/** "save_1/economy/" -> "economy/" */
const lastSegment = (value: string) => value.replace(/^.*\/(?=[^/]+\/?$)/, '');

/**
 * Suggestions for the current input, from what actually exists here:
 * folders and files, commands, fields, items and so on. A finished command
 * name ("cd", "give") offers its arguments. With an empty prompt, the likely
 * next step. Typed history is not used; that's what up/down is for.
 */
export function suggest(input: string, cwd: Cwd): Suggestion | null {
  // "sudo <command>": suggest for the command, keeping the prefix.
  const sudo = /^\s*sudo\s+/i.exec(input);
  if (sudo) {
    const prefix = sudo[0];
    const rest = input.slice(prefix.length);
    if (rest === '') {
      const candidates = completions(input, cwd).map((option) => ({ value: `${prefix}${option}`, from: 'completion' as const, label: option }));
      return candidates.length ? { ghost: '', candidates } : null;
    }
    const inner = suggest(rest, cwd);
    const extra = /\s/.test(rest)
      ? []
      : ['off', 'on'].filter((w) => w.startsWith(rest.toLowerCase()) && w !== rest.toLowerCase()).map((w) => ({ value: w, from: 'completion' as const, label: w }));
    const candidates = [...extra, ...(inner?.candidates ?? [])].map((c) => ({ ...c, value: `${prefix}${c.value}` }));
    const ghost = extra.length ? extra[0].value.slice(rest.length) : (inner?.ghost ?? '');
    if (!ghost && candidates.length === 0) return null;
    return { ghost, candidates };
  }

  if (input.trim() === '') {
    if (input !== '') return null;
    const step = nextStep(cwd);
    return step ? { ghost: step, candidates: [{ value: step, from: 'context', label: step }] } : null;
  }

  const tokens = tokenize(input);
  const trailingSpace = /\s$/.test(input);
  const current = trailingSpace ? '' : (tokens.at(-1) ?? '');
  const base = input.slice(0, input.length - current.length);
  const lower = current.toLowerCase();
  let candidates: Candidate[] = completions(input, cwd)
    .filter((option) => option.toLowerCase().startsWith(lower) && option.length > current.length)
    .map((option) => ({ value: `${base}${option}`, from: 'completion', label: lastSegment(option) }));

  // "cd" or "give" typed in full: offer what comes after it.
  const finishedCommand = Boolean(current && tokens.length === 1 && findCommand(current));
  if (finishedCommand && candidates.length === 0) {
    candidates = completions(`${input} `, cwd).map((option) => ({ value: `${input} ${option}`, from: 'completion', label: lastSegment(option) }));
  }

  // Ghost: the first candidate, except right after a space or a finished
  // command, where the command's argument hint is more useful.
  const args = usageArgs(tokens[0] ?? '');
  const needed = args?.split(' ').slice(Math.max(tokens.length - (trailingSpace ? 1 : 0), 0)).join(' ');
  const hint = finishedCommand ? (args ? ` ${args}` : '') : trailingSpace ? (needed ?? '') : '';
  const best = candidates[0];
  const ghost = hint
    ? hint
    : best && best.value.toLowerCase().startsWith(input.toLowerCase())
        ? best.value.slice(input.length)
        : hint;
  if (!ghost && candidates.length === 0) return null;
  return { ghost, candidates };
}

/* -------------------------------------------------------------------------- */
/* Outcome of a full-screen session                                           */
/* -------------------------------------------------------------------------- */

export interface ChangeSummary {
  label: string;
  /** Plain values. */
  from?: string;
  to?: string;
  /** Lists and objects, in words. */
  summary?: string;
  entries: { sign: '+' | '-' | '~'; label: string; detail?: string }[];
}

const SIGN_OF = { added: '+', removed: '-', changed: '~', field: '~' } as const;

/** What changed between opening a full-screen view and leaving it, for the scrollback. */
export function outcome(title: string, before: JsonObject, after: JsonObject, kind: SaveDoc['kind'] = 'json', file = '', unsaved = true): Line[] {
  const fields = diffDoc(before, after, kind === 'settings' ? displaySetting : undefined);
  if (fields.length === 0) return [text(`${title}: no changes.`, 'dim')];
  return [
    {
      kind: 'changes',
      title,
      file,
      unsaved,
      fields: fields.map((field) => ({
        label: fieldLabel(kind, field.key, after),
        from: field.from,
        to: field.to,
        summary: field.summary,
        entries: field.entries.map((entry) => ({ sign: SIGN_OF[entry.kind], label: entry.label, detail: entry.detail })),
      })),
    },
  ];
}
