#!/usr/bin/env node
/**
 * Pulls the editor's game catalogue (items, cosmetics, tapes, destinations,
 * enums) out of an AssetRipper export of Forsaken Frontiers.
 *
 *   npm run extract -- "C:/path/to/extractor"
 *
 * The folder may contain one or more AssetRipper exports. The script looks for
 *   - an "ExportedProject/Assets" folder (Unity project export: scenes, prefabs, sprites, audio)
 *   - a  "Scripts/Forsaken Frontiers" folder (decompiled C#: enums and constants)
 *
 * Output:
 *   data/game-data.json        catalogue consumed by lib/game-data.ts
 *   public/game/items/*.png    item icons
 *   public/game/cosmetics/*.png
 *   public/game/tapes/*.ogg    tape audio (transcoded with ffmpeg when available)
 *
 * Pass --no-audio to skip copying/transcoding tape audio.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  unescapeDoubleQuoted,
  readScalar,
  coerce,
  parseRef,
  parseFileId,
  readList,
  findKeyLine,
  readAssetFields,
  parseEnum,
} from './unity-parse.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const inputRoot = args.find((arg) => !arg.startsWith('--'));

if (!inputRoot) {
  console.error('Usage: npm run extract -- <path-to-assetripper-export-folder> [--no-audio]');
  process.exit(1);
}

const log = (...parts) => console.log('·', ...parts);
const warn = (...parts) => console.warn('!', ...parts);

/* -------------------------------------------------------------------------- */
/* Locate inputs                                                              */
/* -------------------------------------------------------------------------- */

function findDir(root, predicate, depth = 4) {
  if (predicate(root)) return root;
  if (depth === 0) return null;
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = findDir(path.join(root, entry.name), predicate, depth - 1);
    if (found) return found;
  }
  return null;
}

const assetsDir = findDir(path.resolve(inputRoot), (dir) =>
  dir.endsWith(path.join('ExportedProject', 'Assets')),
);
const scriptsDir = findDir(path.resolve(inputRoot), (dir) =>
  fs.existsSync(path.join(dir, 'Forsaken Frontiers', 'madeinfairyland')),
);

if (!assetsDir) {
  console.error('Could not find an "ExportedProject/Assets" folder. Export with AssetRipper as a Unity project.');
  process.exit(1);
}
if (!scriptsDir) {
  console.error('Could not find decompiled "Scripts/Forsaken Frontiers". Export scripts with AssetRipper as well.');
  process.exit(1);
}

const gameScripts = path.join(scriptsDir, 'Forsaken Frontiers', 'madeinfairyland', 'forsakenfrontiers');
const engineScripts = path.join(scriptsDir, 'fairyengine', 'madeinfairyland', 'fairyengine');
log('assets ', assetsDir);
log('scripts', gameScripts);

/* -------------------------------------------------------------------------- */
/* GUID index                                                                 */
/* -------------------------------------------------------------------------- */

const guidIndex = new Map();
for (const folder of ['Sprite', 'Texture2D', 'AudioClip', 'GameObject', 'MonoBehaviour']) {
  const dir = path.join(assetsDir, folder);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.meta')) continue;
    const head = fs.readFileSync(path.join(dir, name), 'utf8').slice(0, 300);
    const guid = /guid: ([0-9a-f]{32})/.exec(head)?.[1];
    if (guid) guidIndex.set(guid, path.join(dir, name.slice(0, -5)));
  }
}
log(`indexed ${guidIndex.size} asset guids`);

/** Sprite guid -> PNG on disk (the sprite's source texture). */
function resolveSpriteTexture(spriteGuid) {
  const spritePath = guidIndex.get(spriteGuid);
  if (!spritePath) return null;
  if (spritePath.endsWith('.png')) return spritePath;
  const text = fs.readFileSync(spritePath, 'utf8');
  const textureGuid = /texture: \{fileID: \d+, guid: ([0-9a-f]{32})/.exec(text)?.[1];
  const texturePath = textureGuid ? guidIndex.get(textureGuid) : null;
  return texturePath && fs.existsSync(texturePath) ? texturePath : null;
}

/* -------------------------------------------------------------------------- */
/* Output helpers                                                             */
/* -------------------------------------------------------------------------- */

const publicGame = path.join(repoRoot, 'public', 'game');
const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';

function copyAsset(source, category, baseName) {
  if (!source) return null;
  const ext = path.extname(source).toLowerCase();
  const outDir = path.join(publicGame, category);
  fs.mkdirSync(outDir, { recursive: true });
  const fileName = `${slug(baseName)}${ext}`;
  fs.copyFileSync(source, path.join(outDir, fileName));
  return `/game/${category}/${fileName}`;
}

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

function exportAudio(source, baseName) {
  if (!source || flags.has('--no-audio')) return null;
  const outDir = path.join(publicGame, 'tapes');
  fs.mkdirSync(outDir, { recursive: true });
  const ext = path.extname(source).toLowerCase();
  const target = path.join(outDir, `${slug(baseName)}.ogg`);
  const publicPath = `/game/tapes/${slug(baseName)}.ogg`;

  if (ext === '.ogg') {
    fs.copyFileSync(source, target);
    return publicPath;
  }
  if (fs.existsSync(target) && fs.statSync(target).mtimeMs >= fs.statSync(source).mtimeMs) {
    return publicPath;
  }
  if (!hasFfmpeg) {
    warn(`ffmpeg not found, skipping audio for "${baseName}" (${ext})`);
    return null;
  }
  const result = spawnSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-i', source, '-vn', '-c:a', 'libvorbis', '-q:a', '3', target],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    warn(`ffmpeg failed for "${baseName}"`);
    return null;
  }
  return publicPath;
}

