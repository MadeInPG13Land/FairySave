import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditor, type SaveDoc } from '@/lib/store';
import { useSudo } from './sudo';
import { SETTINGS_EXPORT_COMMAND } from '@/lib/registry';
import { ROOT, completions, cwdLabel, outcome, runCommand, suggest, type CommandContext, type Cwd, type Line } from './commands';

function doc(id: string, fileName: string, kind: SaveDoc['kind'], data: SaveDoc['data'], openedAt: number): SaveDoc {
  return { id, fileName, kind, data, original: data, handle: null, access: 'none', view: 'guided', section: null, openedAt };
}

let cwd: Cwd = ROOT;
async function run(input: string) {
  const ctx: CommandContext = { openPicker: async () => {}, setTheme: () => {}, clear: () => {}, cwd };
  const result = await runCommand(input, ctx);
  if (result.cwd) cwd = result.cwd;
  return result.lines;
}
const texts = (lines: Awaited<ReturnType<typeof run>>) =>
  lines.map((line) => ('text' in line ? line.text : 'value' in line ? `${line.key} ${line.value}` : line.kind)).join('\n');

beforeEach(() => {
  cwd = ROOT;
  useEditor.setState({
    hydrated: true,
    activeId: 'p',
    docs: [
      doc('w', 'fairy engine save_1.fs', 'world', { credits: 100, trainItems: [], gamemode: 0 }, 1),
      doc('p', 'fairy engine PersistentData.fs', 'player', { characterName: 'Matt', prestige: 1, unlockedCosmetics: [] }, 2),
    ],
  });
});

const data = (id: string) => useEditor.getState().docs.find((d) => d.id === id)!.data;

describe('terminal directories', () => {
  it('starts home and cds into saves and folders', async () => {
    expect(cwdLabel(cwd)).toBe('~');
    await run('cd save_1');
    expect(cwdLabel(cwd)).toBe('~/save_1');
    await run('..');
    expect(cwdLabel(cwd)).toBe('~');
    await run('cd persistentdata/cosmetics');
    expect(cwdLabel(cwd)).toBe('~/PersistentData/cosmetics');
    await run('cd ..');
    expect(cwdLabel(cwd)).toBe('~/PersistentData');
    await run('cd ~/save_1');
    expect(cwdLabel(cwd)).toBe('~/save_1');
  });

  it('sections are files: cd refuses, edit opens them without moving', async () => {
    await run('cd save_1');
    const refused = await run('cd economy');
    expect(texts(refused)).toMatch(/is a file/);
    expect(cwdLabel(cwd)).toBe('~/save_1');
    for (const verb of ['edit', 'vi', 'show', 'cat']) {
      const lines = await run(`${verb} economy`);
      expect(lines[0]).toMatchObject({ kind: 'form', docId: 'w', section: 'economy', autofocus: verb === 'edit' || verb === 'vi' });
    }
    expect(cwdLabel(cwd)).toBe('~/save_1');
  });

  it('opens files by path from anywhere, and by bare name', async () => {
    expect((await run('edit save_1/economy'))[0]).toMatchObject({ kind: 'form', docId: 'w', section: 'economy' });
    expect((await run('edit PersistentData/cosmetics/pins'))[0]).toMatchObject({ kind: 'form', docId: 'p', section: 'cosmetics/pins' });
    expect(cwdLabel(cwd)).toBe('~');
    await run('cd PersistentData');
    expect((await run('pins'))[0]).toMatchObject({ kind: 'form', section: 'cosmetics/pins' });
    expect((await run('edit pins'))[0]).toMatchObject({ kind: 'form', section: 'cosmetics/pins' });
  });

  it('only finds a save directory from home', async () => {
    await run('cd save_1');
    const lines = await run('cd PersistentData');
    expect(texts(lines)).toMatch(/no such directory/);
    expect(cwdLabel(cwd)).toBe('~/save_1');
    await run('cd ../PersistentData');
    expect(cwdLabel(cwd)).toBe('~/PersistentData');
  });

  it('give from the profile moves into the world save and works', async () => {
    await run('cd PersistentData');
    const lines = await run('give 3 flare');
    expect(cwdLabel(cwd)).toBe('~/save_1');
    expect(texts(lines)).toContain('cd ~/save_1');
    expect((data('w').trainItems as unknown[]).length).toBe(3);
  });

  it('writes to the save you are in even if another save is active', async () => {
    await run('cd save_1');
    // Editing an older PersistentData form activates the profile.
    useEditor.getState().activate('p');
    await run('credits 5000');
    expect(data('w').credits).toBe(5000);
    expect(data('p').credits).toBeUndefined();
  });

  it('save acts on the save you are in', async () => {
    await run('cd save_1');
    await run('credits 5');
    useEditor.getState().activate('p');
    const original = useEditor.getState().save;
    const save = vi.fn(async () => 'file' as const);
    useEditor.setState({ save });
    try {
      // Ctrl+S inside a save runs `save ~/<that save>`.
      await run('save ~/save_1');
      expect(useEditor.getState().activeId).toBe('w');
      expect(save).toHaveBeenCalledTimes(1);
    } finally {
      useEditor.setState({ save: original });
    }
  });

  it('field shortcuts set values inside a save', async () => {
    await run('cd save_1');
    await run('credits 5000');
    expect(data('w').credits).toBe(5000);
    await run('gamemode starless');
    expect(data('w').gamemode).toBe(4);
  });

  it('explains when the needed save is not open', async () => {
    useEditor.setState({ docs: useEditor.getState().docs.filter((d) => d.kind === 'player') });
    const lines = await run('give flare');
    expect(texts(lines)).toMatch(/works on a world save/);
    expect(cwdLabel(cwd)).toBe('~');
  });
});

