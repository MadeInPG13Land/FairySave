'use client';

import { type DragEvent, useMemo, useState } from 'react';
import { FileUp, FolderSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/lib/store';
import { assetPath } from '@/lib/asset-path';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function EmptyTabState() {
  const { loadSampleData, loadLocalFile } = useEditorStore();
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const supportsDirectAccess = useMemo(
    () => typeof window !== 'undefined' && 'showOpenFilePicker' in window,
    [],
  );
  const saveFolderPath = '%USERPROFILE%\\AppData\\LocalLow\\made in fairyland\\Forsaken Frontiers';

  function handleOpenClick() {
    if (supportsDirectAccess) {
      setShowPermissionDialog(true);
      return;
    }

    loadSampleData();
  }

  function handleOpenWithAccess() {
    setShowPermissionDialog(false);
    loadSampleData({ requestWriteAccess: true });
  }

  async function handleCopySavePath() {
    try {
      await navigator.clipboard.writeText(saveFolderPath);
      setPathCopied(true);
      window.setTimeout(() => setPathCopied(false), 2000);
    } catch {
      setPathCopied(false);
    }
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDraggingFile(true);
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingFile(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDraggingFile(false);

    const file = event.dataTransfer.files?.item(0);
    if (!file) {
      return;
    }

    loadLocalFile(file);
  }

  return (
    <div className="flex h-full min-h-[32rem] items-center justify-center">
      <div className="w-full max-w-3xl rounded-2xl border border-white/8 bg-white/[0.025] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.18)] md:p-10">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-white/8 bg-white/[0.04]">
              <img
                src={assetPath('/fairysavetool-logo.png')}
                alt="FairySaveTool"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary/80">
                FairySaveTool
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Open a save or profile file
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenClick}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`group rounded-2xl border border-dashed px-6 py-10 text-left transition ${
              isDraggingFile
                ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(34,197,94,0.25)]'
                : 'border-white/10 bg-black/10 hover:border-primary/60 hover:bg-primary/5'
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-primary transition group-hover:border-primary/30 group-hover:bg-primary/10">
                <FileUp className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-foreground">
                  Drag a `.fs` file here or click to browse
                </p>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  Open either your persistent profile data or one of your regular save files.
                  Everything is decrypted and edited locally in your browser.
                </p>
              </div>
            </div>
          </button>

          <Accordion type="single" collapsible className="rounded-xl border border-white/8 bg-black/10 px-4">
            <AccordionItem value="save-location" className="border-b-0">
              <AccordionTrigger className="py-4 text-sm font-medium text-foreground hover:no-underline">
                <div className="flex items-center gap-3">
                  <FolderSearch className="h-4 w-4 text-primary" />
                  <span>Where to find your save files</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm leading-6 text-muted-foreground">
                      Press <span className="font-medium text-foreground">Windows Key + R</span>,
                      paste this folder path, then press{' '}
                      <span className="font-medium text-foreground">Enter</span>.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-lg px-3 text-xs"
                      onClick={handleCopySavePath}
                    >
                      {pathCopied ? 'Copied' : 'Copy path'}
                    </Button>
                  </div>
                  <code className="block overflow-x-auto rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-xs text-primary md:text-sm">
                    {saveFolderPath}
                  </code>
                  <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                    <p>
                      You will find{' '}
                      <code className="font-medium text-foreground">
                        fairy engine PersistentData.fs
                      </code>{' '}
                      plus up to four save files named{' '}
                      <code className="font-medium text-foreground">fairy engine save_x.fs</code>.
                    </p>
                    <p>
                      There is also a{' '}
                      <code className="font-medium text-foreground">
                        fairy engine PersistentData_backup.fs
                      </code>{' '}
                      backup file used to help prevent data loss. It is recommended that you leave
                      that one alone.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="border-white/8 bg-[#17171b] text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open with file editing</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              FairySaveTool can ask your browser for permission to save directly back to the same
              file.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-muted-foreground">
            After you pick the file, your browser may ask for file access. If you allow it, this
            tab can save and refresh using the original file instead of downloading a new one.
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                setShowPermissionDialog(false);
                loadSampleData();
              }}
            >
              Open without editing
            </Button>
            <Button
              type="button"
              className="rounded-lg bg-emerald-500 text-black hover:bg-emerald-400"
              onClick={handleOpenWithAccess}
            >
              Grant permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