/* -------------------------------------------------------------------------- */
/* C# enums and constants                                                     */
/* -------------------------------------------------------------------------- */

function readEnum(file, enumName, baseDir = gameScripts) {
  const values = parseEnum(fs.readFileSync(path.join(baseDir, file), 'utf8'), enumName);
  if (!values) {
    warn(`enum ${enumName} not found in ${file}`);
    return [];
  }
  return values;
}

function readConst(file, name) {
  const source = fs.readFileSync(path.join(gameScripts, file), 'utf8');
  return new RegExp(`const \\w+ ${name} = ([^;]+);`).exec(source)?.[1]?.replace(/^"|"$/g, '') ?? null;
}

const titleCase = (key) =>
  key
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const enums = {
  gameModes: readEnum('FFGameplayStatics.cs', 'GameMode'),
  worldModifiers: readEnum('FFWorld.cs', 'WorldModifier'),
  cycleDifficulties: readEnum(path.join('train', 'FFTrain.cs'), 'ECycleDifficulty'),
  dataDeckSkins: readEnum(path.join('actor', 'player', 'datadeck', 'FFDataDeck.cs'), 'DataDeckSkin'),
  modifierAllowance: readEnum(path.join('train', 'FFTrain.cs'), 'EWorldModifierAllowance'),
  tapeTypes: readEnum(path.join('actor', 'player', 'datadeck', 'FFTapeKit.cs'), 'ETapeType'),
  cosmeticTypes: readEnum('FFGameplayStatics.cs', 'Type'),
  genders: readEnum(path.join('actor', 'FairyGender.cs'), 'FairyGender', engineScripts),
  lobbyPermissions: readEnum('FairyCoreManager.cs', 'LobbyPermission', engineScripts),
};

/* -------------------------------------------------------------------------- */
/* Main scene                                                                 */
/* -------------------------------------------------------------------------- */

function findScenes(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findScenes(full, out);
    else if (entry.name.endsWith('.unity')) out.push(full);
  }
  return out;
}

const scenes = findScenes(assetsDir).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
const scenePath = scenes.find((scene) => fs.readFileSync(scene, 'utf8').includes('  shopItems:'));
if (!scenePath) {
  console.error('Could not find the gameplay scene (no shopItems block found).');
  process.exit(1);
}
log('scene  ', path.relative(assetsDir, scenePath));
const sceneLines = fs.readFileSync(scenePath, 'utf8').split(/\r?\n/);

// Destinations (FFTrain.pois)
const poiStart = sceneLines.findIndex((line) => /^  - poiName: /.test(line));
const poiKey = (() => {
  for (let i = poiStart - 1; i >= 0; i -= 1) {
    if (/^  [A-Za-z]+:\s*$/.test(sceneLines[i])) return i;
  }
  return -1;
})();
const rawPois = poiKey >= 0 ? readList(sceneLines, poiKey) : [];
const pois = rawPois
  .filter((poi) => poi.poiName)
  .map((poi) => ({
    name: poi.poiName,
    subtitle: poi.poiSubtitle ?? '',
    travelFee: coerce(poi.travelFee) ?? 0,
    isStaticLocation: poi.isStaticLocation === '1',
    locked: poi.locked === '1',
    nonAccessible: poi.nonAccessibleByPlayers === '1',
    outdoors: poi.outdoors === '1',
    modifierAllowance: coerce(poi.worldModifierAllowance) ?? 0,
  }));