describe('close', () => {
  it('refuses to close a save with unsaved changes', async () => {
    await run('cd save_1');
    await run('credits 5000');
    const lines = await run('close');
    expect(texts(lines)).toMatch(/unsaved/);
    expect(useEditor.getState().docs.some((d) => d.id === 'w')).toBe(true);
  });

  it('close -f throws the changes away', async () => {
    await run('cd save_1');
    await run('credits 5000');
    await run('close -f');
    expect(useEditor.getState().docs.some((d) => d.id === 'w')).toBe(false);
    expect(cwdLabel(cwd)).toBe('~');
  });

  it('closes a clean save straight away', async () => {
    await run('cd save_1');
    await run('close');
    expect(useEditor.getState().docs.some((d) => d.id === 'w')).toBe(false);
  });
});

describe('nested directories', () => {
  it('cosmetics is a folder holding the slots, pins and patches files', async () => {
    await run('cd PersistentData');
    const top = texts(await run('ls'));
    expect(top).toMatch(/cosmetics\//);
    expect(top).toMatch(/profile /);
    await run('cd cosmetics');
    expect(cwdLabel(cwd)).toBe('~/PersistentData/cosmetics');
    expect(texts(await run('ls'))).toMatch(/slots [\s\S]*pins [\s\S]*patches /);
    expect((await run('edit slots'))[0]).toMatchObject({ kind: 'form', section: 'cosmetics/slots' });
    expect((await run('edit ../profile'))[0]).toMatchObject({ kind: 'form', section: 'profile' });
    expect(cwdLabel(cwd)).toBe('~/PersistentData/cosmetics');
  });

  it('completes folders for cd and files for edit', () => {
    const inProfile: Cwd = { docId: 'p', section: null };
    expect(completions('cd co', inProfile)).toEqual(['cosmetics/']);
    expect(completions('cd p', inProfile)).toEqual([]);
    expect(completions('edit cosmetics/p', inProfile)).toEqual(['cosmetics/pins', 'cosmetics/patches']);
    expect(completions('vi sl', { docId: 'p', section: 'cosmetics' })).toEqual(['slots']);
  });
});

describe('diff', () => {
  it('opens the live diff for the save you are in, and says when nothing changed', async () => {
    await run('cd save_1');
    expect(texts(await run('diff'))).toMatch(/no changes/);
    await run('give 3 flare');
    expect(await run('diff')).toEqual([{ kind: 'diff', docId: 'w' }]);
  });

  it('ls ~ lists the saves, with unsaved counts, without moving', async () => {
    await run('cd save_1');
    await run('credits 5');
    const out = texts(await run('ls ~'));
    expect(out).toMatch(/save_1\/ fairy engine save_1\.fs/);
    expect(out).toMatch(/PersistentData\//);
    expect(cwdLabel(cwd)).toBe('~/save_1');
  });

  it('diff ~/save opens another save without moving there', async () => {
    await run('cd PersistentData');
    await run('cd ~/save_1');
    await run('give flare');
    await run('cd ~/PersistentData');
    expect(await run('diff ~/save_1')).toEqual([{ kind: 'diff', docId: 'w' }]);
    expect(cwdLabel(cwd)).toBe('~/PersistentData');
    expect(texts(await run('diff ~/nope'))).toMatch(/no open save/);
  });
});

describe('credits', () => {
  it('shows the studio credits from anywhere', async () => {
    const lines = await run('credits');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: 'fetch', title: 'Forsaken Frontiers' });
    // Just the game, who made it, and the Steam page.
    expect(lines[0].kind === 'fetch' && lines[0].rows.map((r) => r.key)).toEqual(['by', 'steam']);
  });

  it('still lets you set the credits field inside a save', async () => {
    await run('cd save_1');
    await run('credits 42');
    expect(data('w').credits).toBe(42);
    expect((await run('credits'))[0]).toMatchObject({ kind: 'fetch' });
  });
});

