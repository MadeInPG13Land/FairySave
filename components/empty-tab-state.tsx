'use client';

import { useMemo, useState } from 'react';
import { FileUp, Lock, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function EmptyTabState() {
  const { loadSampleData } = useEditorStore();
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const supportsDirectAccess = useMemo(
    () => typeof window !== 'undefined' && 'showOpenFilePicker' in window,
    [],
  );

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

  return (
    <div className="flex h-full min-h-[32rem] items-center justify-center">
      <div className="w-full max-w-3xl rounded-2xl border border-white/8 bg-white/[0.025] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.18)] md:p-10">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04]">
              <img src="/icon.svg" alt="FairySaveTool" className="h-8 w-8" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary/80">
                FairySaveTool
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Open a save file
              </h1>
            </div>
          </div>

          <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            Drop in a Forsaken Frontiers `.fs` save to decrypt it locally, edit it with the guided
            tools, and export it back out when you are done.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleOpenClick} className="h-10 rounded-lg px-4">
              <FileUp className="h-4 w-4" />
              Open Save File
            </Button>
          </div>

          <div className="grid gap-3 pt-2 md:grid-cols-3">
            <div className="rounded-xl border border-white/8 bg-black/10 p-4">
              <FileUp className="h-4 w-4 text-primary" />
              <p className="mt-3 text-sm font-medium text-foreground">Load</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Import a save file directly from your machine.
              </p>
            </div>

            <div className="rounded-xl border border-white/8 bg-black/10 p-4">
              <Wand2 className="h-4 w-4 text-primary" />
              <p className="mt-3 text-sm font-medium text-foreground">Edit</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Adjust player or world values with the guided editor.
              </p>
            </div>

            <div className="rounded-xl border border-white/8 bg-black/10 p-4">
              <Lock className="h-4 w-4 text-primary" />
              <p className="mt-3 text-sm font-medium text-foreground">Save</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Re-encrypt the file locally before downloading it again.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="border-white/8 bg-[#17171b] text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open with file editing</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              FairySaveTool can ask Brave for permission to edit the original save file directly,
              so later saves can write back in place instead of downloading a new file every time.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-muted-foreground">
            After you pick the file, Brave may show a second permission prompt for file access.
            If you allow it, this tab can use direct save and future reload-from-disk features.
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