// Modifier value multipliers (FFWorld "Modifier Multipliers")
const modifierMultipliers = {};
for (const line of sceneLines) {
  const m = /^  ([a-z]+)ValueMultiplier: ([\d.]+)$/.exec(line);
  if (m) modifierMultipliers[m[1].toUpperCase()] = Number(m[2]);
}

// Cosmetics (FFCoreManager.customizations)
const cosmeticsKey = findKeyLine(sceneLines, 'customizations');
const seenCosmetics = new Set();
const cosmetics = [];
for (const raw of cosmeticsKey >= 0 ? readList(sceneLines, cosmeticsKey) : []) {
  if (!raw.decalID || seenCosmetics.has(raw.decalID)) continue;
  seenCosmetics.add(raw.decalID);
  const typeValue = coerce(raw.type);
  const spriteGuid = parseRef(raw.sprite);
  cosmetics.push({
    id: raw.decalID,
    type: enums.cosmeticTypes.find((entry) => entry.value === typeValue)?.key ?? String(typeValue),
    redeemable: raw.redeemable === '1',
    bundle: raw.bundleCode || null,
    icon: copyAsset(spriteGuid && resolveSpriteTexture(spriteGuid), 'cosmetics', raw.decalID),
  });
}

// Trader shop (FFTrader.shopItems)
const shopKey = findKeyLine(sceneLines, 'shopItems');
const shopItems = shopKey >= 0 ? readList(sceneLines, shopKey) : [];

/* -------------------------------------------------------------------------- */
/* Item database                                                              */
/* -------------------------------------------------------------------------- */

function readPrefabItem(prefabPath, rootFileId) {
  const docs = fs.readFileSync(prefabPath, 'utf8').split(/^--- /m);
  for (const doc of docs) {
    if (!doc.includes('MonoBehaviour:') || !doc.includes('  fairyName:')) continue;
    if (rootFileId && !doc.includes(`m_GameObject: {fileID: ${rootFileId}}`)) continue;
    const fields = readAssetFields(doc);
    return fields;
  }
  return null;
}