describe('tab completion', () => {
  it('completes save directories and paths', () => {
    expect(completions('cd sa', ROOT)).toEqual(['save_1/']);
    expect(completions('cd ', ROOT)).toEqual(['save_1/', 'PersistentData/']);
    expect(completions('edit save_1/ec', ROOT)).toEqual(['save_1/economy']);
    expect(completions('cd save_1/', ROOT)).toEqual([]);
    expect(completions('pers', ROOT)).toContain('PersistentData/');
  });

  it('completes sections inside a save', () => {
    const inWorld: Cwd = { docId: 'w', section: null };
    expect(completions('edit ec', inWorld)).toEqual(['economy']);
    expect(completions('ec', inWorld)).toContain('economy');
    expect(completions('cd ../Per', inWorld)).toEqual(['../PersistentData/']);
  });
});

describe('suggestions', () => {
  const inWorld: Cwd = { docId: 'w', section: null };
  const inProfile: Cwd = { docId: 'p', section: null };
  const values = (input: string, at: Cwd) => suggest(input, at)?.candidates.map((c) => c.value);

  it('suggests the next step on an empty prompt', () => {
    expect(values('', ROOT)).toEqual(['cd PersistentData']);
    expect(values('', inWorld)).toEqual(['edit run']);
    useEditor.setState({ docs: [] });
    expect(values('', ROOT)).toEqual(['open']);
  });

  it('suggests diff when there are unsaved changes', async () => {
    await run('cd save_1');
    await run('credits 1');
    expect(values('', inWorld)).toEqual(['diff']);
  });

  it('a finished command offers everything that can follow it here', () => {
    expect(values('cd', ROOT)).toEqual(['cd save_1/', 'cd PersistentData/']);
    expect(values('cd', inProfile)).toEqual(['cd cosmetics/', 'cd ..', 'cd ~']);
    expect(suggest('cd', ROOT)?.ghost).toBe(' <save|folder|..|~>');
    expect(values('give', inWorld)?.length).toBeGreaterThan(10);
  });

  it('never suggests from typed history', async () => {
    await run('cd PersistentData');
    await run('cd ~');
    expect(values('cd P', ROOT)).toEqual(['cd PersistentData/']);
    expect(values('cd', inProfile)).not.toContain('cd PersistentData');
  });

  it('filters what exists by what is typed', () => {
    expect(values('edit ec', inWorld)).toEqual(['edit economy']);
    expect(suggest('edit ec', inWorld)?.ghost).toBe('onomy');
    expect(values('cd Pe', ROOT)).toEqual(['cd PersistentData/']);
    expect(values('give fl', inWorld)).toEqual(['give flashlight', 'give flare']);
  });

  it('links on screen use full paths so they work from anywhere', async () => {
    await run('cd PersistentData');
    const lines = await run('ls');
    const commands = lines.flatMap((l) => (l.kind === 'record' && l.command ? [l.command] : []));
    expect(commands).toContain('cd ~/PersistentData/cosmetics');
    expect(commands).toContain('edit ~/PersistentData/profile');
    await run('cd ~/save_1');
    expect((await run('cd ~/PersistentData/cosmetics')).some((l) => l.kind === 'error')).toBe(false);
    expect(cwdLabel(cwd)).toBe('~/PersistentData/cosmetics');
  });

  it('hints at the arguments a command still needs', () => {
    expect(suggest('give', inWorld)?.ghost).toBe(' <item> [count]');
    expect(suggest('give ', inWorld)?.ghost).toBe('<item> [count]');
    expect(suggest('give flare ', inWorld)?.ghost).toBe('[count]');
  });
});

