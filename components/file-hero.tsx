'use client';

import { useState } from 'react';
import { Code, Download, Plus, RefreshCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useEditorStore } from '@/lib/store';
import {
  canTabDirectSave,
  canTabRefresh,
  getActiveTab,
  getFileStatusBadgeLabel,
  tabHasData,
  tabNeedsPermissionPrompt,
} from '@/lib/editor-tab';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileStatus, type EditorTab } from '@/lib/types';

const statusConfig: Record<FileStatus, string> = {
  [FileStatus.Empty]: 'border-white/8 bg-white/[0.03] text-muted-foreground',
  [FileStatus.Loaded]: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
  [FileStatus.Decrypted]: 'border-white/8 bg-white/[0.03] text-muted-foreground',
  [FileStatus.Modified]: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  [FileStatus.Ready]: 'border-primary/25 bg-primary/12 text-primary',
  [FileStatus.Error]: 'border-destructive/20 bg-destructive/10 text-destructive',
};

export function FileHero() {
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const {
    tabs,
    activeTabId,
    activateTab,
    newTab,
    closeTab,
    downloadFile,
    refreshActiveFile,
    setJsonMode,
  } = useEditorStore();

  const activeTab = getActiveTab(tabs, activeTabId);
  const hasData = tabHasData(activeTab);
  const isEmpty = !hasData;
  const canDirectSave = canTabDirectSave(activeTab);
  const canRefresh = canTabRefresh(activeTab);
  const needsPermissionPrompt = tabNeedsPermissionPrompt(activeTab);
  const stateBadgeLabel = getFileStatusBadgeLabel(activeTab?.fileStatus);
  const showStateBadge = Boolean(stateBadgeLabel);

  const title = activeTab?.fileName ?? activeTab?.title ?? 'New Tab';

  async function handleSaveClick() {
    if (!hasData) {
      return;
    }

    if (needsPermissionPrompt) {
      setShowPermissionDialog(true);
      return;
    }

    await downloadFile();
  }

  async function handleGrantPermission() {
    setShowPermissionDialog(false);
    await downloadFile();
  }

  function renderTab(tab: EditorTab) {
    const isActive = tab.id === activeTabId;
    return (
      <div
        key={tab.id}
        className={[
          'group relative mb-[3px] flex h-7 min-w-[180px] max-w-[240px] items-center gap-1 rounded-md border pl-3 pr-1.5 text-sm transition-all',
          isActive
            ? 'border-white/10 bg-white/[0.09] text-foreground'
            : 'border-transparent bg-transparent text-muted-foreground hover:border-white/10 hover:bg-white/[0.06] hover:text-foreground',
        ].join(' ')}
      >
        <button
          onClick={() => activateTab(tab.id)}
          onMouseDown={(event) => {
            if (event.button === 1) {
              event.preventDefault();
              closeTab(tab.id);
            }
          }}
          className="min-w-0 flex-1 truncate text-left text-[13px]"
          type="button"
        >
          <span className="truncate">{tab.title}</span>
        </button>
        <button
          onClick={(event) => {
            event.stopPropagation();
            closeTab(tab.id);
          }}
          className="rounded-full p-1 opacity-60 transition-opacity hover:bg-black/20 hover:opacity-100"
          type="button"
          aria-label={`Close ${tab.title}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <header className="overflow-hidden border-b border-white/6 bg-[#1c1c21]">
      <div className="border-b border-white/6 bg-[#232329] px-2 pt-[3px] md:px-3 md:pt-[3px]">
        <div className="scrollbar-none flex items-end gap-1 overflow-x-auto overflow-y-hidden">
          {tabs.map(renderTab)}
          <button
            onClick={newTab}
            type="button"
            aria-label="New tab"
            className="group mb-[3px] flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition-all hover:border-white/10 hover:bg-white/[0.06] hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!isEmpty ? (
        <div className="bg-[#17171b] px-5 py-4 md:px-7 md:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  FairySaveTool
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                      {title}
                    </h1>
                    {showStateBadge ? (
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusConfig[activeTab.fileStatus]}`}>
                        {stateBadgeLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-full items-center justify-start gap-3 lg:w-auto lg:justify-end">
              <div className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.035] px-3 py-2">
                <Switch
                  id="json-mode"
                  checked={activeTab.jsonMode}
                  onCheckedChange={setJsonMode}
                />
                <Label htmlFor="json-mode" className="cursor-pointer text-xs text-muted-foreground">
                  <Code className="h-3.5 w-3.5" />
                  JSON mode
                </Label>
              </div>

              <Button
                size="sm"
                onClick={() => void handleSaveClick()}
                disabled={!hasData}
                className="h-9 rounded-lg bg-primary px-3 text-primary-foreground hover:bg-primary/90"
              >
                <Download className="h-4 w-4" />
                {canDirectSave ? 'Save' : 'Export'}
              </Button>
              {canRefresh ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void refreshActiveFile()}
                  className="h-9 rounded-lg border-white/10 bg-black/20 hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="border-white/8 bg-[#17171b] text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allow direct file editing</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              FairySaveTool can save changes straight back to{' '}
              <span className="font-medium text-foreground">{title}</span> without downloading a
              new file each time. Brave will show its own file permission prompt next.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-muted-foreground">
            Granting permission lets this tab overwrite the same save file when you press
            <span className="mx-1 font-medium text-foreground">Save</span>.
            You can still deny it and keep using download export mode instead.
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => setShowPermissionDialog(false)}
            >
              Not now
            </Button>
            <Button
              type="button"
              className="rounded-lg bg-emerald-500 text-black hover:bg-emerald-400"
              onClick={() => void handleGrantPermission()}
            >
              Grant permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
