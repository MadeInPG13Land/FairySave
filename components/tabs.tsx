'use client';

import { Braces, Globe2, Plus, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { closeWithConfirm, docChanges, useEditor, type SaveDoc } from '@/lib/store';
import { cn } from '@/lib/utils';

const KIND_ICON = { player: UserRound, world: Globe2, json: Braces, settings: SlidersHorizontal } as const;

/** "fairy engine save_3.fs" -> "save_3.fs" */
export function displayName(doc: Pick<SaveDoc, 'fileName'>) {
  return doc.fileName.replace(/^fairy engine /i, '');
}

/**
 * One tab per open save, above the page. The active tab shares the page's
 * background and runs straight into it; + opens more saves.
 */
export function TabStrip({ onOpenFile }: { onOpenFile: () => void }) {
  const docs = useEditor((state) => state.docs);
  const activeId = useEditor((state) => state.activeId);
  const activate = useEditor((state) => state.activate);

  return (
    // Sits after the app title, well clear of the page's rounded corner, so the active tab's curve lands on its straight top edge.
    <div className="flex h-11 min-w-0 items-end gap-1" role="tablist" aria-label="Open saves">
      {docs.map((doc) => (
        <Tab key={doc.id} doc={doc} active={doc.id === activeId} onSelect={() => activate(doc.id)} onClose={() => closeWithConfirm(doc.id)} />
      ))}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpenFile}
            aria-label="Open save"
            className="mb-1 flex size-7 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Open save · Ctrl O</TooltipContent>
      </Tooltip>
    </div>
  );
}

function Tab({ doc, active, onSelect, onClose }: { doc: SaveDoc; active: boolean; onSelect: () => void; onClose: () => void }) {
  const Icon = KIND_ICON[doc.kind];
  const changes = docChanges(doc);
  return (
    <div
      role="tab"
      aria-selected={active}
      tabIndex={0}
      title={doc.fileName}
      onClick={onSelect}
      onAuxClick={(event) => event.button === 1 && onClose()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn('app-tab group', active && 'app-tab--active')}
    >
      <Icon className={cn('size-3.5 shrink-0', active ? 'text-foreground' : 'text-subtle-foreground')} />
      <span className="truncate">{displayName(doc)}</span>
      {/* Unsaved dot, which turns into the close button on hover (like most editors). */}
      <span className="relative ml-1 flex size-5 shrink-0 items-center justify-center">
        {changes > 0 ? <span className="size-1.5 rounded-full bg-warning group-hover:hidden" aria-label="Unsaved changes" /> : null}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label={`Close ${doc.fileName}`}
          className={cn(
            'absolute inset-0 flex items-center justify-center rounded text-subtle-foreground hover:bg-surface-hover hover:text-foreground focus-visible:opacity-100',
            changes > 0 ? 'hidden group-hover:flex' : active ? 'flex' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <X className="size-3" />
        </button>
      </span>
    </div>
  );
}
