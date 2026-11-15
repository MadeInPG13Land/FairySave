import { describe, expect, it, vi } from 'vitest';
import { COSMETICS, GENDERS, PATCHES, PINS } from '@/lib/game-data';
import type { JsonObject } from '@/lib/save';
import { buildForm, leafSections, resolveSectionId, rowChanges } from './forms';

const WORLD: JsonObject = { credits: 100, saleItems: [], trainItems: [], gamemode: 0, someNewField: 3 };
const SETTINGS: JsonObject = { FlavorIndex: 11, MasterVolume: 0.363, Subtitles: 1, MouseSens: 0.1, 'Screenmanager Resolution Width': 1920, 'unity.cloud_userid': 'x' };
const PLAYER: JsonObject = { characterName: 'Matt', gender: 1, prestige: 1, unlockedCosmetics: [], tapes: [] };

function form(kind: 'world' | 'player' | 'settings', section: string, data: JsonObject) {
  const write = vi.fn();
  return { write, def: buildForm(section, data, kind, write, () => data) };
}

describe('terminal forms', () => {
  it.each([
    ...leafSections('world').map((s) => ['world', s.id] as const),
    ...leafSections('player').map((s) => ['player', s.id] as const),
    ...leafSections('settings').map((s) => ['settings', s.id] as const),
  ])('%s %s builds rows or says it is empty', (kind, section) => {
    const { def } = form(kind, section, kind === 'world' ? WORLD : kind === 'player' ? PLAYER : SETTINGS);
    expect(def.rows.length > 0 || Boolean(def.empty)).toBe(true);
  });

  it('credits writes the credits field', () => {
    const { def, write } = form('world', 'economy', WORLD);
    const control = def.rows.find((row) => row.id === 'credits')!.controls[0];
    if (control.kind !== 'number') throw new Error('credits should be a number');
    control.set(50);
    expect(write).toHaveBeenCalledWith('credits', 50);
  });

  it('the placeholder sale line adds a 20% sale when an item is picked', () => {
    const { def, write } = form('world', 'economy', WORLD);
    const placeholder = def.rows.find((row) => row.id === 'sale:new')!;
    expect(placeholder.ghost).toBe(true);
    const picker = placeholder.controls[0];
    if (picker.kind !== 'enum') throw new Error('the placeholder should be an item picker');
    picker.set('__new__'); // the "pick an item" option does nothing
    expect(write).not.toHaveBeenCalled();
    picker.set(picker.options[1].value);
    expect(write).toHaveBeenCalledWith('saleItems', [{ itemName: picker.options[1].value, salePercent: 20 }]);
  });

  it('a filled-in sale gets its own row and a fresh placeholder below it', () => {
    const data = { ...WORLD, saleItems: [{ itemName: 'medkit', salePercent: 20 }] };
    const { def } = form('world', 'economy', data);
    const ids = def.rows.map((row) => row.id).filter((id) => id.startsWith('sale:'));
    expect(ids).toEqual(['sale:0', 'sale:new']);
    const picker = def.rows.find((row) => row.id === 'sale:new')!.controls[0];
    // Only items not already on sale are offered.
    expect(picker.kind === 'enum' && picker.options.some((o) => o.value === 'medkit')).toBe(false);
    const remove = def.rows.find((row) => row.id === 'sale:0')!.controls.find((c) => c.kind === 'action');
    expect(remove && remove.kind === 'action' && remove.label).toBe('remove');
  });

  it('unlock all on pins only unlocks pins, keeping patches', () => {
    const data = { ...PLAYER, unlockedCosmetics: ['rainbow_patch'] };
    const { def, write } = form('player', 'cosmetics/pins', data);
    def.actions!.find((a) => a.label === 'unlock all')!.run();
    const [key, value] = write.mock.calls[0];
    expect(key).toBe('unlockedCosmetics');
    expect(value).toHaveLength(PINS.length + 1);
    expect(value).toContain('rainbow_patch');
  });

  it('lock all on patches leaves pins alone', () => {
    const data = { ...PLAYER, unlockedCosmetics: [PINS[0].id, PATCHES[0].id] };
    const { def, write } = form('player', 'cosmetics/patches', data);
    def.actions!.find((a) => a.label === 'lock all')!.run();
    expect(write).toHaveBeenCalledWith('unlockedCosmetics', [PINS[0].id]);
  });

  it('slots have their own page', () => {
    const { def } = form('player', 'cosmetics/slots', PLAYER);
    expect(def.rows.map((row) => row.id)).toEqual(['pin1', 'pin2', 'patch1', 'patch2']);
    expect(COSMETICS.length).toBe(PINS.length + PATCHES.length);
  });

  it('resolves nested section names and paths', () => {
    expect(resolveSectionId('player', 'cosmetics')).toBe('cosmetics');
    expect(resolveSectionId('player', 'pins', 'cosmetics')).toBe('cosmetics/pins');
    expect(resolveSectionId('player', 'cosmetics/pa')).toBe('cosmetics/patches');
    expect(resolveSectionId('player', 'slots')).toBe('cosmetics/slots');
    expect(resolveSectionId('player', 'slots', null, true)).toBeNull();
  });

  it('body type offers the game genders', () => {
    const { def } = form('player', 'profile', PLAYER);
    const control = def.rows.find((row) => row.id === 'gender')!.controls[0];
    if (control.kind !== 'enum') throw new Error('gender should be an enum');
    expect(control.options.map((o) => o.value)).toEqual(GENDERS.map((g) => g.value));
  });

  it('marks changed rows with what they were, and can put it back', () => {
    const before = { ...WORLD, maxPlayers: 4 };
    const after = { ...before, credits: 250, saleItems: [{ itemName: 'medkit', salePercent: 20 }] };
    const write = vi.fn();
    const changes = rowChanges(buildForm('economy', after, 'world', write, () => after), buildForm('economy', before, 'world', () => {}, () => before));
    expect(changes.get('credits')?.was).toBe('100');
    expect(changes.get('sale:0')).toEqual({ was: '' });
    expect(changes.has('sale:new')).toBe(false);
    changes.get('credits')!.undo!();
    expect(write).toHaveBeenCalledWith('credits', 100);
  });

  it('settings: volumes as percentages, toggles as 0/1, unity ids hidden', () => {
    const audio = form('settings', 'audio', SETTINGS);
    const master = audio.def.rows.find((row) => row.id === 'MasterVolume')!.controls[0];
    if (master.kind !== 'number') throw new Error('volume should be a number');
    // Stored as 0..1, shown x100: the control holds the stored value, only the display scales.
    expect(master).toMatchObject({ value: 0.363, max: 1, scale: 100, suffix: '%' });
    master.set(0.5);
    expect(audio.write).toHaveBeenCalledWith('MasterVolume', 0.5);

    const ui = form('settings', 'interface', SETTINGS);
    const subtitles = ui.def.rows.find((row) => row.id === 'Subtitles')!.controls[0];
    if (subtitles.kind !== 'bool') throw new Error('subtitles should be a toggle');
    expect(subtitles.value).toBe(true);
    subtitles.set(false);
    expect(ui.write).toHaveBeenCalledWith('Subtitles', 0);

    const other = form('settings', 'other', SETTINGS).def.rows.map((row) => row.id);
    expect(other).toEqual(['Screenmanager Resolution Width']);
    expect(form('settings', 'character', SETTINGS).def.rows[0].controls[0]).toMatchObject({ kind: 'enum', value: 11 });
  });

  it('undoing a percentage puts back the exact stored value, not the rounded one', () => {
    const before = { ...SETTINGS, MasterVolume: 0.36340636014938354 };
    const after = { ...before, MasterVolume: 0.5 };
    const write = vi.fn();
    const changes = rowChanges(
      buildForm('audio', after, 'settings', write, () => after),
      buildForm('audio', before, 'settings', () => {}, () => before),
    );
    expect(changes.get('MasterVolume')?.was).toBe('36.3%');
    changes.get('MasterVolume')!.undo!();
    expect(write).toHaveBeenCalledWith('MasterVolume', 0.36340636014938354);
  });

  it('other lists fields the guided editor does not cover', () => {
    const { def } = form('world', 'other', WORLD);
    expect(def.rows.map((row) => row.id)).toContain('someNewField');
  });
});
