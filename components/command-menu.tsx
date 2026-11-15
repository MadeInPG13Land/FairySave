'use client';

import { Braces, Check, Download, FolderOpen, RotateCcw, Save, X } from 'lucide-react';
import { THEMES } from './themes';
import { useTheme } from 'next-themes';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { closeWithConfirm, useActiveDoc, useEditor } from '@/lib/store';
import { sectionsFor } from './sections';
import { displayName } from './sidebar';

export function CommandMenu({
  open,
  onOpenChange,
  onOpenFile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFile: () => void;
}) {
  const docs = useEditor((state) => state.docs);
  const doc = useActiveDoc();
  const { activate, setSection, setView, save, revert } = useEditor.getState();
  const { theme, setTheme } = useTheme();

  const run = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command menu" description="Search sections, files and actions">
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {doc ? (
          <CommandGroup heading="Go to">
            {sectionsFor(doc.kind).map((section) => (
              <CommandItem key={section.id} onSelect={run(() => setSection(section.id))}>
                <section.icon /> {section.label}
              </CommandItem>
            ))}
            <CommandItem onSelect={run(() => setView('json'))}>
              <Braces /> JSON
            </CommandItem>
          </CommandGroup>
        ) : null}
        <CommandGroup heading="Actions">
          <CommandItem onSelect={run(onOpenFile)}>
            <FolderOpen /> Open save files…
            <CommandShortcut>Ctrl O</CommandShortcut>
          </CommandItem>
          {doc ? (
            <>
              <CommandItem onSelect={run(() => void save())}>
                <Save /> Save
                <CommandShortcut>Ctrl S</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={run(() => void save({ download: true }))}>
                <Download /> Download a copy
              </CommandItem>
              <CommandItem onSelect={run(revert)}>
                <RotateCcw /> Revert changes
              </CommandItem>
              <CommandItem onSelect={run(() => closeWithConfirm())}>
                <X /> Close file
              </CommandItem>
            </>
          ) : null}
        </CommandGroup>
        <CommandGroup heading="Theme">
          {THEMES.map((option) => (
            <CommandItem key={option.id} value={`theme ${option.label}`} onSelect={run(() => setTheme(option.id))}>
              <option.icon /> {option.label} theme
              {theme === option.id ? <Check className="ml-auto" /> : null}
            </CommandItem>
          ))}
        </CommandGroup>
        {docs.length > 1 ? (
          <CommandGroup heading="Files">
            {docs.map((entry) => (
              <CommandItem key={entry.id} value={`file ${entry.fileName}`} onSelect={run(() => activate(entry.id))}>
                {displayName(entry)}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
