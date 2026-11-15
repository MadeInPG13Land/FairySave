'use client';

import { useState } from 'react';
import { Check, Copy, FolderOpen, Globe2, Lock, SlidersHorizontal, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/kit';
import { COSMETICS, DESTINATIONS, GAME_VERSION, ITEMS, TAPES } from '@/lib/game-data';
import { SAVE_FOLDER, supportsInPlaceSave } from '@/lib/file-access';
import { SETTINGS_EXPORT_COMMAND } from '@/lib/registry';

export function Welcome({ onOpenFile }: { onOpenFile: () => void }) {
  const [copied, setCopied] = useState<'path' | 'command' | null>(null);
  const copy = async (what: 'path' | 'command', text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    window.setTimeout(() => setCopied(null), 1500);
  };
  const inPlace = supportsInPlaceSave();

  return (
    <div className="mx-auto max-w-xl pt-6 sm:pt-16">
      <h1 className="text-[21px] font-semibold tracking-[-0.015em]">Edit a Forsaken Frontiers save</h1>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        Open a profile or world save to decrypt it, edit it, and write it back. Everything happens in your browser;
        files never leave your machine.
      </p>

      <button
        type="button"
        onClick={onOpenFile}
        className="group mt-8 flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-card px-6 py-10 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
      >
        <span className="flex size-10 items-center justify-center rounded-lg border bg-surface text-muted-foreground transition-colors group-hover:text-primary">
          <FolderOpen className="size-5" />
        </span>
        <span className="text-[12px] font-medium">Open save files</span>
        <span className="text-[11px] text-muted-foreground">
          or drop <code className="font-mono">.fs</code> or <code className="font-mono">.reg</code> files anywhere · <Kbd>Ctrl O</Kbd>
        </span>
      </button>

      <div className="mt-6 rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground" title={SAVE_FOLDER}>
            {SAVE_FOLDER}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void copy('path', SAVE_FOLDER)}
          >
            {copied === 'path' ? <Check /> : <Copy />} {copied === 'path' ? 'Copied' : 'Copy path'}
          </Button>
        </div>
        <dl className="divide-y text-[12px]">
          <div className="flex items-start gap-3 px-4 py-3">
            <UserRound className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
            <div>
              <dt className="font-mono text-[11px] text-foreground">fairy engine PersistentData.fs</dt>
              <dd className="mt-0.5 text-[11px] text-muted-foreground">Your profile: rank, cosmetics, tapes, data-deck skins.</dd>
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3">
            <Globe2 className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
            <div>
              <dt className="font-mono text-[11px] text-foreground">fairy engine save_1.fs … save_4.fs</dt>
              <dd className="mt-0.5 text-[11px] text-muted-foreground">A world: credits, debt, destinations and items on the train.</dd>
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3">
            <SlidersHorizontal className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
            <div className="min-w-0 flex-1">
              <dt className="text-[11px] text-foreground">Game settings</dt>
              <dd className="mt-0.5 text-[11px] text-muted-foreground">
                Flavour, volumes, mouse and graphics live in the registry. Export them, then drop the .reg file here:
              </dd>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[10px] text-muted-foreground" title={SETTINGS_EXPORT_COMMAND}>
                  {SETTINGS_EXPORT_COMMAND}
                </code>
                <Button variant="ghost" size="sm" onClick={() => void copy('command', SETTINGS_EXPORT_COMMAND)}>
                  {copied === 'command' ? <Check /> : <Copy />} {copied === 'command' ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
            <dd className="text-[11px] text-muted-foreground">
              {inPlace
                ? 'Your browser supports saving in place: the first save asks for permission to write to the file.'
                : 'Your browser downloads edited saves; copy them back into the folder above. Chrome or Edge can save in place.'}{' '}
              Close the game before saving, and keep a backup.
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-6 text-[11px] text-subtle-foreground">
        Game data v{GAME_VERSION}: {DESTINATIONS.length} destinations, {ITEMS.length} items, {COSMETICS.length} cosmetics,{' '}
        {TAPES.length} tapes.
      </p>
    </div>
  );
}
