/**
 * Forsaken Frontiers keeps its settings (Unity PlayerPrefs) in the Windows
 * registry, under HKCU\Software\made in fairyland\Forsaken Frontiers. A browser
 * can't read or write the registry, so settings go through .reg files: you
 * export the key (`reg export` or regedit), drop it in, and get back a .reg of
 * your changes to double-click.
 *
 * How Unity stores each value:
 *   - names get a suffix, "_h" + a hash of the name ("FlavorIndex_h2996959227");
 *   - whole numbers are REG_DWORD             -> `dword:0000000b`
 *   - decimals are 8-byte doubles, typed as REG_DWORD anyway -> `hex(4):00,..,3f`
 *   - text is UTF-8 with a trailing zero byte, REG_BINARY      -> `hex:31,39,..,00`
 */

export const FF_REGISTRY_KEY = 'HKEY_CURRENT_USER\\Software\\made in fairyland\\Forsaken Frontiers';

/** Exports the game's settings to a file you can drop into FairySave. */
export const SETTINGS_EXPORT_COMMAND = String.raw`reg export "HKCU\Software\made in fairyland\Forsaken Frontiers" ff-settings.reg`;

export type RegType = 'dword' | 'double' | 'string';

export interface RegEntry {
  /** The value's full name in the registry, hash suffix included. */
  regName: string;
  type: RegType;
  value: number | string;
}

/** The hash Unity appends to PlayerPrefs names on Windows (djb2, xor variant). */
export function unityHash(name: string): number {
  let hash = 5381;
  // Per UTF-16 unit, like C# strings.
  for (let i = 0; i < name.length; i += 1) hash = (Math.imul(hash, 33) ^ name.charCodeAt(i)) >>> 0;
  return hash;
}

export const regNameFor = (name: string) => `${name}_h${unityHash(name)}`;

/** .reg files from regedit and `reg export` are UTF-16 with a BOM; accept UTF-8 too. */
export function decodeRegBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  return new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
}

export const looksLikeRegExport = (text: string) => /^\s*(Windows Registry Editor Version 5\.00|REGEDIT4)/.test(text);

const hexBytes = (list: string) =>
  list
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => parseInt(part, 16));

function decodeValue(raw: string): Omit<RegEntry, 'regName'> | null {
  const dword = /^dword:([0-9a-f]{1,8})$/i.exec(raw);
  if (dword) return { type: 'dword', value: parseInt(dword[1], 16) | 0 };
  const binary = /^hex(?:\((\w+)\))?:(.*)$/i.exec(raw);
  if (!binary) return null;
  const bytes = new Uint8Array(hexBytes(binary[2]));
  const kind = (binary[1] ?? '3').toLowerCase();
  // Unity's decimals: 8 bytes in a "DWORD" (type 4).
  if (kind === '4' && bytes.length === 8) return { type: 'double', value: new DataView(bytes.buffer).getFloat64(0, true) };
  if (kind === '4' && bytes.length === 4) return { type: 'dword', value: new DataView(bytes.buffer).getInt32(0, true) };
  if (kind === '3') {
    const end = bytes.indexOf(0);
    return { type: 'string', value: new TextDecoder('utf-8').decode(end === -1 ? bytes : bytes.subarray(0, end)) };
  }
  return null; // other registry types: not something Unity writes; left alone
}

/**
 * The game's values from a .reg export, keyed by their PlayerPrefs name (no
 * hash suffix). Throws if the file doesn't contain the game's key.
 */
export function parseRegExport(text: string): Record<string, RegEntry> {
  if (!looksLikeRegExport(text)) throw new Error('This is not a registry export.');
  // Long values wrap onto the next line after a trailing backslash.
  const lines = text.replace(/\\\r?\n\s*/g, '').split(/\r?\n/);
  const entries: Record<string, RegEntry> = {};
  let inGameKey = false;
  let sawGameKey = false;
  for (const line of lines) {
    const header = /^\[(-?)(.+)\]\s*$/.exec(line.trim());
    if (header) {
      inGameKey = !header[1] && header[2].toLowerCase() === FF_REGISTRY_KEY.toLowerCase();
      sawGameKey ||= inGameKey;
      continue;
    }
    if (!inGameKey) continue;
    const value = /^"((?:[^"\\]|\\.)*)"=(.*)$/.exec(line.trim());
    if (!value) continue;
    const regName = value[1].replace(/\\(.)/g, '$1');
    const decoded = decodeValue(value[2].trim());
    if (!decoded) continue;
    const suffix = /^(.*)_h(\d+)$/.exec(regName);
    const name = suffix && unityHash(suffix[1]) === Number(suffix[2]) ? suffix[1] : regName;
    entries[name] = { regName, ...decoded };
  }
  if (!sawGameKey) throw new Error("This export doesn't contain Forsaken Frontiers' settings.");
  return entries;
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(',');

function encodeValue(type: RegType, value: number | string): string {
  if (type === 'dword') return `dword:${(Math.trunc(Number(value)) >>> 0).toString(16).padStart(8, '0')}`;
  if (type === 'double') {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setFloat64(0, Number(value), true);
    return `hex(4):${hex(bytes)}`;
  }
  const text = new TextEncoder().encode(String(value));
  const bytes = new Uint8Array(text.length + 1);
  bytes.set(text);
  return `hex:${hex(bytes)}`;
}

const quote = (name: string) => `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** A .reg file that sets these values (and deletes those with value null), as regedit writes it. */
export function buildRegFile(entries: { regName: string; type: RegType; value: number | string | null }[]): Uint8Array {
  const lines = [
    'Windows Registry Editor Version 5.00',
    '',
    `[${FF_REGISTRY_KEY}]`,
    ...entries.map((entry) => `${quote(entry.regName)}=${entry.value === null ? '-' : encodeValue(entry.type, entry.value)}`),
    '',
  ];
  const text = lines.join('\r\n');
  // UTF-16LE with a BOM, like regedit's own exports.
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[3 + i * 2] = code >> 8;
  }
  return bytes;
}
