/**
 * Pure helpers for reading AssetRipper's Unity YAML and decompiled C#.
 * No file system access or side effects, so they can be unit tested.
 */

/* -------------------------------------------------------------------------- */
/* Unity YAML helpers (line based; Unity YAML is regular enough)              */
/* -------------------------------------------------------------------------- */

export function unescapeDoubleQuoted(body) {
  // YAML folding: a line break becomes a space, unless escaped with a trailing backslash.
  const lines = body.split('\n');
  let folded = '';
  for (let i = 0; i < lines.length; i += 1) {
    let line = i === 0 ? lines[i] : lines[i].replace(/^\s+/, '');
    if (i < lines.length - 1) {
      if (/(^|[^\\])(\\\\)*\\$/.test(line)) {
        folded += line.slice(0, -1);
      } else if (line === '') {
        folded += '\n';
      } else {
        folded += `${line} `;
      }
    } else {
      folded += line;
    }
  }
  return folded.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_, esc) => {
    switch (esc[0]) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case '0': return '\0';
      case ' ': return ' ';
      case '"': return '"';
      case '/': return '/';
      case '\\': return '\\';
      case 'u': return String.fromCharCode(parseInt(esc.slice(1), 16));
      case 'x': return String.fromCharCode(parseInt(esc.slice(1), 16));
      default: return esc;
    }
  });
}

/** Reads a scalar that starts on lines[index] after `key: `. Returns { value, next }. */
export function readScalar(lines, index, raw) {
  const text = raw.trimStart();
  if (text.startsWith('"')) {
    let body = text.slice(1);
    let i = index;
    const closes = (s) => /(^|[^\\])(\\\\)*"\s*$/.test(s);
    while (!closes(body)) {
      i += 1;
      if (i >= lines.length) break;
      body += `\n${lines[i]}`;
    }
    body = body.replace(/"\s*$/, '');
    return { value: unescapeDoubleQuoted(body), next: i + 1 };
  }
  if (text.startsWith("'")) {
    let body = text.slice(1);
    let i = index;
    const closes = (s) => /(^|[^'])('')*'\s*$/.test(s);
    while (!closes(body)) {
      i += 1;
      if (i >= lines.length) break;
      body += `\n${lines[i]}`;
    }
    body = body.replace(/'\s*$/, '');
    const folded = body
      .split('\n')
      .map((line, n) => (n === 0 ? line : line.trim()))
      .join(' ');
    return { value: folded.replace(/''/g, "'"), next: i + 1 };
  }
  return { value: text.trim(), next: index + 1 };
}

export function coerce(value) {
  if (typeof value !== 'string') return value;
  if (/^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(value)) return Number(value);
  return value;
}

export function parseRef(value) {
  const match = /guid: ([0-9a-f]{32})/.exec(String(value));
  return match ? match[1] : null;
}

export function parseFileId(value) {
  const match = /fileID: (-?\d+)/.exec(String(value));
  return match ? match[1] : null;
}

/**
 * Parses a YAML list that starts right after the line `<indent>key:`.
 * Unity writes list items at the same indent as the key ("  - field: x").
 * Only the item's direct scalar fields are collected.
 */
export function readList(lines, keyLineIndex) {
  const keyIndent = lines[keyLineIndex].match(/^\s*/)[0].length;
  const itemPrefix = `${' '.repeat(keyIndent)}- `;
  const fieldIndent = keyIndent + 2;
  const items = [];
  let i = keyLineIndex + 1;
  let current = null;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith(itemPrefix)) {
      current = {};
      items.push(current);
      const rest = line.slice(itemPrefix.length);
      const m = /^([A-Za-z0-9_]+):(.*)$/.exec(rest);
      if (m) {
        const { value, next } = readScalar(lines, i, m[2]);
        current[m[1]] = value;
        i = next;
        continue;
      }
      i += 1;
      continue;
    }
    const indent = line.match(/^\s*/)[0].length;
    if (indent < fieldIndent || line.trim() === '' || line.startsWith('---')) break;
    if (current && indent === fieldIndent) {
      const m = /^\s*([A-Za-z0-9_]+):(.*)$/.exec(line);
      if (m) {
        const { value, next } = readScalar(lines, i, m[2]);
        current[m[1]] = value;
        i = next;
        continue;
      }
    }
    i += 1;
  }
  return items;
}

export function findKeyLine(lines, key, from = 0) {
  const pattern = new RegExp(`^\\s*${key}:\\s*$`);
  for (let i = from; i < lines.length; i += 1) {
    if (pattern.test(lines[i])) return i;
  }
  return -1;
}

/** Top-level scalar fields of a single-document asset (indent 2). */
export function readAssetFields(text) {
  const lines = text.split(/\r?\n/);
  const fields = {};
  for (let i = 0; i < lines.length; ) {
    const m = /^  ([A-Za-z0-9_]+):(.*)$/.exec(lines[i]);
    if (m && m[2].trim() !== '') {
      const { value, next } = readScalar(lines, i, m[2]);
      fields[m[1]] = value;
      i = next;
    } else {
      i += 1;
    }
  }
  return fields;
}

/**
 * Reads `enum <name> { ... }` from C# source. Handles comments, attributes,
 * implicit values (previous + 1), hex, negatives and `1 << n`. Returns null if
 * the enum isn't there; throws on a value it can't read, so a game update can
 * never quietly turn a value into NaN/null in game-data.json.
 */
export function parseEnum(source, enumName) {
  const match = new RegExp(`enum ${enumName}\\b[^{]*\\{([^}]*)\\}`).exec(source);
  if (!match) return null;
  const body = match[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\[[^\]]*\]/g, '');
  const out = [];
  let previous = -1;
  for (const entry of body.split(',').map((part) => part.trim()).filter(Boolean)) {
    const [key, raw] = entry.split('=').map((part) => part.trim());
    let value;
    if (raw === undefined) value = previous + 1;
    else if (/^-?\d+$/.test(raw)) value = Number(raw);
    else if (/^0x[0-9a-f]+$/i.test(raw)) value = parseInt(raw, 16);
    else if (/^\d+\s*<<\s*\d+$/.test(raw)) {
      const [a, b] = raw.split('<<').map((part) => Number(part.trim()));
      value = a << b;
    } else throw new Error(`enum ${enumName}: can't read value of ${key} (${raw})`);
    out.push({ key, value });
    previous = value;
  }
  return out;
}