describe('full-screen outcome', () => {
  it('says when nothing changed', () => {
    expect(texts(outcome('profile', { prestige: 1 }, { prestige: 1 }))).toBe('profile: no changes.');
  });

  it('uses the form labels, with values before and after', () => {
    const [line] = outcome('profile', { rankLevel: 67 }, { rankLevel: 999 }, 'player', 'PersistentData.fs');
    expect(line).toMatchObject({ kind: 'changes', title: 'profile', file: 'PersistentData.fs', unsaved: true });
    expect(line.kind === 'changes' && line.fields).toEqual([{ label: 'rank', from: '67', to: '999', summary: undefined, entries: [] }]);
  });

  it('summarises lists in words with their entries', () => {
    const [line] = outcome('cosmetics/pins', { unlockedCosmetics: ['abandoned_pin', 'usa'] }, { unlockedCosmetics: ['usa'] }, 'player');
    expect(line.kind === 'changes' && line.fields).toEqual([
      { label: 'unlocked cosmetics', from: undefined, to: undefined, summary: '1 removed', entries: [{ sign: '-', label: 'Abandoned pin', detail: undefined }] },
    ]);
  });
});

describe('saving', () => {
  const withSaveSpy = async (body: (save: ReturnType<typeof vi.fn>) => Promise<void>, result: 'file' | 'download' = 'file') => {
    const original = useEditor.getState().save;
    const save = vi.fn(async () => result);
    useEditor.setState({ save });
    try {
      await body(save);
    } finally {
      useEditor.setState({ save: original });
    }
  };

  it('save on its own opens the save menu, starting on the save you are in', async () => {
    expect(await run('save')).toEqual([{ kind: 'save-menu', docId: null }]);
    await run('cd save_1');
    expect(await run('save')).toEqual([{ kind: 'save-menu', docId: 'w' }]);
  });

  it('save <save> writes that one, even if another is active', async () => {
    useEditor.getState().activate('w');
    await withSaveSpy(async (save) => {
      const lines = await run('save ~/PersistentData');
      expect(save).toHaveBeenCalledTimes(1);
      expect(useEditor.getState().activeId).toBe('p');
      expect(texts(lines)).toMatch(/wrote PersistentData\.fs/);
    });
  });

  it('saves any time, even with no changes', async () => {
    await withSaveSpy(async (save) => {
      await run('save ~/save_1');
      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  it('says a download is a copy, not written', async () => {
    await withSaveSpy(async () => {
      expect(texts(await run('save ~/save_1'))).toMatch(/downloaded .* copy it into your save folder/);
    }, 'download');
  });
});

describe('sudo', () => {
  it('bare sudo (or sudo on) stays on until sudo off', async () => {
    useSudo.getState().set(false);
    expect(texts(await run('sudo'))).toBe('limits lifted.');
    expect(useSudo.getState().on).toBe(true);
    await run('sudo off');
    expect(useSudo.getState().on).toBe(false);
    await run('sudo on');
    expect(useSudo.getState()).toMatchObject({ on: true, once: false });
    await run('sudo off');
  });

  it('sudo <command> is a one-off', async () => {
    useSudo.getState().set(false);
    await run('sudo ls');
    expect(useSudo.getState().on).toBe(false);
    // A full-screen view keeps it until the shell closes the view.
    const lines = await run('sudo edit save_1/run');
    expect(lines.at(-1)).toMatchObject({ kind: 'form', section: 'run' });
    expect(useSudo.getState()).toMatchObject({ on: true, once: true });
    useSudo.getState().set(false);
  });

  it('tab completes the command after sudo, plus off', () => {
    expect(completions('sudo ', ROOT)).toContain('off');
    expect(completions('sudo ', ROOT)).toContain('edit');
    expect(completions('sudo ed', ROOT)).toContain('edit');
    expect(completions('sudo cd sa', ROOT)).toContain('save_1/');
    const s = suggest('sudo cd ', ROOT)!;
    expect(s.candidates.every((c) => c.value.startsWith('sudo cd '))).toBe(true);
    expect(suggest('sudo o', ROOT)!.ghost).toBe('ff');
  });

  it('exit leaves sudo before it leaves the terminal', async () => {
    useSudo.getState().set(true);
    let theme = '';
    const ctx = { openPicker: async () => {}, setTheme: (t: string) => (theme = t), clear: () => {}, cwd: ROOT };
    expect(texts((await runCommand('exit', ctx)).lines)).toMatch(/limits back on/);
    expect(useSudo.getState().on).toBe(false);
    expect(theme).toBe('');
    await runCommand('exit', ctx);
    expect(theme).toBe('dark');
  });
});

describe('game settings in the terminal', () => {
  const addSettings = () =>
    useEditor.setState((state) => ({
      docs: [...state.docs, doc('s', 'ff-settings.reg', 'settings', { FlavorIndex: 11, MasterVolume: 0.36, Subtitles: 1, MouseSens: 0.1 }, 3)],
    }));

  it('settings explains how to export them when none are open', async () => {
    expect(texts(await run('settings'))).toContain(SETTINGS_EXPORT_COMMAND);
  });

  it('settings goes to ~/settings, and set speaks the editor units', async () => {
    addSettings();
    await run('settings');
    expect(cwdLabel(cwd)).toBe('~/settings');
    await run('set MasterVolume 50');
    expect(data('s').MasterVolume).toBe(0.5);
    await run('Subtitles off');
    expect(data('s').Subtitles).toBe(0);
    const lines = await run('FlavorIndex cream-soda');
    expect(data('s').FlavorIndex).toBe(12);
    expect(texts(lines)).toMatch(/Melon -> Cream Soda/);
    expect(texts(await run('FlavorIndex banana'))).toMatch(/one of: vanilla/);
    expect(data('s').FlavorIndex).toBe(12);
  });

  it('tab completes flavour names and on/off', async () => {
    addSettings();
    await run('cd settings');
    expect(completions('set FlavorIndex me', cwd)).toEqual(['melon']);
    expect(completions('set Subtitles ', cwd)).toEqual(['on', 'off']);
  });
});

