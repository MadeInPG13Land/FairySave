/**
 * The game's settings, as kept in the registry (see lib/registry.ts). Ranges
 * and defaults come from the sliders in the game's options menu
 * (FFPlayer.prefab); dropdown choices from the game's code.
 *
 * A settings doc's data is { PlayerPrefs name: number | string }, exactly the
 * stored values: on/off settings are 0 or 1, volumes are 0..1.
 */
import { GAME_MODES } from './game-data';
import type { RegType } from './registry';
import type { JsonObject } from './save';

export type SettingGroup = 'character' | 'audio' | 'controls' | 'display' | 'interface' | 'gameplay';

export const SETTING_GROUPS: { id: SettingGroup; label: string; summary: string }[] = [
  { id: 'character', label: 'Character', summary: 'your flavour (colour)' },
  { id: 'audio', label: 'Audio', summary: 'volumes and voice chat' },
  { id: 'controls', label: 'Controls', summary: 'mouse, sprint and crouch' },
  { id: 'display', label: 'Display', summary: 'graphics, gamma and resolution' },
  { id: 'interface', label: 'Interface', summary: 'crosshair, subtitles and filters' },
  { id: 'gameplay', label: 'Gameplay', summary: 'game mode and lobby' },
];

export interface SettingOption {
  value: number;
  label: string;
}

export type SettingDef = {
  key: string;
  label: string;
  group: SettingGroup;
  /** How it's stored, for settings the export doesn't have yet. */
  type: RegType;
} & (
  | { kind: 'bool' }
  | { kind: 'enum'; options: SettingOption[] }
  /** A 0..1 value shown as a percentage. */
  | { kind: 'percent'; max: number }
  | { kind: 'number'; min: number; max: number; int?: boolean }
  | { kind: 'text' }
);

export const FLAVORS: SettingOption[] = [
  'Vanilla',
  'Cherry',
  'Lime',
  'Grape',
  'Blueberry',
  'Strawberry',
  'Orange',
  'Lemon',
  'Mint',
  'Chocolate',
  'Blackberry',
  'Melon',
  'Cream Soda',
  'Licorice',
].map((label, value) => ({ value, label }));

/** Unity's quality levels for this game (ProjectSettings/QualitySettings). */
const QUALITY: SettingOption[] = ['Low', 'Medium', 'High', 'Very High', 'Ultra'].map((label, value) => ({ value, label }));

const COLORBLIND: SettingOption[] = [
  'None',
  'Protanopia',
  'Protanomaly',
  'Deuteranopia',
  'Deuteranomaly',
  'Tritanopia',
  'Tritanomaly',
  'Achromatopsia',
  'Achromatomaly',
].map((label, value) => ({ value, label }));

const volume = (key: string, label: string, max = 1): SettingDef => ({ key, label, group: 'audio', type: 'double', kind: 'percent', max });
const toggle = (key: string, label: string, group: SettingGroup): SettingDef => ({ key, label, group, type: 'dword', kind: 'bool' });

export const SETTINGS: SettingDef[] = [
  { key: 'FlavorIndex', label: 'flavour', group: 'character', type: 'dword', kind: 'enum', options: FLAVORS },

  volume('MasterVolume', 'master'),
  volume('MusicVolume', 'ambience music'),
  volume('RadioVolume', 'radio'),
  volume('PlayerVoiceVolume', 'voice chat'),
  volume('EnemyVolume', 'enemies'),
  volume('DirectorVoiceVolume', 'director', 0.5),
  volume('TraderVolume', 'trader', 0.5),
  volume('ShepherdVolume', 'shepherd', 0.5),
  volume('TrainVolume', 'train', 0.5),
  { key: 'MicrophoneBoostDb', label: 'microphone boost (dB)', group: 'audio', type: 'double', kind: 'number', min: 0, max: 12, int: true },
  { key: 'VoiceActivationMode', label: 'voice chat mode', group: 'audio', type: 'dword', kind: 'number', min: 0, max: 3, int: true },

  { key: 'MouseSens', label: 'mouse sensitivity', group: 'controls', type: 'double', kind: 'number', min: 0, max: 0.15 },
  { key: 'MouseSmoothing', label: 'mouse smoothing', group: 'controls', type: 'double', kind: 'number', min: 0, max: 0.15 },
  toggle('HoldToSprint', 'hold to sprint', 'controls'),
  toggle('CameraSway', 'camera sway', 'controls'),
  { key: 'crouchbind', label: 'crouch key', group: 'controls', type: 'string', kind: 'text' },

  { key: 'GraphicsPreset', label: 'graphics preset', group: 'display', type: 'dword', kind: 'enum', options: QUALITY },
  { key: 'UnityGraphicsQuality', label: 'quality level', group: 'display', type: 'dword', kind: 'enum', options: QUALITY },
  { key: 'Gamma', label: 'gamma', group: 'display', type: 'double', kind: 'number', min: 0.5, max: 1.25 },
  { key: 'DisplayMode', label: 'display mode', group: 'display', type: 'dword', kind: 'number', min: 0, max: 3, int: true },
  { key: 'SelectedResolution', label: 'resolution', group: 'display', type: 'string', kind: 'text' },
  { key: 'vSyncCount', label: 'vsync', group: 'display', type: 'dword', kind: 'number', min: 0, max: 4, int: true },
  toggle('oldRenderer', 'old renderer', 'display'),

  toggle('Crosshair', 'crosshair', 'interface'),
  toggle('InteractMessage', 'interaction prompts', 'interface'),
  toggle('Subtitles', 'subtitles', 'interface'),
  toggle('SpeedrunTimer', 'speedrun timer', 'interface'),
  { key: 'colorblind_filter', label: 'colourblind filter', group: 'interface', type: 'dword', kind: 'enum', options: COLORBLIND },

  {
    key: 'SelectedGamemode',
    label: 'last game mode',
    group: 'gameplay',
    type: 'dword',
    kind: 'enum',
    options: GAME_MODES.map((mode) => ({ value: mode.value, label: mode.label })),
  },
  toggle('HostOnlyTrainInteractions', 'host-only train controls', 'gameplay'),
  toggle('completedDisclaimer', 'seen the disclaimer', 'gameplay'),
];

