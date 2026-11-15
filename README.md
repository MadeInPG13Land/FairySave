# FairySave

A browser-based save editor for **Forsaken Frontiers**. Open a profile (`fairy engine PersistentData.fs`) or a world (`fairy engine save_N.fs`), edit it, and write it back. Everything runs locally; no file is uploaded.

Saves live in `%USERPROFILE%\AppData\LocalLow\made in fairyland\Forsaken Frontiers`. In Chrome or Edge the editor can save in place; elsewhere it downloads the edited file. Close the game before saving: it writes its saves when it quits.

## Two ways to edit

- **Terminal** (the default, CRT look): each open save is a directory under `~`. `cd save_1`, `ls`, then `edit economy` opens a section full screen, nano-style. `diff` shows every change with undo/redo, `save` opens the save menu, Tab completes anything. `help` lists the rest. `sudo` lifts the editor's own min/max limits for fun (`sudo off` puts them back); `sudo edit run` lifts them for that one form. Esc at an empty prompt, or `crt exit` in the status bar, switches to the regular editor.
- **Regular editor**: one tab per save, its sections in the sidebar.

## Game settings

The game keeps its settings (flavour, volumes, mouse, graphics, subtitles…) in the Windows registry, not in the save files. A browser can't touch the registry, so they go through a `.reg` file:

1. Export them (or right-click the key in `regedit` and choose Export):

   ```bash
   reg export "HKCU\Software\made in fairyland\Forsaken Frontiers" ff-settings.reg
   ```

2. Drop `ff-settings.reg` into FairySave. It opens as `~/settings` in the terminal and a settings tab in the regular editor.
3. Edit, then save: you get a `.reg` with just your changes. **Close the game**, then double-click it.

A setting only exists once the game has stored it (after you first change it in game). Unity's own IDs in the export are never shown or written back. `*.reg` is gitignored because exports contain them.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm test
npm run build      # static export to ./out (GitHub Pages)
```

The `Check` workflow runs the typecheck, tests and build on every push and pull request.

## Updating for a new game version

Item, cosmetic, tape, destination and modifier lists are generated from the game files rather than written by hand.

1. Export the game with [AssetRipper](https://github.com/AssetRipper/AssetRipper): export **both** the Unity project (scenes, prefabs, sprites, audio) and the decompiled scripts. Put the export folder(s) in one directory.
2. Run the extractor against that directory:

   ```bash
   npm run extract -- "C:/path/to/extractor"
   ```

   It rewrites `data/game-data.json`, copies icons into `public/game/`, transcodes tape audio to Ogg (needs `ffmpeg` on PATH; pass `--no-audio` to skip), and prints what was added or removed since the last run.
3. Check the diff. Display-only tweaks (nicer labels, which modifiers count as positive) live in `lib/game-data.ts`.

Even without re-extracting, the editor keeps working with newer saves: unknown fields are preserved and listed under **Other fields**, unknown destinations and data-deck skins are picked up from the save's keys, and the JSON view can edit anything.

## Layout

| Path | What |
| --- | --- |
| `scripts/extract-game-data.mjs` | AssetRipper export → `data/game-data.json` + assets |
| `lib/game-data.ts` | Typed catalogue and lookups |
| `lib/save.ts` | Save model: kind detection, known fields, train-item helpers |
| `lib/crypto.ts` | AES-CBC + base64 save encoding |
| `lib/store.ts` | Open files, edits, save/export (zustand) |
| `lib/registry.ts` | Read and write `.reg` exports of the game settings |
| `lib/settings.ts` | The game settings: labels, groups, ranges from the options menu |
| `components/player/*`, `components/world/*`, `components/settings.tsx` | Regular editor sections |
| `components/terminal/*` | The terminal: commands, forms, full-screen views, start screen |