const itemDbPath = [...guidIndex.values()].find((p) => path.basename(p) === 'Item Database.asset');
const itemDbRefs = itemDbPath
  ? fs
      .readFileSync(itemDbPath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => /^  - \{fileID/.test(line))
      .map((line) => ({ guid: parseRef(line), fileId: parseFileId(line) }))
  : [];
if (!itemDbPath) warn('Item Database.asset not found; item list will come from the shop only.');

const itemsByDataName = new Map();
const prefabGuidToDataName = new Map();

for (const ref of itemDbRefs) {
  const prefabPath = ref.guid && guidIndex.get(ref.guid);
  if (!prefabPath || !prefabPath.endsWith('.prefab')) continue;
  const itemDataName = path.basename(prefabPath, '.prefab');
  const fields = readPrefabItem(prefabPath, ref.fileId) ?? {};
  const spriteGuid = parseRef(fields.uiSprite);
  prefabGuidToDataName.set(ref.guid, itemDataName);
  itemsByDataName.set(itemDataName, {
    itemDataName,
    itemName: fields.fairyName || itemDataName.toLowerCase(),
    value: coerce(fields.value) ?? 0,
    alwaysEquipped: fields.alwaysEquipped === '1',
    spriteGuid,
    inItemDatabase: true,
    shop: null,
  });
}

for (const raw of shopItems) {
  const prefabGuid = parseRef(raw.prefab);
  const dataName = (prefabGuid && prefabGuidToDataName.get(prefabGuid)) || null;
  const existing = dataName ? itemsByDataName.get(dataName) : null;
  const shop = {
    name: raw.itemName,
    cost: coerce(raw.itemCost) ?? 0,
    description: raw.itemDescription ?? '',
    saleAllowed: raw.saleAllowed === '1',
    hidden: raw.isHidden === '1',
  };
  if (existing) {
    existing.shop = shop;
    existing.spriteGuid = parseRef(raw.itemSprite) ?? existing.spriteGuid;
  } else {
    const fallbackName = dataName ?? raw.itemName;
    itemsByDataName.set(fallbackName, {
      itemDataName: fallbackName,
      itemName: raw.itemName,
      value: 0,
      alwaysEquipped: false,
      spriteGuid: parseRef(raw.itemSprite),
      inItemDatabase: false,
      shop,
    });
  }
}

const items = [...itemsByDataName.values()].map(({ spriteGuid, ...item }) => ({
  ...item,
  icon: copyAsset(spriteGuid && resolveSpriteTexture(spriteGuid), 'items', item.itemDataName),
}));

/* -------------------------------------------------------------------------- */
/* Tapes                                                                      */
/* -------------------------------------------------------------------------- */

const tapes = [];
const monoDir = path.join(assetsDir, 'MonoBehaviour');
for (const name of fs.readdirSync(monoDir)) {
  if (!name.endsWith('.asset')) continue;
  const text = fs.readFileSync(path.join(monoDir, name), 'utf8');
  if (!/^  tapeType: /m.test(text) || !/^  title: /m.test(text)) continue;
  const fields = readAssetFields(text);
  const typeValue = coerce(fields.tapeType);
  const audioGuid = parseRef(fields.tapeClip);
  tapes.push({
    title: fields.title,
    type: enums.tapeTypes.find((entry) => entry.value === typeValue)?.key ?? String(typeValue),
    story: fields.storyTape === '1',
    loop: fields.loop === '1',
    typeSpeed: coerce(fields.typeSpeed) ?? 0.06,
    transcription: (fields.transcription ?? '').replace(/\r\n?/g, '\n'),
    audio: exportAudio(audioGuid && guidIndex.get(audioGuid), fields.title),
  });
}
const tapeOrder = { STARTER: 0, LOG: 1, MUSIC: 2 };
tapes.sort((a, b) => (tapeOrder[a.type] ?? 9) - (tapeOrder[b.type] ?? 9) || a.title.localeCompare(b.title));

/* -------------------------------------------------------------------------- */
/* Write                                                                      */
/* -------------------------------------------------------------------------- */

const output = {
  $comment: 'Generated by scripts/extract-game-data.mjs. Do not edit by hand; put display tweaks in lib/game-data.ts.',
  gameVersion: Number(readConst('FFGameplayStatics.cs', 'GAME_VERSION')) || null,
  extractedAt: new Date().toISOString().slice(0, 10),
  gameModes: enums.gameModes.map(({ key, value }) => ({ key, value, label: titleCase(key) })),
  genders: enums.genders.map(({ key, value }) => ({ key, value, label: titleCase(key) })),
  lobbyPrivacy: enums.lobbyPermissions.map(({ key, value }) => ({ key, value, label: titleCase(key) })),
  cycleDifficulties: enums.cycleDifficulties.map(({ key, value }) => ({ key, value, label: titleCase(key) })),
  worldModifiers: enums.worldModifiers.map(({ key, value }) => ({
    key,
    value,
    label: titleCase(key),
    lootMultiplier: modifierMultipliers[key] ?? null,
  })),
  modifierAllowanceFlags: enums.modifierAllowance,
  dataDeckSkins: enums.dataDeckSkins.map(({ key, value }) => ({
    key,
    value,
    label: titleCase(key),
    unlockKey: value === 0 ? null : `dataDeckSkin_${key.toLowerCase()}_unlocked`,
  })),
  destinations: pois,
  items,
  cosmetics,
  tapes,
};

const outFile = path.join(repoRoot, 'data', 'game-data.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });

let previous = null;
try {
  previous = JSON.parse(fs.readFileSync(outFile, 'utf8'));
} catch {
  /* first run */
}
fs.writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`);

/* Diff summary so it's obvious what a game update added. */
function diff(label, prev, next, keyOf) {
  if (!prev) return;
  const before = new Set(prev.map(keyOf));
  const after = new Set(next.map(keyOf));
  const added = [...after].filter((key) => !before.has(key));
  const removed = [...before].filter((key) => !after.has(key));
  if (added.length) log(`${label}: + ${added.join(', ')}`);
  if (removed.length) log(`${label}: - ${removed.join(', ')}`);
}
diff('destinations', previous?.destinations, output.destinations, (x) => x.name);
diff('items', previous?.items, output.items, (x) => x.itemDataName);
diff('cosmetics', previous?.cosmetics, output.cosmetics, (x) => x.id);
diff('tapes', previous?.tapes, output.tapes, (x) => x.title);
diff('modifiers', previous?.worldModifiers, output.worldModifiers, (x) => `${x.key}=${x.value}`);
diff('game modes', previous?.gameModes, output.gameModes, (x) => `${x.key}=${x.value}`);

log(
  `game v${output.gameVersion}: ${pois.length} destinations, ${items.length} items, ` +
    `${cosmetics.length} cosmetics, ${tapes.length} tapes, ${output.worldModifiers.length} modifiers`,
);
const missingIcons = [...items.filter((i) => !i.icon).map((i) => i.itemDataName), ...cosmetics.filter((c) => !c.icon).map((c) => c.id)];
if (missingIcons.length) warn(`no icon resolved for: ${missingIcons.join(', ')}`);
log(`wrote ${path.relative(repoRoot, outFile)}`);