const BY_KEY = new Map(SETTINGS.map((setting) => [setting.key, setting]));
export const findSetting = (key: string) => BY_KEY.get(key);

/** A setting's value as the editor shows it (50%, on, Melon), or null to show it as stored. */
export function displaySetting(key: string, value: unknown): string | null {
  const def = BY_KEY.get(key);
  if (!def || value === undefined) return null;
  if (def.kind === 'percent') return `${Math.round(Number(value) * 1000) / 10}%`;
  if (def.kind === 'bool') return Number(value) !== 0 ? 'on' : 'off';
  if (def.kind === 'enum') return def.options.find((o) => o.value === Number(value))?.label ?? null;
  return null;
}

const squash = (text: string) => text.toLowerCase().replace(/[\s_-]+/g, '');

/**
 * A value typed after `set <setting>`, in the editor's units: `50` or `50%`
 * for volumes, on/off for toggles, a name (or number) for choices.
 * Returns the stored value; throws a readable error otherwise.
 */
export function parseSetting(def: SettingDef, raw: string): number | string {
  const text = raw.trim();
  switch (def.kind) {
    case 'percent': {
      const percent = Number(text.replace(/%$/, ''));
      if (!Number.isFinite(percent)) throw new Error(`${def.label} is a percentage, like 50.`);
      return percent / 100;
    }
    case 'bool':
      if (/^(true|on|yes|1)$/i.test(text)) return 1;
      if (/^(false|off|no|0)$/i.test(text)) return 0;
      throw new Error(`${def.label} is on or off.`);
    case 'enum': {
      const wanted = squash(text);
      const asNumber = Number(text);
      const match =
        (wanted && def.options.find((o) => squash(o.label) === wanted)) ||
        (wanted && def.options.find((o) => squash(o.label).startsWith(wanted))) ||
        (text !== '' && Number.isInteger(asNumber) ? def.options.find((o) => o.value === asNumber) : undefined);
      if (!match) throw new Error(`${def.label} is one of: ${def.options.map((o) => o.label.toLowerCase()).join(', ')}.`);
      return match.value;
    }
    case 'number': {
      const number = Number(text);
      if (!Number.isFinite(number)) throw new Error(`${def.label} is a number.`);
      return def.int ? Math.trunc(number) : number;
    }
    case 'text':
      return text.replace(/^"(.*)"$/, '$1');
  }
}

/** What `set <setting> ` can tab-complete to: choice names, or on/off. */
export function settingCompletions(key: string): string[] {
  const def = BY_KEY.get(key);
  if (def?.kind === 'enum') return def.options.map((o) => o.label.toLowerCase().replace(/\s+/g, '-'));
  if (def?.kind === 'bool') return ['on', 'off'];
  return [];
}

/** Unity's own bookkeeping and anonymous IDs: never shown, never written. */
export const isHiddenSetting = (key: string) => /^unity[._]/i.test(key);

/** The known settings in this export, in order, for one group. */
export const settingsIn = (group: SettingGroup, data: JsonObject) => SETTINGS.filter((s) => s.group === group && s.key in data);

/** Values the export has that aren't described above (window size, monitor…). */
export const otherSettingKeys = (data: JsonObject) => Object.keys(data).filter((key) => !BY_KEY.has(key) && !isHiddenSetting(key));
