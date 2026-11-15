'use client';

import { useCallback, useEffect, useState, type DragEvent } from 'react';
import { FileUp } from 'lucide-react';
import { useEditor, useActiveDoc } from '@/lib/store';
import { filesFromDrop, pickSaveFiles } from '@/lib/file-access';
import { AppMeta, AppTitle, SectionNav } from './sidebar';
import { TabStrip } from './tabs';
import { Welcome } from './welcome';
import { CommandMenu } from './command-menu';
import { CrtGlass } from './crt-glass';
import { TerminalShell } from './terminal/terminal-shell';
import { useTheme } from 'next-themes';
import { JsonEditor } from './json-editor';
import { resolveSection } from './sections';
import { cn } from '@/lib/utils';

export function AppShell() {
  const hydrated = useEditor((state) => state.hydrated);
  const hydrate = useEditor((state) => state.hydrate);
  const openFiles = useEditor((state) => state.openFiles);
  const save = useEditor((state) => state.save);
  const doc = useActiveDoc();
  const [dragging, setDragging] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { theme } = useTheme();
  // The CRT theme swaps the whole UI for a command line.
  const terminal = hydrated && theme === 'crt';

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const openPicker = useCallback(async () => {
    const files = await pickSaveFiles();
    if (files.length) await openFiles(files);
  }, [openFiles]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (document.getElementById('term-input')) document.getElementById('term-input')?.focus();
        else setCommandOpen((open) => !open);
      } else if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        // The CRT terminal handles its own Ctrl+S, since it knows which save you're in.
        if (document.querySelector('.term')) return;
        if (useEditor.getState().activeId) void save({ download: event.shiftKey });
      } else if (mod && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void openPicker();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPicker, save]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      const dirty = useEditor
        .getState()
        .docs.some((entry) => JSON.stringify(entry.data) !== JSON.stringify(entry.original));
      if (dirty) event.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const dragHandlers = {
    onDragOver: (event: DragEvent) => {
      if (!Array.from(event.dataTransfer.types).includes('Files')) return;
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: (event: DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: async (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const files = await filesFromDrop(event.dataTransfer);
      if (files.length) await openFiles(files);
    },
  };

  const section = doc ? resolveSection(doc.kind, doc.section) : null;
  const showJson = doc && (doc.view === 'json' || !section);
  const set = useEditor((state) => state.setField);

  return (
    <div className={cn('app-screen flex h-dvh overflow-hidden', terminal ? 'bg-background' : 'bg-sidebar')} {...dragHandlers}>
      {terminal ? (
        <TerminalShell onOpenPicker={openPicker} />
      ) : (
        <>
        {/* Title row outside the page: app title, then the saves as tabs, then app-wide bits.
            The page below spans the full width; the active tab runs into it, and the
            tab's sections sit in a column inside the page. */}
        <div className="flex min-w-0 flex-1 flex-col px-2 pb-2">
          <div className="flex h-11 shrink-0 items-end">
            <AppTitle onOpenCommand={() => setCommandOpen(true)} />
            <TabStrip onOpenFile={openPicker} />
            <AppMeta />
          </div>
          <div className="app-panel flex min-h-0 flex-1">
            <SectionNav />
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="min-h-0 flex-1 overflow-y-auto">
                <div
                  className={cn(
                    'mx-auto w-full px-4 py-6 sm:px-8 sm:py-8',
                    showJson ? 'flex h-full max-w-5xl flex-col' : 'max-w-[880px]',
                  )}
                >
                  {!hydrated ? null : !doc ? (
                    <Welcome onOpenFile={openPicker} />
                  ) : showJson ? (
                    <JsonEditor key={doc.id} doc={doc} />
                  ) : section ? (
                    <section.component key={`${doc.id}:${section.id}`} data={doc.data} kind={doc.kind} set={set} />
                  ) : null}
                </div>
              </main>
            </div>
          </div>
        </div>
        <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} onOpenFile={openPicker} />
        </>
      )}

      <CrtGlass />

      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-card px-12 py-10">
            <FileUp className="size-6 text-primary" />
            <p className="text-[12px] font-medium">Drop save files to open</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
